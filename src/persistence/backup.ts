import { z } from 'zod';
import { canonical, hash } from '../sim/determinism';
import { planIdentity } from '../sim/tutorial';
import { campaignSchema, validateCampaign } from './campaign';
import { emptyFence, fenceSchema, mergeFences, type ProgressFence } from './fence';
import { BACKUP_BYTES, parseBackupJSON } from './json';
import { preferencesSchema, type Preferences } from './preferences';
import { practiceSchema, validatePracticeArmy, type PracticeStore } from './practice';
import type { CampaignRepository } from './repository';
import { sequenceSchema } from './sequence';
const snapshotSchema = z.object({ campaign: campaignSchema, fence: fenceSchema }).strict();
const slotSchema = z
  .object({
    campaign: campaignSchema,
    fence: fenceSchema,
    previous: snapshotSchema.nullable(),
    practice: practiceSchema.nullable(),
    practiceSequence: sequenceSchema,
  })
  .strict();
const payloadSchema = z
  .object({
    format: z.literal('resonance-bastion-backup'),
    schema: z.literal(1),
    slots: z.array(slotSchema).min(1).max(3),
    preferences: preferencesSchema.nullable(),
  })
  .strict();
const envelopeSchema = payloadSchema
  .extend({ checksum: z.string().regex(/^[a-f0-9]{64}$/) })
  .strict();
export type SlotBackup = z.infer<typeof slotSchema>;
export type Backup = z.infer<typeof envelopeSchema>;
export async function validateSlotBackup(input: unknown): Promise<SlotBackup> {
  const slot = slotSchema.parse(input);
  validateCampaign(slot.campaign);
  if (slot.fence.lineage !== slot.campaign.lineage)
    throw new Error('Backup fence lineage mismatch');
  if (slot.previous) {
    validateCampaign(slot.previous.campaign);
    if (
      slot.previous.fence.lineage !== slot.previous.campaign.lineage ||
      slot.previous.campaign.slot !== slot.campaign.slot
    )
      throw new Error('Previous snapshot identity mismatch');
  }
  if (slot.practice) {
    const cp = slot.practice,
      c = slot.campaign;
    if (
      cp.slot !== c.slot ||
      cp.lineage !== c.lineage ||
      cp.revision !== c.revision ||
      BigInt(cp.sequence) > BigInt(slot.practiceSequence)
    )
      throw new Error('Practice checkpoint base/sequence mismatch');
    validatePracticeArmy(c, cp.army);
    if (cp.identity !== (await planIdentity(cp.plan, cp.army)))
      throw new Error('Practice checksum mismatch');
  }
  if (new TextEncoder().encode(canonical(slot)).byteLength > 8 * 1024 * 1024)
    throw new Error('Indispensable slot exceeds 8 MiB');
  return slot;
}
export async function createBackup(
  slots: SlotBackup[],
  preferences: Preferences | null,
): Promise<Backup> {
  const payload = payloadSchema.parse({
    format: 'resonance-bastion-backup',
    schema: 1,
    slots,
    preferences,
  });
  const ids = new Set<string>(),
    positions = new Set<number>();
  for (const slot of payload.slots) {
    await validateSlotBackup(slot);
    if (ids.has(slot.campaign.lineage) || positions.has(slot.campaign.slot))
      throw new Error('Duplicate backup campaign or slot');
    ids.add(slot.campaign.lineage);
    positions.add(slot.campaign.slot);
  }
  const backup = { ...payload, checksum: await hash(payload) };
  if (new TextEncoder().encode(canonical(backup)).byteLength > BACKUP_BYTES)
    throw new Error('Export exceeds 32 MiB; export individual slots');
  return backup;
}
export async function readBackup(text: string): Promise<{ backup: Backup; legacy: boolean }> {
  const raw = parseBackupJSON(text);
  const legacySchema = z
    .object({ format: z.literal('resonance-foundation-backup-v1'), campaign: campaignSchema })
    .strict();
  const legacy = legacySchema.safeParse(raw);
  if (legacy.success) {
    const campaign = validateCampaign(legacy.data.campaign);
    return {
      legacy: true,
      backup: await createBackup(
        [
          {
            campaign,
            fence: emptyFence(campaign.lineage),
            previous: null,
            practice: null,
            practiceSequence: '0',
          },
        ],
        null,
      ),
    };
  }
  const backup = envelopeSchema.parse(raw);
  // Verify the original supplied values before canonical UUID normalization.
  const { checksum, ...payload } = raw as Record<string, unknown>;
  if ((await hash(payload)) !== checksum)
    throw new Error('Backup checksum failed; no data changed');
  const normalized = await createBackup(backup.slots, backup.preferences);
  return { backup: normalized, legacy: false };
}
interface RawSlot {
  campaign: unknown;
  previous: unknown;
  practice: unknown;
  sequence: unknown;
}
export interface RecoveryView {
  slots: RawSlot[];
  fences: Record<string, ProgressFence>;
  unknownKeys: string[];
}
export interface ImportSelection {
  source: number;
  destination: number;
}
const knownMetadataKey = (key: IDBValidKey): boolean =>
  typeof key === 'string' &&
  (['preferences.v1', 'probe', 'lastOpened'].includes(key) ||
    /^(practice\.(slot|sequence)\.[0-2]|fence\.[0-9a-fA-F-]{36})$/.test(key));
