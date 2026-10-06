export class AudioMixer {
  context: AudioContext | undefined;
  muted = false;
  async unlock(): Promise<boolean> {
    try {
      this.context ??= new AudioContext();
      await this.context.resume();
      return this.context.state === 'running';
    } catch {
      return false;
    }
  }
  setMuted(muted: boolean): void {
    this.muted = muted;
  }
  async suspend(): Promise<void> {
    if (this.context?.state === 'running') await this.context.suspend();
  }
  async resume(): Promise<void> {
    if (this.context?.state === 'suspended') await this.context.resume();
  }
}
