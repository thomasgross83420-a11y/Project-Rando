import type Phaser from 'phaser';
import art from '../../public/assets/combat/manifest.json';
import rifleRig from '../../public/assets/combat/rifle-rig.json';
import type { CombatFrame } from './animation';

export type DamageBand = 'scuffed' | 'damaged';
export type VisualFrame = Pick<
  CombatFrame,
  'key' | 'rect' | 'trim' | 'anchor' | 'native' | 'atlas'
> & {
  texture?: string;
};
const frames = new Map(art.frames.map((f) => [f.key, f]));
const rifleDamage: Readonly<Record<string, CombatFrame>> = rifleRig.damageFrames;

export function damageSource(frame: CombatFrame, band: DamageBand): CombatFrame {
  if (frame.content === 'friendly.rifle_squad') {
    const authored = rifleDamage[`${frame.key}.${band}`];
    if (!authored) throw new Error(`Missing authored Rifle damage ${frame.key}.${band}`);
    return authored;
  }
  const key = frame.key.slice(0, frame.key.lastIndexOf('.', frame.key.lastIndexOf('.') - 1));
  const overlay = frames.get(`${key}.${band}.0`);
  if (!overlay) throw new Error(`Missing damage source ${key}.${band}`);
  return overlay;
}

/** Presentation attachment matches the retained v1 rig. No source image is edited.
 * The final alpha intersection prevents weathering from floating outside a pose.
 * This does not certify the v1 rig's anatomy or replace authored joint landmarks.
 */
