import { z } from 'zod';
import type { CampaignRepository } from './repository';
import { validateCampaign, maximumBody, type Campaign, type ProgressionCampaign } from './campaign';
import { foundation, type ContentID } from '../data/foundation';
import { combat } from '../data/combat';
import { sequenceSchema } from './sequence';
import {
  frozenCampaignSchema,
  freezeCampaign,
  profiledPracticePlanSchema,
  profiledPracticePlan,
} from '../sim/campaign-start';
import { canonical, hash } from '../sim/determinism';
import { receiptsSchema } from './run-journal';
import { runReceiptsKey } from './run-keys';
import {
  tutorialSchema,
  startSchema,
  planIdentity,
  tutorialPlan,
  type StartAsset,
} from '../sim/tutorial';
const terminalSchema = z
  .object({
    state: z.enum(['Victory', 'Defeat']),
    tick: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    reason: z.string().max(300),
    hash: z.string().regex(/^[a-f0-9]{64}$/),
    kills: z.number().int().min(0).max(24),
    tp: z.number().int().min(0).max(30),
    coreHP: z.number().int().nonnegative().max(10240000),
  })
  .strict();
const legacyPracticeSchema = z
  .object({
    schema: z.literal(1),
    kind: z.literal('tutorial-practice'),
    slot: z.number().int().min(0).max(2),
    lineage: z.uuid().transform((id) => id.toLowerCase()),
    revision: z.number().int().nonnegative(),
    sequence: sequenceSchema,
    plan: tutorialSchema,
    army: z.array(startSchema).min(1).max(120),
    identity: z.string().regex(/^[a-f0-9]{64}$/),
    terminal: terminalSchema.nullable(),
  })
  .strict();
