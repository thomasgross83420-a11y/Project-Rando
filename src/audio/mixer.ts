import { z } from 'zod';
import manifest from '../../public/assets/audio/manifest.json';
export const audioDefaults = { master: 70, music: 35, sfx: 65, ui: 50, alerts: 75, muted: false };
export const audioSettings = z
  .object({
    master: z.number().int().min(0).max(100),
    music: z.number().int().min(0).max(100),
    sfx: z.number().int().min(0).max(100),
    ui: z.number().int().min(0).max(100),
    alerts: z.number().int().min(0).max(100),
    muted: z.boolean(),
  })
  .strict();
export type AudioSettings = z.infer<typeof audioSettings>;
type Channel = 'music' | 'sfx' | 'ui' | 'alerts';
export class AudioMixer {
  context: AudioContext | undefined;
  muted = false;
  settings: AudioSettings = { ...audioDefaults };
  master: GainNode | undefined;
  channels: Partial<Record<Channel, GainNode>> = {};
  buffers = new Map<string, AudioBuffer>();
  private pending = new Map<string, Promise<AudioBuffer>>();
  voices: { source: AudioBufferSourceNode; priority: number; shot: boolean; key: string }[] = [];
  musicSources: { source: AudioBufferSourceNode; gain: GainNode; key: string }[] = [];
  lastShot = new Map<string, number>();
  musicRevision = 0;
  state = 'Awaiting interaction';
  decoded = 0;
  async unlock(): Promise<boolean> {
    try {
      this.context ??= new AudioContext();
      if (!this.master) {
        this.master = this.context.createGain();
        const limiter = this.context.createDynamicsCompressor();
        limiter.threshold.value = -6;
        limiter.knee.value = 4;
        limiter.ratio.value = 12;
        limiter.attack.value = 0.003;
        limiter.release.value = 0.25;
        this.master.connect(limiter).connect(this.context.destination);
        for (const channel of ['music', 'sfx', 'ui', 'alerts'] as const) {
          const gain = this.context.createGain();
          gain.connect(this.master);
          this.channels[channel] = gain;
        }
        this.configure(this.settings);
      }
      await this.context.resume();
      this.state = this.context.state === 'running' ? 'Enabled' : 'Blocked: use Enable Sound';
      return this.context.state === 'running';
    } catch (e) {
      this.state = `Audio unavailable: ${String(e)}`;
      return false;
    }
  }
  configure(settings: AudioSettings): void {
    this.settings = audioSettings.parse(settings);
    this.muted = settings.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : settings.master / 100;
    for (const c of ['music', 'sfx', 'ui', 'alerts'] as const) {
      const g = this.channels[c];
      if (g) g.gain.value = settings[c] / 100;
    }
  }
  setMuted(muted: boolean): void {
    this.configure({ ...this.settings, muted });
  }
  async decode(key: string): Promise<AudioBuffer> {
    const cached = this.buffers.get(key);
    if (cached) return cached;
    const waiting = this.pending.get(key);
    if (waiting) return waiting;
    const promise = this.load(key);
    this.pending.set(key, promise);
    try {
      return await promise;
    } finally {
      this.pending.delete(key);
    }
  }
  private async load(key: string): Promise<AudioBuffer> {
    const existing = this.buffers.get(key);
    if (existing) return existing;
    const record = manifest.tracks.find((t) => t.key === key);
    if (!record || !this.context) throw new Error(`Unknown or unavailable audio ${key}`);
    const response = await fetch(`${import.meta.env.BASE_URL}assets/audio/${record.file}`);
    if (!response.ok) throw new Error(`Audio HTTP ${response.status}`);
    const buffer = await this.context.decodeAudioData(await response.arrayBuffer());
    if (Math.abs(buffer.duration - record.duration) > 0.02)
      throw new Error('Decoded duration mismatch');
    if (
      key.startsWith('music.') &&
      [...this.buffers.keys()].filter((k) => k.startsWith('music.')).length >= 2
    ) {
      const unused = [...this.buffers.keys()].find(
        (k) => k.startsWith('music.') && !this.musicSources.some((s) => s.key === k),
      );
      if (unused) this.buffers.delete(unused);
    }
    this.buffers.set(key, buffer);
    this.decoded++;
    return buffer;
  }
  async music(key: string): Promise<void> {
    if (!this.context || this.musicSources.some((s) => s.key === key)) return;
    const revision = ++this.musicRevision;
    try {
      const buffer = await this.decode(key);
      if (revision !== this.musicRevision) return;
      const bus = this.channels.music;
      if (!bus) return;
      while (this.musicSources.length >= 2) {
        const old = this.musicSources.shift();
        old?.source.stop();
      }
      const context = this.context,
        now = context.currentTime;
      for (const old of this.musicSources) {
        old.gain.gain.cancelScheduledValues(now);
        old.gain.gain.setValueAtTime(old.gain.gain.value, now);
        old.gain.gain.linearRampToValueAtTime(0, now + 1.5);
        old.source.stop(now + 1.5);
      }
      const source = context.createBufferSource(),
        gain = context.createGain();
      source.buffer = buffer;
      source.loop = true;
      source.loopStart = 0;
      source.loopEnd = buffer.duration;
      source.playbackRate.value = 1;
      source.connect(gain).connect(bus);
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(1, now + 1.5);
      source.onended = () => {
        source.disconnect();
        gain.disconnect();
        this.musicSources = this.musicSources.filter((s) => s.source !== source);
      };
      this.musicSources.push({ source, gain, key });
      source.start();
      this.state = `Playing ${key}`;
    } catch (e) {
      this.state = `Music unavailable: ${String(e)}`;
    }
  }
  async play(key: string, priority = 1, shot = false, channel: Channel = 'sfx'): Promise<void> {
    if (this.muted || !this.context || this.context.state !== 'running') return;
    const now = this.context.currentTime * 1000;
    if (shot && now - (this.lastShot.get(key) ?? -Infinity) < 80) return;
    if (shot) this.lastShot.set(key, now);
    try {
      const buffer = await this.decode(key);
      if (this.muted || this.context.state !== 'running') return;
      const atLimit =
        this.voices.length >= 24 || (shot && this.voices.filter((v) => v.shot).length >= 8);
      if (atLimit) {
        const victim = this.voices
          .filter((v) => v.priority < priority && (!shot || v.shot))
          .sort((a, b) => a.priority - b.priority)[0];
        if (!victim) return;
        victim.source.stop();
        this.voices = this.voices.filter((v) => v !== victim);
      }
      const source = this.context.createBufferSource(),
        bus = this.channels[channel];
      if (!bus) return;
      source.buffer = buffer;
      source.connect(bus);
      const voice = { source, priority, shot, key };
      this.voices.push(voice);
      source.onended = () => {
        source.disconnect();
        this.voices = this.voices.filter((v) => v !== voice);
      };
      source.start();
    } catch (e) {
      this.state = `Effect unavailable: ${String(e)}`;
    }
  }
  async suspend(): Promise<void> {
    if (this.context?.state === 'running') await this.context.suspend();
  }
  async resume(): Promise<void> {
    if (this.context?.state === 'suspended') await this.context.resume();
  }
  stopMusic(): void {
    this.musicRevision++;
    for (const s of this.musicSources) s.source.stop();
    this.musicSources = [];
  }
}
