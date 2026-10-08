import music from '../../public/assets/full/audio/manifest.json';
import type { Settings } from './model';
interface Voice {
  node: OscillatorNode;
  priority: boolean;
  shot: boolean;
}
export class FullAudio {
  private context: AudioContext | undefined;
  private master: GainNode | undefined;
  private limiter: DynamicsCompressorNode | undefined;
  private voices: Voice[] = [];
  private track: HTMLAudioElement | undefined;
  private sting: HTMLAudioElement | undefined;
  private key = '';
  private settings: Settings | undefined;
  private repeats = new Map<string, number>();
  async enable(s: Settings) {
    this.settings = s;
    try {
      if (!this.context) {
        this.context = new AudioContext();
        this.master = this.context.createGain();
        this.limiter = this.context.createDynamicsCompressor();
        this.limiter.threshold.value = -14;
        this.limiter.knee.value = 8;
        this.limiter.ratio.value = 6;
        this.limiter.attack.value = 0.003;
        this.limiter.release.value = 0.18;
        this.master.connect(this.limiter).connect(this.context.destination);
      }
      void this.context.resume().catch(() => {});
      this.configure(s);
      if (this.track) void this.track.play().catch(() => {});
    } catch {
      /* Autoplay refusal does not block a siege. */
    }
  }
  configure(s: Settings) {
    this.settings = s;
    if (this.master) this.master.gain.value = s.muted ? 0 : s.master;
    if (this.track) this.track.volume = s.muted ? 0 : s.music * s.master;
  }
  async play(cue: string) {
    if (this.key === cue) return;
    const r = music.tracks.find((t) => t.key === cue);
    if (!r) return;
    this.track?.pause();
    this.key = cue;
    const next = new Audio(import.meta.env.BASE_URL + 'assets/full/audio/' + r.file);
    next.loop = true;
    next.volume = this.settings?.muted
      ? 0
      : (this.settings?.music ?? 0.35) * (this.settings?.master ?? 0.7);
    this.track = next;
    if (this.context?.state === 'running')
      try {
        await next.play();
      } catch {
        /* Enable Sound remains available. */
      }
  }
  sound(key: string, priority = false, pan = 0) {
    const ctx = this.context,
      bus = this.master,
      s = this.settings;
    if (!ctx || !bus || !s || ctx.state !== 'running' || s.muted) return;
    const now = ctx.currentTime,
      shot = key.startsWith('shot:');
    if (!priority && now - (this.repeats.get(key) ?? -99) < 0.08) return;
    this.repeats.set(key, now);
    if (this.repeats.size > 256) this.repeats.delete(this.repeats.keys().next().value!);
    if (shot && this.voices.filter((v) => v.shot).length >= 8) return;
    if (this.voices.length >= 24) {
      const replace = this.voices.find((v) => !v.priority);
      if (!replace) return;
      replace.node.stop();
      this.voices = this.voices.filter((v) => v !== replace);
    }
    const oscillator = ctx.createOscillator(),
      gain = ctx.createGain(),
      position = ctx.createStereoPanner();
    let h = 0;
    for (const c of key) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    const boom = /blast|breaker|mortar|breach/.test(key),
      heal = /heal|rearm/.test(key),
      energy = /arc|lance|conductor|shield/.test(key),
      freq = boom ? 70 : heal ? 640 : energy ? 210 : 140 + (h % 260);
    oscillator.type = heal || energy ? 'sine' : boom ? 'sawtooth' : 'triangle';
    oscillator.frequency.setValueAtTime(freq * (boom ? 2 : 1), now);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(25, freq * 0.5), now + 0.12);
    const volume = priority ? s.alerts : key.startsWith('ui:') ? s.ui : s.sfx;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime((priority ? 0.09 : 0.04) * volume, now + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + (boom ? 0.5 : 0.16));
    position.pan.value = Math.max(-0.6, Math.min(0.6, pan));
    oscillator.connect(gain).connect(position).connect(bus);
    oscillator.start();
    oscillator.stop(now + (boom ? 0.55 : 0.19));
    const voice = { node: oscillator, priority, shot };
    this.voices.push(voice);
    oscillator.onended = () => {
      this.voices = this.voices.filter((v) => v !== voice);
      gain.disconnect();
      position.disconnect();
    };
  }
  stinger(victory: boolean) {
    this.sting?.pause();
    const r = music.tracks.find((t) => t.key === (victory ? 'victory' : 'defeat'));
    if (!r || this.context?.state !== 'running' || this.settings?.muted) return;
    this.sting = new Audio(import.meta.env.BASE_URL + 'assets/full/audio/' + r.file);
    this.sting.volume = (this.settings?.master ?? 0.7) * (this.settings?.alerts ?? 0.75);
    void this.sting.play().catch(() => {});
  }
  pause(p: boolean) {
    if (p) {
      this.track?.pause();
      this.sting?.pause();
    } else if (this.context?.state === 'running') void this.track?.play().catch(() => {});
  }
}