const profiledPracticeSchema = legacyPracticeSchema.extend({
  schema: z.literal(2),
  plan: profiledPracticePlanSchema,
  frozen: frozenCampaignSchema,
});
export const practiceSchema = z.discriminatedUnion('schema', [
  legacyPracticeSchema,
  profiledPracticeSchema,
]);
export type PracticeCheckpoint = z.infer<typeof practiceSchema>;
export const guidedPositions: [ContentID, number, number][] = [
  ['friendly.sentry', 24, 26],
  ['friendly.sentry', 24, 32],
  ['friendly.rifle_squad', 22, 28],
  ['warden.bulwark', 29, 33],
  ['friendly.repair_node', 25, 34],
  ['friendly.standard_barricade', 22, 26],
  ['friendly.proximity_mine', 18, 24],
];
export function practiceArmy(campaign: Campaign, guided = true): StartAsset[] {
  if (campaign.warden !== 'warden.bulwark' || campaign.doctrine !== 'Bastion')
    throw new Error(
      'This Gate2 tutorial slice supports selected Bulwark and Bastion. Other combinations are Gate4; campaign choice is preserved.',
    );
  const clone = structuredClone(campaign),
    used = new Set<string>();
  if (clone.schema === 2) for (const a of clone.assets) a.hp = maximumBody(a);
  if (guided) {
    for (const a of clone.assets) a.placement = null;
    for (const [type, x, y] of guidedPositions) {
      const a = clone.assets
        .filter((a) => a.type === type && !used.has(a.id))
        .sort((a, b) => (a.id < b.id ? -1 : 1))[0];
      if (!a) throw new Error(`Required owned tutorial asset missing: ${type}`);
      used.add(a.id);
      a.placement = { x, y, rotation: 0 };
    }
  }
  validateCampaign(clone);
  const army: StartAsset[] = clone.assets
    .filter((a) => a.placement)
    .map((a) => {
      if (!(a.type in combat)) throw new Error(`Combat is not implemented for deployed ${a.type}`);
      const p = a.placement,
        d = foundation[a.type];
      if (!p) throw new Error('Missing deployment');
      return startSchema.parse({
        uuid: a.id,
        heading: p.rotation * 16384,
        type: a.type,
        x: p.x,
        y: p.y,
        width: p.rotation % 2 ? d.height : d.width,
        height: p.rotation % 2 ? d.width : d.height,
        hp: a.hp,
      });
    });
  if (!army.some((a) => a.type === campaign.warden))
    throw new Error(
      'Deploy the selected Bulwark before using the current fortress. Guided clone is available.',
    );
  return army;
}
export function validatePracticeArmy(c: Campaign, army: StartAsset[]): void {
  const clone = structuredClone(c);
  for (const a of clone.assets) a.placement = null;
  const ids = new Set<string>();
  for (const raw of army) {
    const a = startSchema.parse(raw),
      owned = clone.assets.find((o) => o.id.toLowerCase() === a.uuid);
    if (
      ids.has(a.uuid) ||
      !owned ||
      owned.type !== a.type ||
      (c.schema === 2 ? maximumBody(owned) : owned.hp) !== a.hp ||
      a.heading % 16384
    )
      throw new Error('Practice army ownership, health or heading mismatch');
    ids.add(a.uuid);
    if (clone.schema === 2) owned.hp = a.hp;
    const rotation = a.heading / 16384,
      d = foundation[owned.type];
    if (
      a.width !== (rotation % 2 ? d.height : d.width) ||
      a.height !== (rotation % 2 ? d.width : d.height)
    )
      throw new Error('Practice footprint mismatch');
    owned.placement = { x: a.x, y: a.y, rotation: rotation as 0 | 1 | 2 | 3 };
  }
  validateCampaign(clone);
  if (
    c.warden !== 'warden.bulwark' ||
    c.doctrine !== 'Bastion' ||
    !army.some((a) => a.type === c.warden)
  )
    throw new Error('Tutorial requires the selected Bulwark / Bastion');
}
function freezePractice(c: ProgressionCampaign, army: StartAsset[]) {
  validatePracticeArmy(c, army);
  const clone = structuredClone(c);
  clone.coreHP = 10000 * 1024;
  for (const a of clone.assets) {
    a.placement = null;
    a.hp = maximumBody(a);
    if (a.permanentCharges !== null) a.permanentCharges = 1;
  }
  for (const a of army) {
    const owned = clone.assets.find((o) => o.id === a.uuid);
    if (!owned) throw new Error('Practice owned identity missing');
    owned.placement = { x: a.x, y: a.y, rotation: (a.heading / 16384) as 0 | 1 | 2 | 3 };
  }
  return freezeCampaign(clone);
}
export async function practiceIdentity(cp: PracticeCheckpoint): Promise<string> {
  return cp.schema === 1
    ? planIdentity(cp.plan, cp.army)
    : hash({ plan: cp.plan, army: cp.army, frozen: cp.frozen });
}
export async function validatePracticeCheckpoint(
  c: Campaign,
  cp: PracticeCheckpoint,
): Promise<void> {
  validatePracticeArmy(c, cp.army);
  if (cp.schema === 2) {
    if (c.schema !== 2 || canonical(cp.frozen) !== canonical(freezePractice(c, cp.army)))
      throw new Error('Practice frozen clone mismatch');
  } else if (c.schema !== 1)
    throw new Error('Legacy practice cannot silently downgrade progression');
  if ((await practiceIdentity(cp)) !== cp.identity)
    throw new Error('Practice identity failed; retained data preserved');
}
export class PracticeStore {
  readonly memory = new Map<number, PracticeCheckpoint>();
  readonly memorySequence = new Map<number, string>();
  constructor(readonly repository: CampaignRepository) {}
  async read(c: Campaign): Promise<PracticeCheckpoint | undefined> {
    const raw = this.repository.database
      ? await this.repository.database.read<unknown>('meta', `practice.slot.${c.slot}`)
      : this.memory.get(c.slot);
    if (raw === undefined) return;
    const valid = practiceSchema.parse(raw);
    if (valid.slot !== c.slot || valid.lineage !== c.lineage || valid.revision !== c.revision)
      throw new Error(
        'Retained practice belongs to a replaced campaign; export/recovery required before a new practice checkpoint.',
      );
    await validatePracticeCheckpoint(c, valid);
    return valid;
  }
  private async transaction<T>(
    c: Campaign,
    work: (
      store: IDBObjectStore,
      result: (v: T) => void,
      guard: (fn: () => void) => () => void,
    ) => void,
  ): Promise<T> {
    const repo = this.repository,
      writer = repo.writer;
    if (!writer) throw new Error('Read Only: another tab owns editing');
    if (!repo.database) throw new Error('Explicit temporary practice required');
    let failure: unknown;
    try {
      return await repo.database.transaction<T>(
        ['meta', 'writer', 'campaigns'],
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
            if (w?.tabID !== repo.tabID || w.generation !== writer.generation) {
              repo.writer = undefined;
              throw new Error('Read Only: writer changed');
            }
            const saved = tx.objectStore('campaigns').get(c.slot);
            saved.onsuccess = guard(() => {
              const before = saved.result as Campaign | undefined;
              if (before?.lineage.toLowerCase() !== c.lineage || before.revision !== c.revision)
                throw new Error('Campaign changed; reload before retry');
              const run = tx.objectStore('meta').get(`run.slot.${c.slot}`);
              run.onsuccess = guard(() => {
                if (run.result !== undefined)
                  throw new Error('Resolve retained campaign run before practice');
                const receipts = tx.objectStore('meta').get(runReceiptsKey(c.slot));
                receipts.onsuccess = guard(() => {
                  if (
                    receipts.result !== undefined &&
                    receiptsSchema.parse(receipts.result).unpresented
                  )
                    throw new Error('Acknowledge committed Results before practice');
                  work(tx.objectStore('meta'), done, guard);
                });
              });
            });
          });
        },
      );
    } catch (e) {
      throw failure ?? e;
    }
  }
  async start(c: Campaign, army: StartAsset[]): Promise<PracticeCheckpoint> {
    validatePracticeArmy(c, army);
    const plan = c.schema === 2 ? profiledPracticePlan() : tutorialPlan(),
      base = {
        schema: c.schema === 2 ? (2 as const) : (1 as const),
        kind: 'tutorial-practice' as const,
        slot: c.slot,
        lineage: c.lineage,
        revision: c.revision,
        plan,
        army,
        identity: '',
        terminal: null,
        ...(c.schema === 2 ? { frozen: freezePractice(c, army) } : {}),
      };
    base.identity =
      c.schema === 2
        ? await hash({ plan, army, frozen: base.frozen })
        : await planIdentity(tutorialSchema.parse(plan), army);
    if (!this.repository.database) {
      if (!this.repository.writer) throw new Error('Read Only');
      if (this.repository.activeRunSlots.has(c.slot))
        throw new Error('Resolve retained campaign run before practice');
      if (this.repository.unpresentedResultSlots.has(c.slot))
        throw new Error('Acknowledge committed Results before practice');
      if (this.memory.has(c.slot))
        throw new Error('Existing practice must be restarted or discarded');
      const sequence = String(BigInt(this.memorySequence.get(c.slot) ?? '0') + 1n),
        checkpoint = practiceSchema.parse({ ...base, sequence });
      this.memorySequence.set(c.slot, sequence);
      this.memory.set(c.slot, checkpoint);
      this.repository.practiceSlots.add(c.slot);
      return structuredClone(checkpoint);
    }
    return this.transaction(c, (store, done, guard) => {
      const current = store.get(`practice.slot.${c.slot}`);
      current.onsuccess = guard(() => {
        if (current.result !== undefined)
          throw new Error('Existing practice checkpoint must be resolved');
        const counter = store.get(`practice.sequence.${c.slot}`);
        counter.onsuccess = guard(() => {
          const old = sequenceSchema.parse(counter.result ?? '0'),
            sequence = String(BigInt(old) + 1n),
            checkpoint = practiceSchema.parse({ ...base, sequence });
          if (new TextEncoder().encode(JSON.stringify(checkpoint)).length > 1048576)
            throw new Error('Checkpoint exceeds 1MiB');
          store.put(sequence, `practice.sequence.${c.slot}`);
          store.put(checkpoint, `practice.slot.${c.slot}`);
          done(checkpoint);
        });
      });
    });
  }
  async terminal(
    c: Campaign,
    checkpoint: PracticeCheckpoint,
    result: z.infer<typeof terminalSchema>,
  ): Promise<PracticeCheckpoint> {
    const next = practiceSchema.parse({ ...checkpoint, terminal: result });
    if (!this.repository.database) {
      const current = this.memory.get(c.slot);
      if (!this.repository.writer || current?.sequence !== checkpoint.sequence)
        throw new Error('Practice changed');
      if (current.terminal && current.terminal.hash !== result.hash)
        throw new Error('Terminal identity mismatch');
      this.memory.set(c.slot, next);
      return next;
    }
    return this.transaction(c, (store, done, guard) => {
      const request = store.get(`practice.slot.${c.slot}`);
      request.onsuccess = guard(() => {
        const current = practiceSchema.parse(request.result);
        if (current.sequence !== checkpoint.sequence || current.identity !== checkpoint.identity)
          throw new Error('Practice changed');
        if (current.terminal && current.terminal.hash !== result.hash)
          throw new Error('Terminal identity mismatch');
        store.put(next, `practice.slot.${c.slot}`);
        done(next);
      });
    });
  }
  async discard(c: Campaign, checkpoint: PracticeCheckpoint): Promise<void> {
    if (!this.repository.database) {
      if (!this.repository.writer) throw new Error('Read Only');
      if (this.memory.get(c.slot)?.sequence !== checkpoint.sequence)
        throw new Error('Practice changed');
      this.memory.delete(c.slot);
      this.repository.practiceSlots.delete(c.slot);
      return;
    }
    await this.transaction(c, (store, done, guard) => {
      const r = store.get(`practice.slot.${c.slot}`);
      r.onsuccess = guard(() => {
        const current = practiceSchema.parse(r.result);
        if (current.sequence !== checkpoint.sequence) throw new Error('Practice changed');
        store.delete(`practice.slot.${c.slot}`);
        done(undefined);
      });
    });
  }
}
