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
