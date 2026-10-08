/** §25E contribution in exact body-point equivalents. Combat owns outcomes;
 * this ledger observes applied changes, never predicts hits or awards money.
 */
export const CONTRIBUTION_POLICY = 'contribution.actual-v1';
export const SCORE_PER_FIXED = 6000n;
export const SCORE_PER_POINT = 1024n * SCORE_PER_FIXED;
type Metric = 'damage' | 'restoration' | 'prevention' | 'control' | 'detection';
export interface LedgerActor {
  id: number;
  uuid: string | null;
  type: string;
  team: 'friendly' | 'hostile';
  developing: boolean;
  rewardable: boolean;
  body: number;
  maximum: number;
  initialStock: number;
  permanentStock: number;
}
interface Entry extends LedgerActor {
  initialMissing: number;
  hostileBodyReceived: bigint;
  restorationUsed: bigint;
  blocks: Set<number>;
  scores: Record<Metric, bigint>;
  temporaryStock: number;
  controlReceived: bigint;
  controlledTick: number;
  revealed: boolean;
  firstZero: boolean;
}
const integer = (n: number, lo = 0) => {
  if (!Number.isSafeInteger(n) || n < lo) throw new Error('Contribution integer domain');
};
export class ContributionLedger {
  private entries = new Map<number, Entry>();
  private uuids = new Set<string>();
  private friendlies: Entry[] = [];
  private tick = 0;
  private block = 1;
  constructor(private readonly actorBudget: number) {
    integer(actorBudget, 1);
  }
  register(a: LedgerActor): void {
    integer(a.id, 1);
    integer(a.body);
    integer(a.maximum, 1);
    integer(a.initialStock);
    integer(a.permanentStock);
    if (
      this.entries.size >= this.actorBudget ||
      this.entries.has(a.id) ||
      a.body > a.maximum ||
      a.initialStock > 8 ||
      a.permanentStock > a.initialStock
    )
      throw new Error('Contribution actor identity/budget/body/stock mismatch');
    const uuid = a.uuid?.toLowerCase() ?? null;
    if (
      uuid &&
      (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(uuid) ||
        this.uuids.has(uuid))
    )
      throw new Error('Contribution UUID invalid or duplicate');
    if (a.developing && (a.team !== 'friendly' || !uuid))
      throw new Error('Contribution developing ownership mismatch');
    if (uuid) this.uuids.add(uuid);
    const entry: Entry = {
      ...a,
      uuid,
      initialMissing: a.maximum - a.body,
      hostileBodyReceived: 0n,
      restorationUsed: 0n,
      blocks: new Set(),
      scores: { damage: 0n, restoration: 0n, prevention: 0n, control: 0n, detection: 0n },
      temporaryStock: 0,
      controlReceived: 0n,
      controlledTick: -1,
      revealed: false,
      firstZero: a.body === 0,
    };
    this.entries.set(a.id, entry);
    if (a.team === 'friendly') this.friendlies.push(entry);
  }
  private actor(id: number): Entry {
    const e = this.entries.get(id);
    if (!e) throw new Error('Unregistered contribution actor');
    return e;
  }
  beginTick(tick: number): void {
    integer(tick, 1);
    if (tick !== this.tick + 1) throw new Error('Contribution ticks must be contiguous');
    this.tick = tick;
    for (const e of this.friendlies) if (e.body > 0) e.blocks.add(this.block);
  }
  private score(source: Entry, metric: Metric, amount: bigint): void {
    if (source.team === 'friendly' && source.developing) source.scores[metric] += amount;
  }
  /** Loss values already include armor, spillover and remaining-health caps.
   * A posthumous released projectile keeps its source's credit. */
  damage(source: number, target: number, bodyLoss: number, shieldLoss: number): void {
    integer(bodyLoss);
    integer(shieldLoss);
    const s = this.actor(source),
      t = this.actor(target);
    if (bodyLoss > t.body || (t.body === 0 && (bodyLoss > 0 || shieldLoss > 0)))
      throw new Error('Contribution damage exceeds living body');
    t.body -= bodyLoss;
    if (t.body === 0) t.firstZero = true;
    if (s.team === 'hostile' && t.team === 'friendly') t.hostileBodyReceived += BigInt(bodyLoss);
    if (s.team === 'friendly' && t.team === 'hostile' && t.rewardable)
      this.score(s, 'damage', (BigInt(bodyLoss) + BigInt(shieldLoss)) * SCORE_PER_FIXED);
  }
  /** Structural/environmental loss gives neither damage XP nor heal budget. */
  structuralLoss(target: number, amount: number): void {
    integer(amount);
    const t = this.actor(target);
    if (amount > t.body) throw new Error('Structural loss exceeds body');
    t.body -= amount;
    if (t.body === 0) t.firstZero = true;
  }
  restore(source: number, target: number, amount: number): bigint {
    integer(amount);
    const s = this.actor(source),
      t = this.actor(target);
    if (
      s.team !== 'friendly' ||
      t.team !== 'friendly' ||
      t.body === 0 ||
      amount > t.maximum - t.body
    )
      throw new Error('Contribution restoration eligibility/body mismatch');
    t.body += amount;
    const room = BigInt(t.initialMissing) + t.hostileBodyReceived - t.restorationUsed,
      eligible = BigInt(amount) < room ? BigInt(amount) : room;
    t.restorationUsed += eligible;
    this.score(s, 'restoration', eligible * SCORE_PER_FIXED);
    return eligible;
  }
  /** Caller supplies ordered, armor-adjusted, health-capped marginal prevention;
   * the per-hit budget enforces no duplicate credit across protecting effects. */
  prevention(
    attacker: number,
    target: number,
    shares: readonly { source: number; bodyAverted: number }[],
    budget: number,
  ): void {
    integer(budget);
    const a = this.actor(attacker),
      t = this.actor(target);
    if (budget > t.body) throw new Error('Prevention budget exceeds living recipient body');
    let sum = 0n;
    for (const share of shares) {
      integer(share.bodyAverted);
      this.actor(share.source);
      sum += BigInt(share.bodyAverted);
    }
    if (sum > BigInt(budget)) throw new Error('Duplicate prevention exceeds hit budget');
    if (a.team !== 'hostile' || t.team !== 'friendly') return;
    for (const share of shares) {
      const s = this.actor(share.source);
      if (s.team === t.team)
        this.score(s, 'prevention', BigInt(share.bodyAverted) * SCORE_PER_FIXED);
    }
  }
  /** One strongest winning source per requested enemy movement tick. Body-point
   * equivalents stay exact even at fractional per-tick rates. */
  control(
    source: number,
    target: number,
    reductionPercent: number,
    rooted: boolean,
    requestedMovement: boolean,
  ): void {
    integer(reductionPercent);
    if (reductionPercent > 50) throw new Error('Control slow cap');
    const s = this.actor(source),
      t = this.actor(target);
    if (
      !requestedMovement ||
      t.body === 0 ||
      s.team !== 'friendly' ||
      t.team !== 'hostile' ||
      !t.rewardable
    )
      return;
    if (t.controlledTick === this.tick) throw new Error('Duplicate control winner in one tick');
    t.controlledTick = this.tick;
    const raw = BigInt(rooted ? 100 : reductionPercent) * 10240n,
      remaining = 100n * SCORE_PER_POINT - t.controlReceived,
      applied = raw < remaining ? raw : remaining;
    t.controlReceived += applied;
    this.score(s, 'control', applied);
  }
  /** Detection resolver owns nearest/ID ties; cloak cycling cannot earn again. */
  reveal(source: number, target: number, hidden: boolean, alreadyVisible: boolean): void {
    const s = this.actor(source),
      t = this.actor(target);
    if (
      t.revealed ||
      !hidden ||
      alreadyVisible ||
      t.body === 0 ||
      s.team !== 'friendly' ||
      t.team !== 'hostile' ||
      !t.rewardable
    )
      return;
    t.revealed = true;
    this.score(s, 'detection', 10n * SCORE_PER_POINT);
  }
  spendCharge(id: number): void {
    const e = this.actor(id);
    if (e.temporaryStock > 0) e.temporaryStock--;
    else if (e.permanentStock > 0) e.permanentStock--;
    else throw new Error('Cannot spend depleted trap stock');
  }
  grantTemporaryCharge(id: number): void {
    const e = this.actor(id);
    if (e.body === 0 || e.permanentStock + e.temporaryStock >= e.initialStock)
      throw new Error('Temporary charge exceeds living trap capacity');
    e.temporaryStock++;
  }
  assertBody(id: number, body: number): void {
    if (this.actor(id).body !== body)
      throw new Error('Combat body diverged from contribution ledger');
  }
  snapshot() {
    return {
      policy: CONTRIBUTION_POLICY,
      scoreUnitsPerPoint: String(SCORE_PER_POINT),
      tick: this.tick,
      block: this.block,
      actors: [...this.entries.values()]
        .sort((a, b) => a.id - b.id)
        .map((e) => ({
          id: e.id,
          uuid: e.uuid,
          type: e.type,
          team: e.team,
          developing: e.developing,
          rewardable: e.rewardable,
          body: e.body,
          maximum: e.maximum,
          firstZero: e.firstZero,
          initialMissing: e.initialMissing,
          hostileBodyReceived: String(e.hostileBodyReceived),
          restorationUsed: String(e.restorationUsed),
          operationalBlocks: [...e.blocks].sort((a, b) => a - b),
          initialStock: e.initialStock,
          permanentStock: e.permanentStock,
          temporaryStock: e.temporaryStock,
          controlReceived: String(e.controlReceived),
          controlledTick: e.controlledTick,
          revealed: e.revealed,
          scores: {
            damage: String(e.scores.damage),
            restoration: String(e.scores.restoration),
            prevention: String(e.scores.prevention),
            control: String(e.scores.control),
            detection: String(e.scores.detection),
          },
          score: String(Object.values(e.scores).reduce((a, b) => a + b, 0n)),
        })),
    };
  }
}
