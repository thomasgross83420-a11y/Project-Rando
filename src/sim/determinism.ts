export function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`)
    .join(',')}}`;
}
export async function hash(value: unknown): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical(value)));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
export class RandomStream {
  state: number;
  constructor(state: number) {
    this.state = state >>> 0 || 0x6d2b79f5;
  }
  next(): number {
    let x = this.state;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.state = x >>> 0;
    return this.state;
  }
  static async seeded(seed: string, stream: string, version: string): Promise<RandomStream> {
    const bytes = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(`RB1|${seed}|${stream}|${version}`),
    );
    return new RandomStream(new DataView(bytes).getUint32(0, false));
  }
}
export const FIXED = 1024;
export const TICKS_PER_SECOND = 60;
export function roundFixed(value: number): number {
  if (!Number.isFinite(value)) throw new Error('Non-finite simulation value');
  return Math.sign(value) * Math.floor(Math.abs(value) + 0.5);
}
// Gate 0 mechanism fixture, not a shipped combat system.
export class HeadlessFixture {
  tick = 0;
  x = 0;
  carry = 0;
  releases: number[] = [];
  readonly stream: RandomStream;
  constructor(stream: RandomStream) {
    this.stream = stream;
  }
  step(): void {
    this.tick++;
    this.carry += 2253;
    const advance = Math.floor(this.carry / TICKS_PER_SECOND);
    this.x += advance;
    this.carry -= advance * TICKS_PER_SECOND;
    if (this.tick % 48 === 0) this.releases.push(this.stream.next());
  }
  snapshot(): object {
    return {
      tick: this.tick,
      x: this.x,
      carry: this.carry,
      releases: this.releases,
      random: this.stream.state,
    };
  }
}
