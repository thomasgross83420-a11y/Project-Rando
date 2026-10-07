import { it, expect } from 'vitest';
import { InterfaceTime } from '../../src/ui/interface-time';
it('caption and health-indicator deadlines preserve remaining time across hidden/freeze absence', () => {
  const time = new InterfaceTime();
  expect(time.sample(100, true)).toBe(0);
  const captionDeadline = 6000;
  expect(time.sample(1100, true)).toBe(1000);
  expect(time.sample(1200, false)).toBe(1000);
  expect(time.sample(21200, false)).toBe(1000);
  expect(time.sample(22000, true)).toBe(1000);
  expect(captionDeadline - time.sample(23000, true)).toBe(4000);
  time.interrupt(); // browser freeze without a visibility transition
  expect(time.sample(99000, true)).toBe(2000);
  expect(time.sample(100000, true)).toBe(3000); // visible interface time still advances while combat is paused
});
