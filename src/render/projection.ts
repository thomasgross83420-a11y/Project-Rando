export interface Point {
  x: number;
  y: number;
}
export interface Camera {
  x: number;
  y: number;
  zoom: number;
  view: 0 | 1 | 2 | 3;
  width: number;
  height: number;
}
export function rotate(point: Point, view: Camera['view']): Point {
  const { x, y } = point;
  return [
    { x, y },
    { x: -y, y: x },
    { x: -x, y: -y },
    { x: y, y: -x },
  ][view] as Point;
}
export function project(point: Point, camera: Camera, height = 0): Point {
  const { x: u, y: v } = rotate({ x: point.x - camera.x, y: point.y - camera.y }, camera.view);
  return {
    x: camera.width / 2 + 16 * camera.zoom * (u - v),
    y: camera.height / 2 + 8 * camera.zoom * (u + v) - 24 * camera.zoom * height,
  };
}
export function unproject(point: Point, camera: Camera): Point {
  const x = (point.x - camera.width / 2) / camera.zoom;
  const y = (point.y - camera.height / 2) / camera.zoom;
  const p = rotate(
    { x: x / 32 + y / 16, y: y / 16 - x / 32 },
    ((4 - camera.view) % 4) as Camera['view'],
  );
  return { x: p.x + camera.x, y: p.y + camera.y };
}
export function clientPoint(
  client: Point,
  rect: Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>,
  camera: Camera,
): Point {
  return {
    x: ((client.x - rect.left) * camera.width) / rect.width,
    y: ((client.y - rect.top) * camera.height) / rect.height,
  };
}
export function pan(camera: Camera, dx: number, dy: number): void {
  const a = unproject({ x: 0, y: 0 }, camera),
    b = unproject({ x: dx, y: dy }, camera);
  camera.x -= b.x - a.x;
  camera.y -= b.y - a.y;
}
export function zoomAt(camera: Camera, zoom: number, point: Point): void {
  const a = unproject(point, camera);
  camera.zoom = Math.max(0.35, Math.min(2.5, zoom));
  const b = unproject(point, camera);
  camera.x += a.x - b.x;
  camera.y += a.y - b.y;
}
export function fit(camera: Camera): void {
  camera.x = 30;
  camera.y = 30;
  camera.zoom = Math.min((camera.width - 24) / 1920, (camera.height - 72) / 1120, 2.5);
}

/** Fit purchased terrain plus maximum sprite-height padding, not the staging field.
 * Unlike whole-field overview, Base respects the ordinary 0.35 lower zoom bound.
 */
export function fitBase(camera: Camera): void {
  const measuring = { ...camera, x: 0, y: 0, zoom: 1, width: 0, height: 0 };
  const corners = [
    { x: 12, y: 12 },
    { x: 48, y: 12 },
    { x: 48, y: 48 },
    { x: 12, y: 48 },
  ].map((p) => project(p, measuring));
  const minX = Math.min(...corners.map((p) => p.x)),
    maxX = Math.max(...corners.map((p) => p.x));
  const minY = Math.min(...corners.map((p) => p.y)) - 96,
    maxY = Math.max(...corners.map((p) => p.y)) + 16;
  const center = unproject({ x: (minX + maxX) / 2, y: (minY + maxY) / 2 }, measuring);
  camera.x = center.x;
  camera.y = center.y;
  camera.zoom = Math.max(
    0.35,
    Math.min(2.5, (camera.width - 24) / (maxX - minX), (camera.height - 24) / (maxY - minY)),
  );
}

/** Frame the deployed defenders at combat start. Camera presentation only. */
export function fitCombatStart(camera: Camera, defenders: readonly Point[]): void {
  if (!defenders.length) return;
  const measuring = { ...camera, x: 0, y: 0, width: 0, height: 0, zoom: 1 };
  const points = defenders.map((p) => project(p, measuring));
  const left = Math.min(...points.map((p) => p.x)) - 28;
  const right = Math.max(...points.map((p) => p.x)) + 28;
  const top = Math.min(...points.map((p) => p.y)) - 64;
  const bottom = Math.max(...points.map((p) => p.y)) + 28;
  const center = unproject({ x: (left + right) / 2, y: (top + bottom) / 2 }, measuring);
  camera.x = center.x;
  camera.y = center.y;
  camera.zoom = Math.max(
    0.35,
    Math.min(1.35, (camera.width - 24) / (right - left), (camera.height - 24) / (bottom - top)),
  );
}