export class BackupStore {
  private busy = false;
  constructor(
    readonly repo: CampaignRepository,
    readonly practice: PracticeStore,
  ) {}
  async inspect(): Promise<RecoveryView> {
    if (!this.repo.database) {
      const slots: RawSlot[] = [];
      for (let slot = 0; slot < 3; slot++)
        slots.push({
          campaign: this.repo.memory.get(slot),
          previous: this.repo.memoryPrevious.get(slot),
          practice: this.practice.memory.get(slot),
          sequence: this.practice.memorySequence.get(slot),
        });
      return structuredClone({
        slots,
        fences: Object.fromEntries(this.repo.memoryFences),
        unknownKeys: [],
      });
    }
    return this.repo.database.transaction<RecoveryView>(
      ['campaigns', 'previous', 'meta'],
      'readonly',
      (tx, done) => {
        const slots: RawSlot[] = Array.from({ length: 3 }, () => ({
            campaign: undefined,
            previous: undefined,
            practice: undefined,
            sequence: undefined,
          })),
          fences: Record<string, ProgressFence> = Object.create(null),
          unknownKeys: string[] = [];
        let pending = 13;
        const complete = () => {
          if (--pending === 0) done({ slots, fences, unknownKeys });
        };
        for (let i = 0; i < 3; i++)
          for (const [store, key, field] of [
            ['campaigns', i, 'campaign'],
            ['previous', i, 'previous'],
            ['meta', `practice.slot.${i}`, 'practice'],
            ['meta', `practice.sequence.${i}`, 'sequence'],
          ] as const) {
            const r = tx.objectStore(store).get(key);
            r.onsuccess = () => {
              const s = slots[i];
              if (s) s[field] = r.result;
              complete();
            };
          }
        const r = tx.objectStore('meta').openCursor();
        r.onsuccess = () => {
          const cur = r.result;
          if (cur) {
            if (!knownMetadataKey(cur.key)) unknownKeys.push(String(cur.key));
            if (typeof cur.key === 'string' && cur.key.startsWith('fence.'))
              fences[cur.key.slice(6)] = cur.value;
            cur.continue();
          } else complete();
        };
      },
    );
  }
  async export(indices: number[], preferences: Preferences | null): Promise<Backup> {
    const view = await this.inspect(),
      slots: SlotBackup[] = [];
    if (view.unknownKeys.length)
      throw new Error(
        'Unsupported retained logical state; use its compatible application version before backup or recovery',
      );
    for (const i of indices) {
      const raw = view.slots[i];
      if (!raw || raw.campaign === undefined) throw new Error('Choose an occupied slot');
      const campaign = validateCampaign(raw.campaign),
        previous = raw.previous === undefined ? null : validateCampaign(raw.previous);
      slots.push(
        await validateSlotBackup({
          campaign,
          fence: view.fences[campaign.lineage] ?? emptyFence(campaign.lineage),
          previous: previous
            ? {
                campaign: previous,
                fence: view.fences[previous.lineage] ?? emptyFence(previous.lineage),
              }
            : null,
          practice: raw.practice ?? null,
          practiceSequence: raw.sequence ?? '0',
        }),
      );
    }
    return createBackup(slots, preferences);
  }
  async replace(
    backup: Backup,
    selection: ImportSelection[],
    expected: RecoveryView,
    applyPreferences = false,
  ): Promise<void> {
    backup = (await readBackup(canonical(backup))).backup;
    if (!selection.length) throw new Error('Select at least one destination');
    const destinations = new Set<number>(),
      sources = new Set<number>(),
      next = new Map<number, SlotBackup>();
    for (const item of selection) {
      const source = backup.slots[item.source];
      if (
        !source ||
        !Number.isInteger(item.destination) ||
        item.destination < 0 ||
        item.destination > 2 ||
        destinations.has(item.destination) ||
        sources.has(item.source)
      )
        throw new Error('Duplicate or invalid import destination/source');
      destinations.add(item.destination);
      sources.add(item.source);
      const old = expected.slots[item.destination];
      if (!old) throw new Error('Missing destination snapshot');
      const current = old.campaign === undefined ? undefined : validateCampaign(old.campaign);
      if (old.practice !== undefined && canonical(old.practice) !== canonical(source.practice))
        throw new Error('Resolve the retained practice before importing a conflicting checkpoint');
      const revision = Math.max(current?.revision ?? 0, source.campaign.revision) + 1;
      const campaign = validateCampaign({ ...source.campaign, slot: item.destination, revision });
      const practice = source.practice
        ? practiceSchema.parse({ ...source.practice, slot: item.destination, revision })
        : null;
      const seq = sequenceSchema.parse(old.sequence ?? '0');
      const local = expected.fences[campaign.lineage] ?? emptyFence(campaign.lineage);
      next.set(
        item.destination,
        await validateSlotBackup({
          ...source,
          campaign,
          practice,
          previous: current
            ? {
                campaign: current,
                fence: expected.fences[current.lineage] ?? emptyFence(current.lineage),
              }
            : source.previous
              ? {
                  campaign: { ...source.previous.campaign, slot: item.destination },
                  fence: source.previous.fence,
                }
              : null,
          fence: mergeFences(local, source.fence),
          practiceSequence:
            BigInt(seq) > BigInt(source.practiceSequence) ? seq : source.practiceSequence,
        }),
      );
    }
    const lineages = new Set<string>();
    for (let i = 0; i < 3; i++) {
      const c =
        next.get(i)?.campaign ??
        (expected.slots[i]?.campaign === undefined
          ? undefined
          : validateCampaign(expected.slots[i]?.campaign));
      if (c) {
        if (lineages.has(c.lineage))
          throw new Error(
            'The same campaign cannot occupy multiple slots; select its existing destination',
          );
        lineages.add(c.lineage);
      }
    }
    const combinedFences = new Map<string, ProgressFence>();
    const retain = (f: ProgressFence) =>
      combinedFences.set(
        f.lineage,
        mergeFences(
          combinedFences.get(f.lineage) ?? expected.fences[f.lineage] ?? emptyFence(f.lineage),
          f,
        ),
      );
    for (const value of next.values()) {
      retain(value.fence);
      if (value.previous) retain(value.previous.fence);
    }
    for (const item of selection) {
      const p = backup.slots[item.source]?.previous;
      if (p) retain(p.fence);
    }
    await this.write(
      expected,
      (tx, done) => {
        for (const [i, value] of next) {
          if (value.previous) tx.objectStore('previous').put(value.previous.campaign, i);
          else tx.objectStore('previous').delete(i);
          tx.objectStore('campaigns').put(value.campaign, i);
          tx.objectStore('meta').put(value.practiceSequence, `practice.sequence.${i}`);
          if (value.practice) tx.objectStore('meta').put(value.practice, `practice.slot.${i}`);
          else tx.objectStore('meta').delete(`practice.slot.${i}`);
        }
        for (const [lineage, fence] of combinedFences)
          tx.objectStore('meta').put(fence, `fence.${lineage}`);
        if (applyPreferences && backup.preferences)
          tx.objectStore('meta').put(backup.preferences, 'preferences.v1');
        done();
      },
      () => {
        for (const [lineage, fence] of combinedFences)
          this.repo.memoryFences.set(lineage, structuredClone(fence));
        for (const [i, value] of next) {
          if (value.previous)
            this.repo.memoryPrevious.set(i, structuredClone(value.previous.campaign));
          else this.repo.memoryPrevious.delete(i);
          this.repo.memory.set(i, structuredClone(value.campaign));
          this.practice.memorySequence.set(i, value.practiceSequence);
          if (value.practice) {
            this.practice.memory.set(i, value.practice);
            this.repo.practiceSlots.add(i);
          } else {
            this.practice.memory.delete(i);
            this.repo.practiceSlots.delete(i);
          }
        }
      },
    );
  }
  async restorePrevious(index: number, expected: RecoveryView): Promise<void> {
    const old = expected.slots[index];
    if (!old || old.previous === undefined) throw new Error('No previous snapshot available');
    if (old.practice !== undefined) throw new Error('Resolve retained practice before rollback');
    const campaign = validateCampaign(old.previous);
    const backup = await createBackup(
      [
        {
          campaign,
          fence: expected.fences[campaign.lineage] ?? emptyFence(campaign.lineage),
          previous: null,
          practice: null,
          practiceSequence: sequenceSchema.parse(old.sequence ?? '0'),
        },
      ],
      null,
    );
    await this.replace(backup, [{ source: 0, destination: index }], expected);
  }
  async deleteSlot(index: number, expected: RecoveryView): Promise<void> {
    const old = expected.slots[index];
    if (!old || old.campaign === undefined) throw new Error('No campaign to delete');
    if (old.practice !== undefined) throw new Error('Resolve retained practice before deleting');
    const c = validateCampaign(old.campaign);
    await this.write(
      expected,
      (tx, done) => {
        tx.objectStore('campaigns').delete(index);
        tx.objectStore('previous').delete(index);
        tx.objectStore('meta').delete(`fence.${c.lineage}`);
        const r = tx.objectStore('meta').get('lastOpened');
        r.onsuccess = () => {
          if (r.result === index) tx.objectStore('meta').delete('lastOpened');
          done();
        };
      },
      () => {
        this.repo.memory.delete(index);
        this.repo.memoryPrevious.delete(index);
        this.repo.memoryFences.delete(c.lineage);
      },
    );
  }
  private async write(
    expected: RecoveryView,
    work: (tx: IDBTransaction, done: () => void, guard: (fn: () => void) => () => void) => void,
    memory: () => void,
  ): Promise<void> {
    if (this.busy) throw new Error('Recovery write already in progress');
    if (expected.unknownKeys.length)
      throw new Error(
        'Unsupported retained logical state preserved; use its compatible application version',
      );
    const writer = this.repo.writer;
    if (!writer) throw new Error('Read Only: another tab owns editing');
    this.busy = true;
    try {
      if (!this.repo.database) {
        if (canonical(await this.inspect()) !== canonical(expected))
          throw new Error('Campaign changed; review again');
        memory();
        return;
      }
      let failure: unknown;
      try {
        await this.repo.database.transaction<void>(
          ['campaigns', 'previous', 'meta', 'writer'],
          'readwrite',
          (tx, done) => {
            const guard = (fn: () => void) => () => {
              try {
                fn();
              } catch (e) {
                failure = e;
                tx.abort();
              }
            };
            const r = tx.objectStore('writer').get('active');
            r.onsuccess = guard(() => {
              const w = r.result as { tabID: string; generation: number } | undefined;
              if (w?.tabID !== this.repo.tabID || w.generation !== writer.generation) {
                this.repo.writer = undefined;
                throw new Error('Read Only: writer changed');
              }
              let pending = 13;
              const check = (actual: unknown, wanted: unknown) => {
                if (canonical(actual ?? null) !== canonical(wanted ?? null))
                  throw new Error('Campaign or recovery data changed; review again');
                if (--pending === 0) work(tx, () => done(undefined), guard);
              };
              for (let i = 0; i < 3; i++)
                for (const [store, key, field] of [
                  ['campaigns', i, 'campaign'],
                  ['previous', i, 'previous'],
                  ['meta', `practice.slot.${i}`, 'practice'],
                  ['meta', `practice.sequence.${i}`, 'sequence'],
                ] as const) {
                  const q = tx.objectStore(store).get(key);
                  q.onsuccess = guard(() => check(q.result, expected.slots[i]?.[field]));
                }
              const fences: Record<string, ProgressFence> = Object.create(null),
                unknownKeys: string[] = [],
                q = tx.objectStore('meta').openCursor();
              q.onsuccess = guard(() => {
                const cur = q.result;
                if (cur) {
                  if (!knownMetadataKey(cur.key)) unknownKeys.push(String(cur.key));
                  if (typeof cur.key === 'string' && cur.key.startsWith('fence.'))
                    fences[cur.key.slice(6)] = cur.value;
                  cur.continue();
                } else
                  check(
                    { fences, unknownKeys },
                    { fences: expected.fences, unknownKeys: expected.unknownKeys },
                  );
              });
            });
          },
        );
      } catch (e) {
        throw failure ?? e;
      }
    } finally {
      this.busy = false;
    }
  }
}
