import { H } from '../sim/fixed';

/** Simulation: clockwise from north. Source artwork: counterclockwise from east. */
export const worldHeading = (degrees: number): number =>
  ((Math.round((degrees * H) / 360) % H) + H) % H;

export function spriteDirection(heading: number, cameraView: number, directions: 4 | 8): number {
  return (
    ((Math.round((0.25 - heading / H - cameraView / 4) * directions) % directions) + directions) %
    directions
  );
}