export function composePoseDamage(
  frame: CombatFrame,
  overlay: CombatFrame,
  sources: readonly CanvasImageSource[],
): HTMLCanvasElement {
  const [w = 0, h = 0] = frame.native;
  const base = document.createElement('canvas');
  base.width = w;
  base.height = h;
  const sourceContext = base.getContext('2d');
  if (!sourceContext) throw new Error('Damage compositor unavailable');
  sourceContext.imageSmoothingEnabled = false;
  const [sx = 0, sy = 0, sw = 0, sh = 0] = overlay.rect;
  const source = sources[overlay.atlas];
  if (!source) throw new Error('Missing overlay atlas');
  sourceContext.drawImage(
    source,
    sx,
    sy,
    sw,
    sh,
    overlay.trim[0] ?? 0,
    overlay.trim[1] ?? 0,
    sw,
    sh,
  );
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const ctx = out.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Damage compositor unavailable');
  ctx.imageSmoothingEnabled = false;
  const crop = (x: number, y: number, width: number, height: number, dx: number, dy: number) => {
    if (width && height) ctx.drawImage(base, x, y, width, height, x + dx, y + dy, width, height);
  };
  if (frame.content === 'friendly.rifle_squad') {
    ctx.drawImage(base, 0, 0);
  } else if (frame.state === 'move') {
    const cut = Math.round(h * 0.7),
      mid = Math.floor(w / 2),
      stride = [0, 1, 2, 1, 0, -1, -2, -1][frame.frame] ?? 0,
      angle = (Number(frame.facing) * Math.PI) / 4,
      dx = Math.round(Math.sin(angle) * stride),
      dy = Math.round(-Math.cos(angle) * stride);
    crop(0, 0, w, cut, 0, [1, 2, 5, 6].includes(frame.frame) ? -1 : 0);
    crop(0, cut, mid, h - cut, dx, dy - ([1, 2].includes(frame.frame) ? 1 : 0));
    crop(mid, cut, w - mid, h - cut, -dx, -dy - ([5, 6].includes(frame.frame) ? 1 : 0));
  } else if (['attack', 'ability', 'channel'].includes(frame.state)) {
    const top = Math.round(h * 0.29),
      bottom = Math.round(h * 0.62),
      mid = Math.floor(w / 2),
      left = mid - Math.floor(w / 7) + 1,
      right = mid + Math.floor(w / 7),
      dx = [1, 2].includes(frame.frame) ? -1 : frame.frame === 3 ? 1 : 0,
      dy = frame.state === 'ability' && frame.frame === 2 ? 1 : 0;
    ctx.drawImage(base, 0, 0);
    ctx.clearRect(0, top, left, bottom - top);
    ctx.clearRect(right, top, w - right, bottom - top);
    crop(0, top, left, bottom - top, dx, dy);
    crop(right, top, w - right, bottom - top, dx, dy);
  } else ctx.drawImage(base, 0, 0);
  const [bx = 0, by = 0, bw = 0, bh = 0] = frame.rect;
  const body = sources[frame.atlas];
  if (!body) throw new Error('Missing body atlas');
  // A full native-size mask matters: pixels outside the trimmed body must clear too.
  sourceContext.clearRect(0, 0, w, h);
  sourceContext.drawImage(body, bx, by, bw, bh, frame.trim[0] ?? 0, frame.trim[1] ?? 0, bw, bh);
  ctx.globalCompositeOperation = 'destination-in';
  ctx.drawImage(base, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
  return out;
}

/** Build one shared, tightly packed presentation atlas per scene, not per unit/frame.
 * No masks, canvas work or texture uploads occur in the battle drawing loop.
 */
export class PoseDamageBank {
  readonly records = new Map<string, VisualFrame | null>();
  readonly texture = 'combat.pose-damage';
  readonly canvas: HTMLCanvasElement;
  readonly unique: number;
  readonly pixels: number;
  constructor(sources: readonly CanvasImageSource[]) {
    const candidates: {
      key: string;
      frame: CombatFrame;
      canvas: HTMLCanvasElement;
      trim: number[];
      bytes: Uint8ClampedArray;
    }[] = [];
    for (const frame of art.frames) {
      if (
        ['scuffed', 'damaged', 'incapacitated', 'wreck'].includes(frame.state) ||
        frame.content.startsWith('fx.')
      )
        continue;
      for (const band of ['scuffed', 'damaged'] as const) {
        const key = `${frame.key}.${band}`,
          canvas = composePoseDamage(frame, damageSource(frame, band), sources),
          ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Damage compositor unavailable');
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        let left = canvas.width,
          top = canvas.height,
          right = 0,
          bottom = 0;
        for (let y = 0; y < canvas.height; y++)
          for (let x = 0; x < canvas.width; x++)
            if (data[(y * canvas.width + x) * 4 + 3]) {
              left = Math.min(left, x);
              top = Math.min(top, y);
              right = Math.max(right, x + 1);
              bottom = Math.max(bottom, y + 1);
            }
        if (right <= left) {
          this.records.set(key, null);
          continue;
        }
        const cropped = document.createElement('canvas');
        cropped.width = right - left;
        cropped.height = bottom - top;
        const cc = cropped.getContext('2d');
        if (!cc) throw new Error('Damage compositor unavailable');
        cc.drawImage(
          canvas,
          left,
          top,
          cropped.width,
          cropped.height,
          0,
          0,
          cropped.width,
          cropped.height,
        );
        candidates.push({
          key,
          frame,
          canvas: cropped,
          trim: [left, top, right, bottom],
          bytes: cc.getImageData(0, 0, cropped.width, cropped.height).data,
        });
      }
    }
    candidates.sort(
      (a, b) =>
        b.canvas.height - a.canvas.height ||
        b.canvas.width - a.canvas.width ||
        a.key.localeCompare(b.key),
    );
    const rows: { x: number; y: number; height: number }[] = [],
      placed: { canvas: HTMLCanvasElement; rect: number[] }[] = [],
      aliases = new Map<string, { bytes: Uint8ClampedArray; rect: number[] }[]>();
    let height = 0;
    for (const c of candidates) {
      let hash = 2166136261;
      for (const byte of c.bytes) hash = Math.imul(hash ^ byte, 16777619) >>> 0;
      const identity = `${c.canvas.width}.${c.canvas.height}.${hash}`,
        bucket = aliases.get(identity) ?? [],
        alias = bucket.find((p) => p.bytes.every((v, i) => v === c.bytes[i]));
      let rect = alias?.rect;
      if (!rect) {
        let row = rows.find(
          (r) => r.height >= c.canvas.height + 8 && r.x + c.canvas.width + 8 <= 2048,
        );
        if (!row) {
          row = { x: 0, y: height, height: c.canvas.height + 8 };
          rows.push(row);
          height += row.height;
        }
        rect = [row.x + 4, row.y + 4, c.canvas.width, c.canvas.height];
        row.x += c.canvas.width + 8;
        bucket.push({ bytes: c.bytes, rect });
        aliases.set(identity, bucket);
        placed.push({ canvas: c.canvas, rect });
      }
      this.records.set(c.key, {
        key: c.key,
        rect,
        trim: c.trim,
        native: c.frame.native,
        anchor: c.frame.anchor,
        atlas: 0,
        texture: this.texture,
      });
    }
    this.canvas = document.createElement('canvas');
    this.canvas.width = 2048;
    this.canvas.height = Math.max(1, height);
    this.pixels = this.canvas.width * this.canvas.height;
    const existing = art.atlases.reduce(
      (n, a) => n + (a.size[0] ?? 0) * (a.size[1] ?? 0),
      1048576 + 288 * 32,
    );
    if (height > 2048 || existing + this.pixels > 8000000)
      throw new Error('Pose damage atlas exceeds texture budget');
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('Damage compositor unavailable');
    for (const p of placed) ctx.drawImage(p.canvas, p.rect[0] ?? 0, p.rect[1] ?? 0);
    this.unique = placed.length;
  }
  install(scene: Phaser.Scene): void {
    if (scene.textures.exists(this.texture)) return;
    const texture = scene.textures.addCanvas(this.texture, this.canvas);
    if (!texture) throw new Error('Pose damage texture unavailable');
    for (const f of this.records.values())
      if (f) texture.add(f.key, 0, f.rect[0] ?? 0, f.rect[1] ?? 0, f.rect[2] ?? 0, f.rect[3] ?? 0);
  }
  get(frame: CombatFrame, band: DamageBand): VisualFrame | null {
    const record = this.records.get(`${frame.key}.${band}`);
    if (record === undefined) throw new Error(`Missing pose damage ${frame.key}.${band}`);
    return record;
  }
}
