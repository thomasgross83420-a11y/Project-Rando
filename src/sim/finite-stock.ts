/** Blueprint §§24C/27C: pure finite-charge operations and a siege-local,
 * one-star Engineer rearm coordinator. Integration awaits the mobile actor.
 * No permanent stock, wallet, body or campaign mutation occurs here. */
export interface FiniteStock {
  readonly initial: number;
  readonly permanent: number;
  readonly temporary: number;
}
const integer = (n: number, minimum = 0) => {
  if (!Number.isSafeInteger(n) || n < minimum) throw new Error('Rearm integer domain');
};
export function validateFiniteStock(stock: FiniteStock): void {
  integer(stock.initial, 1);
  integer(stock.permanent);
  integer(stock.temporary);
  if (stock.initial > 8 || stock.permanent + stock.temporary > stock.initial)
    throw new Error('Finite stock exceeds its initial cap');
}
export function spendFiniteCharge(stock: FiniteStock): FiniteStock | null {
  validateFiniteStock(stock);
  return stock.temporary > 0
    ? { ...stock, temporary: stock.temporary - 1 }
    : stock.permanent > 0
      ? { ...stock, permanent: stock.permanent - 1 }
      : null;
}
export function endingPermanentStock(stock: FiniteStock): number {
  validateFiniteStock(stock);
  return stock.permanent;
}
export interface RearmConditions {
  readonly sourceAlive: boolean;
  readonly trapAlive: boolean;
  readonly inRange: boolean;
  readonly lineOfSight: boolean;
  readonly stationary: boolean;
  readonly hostileWithinFourGU: boolean;
  readonly underAttack: boolean;
  readonly damagedThisTick: boolean;
  readonly higherPriorityAction: boolean;
}
const legal = (c: RearmConditions) =>
  c.sourceAlive &&
  c.trapAlive &&
  c.inRange &&
  c.lineOfSight &&
  c.stationary &&
  !c.hostileWithinFourGU &&
  !c.underAttack &&
  !c.damagedThisTick &&
  !c.higherPriorityAction;
interface Channel {
  readonly source: number;
  readonly trap: number;
  readonly initial: number;
  readonly started: number;
  readonly due: number;
}
export interface RearmObservation {
  readonly conditions: RearmConditions;
  readonly stock: FiniteStock;
}
export interface RearmCompletion {
  readonly source: number;
  readonly trap: number;
  readonly stock: FiniteStock;
}
export class EngineerRearm {
  private cursor: number;
  private channels = new Map<number, Channel>();
  private additions = new Map<number, number>();
  constructor(tick = 0) {
    integer(tick);
    this.cursor = tick;
  }
  completed(source: number): number {
    integer(source, 1);
    return this.additions.get(source) ?? 0;
  }
  get active(): readonly Readonly<Channel>[] {
    return [...this.channels.values()].sort((a, b) => a.source - b.source).map((c) => ({ ...c }));
  }
  begin(source: number, trap: number, observation: RearmObservation): boolean {
    integer(source, 1);
    integer(trap, 1);
    if (source === trap) throw new Error('Engineer and trap require distinct entity identities');
    validateFiniteStock(observation.stock);
    if (
      !legal(observation.conditions) ||
      this.channels.has(source) ||
      this.completed(source) >= 8 ||
      observation.stock.permanent + observation.stock.temporary === observation.stock.initial ||
      this.active.some((c) => c.trap === trap)
    )
      return false;
    const due = this.cursor + 360;
    integer(due);
    this.channels.set(source, {
      source,
      trap,
      initial: observation.stock.initial,
      started: this.cursor,
      due,
    });
    return true;
  }
  cancel(source: number): void {
    integer(source, 1);
    this.channels.delete(source);
  }
  /** Sample each authoritative tick after damage/death. Never catch up over
   * unobserved ticks; source/recipient cancellation discards partial progress.
   * Stage the whole batch first so invalid observations cannot partly commit. */
  advance(
    tick: number,
    observe: (source: number, trap: number) => RearmObservation | null,
  ): readonly RearmCompletion[] {
    integer(tick);
    if (tick !== this.cursor + 1) throw new Error('Rearm requires consecutive simulation ticks');
    const removed: number[] = [],
      completions: RearmCompletion[] = [];
    for (const channel of this.active) {
      const observation = observe(channel.source, channel.trap);
      if (observation) {
        validateFiniteStock(observation.stock);
        if (observation.stock.initial !== channel.initial)
          throw new Error('Rearm initial cap changed during siege');
      }
      if (
        !observation ||
        !legal(observation.conditions) ||
        observation.stock.permanent + observation.stock.temporary === observation.stock.initial
      ) {
        removed.push(channel.source);
      } else if (tick >= channel.due) {
        removed.push(channel.source);
        completions.push({
          source: channel.source,
          trap: channel.trap,
          stock: { ...observation.stock, temporary: observation.stock.temporary + 1 },
        });
      }
    }
    this.cursor = tick;
    for (const source of removed) this.channels.delete(source);
    for (const c of completions) this.additions.set(c.source, this.completed(c.source) + 1);
    return completions;
  }
}
