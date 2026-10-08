/** Blueprint §19A transaction boundary. The gameplay-specific compiler/result
 * adapter is required: this store does not itself authorize campaign payouts.
 * No shipped UI calls it until the full body/stock/XP adapter is implemented.
 */
import { z } from 'zod';
import { canonical, hash } from '../sim/determinism';
import { validateCampaign, campaignSchema, type Campaign } from './campaign';
import { emptyFence, fenceSchema, type ProgressFence } from './fence';
import { parseBackupJSON } from './json';
import type { CampaignRepository } from './repository';
import { sequenceSchema } from './sequence';
import { runStateKey as key, runReceiptsKey as receiptsKey } from './run-keys';
export { sequenceSchema } from './sequence';
const logicalJSON = z.json().transform((value): unknown => value);
const digest = z.string().regex(/^[a-f0-9]{64}$/);
const runIDSchema = z
  .object({ lineage: z.uuid().transform((s) => s.toLowerCase()), sequence: sequenceSchema })
  .strict();
const checkpointSchema = z
  .object({
    schema: z.literal(1),
    kind: z.literal('ordinary-run'),
    rulesID: z.string().regex(/^[a-z0-9.-]{1,100}$/),
    runID: runIDSchema,
    slot: z.number().int().min(0).max(2),
    baseRevision: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    base: campaignSchema,
    baseHash: digest,
    planHash: digest,
    plan: logicalJSON,
    frozen: logicalJSON,
    fence: fenceSchema,
    checksum: digest,
  })
  .strict();
const terminalSchema = z
  .object({
    terminalTick: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
    outcome: z.enum(['Victory', 'Defeat']),
    endBodyAndStock: logicalJSON,
    aggregates: logicalJSON,
    rewardOriginBuckets: logicalJSON,
  })
  .strict();
const pendingSchema = terminalSchema
  .extend({
    schema: z.literal(1),
    runID: runIDSchema,
    baseRevision: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    planHash: digest,
    economyPolicyID: z.literal('economy.duration_wave_v1'),
    after: campaignSchema,
    rewards: logicalJSON,
    claims: fenceSchema,
    checksum: digest,
  })
  .strict();
const receiptSchema = z
  .object({
    schema: z.literal(1),
    runID: runIDSchema,
    planHash: digest,
    baseRevision: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    resultRevision: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    outcome: z.enum(['Victory', 'Defeat']),
    terminalTick: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
    pendingChecksum: digest,
    rewards: logicalJSON,
    checksum: digest,
  })
  .strict();
export const stateSchema = z
  .object({ checkpoint: checkpointSchema, pending: pendingSchema.nullable() })
  .strict();
const memoryJournals = new WeakMap<
  CampaignRepository,
  { states: Map<number, RunState>; receipts: Map<number, ReceiptState> }
>();
export const receiptsSchema = z
  .object({ receipts: z.array(receiptSchema).max(16), unpresented: runIDSchema.nullable() })
  .strict();
export type RunCheckpoint = z.infer<typeof checkpointSchema>;
export type PendingResult = z.infer<typeof pendingSchema>;
export type RunReceipt = z.infer<typeof receiptSchema>;
export type TerminalInput = z.infer<typeof terminalSchema>;
export type RunState = z.infer<typeof stateSchema>;
export type ReceiptState = z.infer<typeof receiptsSchema>;
/** Pure deterministic adapter. Must validate compiled allocations, frozen stats,
 * terminal body/stock, contribution and policy, and derive every resulting field.
 * It cannot await or write storage. Test fixtures are not gameplay adapters.
 */
