/** Foreground presentation milliseconds; never an input to authoritative simulation. */
export class InterfaceTime {
  value = 0;
  private last: number | null = null;
  interrupt(): void {
    this.last = null;
  }
  sample(now: number, visible: boolean): number {
    if (!visible) {
      this.interrupt();
      return this.value;
    }
    if (this.last !== null) this.value += Math.max(0, now - this.last);
    this.last = now;
    return this.value;
  }
}
