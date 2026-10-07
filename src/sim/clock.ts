// Presentation scheduler; authoritative Battle.step alone advances gameplay.
export type PauseReason =
  | 'manual'
  | 'modal'
  | 'background'
  | 'orientation'
  | 'renderer'
  | 'performance'
  | 'recovery';
export class BattleClock {
  readonly pauses = new Set<PauseReason>();
  speed: 0.5 | 1 | 2 | 4 = 1;
  backlog = 0;
  last: number | null = null;
  overloadSince: number | null = null;
  constructor(
    readonly step: () => void,
    readonly onPause: (reason: PauseReason) => void,
  ) {}
  pause(reason: PauseReason): void {
    if (this.pauses.has(reason)) return;
    this.pauses.add(reason);
    this.last = null;
    if (reason === 'background') this.backlog = 0;
    this.onPause(reason);
  }
  resume(): void {
    this.pauses.clear();
    this.last = null;
    this.overloadSince = null;
  }
  clear(reason: PauseReason): void {
    this.pauses.delete(reason);
    this.last = null;
  }
  frame(now: number): number {
    if (this.pauses.size) {
      this.last = now;
      return 0;
    }
    if (this.last === null) {
      this.last = now;
      return 0;
    }
    const elapsed = Math.max(0, now - this.last);
    this.last = now;
    this.backlog += elapsed * 0.06 * this.speed;
    let ticks = 0;
    while (this.backlog >= 1 && ticks < 12) {
      this.step();
      this.backlog--;
      ticks++;
    }
    if (this.backlog > 30) {
      this.overloadSince ??= now;
      if (now - this.overloadSince >= 2000) this.pause('performance');
    } else this.overloadSince = null;
    return ticks;
  }
}