export interface RunRules {
  readonly id: string;
  validateStart(base: Campaign, plan: unknown, frozen: unknown, fence: ProgressFence): void;
  derive(
    checkpoint: RunCheckpoint,
    terminal: TerminalInput,
  ): { after: Campaign; rewards: unknown; claims: ProgressFence };
}
interface View {
  campaign: unknown;
  previous: unknown;
  state: unknown;
  receipts: unknown;
  fence: unknown;
  practice: unknown;
}
const same = (a: unknown, b: unknown) => canonical(a ?? null) === canonical(b ?? null);
const terminalOf = (v: TerminalInput): TerminalInput => ({
  terminalTick: v.terminalTick,
  outcome: v.outcome,
  endBodyAndStock: v.endBodyAndStock,
  aggregates: v.aggregates,
  rewardOriginBuckets: v.rewardOriginBuckets,
});
const sameID = (a: RunCheckpoint['runID'], b: RunCheckpoint['runID']) => same(a, b);
const boundedClone = <T>(input: T, max: number): T => {
  const text = canonical(input);
  if (new TextEncoder().encode(text).byteLength > max)
    throw new Error('Run logical state exceeds byte budget');
  return parseBackupJSON(text) as T;
};
async function verifyChecksum<T extends { checksum: string }>(v: T): Promise<void> {
  const { checksum, ...payload } = v;
  if ((await hash(payload)) !== checksum)
    throw new Error('Run checksum mismatch; retained state preserved');
}
async function seal<T extends object>(v: T): Promise<T & { checksum: string }> {
  return { ...v, checksum: await hash(v) };
}
export class RunJournalStore {
  private busy = false;
  readonly memory: Map<number, RunState>;
  readonly memoryReceipts: Map<number, ReceiptState>;
  constructor(
    readonly repo: CampaignRepository,
    readonly rules: RunRules,
  ) {
    let retained = memoryJournals.get(repo);
    if (!retained) {
      retained = { states: new Map(), receipts: new Map() };
      memoryJournals.set(repo, retained);
    }
    this.memory = retained.states;
    this.memoryReceipts = retained.receipts;
  }
  private async view(slot: number): Promise<View> {
    if (!this.repo.database)
      return structuredClone({
        campaign: this.repo.memory.get(slot),
        previous: this.repo.memoryPrevious.get(slot),
        state: this.memory.get(slot),
        receipts: this.memoryReceipts.get(slot),
        fence: this.repo.memoryFences.get(this.repo.memory.get(slot)?.lineage ?? ''),
        practice: this.repo.practiceSlots.has(slot) ? true : undefined,
      });
    return this.repo.database.transaction<View>(
      ['campaigns', 'previous', 'meta'],
      'readonly',
      (tx, done) => {
        const values: View = {
          campaign: undefined,
          previous: undefined,
          state: undefined,
          receipts: undefined,
          fence: undefined,
          practice: undefined,
        };
        const c = tx.objectStore('campaigns').get(slot);
        c.onsuccess = () => {
          values.campaign = c.result;
          const lineage = c.result?.lineage;
          let pending = 5;
          for (const [field, k] of [
            ['previous', slot],
            ['state', key(slot)],
            ['receipts', receiptsKey(slot)],
            ['fence', `fence.${lineage}`],
            ['practice', `practice.slot.${slot}`],
          ] as const) {
            const r = tx.objectStore(field === 'previous' ? 'previous' : 'meta').get(k);
            r.onsuccess = () => {
              values[field] = r.result;
              if (--pending === 0) done(values);
            };
          }
        };
      },
    );
  }
  private async validateCheckpoint(raw: unknown): Promise<RunCheckpoint> {
    const cp = checkpointSchema.parse(boundedClone(raw, 8 * 1048576));
    await verifyChecksum(cp);
    validateCampaign(cp.base);
    if (cp.rulesID !== this.rules.id)
      throw new Error('Unsupported result adapter; retained checkpoint preserved');
    if (
      cp.slot !== cp.base.slot ||
      cp.runID.lineage !== cp.base.lineage ||
      cp.baseRevision !== cp.base.revision ||
      cp.fence.lineage !== cp.base.lineage ||
      cp.fence.allocated !== cp.runID.sequence ||
      BigInt(cp.fence.finalized) >= BigInt(cp.runID.sequence)
    )
      throw new Error('Checkpoint identity/fence mismatch');
    if ((await hash(cp.base)) !== cp.baseHash || (await hash(cp.plan)) !== cp.planHash)
      throw new Error('Checkpoint base/plan hash mismatch');
    this.rules.validateStart(
      structuredClone(cp.base),
      structuredClone(cp.plan),
      structuredClone(cp.frozen),
      structuredClone(cp.fence),
    );
    return cp;
  }
  async validateState(raw: unknown): Promise<RunState> {
    const state = stateSchema.parse(boundedClone(raw, 8 * 1048576));
    state.checkpoint = await this.validateCheckpoint(state.checkpoint);
    if (state.pending) await this.validatePending(state.checkpoint, state.pending);
    return state;
  }
  /** Backup import changes slot/revision without changing the attempt or frozen
   * gameplay. Re-derive pending results instead of editing sealed rewards. All
   * hashing completes before BackupStore opens its write transaction. */
  async rebaseState(raw: unknown, campaign: Campaign): Promise<RunState> {
    const state = await this.validateState(raw);
    const base = validateCampaign(campaign);
    const old = state.checkpoint.base;
    if (
      base.lineage !== old.lineage ||
      !same({ ...base, slot: old.slot, revision: old.revision }, old)
    )
      throw new Error("Import cannot change a retained run's base gameplay");
    const { checksum: _checksum, ...previous } = state.checkpoint;
    const checkpoint = await this.validateCheckpoint(
      await seal({
        ...previous,
        slot: base.slot,
        baseRevision: base.revision,
        base,
        baseHash: await hash(base),
      }),
    );
    return {
      checkpoint,
      pending: state.pending
        ? await this.buildPending(checkpoint, terminalOf(state.pending))
        : null,
    };
  }
  private async validatePending(cp: RunCheckpoint, raw: unknown): Promise<PendingResult> {
    const pending = pendingSchema.parse(boundedClone(raw, 8 * 1048576));
    await verifyChecksum(pending);
    if (
      !sameID(cp.runID, pending.runID) ||
      cp.baseRevision !== pending.baseRevision ||
      cp.planHash !== pending.planHash
    )
      throw new Error('Pending result identity mismatch');
    const expected = this.rules.derive(
      structuredClone(cp),
      terminalSchema.parse(terminalOf(pending)),
    );
    const after = validateCampaign(expected.after);
    if (
      after.lineage !== cp.base.lineage ||
      after.slot !== cp.slot ||
      after.revision !== cp.baseRevision + 1
    )
      throw new Error('Result revision/lineage mismatch');
    const claims = fenceSchema.parse(expected.claims);
    if (
      claims.lineage !== cp.runID.lineage ||
      claims.allocated !== cp.runID.sequence ||
      claims.finalized !== cp.fence.finalized
    )
      throw new Error('Adapter must preserve sequence fences');
    for (const field of [
      'campaign',
      'mastery',
      'roles',
      'bosses',
      'milestones',
      'generated',
    ] as const)
      if (cp.fence[field].some((x) => !(claims[field] as (string | number)[]).includes(x)))
        throw new Error('Result cannot erase claims');
    if (
      !same(after, pending.after) ||
      !same(expected.rewards, pending.rewards) ||
      !same(claims, pending.claims)
    )
      throw new Error('Pending result derived fields mismatch');
    return pending;
  }
  async read(c: Campaign): Promise<RunState | undefined> {
    const v = await this.view(c.slot);
    if (!same(validateCampaign(v.campaign), validateCampaign(c)))
      throw new Error('Campaign changed; reload');
    if (v.state === undefined) return;
    const state = await this.validateState(v.state);
    if (!same(state.checkpoint.base, c))
      throw new Error('Checkpoint base mismatch; recovery required');
    const f = fenceSchema.parse(v.fence);
    if (BigInt(state.checkpoint.runID.sequence) <= BigInt(f.finalized))
      throw new Error('Stale finalized checkpoint; no payable result');
    if (!same(f, state.checkpoint.fence))
      throw new Error('Run claim fence changed; recovery required');
    return state;
  }
  async start(c: Campaign, planInput: unknown, frozenInput: unknown): Promise<RunCheckpoint> {
    const base = validateCampaign(boundedClone(c, 8 * 1048576));
    const plan = boundedClone(planInput, 8 * 1048576),
      frozen = boundedClone(frozenInput, 8 * 1048576);
    const v = await this.view(base.slot);
    if (!same(v.campaign, base)) throw new Error('Campaign changed; reload before preflight');
    if (v.state !== undefined || v.practice !== undefined)
      throw new Error('Resolve active run/practice before preflight');
    if ((await this.validatedReceipts(v.receipts)).unpresented)
      throw new Error('Acknowledge committed Results before preflight');
    const fence = fenceSchema.parse(v.fence ?? emptyFence(c.lineage));
    if (fence.allocated !== fence.finalized)
      throw new Error('Unresolved allocated sequence; recovery required');
    const sequence = sequenceSchema.parse(String(BigInt(fence.allocated) + 1n));
    const nextFence = { ...fence, allocated: sequence };
    this.rules.validateStart(base, plan, frozen, nextFence);
    const cp = checkpointSchema.parse(
      await seal({
        schema: 1,
        kind: 'ordinary-run',
        rulesID: this.rules.id,
        runID: { lineage: base.lineage, sequence },
        slot: base.slot,
        baseRevision: base.revision,
        base,
        baseHash: await hash(base),
        planHash: await hash(plan),
        plan,
        frozen,
        fence: nextFence,
      }),
    );
    await this.validateCheckpoint(cp);
    const state: RunState = { checkpoint: cp, pending: null };
    await this.write(base.slot, v, { state, fence: nextFence });
    return structuredClone(cp);
  }
  async restart(c: Campaign): Promise<RunCheckpoint> {
    const state = await this.read(c);
    if (!state || state.pending)
      throw new Error('No restartable run; resolve pending result first');
    return structuredClone(state.checkpoint);
  }
  async buildPending(cpInput: RunCheckpoint, terminalInput: TerminalInput): Promise<PendingResult> {
    const cp = await this.validateCheckpoint(cpInput);
    const terminal = terminalSchema.parse(boundedClone(terminalInput, 8 * 1048576));
    const result = this.rules.derive(structuredClone(cp), structuredClone(terminal));
    const pending = pendingSchema.parse(
      await seal({
        schema: 1,
        ...terminal,
        runID: cp.runID,
        baseRevision: cp.baseRevision,
        planHash: cp.planHash,
        economyPolicyID: 'economy.duration_wave_v1',
        after: result.after,
        rewards: result.rewards,
        claims: result.claims,
      }),
    );
    return this.validatePending(cp, pending);
  }
  /** Step 1: immutable result, checkpoint and campaign stay untouched. */
  async journal(cpInput: RunCheckpoint, pendingInput: PendingResult): Promise<void> {
    const cp = await this.validateCheckpoint(cpInput),
      pending = await this.validatePending(cp, pendingInput);
    const v = await this.view(cp.slot);
    const state = await this.read(cp.base);
    if (!state || !same(cp, state.checkpoint)) throw new Error('Active run changed');
    if (state.pending && !same(state.pending, pending))
      throw new Error('Immutable pending result already exists');
    const nextState = await this.validateState({ checkpoint: cp, pending });
    await this.write(cp.slot, v, { state: nextState });
  }
  async validatedReceipts(raw: unknown): Promise<ReceiptState> {
    const value = receiptsSchema.parse(
      boundedClone(raw ?? { receipts: [], unpresented: null }, 8 * 1048576),
    );
    const seen = new Set<string>();
    for (const receipt of value.receipts) {
      await verifyChecksum(receipt);
      const id = canonical(receipt.runID);
      if (seen.has(id)) throw new Error('Duplicate recent receipt');
      seen.add(id);
    }
    const unpresented = value.unpresented;
    if (unpresented && !value.receipts.some((r) => sameID(r.runID, unpresented)))
      throw new Error('Missing unpresented receipt');
    return value;
  }
  /** Step 2: exact receipt first reconciles a lost transaction acknowledgment. */
  async finalize(
    cpInput: RunCheckpoint,
    pendingInput: PendingResult,
  ): Promise<
    { status: 'committed'; receipt: RunReceipt } | { status: 'already-finalized'; receipt: null }
  > {
    const cp = await this.validateCheckpoint(cpInput),
      pending = await this.validatePending(cp, pendingInput);
    const v = await this.view(cp.slot);
    const receipts = await this.validatedReceipts(v.receipts);
    const existing = receipts.receipts.find((r) => sameID(r.runID, cp.runID));
    if (existing) {
      if (existing.pendingChecksum !== pending.checksum)
        throw new Error('Finalized result identity conflict');
      return { status: 'committed', receipt: structuredClone(existing) };
    }
    const f = fenceSchema.parse(v.fence ?? emptyFence(cp.runID.lineage));
    if (f.lineage !== cp.runID.lineage) throw new Error('Campaign lineage changed');
    if (BigInt(cp.runID.sequence) <= BigInt(f.finalized))
      return { status: 'already-finalized', receipt: null };
    const current = validateCampaign(v.campaign);
    const state = await this.validateState(v.state);
    if (
      !same(state.checkpoint, cp) ||
      !same(state.pending, pending) ||
      !same(current, cp.base) ||
      !same(f, cp.fence)
    )
      throw new Error('Result base/journal/fence changed; no partial payment');
    const receipt = receiptSchema.parse(
      await seal({
        schema: 1,
        runID: cp.runID,
        planHash: cp.planHash,
        baseRevision: cp.baseRevision,
        resultRevision: pending.after.revision,
        outcome: pending.outcome,
        terminalTick: pending.terminalTick,
        pendingChecksum: pending.checksum,
        rewards: pending.rewards,
      }),
    );
    const nextReceipts = {
      receipts: [...receipts.receipts, receipt].slice(-16),
      unpresented: cp.runID,
    };
    const fence = { ...pending.claims, finalized: cp.runID.sequence };
    await this.write(cp.slot, v, {
      campaign: pending.after,
      previous: current,
      state: null,
      receipts: nextReceipts,
      fence,
    });
    return { status: 'committed', receipt: structuredClone(receipt) };
  }
  async abandon(c: Campaign): Promise<void> {
    const v = await this.view(c.slot),
      state = await this.read(c);
    if (!state || state.pending) throw new Error('Cannot abandon a pending result');
    await this.write(c.slot, v, {
      state: null,
      fence: { ...state.checkpoint.fence, finalized: state.checkpoint.runID.sequence },
    });
  }
  /** Imported/restored stale attempts may only return to Preparation, never pay. */
  async discardStale(c: Campaign): Promise<void> {
    const v = await this.view(c.slot);
    if (!same(v.campaign, validateCampaign(c))) throw new Error('Campaign changed');
    const state = await this.validateState(v.state),
      f = fenceSchema.parse(v.fence);
    if (
      state.checkpoint.runID.lineage !== c.lineage ||
      f.lineage !== c.lineage ||
      BigInt(state.checkpoint.runID.sequence) > BigInt(f.finalized)
    )
      throw new Error('Run is not a finalized stale attempt');
    await this.write(c.slot, v, { state: null });
  }
  /** Explicit recovery of an allocated sequence whose checkpoint is absent.
   * Never infer partial kills/body changes. Future UI must preview abandonment.
   */
  async abandonOrphan(c: Campaign): Promise<void> {
    const v = await this.view(c.slot);
    if (!same(v.campaign, validateCampaign(c)) || v.state !== undefined || v.practice !== undefined)
      throw new Error('Orphan recovery base/state changed');
    const receipts = await this.validatedReceipts(v.receipts);
    if (receipts.unpresented)
      throw new Error('Acknowledge committed Results before orphan recovery');
    const fence = fenceSchema.parse(v.fence);
    if (fence.lineage !== c.lineage || BigInt(fence.allocated) <= BigInt(fence.finalized))
      throw new Error('No orphan allocation');
    await this.write(c.slot, v, { fence: { ...fence, finalized: fence.allocated } });
  }
  async unpresented(slot: number): Promise<RunReceipt | undefined> {
    const v = await this.view(slot),
      receipts = await this.validatedReceipts(v.receipts);
    return structuredClone(
      receipts.receipts.find((r) => receipts.unpresented && sameID(r.runID, receipts.unpresented)),
    );
  }
  async acknowledge(slot: number, id: RunCheckpoint['runID']): Promise<void> {
    const v = await this.view(slot),
      receipts = await this.validatedReceipts(v.receipts);
    if (!receipts.unpresented) return;
    if (!sameID(receipts.unpresented, id)) throw new Error('Results presentation changed');
    await this.write(slot, v, { receipts: { ...receipts, unpresented: null } });
  }
  /** Exact in-memory terminal recovery. This is a run bundle, not a whole-slot
   * backup; no import is enabled until a production adapter is installed.
   */
  async exportPending(cpInput: RunCheckpoint, pendingInput: PendingResult): Promise<string> {
    const cp = await this.validateCheckpoint(cpInput),
      pending = await this.validatePending(cp, pendingInput);
    return canonical(
      await seal({
        format: 'resonance-bastion-pending-recovery',
        schema: 1,
        checkpoint: cp,
        pending,
      }),
    );
  }
  private async write(
    slot: number,
    expected: View,
    next: {
      campaign?: Campaign;
      previous?: Campaign;
      state?: RunState | null;
      receipts?: ReceiptState;
      fence?: ProgressFence;
    },
  ): Promise<void> {
    boundedClone(
      {
        campaign: next.campaign ?? expected.campaign ?? null,
        previous: next.previous ?? expected.previous ?? null,
        state: next.state === undefined ? (expected.state ?? null) : next.state,
        receipts: next.receipts ?? expected.receipts ?? null,
        fence: next.fence ?? expected.fence ?? null,
        practice: expected.practice ?? null,
      },
      8 * 1048576,
    );
    if (this.busy) throw new Error('Run transaction already in progress');
    const writer = this.repo.writer;
    if (!writer) throw new Error('Read Only');
    this.busy = true;
    try {
      if (!this.repo.database) {
        if (
          !same(await this.view(slot), expected) ||
          this.repo.writer?.generation !== writer.generation
        )
          throw new Error('Run state/writer changed');
        if (next.campaign) this.repo.memory.set(slot, structuredClone(next.campaign));
        if (next.previous) this.repo.memoryPrevious.set(slot, structuredClone(next.previous));
        if (next.state === null) {
          this.memory.delete(slot);
          this.repo.activeRunSlots.delete(slot);
        } else if (next.state) {
          this.memory.set(slot, structuredClone(next.state));
          this.repo.activeRunSlots.add(slot);
        }
        if (next.receipts) {
          this.memoryReceipts.set(slot, structuredClone(next.receipts));
          if (next.receipts.unpresented) this.repo.unpresentedResultSlots.add(slot);
          else this.repo.unpresentedResultSlots.delete(slot);
        }
        if (next.fence) this.repo.memoryFences.set(next.fence.lineage, structuredClone(next.fence));
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
            const w = tx.objectStore('writer').get('active');
            w.onsuccess = guard(() => {
              if (
                w.result?.tabID !== this.repo.tabID ||
                w.result?.generation !== writer.generation
              ) {
                this.repo.writer = undefined;
                throw new Error('Read Only: writer changed');
              }
              const c = tx.objectStore('campaigns').get(slot);
              c.onsuccess = guard(() => {
                if (!same(c.result, expected.campaign))
                  throw new Error('Campaign changed; reconcile receipt before retry');
                let pending = 5;
                const commit = () => {
                  if (next.campaign) tx.objectStore('campaigns').put(next.campaign, slot);
                  if (next.previous) tx.objectStore('previous').put(next.previous, slot);
                  if (next.state === null) tx.objectStore('meta').delete(key(slot));
                  else if (next.state) tx.objectStore('meta').put(next.state, key(slot));
                  if (next.receipts) tx.objectStore('meta').put(next.receipts, receiptsKey(slot));
                  if (next.fence)
                    tx.objectStore('meta').put(next.fence, `fence.${next.fence.lineage}`);
                  done(undefined);
                };
                const lineage = (expected.campaign as Campaign).lineage;
                for (const [field, k] of [
                  ['previous', slot],
                  ['state', key(slot)],
                  ['receipts', receiptsKey(slot)],
                  ['fence', `fence.${lineage}`],
                  ['practice', `practice.slot.${slot}`],
                ] as const) {
                  const r = tx.objectStore(field === 'previous' ? 'previous' : 'meta').get(k);
                  r.onsuccess = guard(() => {
                    if (!same(r.result, expected[field]))
                      throw new Error('Run state changed; reconcile before retry');
                    if (--pending === 0) commit();
                  });
                }
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
