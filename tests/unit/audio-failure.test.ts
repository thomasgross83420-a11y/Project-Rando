import { expect, it } from 'vitest';
import { AudioMixer } from '../../src/audio/mixer';
it('device suspension failure silences every bus and preserves the saved mix through resume', async () => {
  const mixer = new AudioMixer();
  const master = { gain: { value: 0.7 } };
  mixer.master = master as unknown as GainNode;
  mixer.context = {
    state: 'running',
    suspend: () => Promise.reject(new Error('Device refused suspension')),
  } as unknown as AudioContext;
  await expect(mixer.suspend()).resolves.toBeUndefined();
  expect(master.gain.value).toBe(0);
  expect(mixer.state).toContain('Device refused');
  mixer.configure({ ...mixer.settings, master: 40 });
  expect(master.gain.value).toBe(0);
  await mixer.resume();
  expect(master.gain.value).toBe(0.4);
});
it('device resume failure keeps sound silent, while a later successful retry restores it', async () => {
  const mixer = new AudioMixer(),
    master = { gain: { value: 0.7 } };
  mixer.master = master as unknown as GainNode;
  let state: AudioContextState = 'suspended',
    fail = true;
  mixer.context = {
    get state() {
      return state;
    },
    resume: async () => {
      if (fail) throw new Error('Device refused resume');
      state = 'running';
    },
  } as unknown as AudioContext;
  await mixer.suspend();
  await expect(mixer.resume()).resolves.toBeUndefined();
  expect(master.gain.value).toBe(0);
  expect(mixer.state).toContain('Device refused');
  fail = false;
  await mixer.resume();
  expect(master.gain.value).toBe(0.7);
  mixer.setMuted(true);
  await mixer.resume();
  expect(master.gain.value).toBe(0);
});
