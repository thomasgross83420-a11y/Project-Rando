import Phaser from 'phaser';
import atlas from '../../public/assets/foundation.json';
import { footprint, type Campaign } from '../persistence/campaign';
import { foundation, requireDefinition, type ContentID } from '../data/foundation';
import { ENTRANCES } from '../construction/geometry';
import {
  clientPoint,
  fit as fitWorld,
  pan,
  project,
  unproject,
  zoomAt,
  type Camera,
  type Point,
} from './projection';
export class WorldView {
  readonly camera: Camera = { x: 30, y: 30, zoom: 1, view: 0, width: 412, height: 400 };
  game: Phaser.Game;
  graphics: Phaser.GameObjects.Graphics | undefined;
  ready = false;
  fitActive = false;
  scene: Phaser.Scene | undefined;
  sprites: Phaser.GameObjects.Image[] = [];
  campaign: Campaign | undefined;
  ghost: { type: ContentID; x: number; y: number; rotation: number } | undefined;
  onSelect: ((point: Point) => void) | undefined;
  onInspect: ((ids: string[]) => void) | undefined;
  hitRecords: { id: string; x: number; y: number; width: number; height: number; foot: Point }[] =
    [];
  labels: Phaser.GameObjects.Text[] = [];
  selected: Point = { x: 30, y: 30 };
  constructor(
    readonly parent: HTMLElement,
    readonly status: (message: string) => void,
  ) {
    const owner = this;
    class Scene extends Phaser.Scene {
      preload(): void {
        this.load.image('foundation', `${import.meta.env.BASE_URL}assets/foundation.png`);
      }
      create(): void {
        owner.scene = this;
        const texture = this.textures.get('foundation');
        for (const f of atlas.frames) {
          const [x, y, w, h] = f.rect;
          if (x === undefined || y === undefined || w === undefined || h === undefined)
            throw new Error('Malformed atlas');
          texture.add(f.key, 0, x, y, w, h);
        }
        owner.graphics = this.add.graphics();
        owner.ready = true;
        owner.resize();
        owner.draw();
      }
    }
    this.game = new Phaser.Game({
      type: Phaser.AUTO,
      parent,
      width: parent.clientWidth,
      height: parent.clientHeight,
      backgroundColor: '#111923',
      pixelArt: true,
      antialias: false,
      banner: false,
      audio: { noAudio: true },
      fps: { target: 60 },
      scene: Scene,
    });
    new ResizeObserver(() => this.resize()).observe(parent);
    this.game.canvas.setAttribute(
      'aria-label',
      'Fortress world. Use coordinate fields and camera controls below.',
    );
    this.game.canvas.addEventListener('webglcontextlost', (event) => {
      event.preventDefault();
      this.status('Renderer paused. Restoring world…');
    });
    this.game.canvas.addEventListener('webglcontextrestored', () => {
      this.draw();
      this.status('Renderer restored. Camera and saved state preserved.');
    });
    this.bindInput();
  }
  resize(): void {
    this.camera.width = this.parent.clientWidth;
    this.camera.height = this.parent.clientHeight;
    if (this.fitActive) fitWorld(this.camera);
    if (!this.ready) return;
    this.game.scale.resize(this.camera.width, this.camera.height);
    this.draw();
  }
  point(event: PointerEvent): Point {
    return clientPoint(
      { x: event.clientX, y: event.clientY },
      this.game.canvas.getBoundingClientRect(),
      this.camera,
    );
  }
  bindInput(): void {
    const canvas = this.game.canvas;
    const pointers = new Map<number, Point>();
    let start: Point | undefined;
    let startClient: Point | undefined;
    let moved = false;
    let oldPinch = 0;
    let oldMidpoint: Point | undefined;
    let multiPointer = false;
    canvas.addEventListener('pointerdown', (e) => {
      if (pointers.size === 0) {
        moved = false;
        multiPointer = false;
      }
      pointers.set(e.pointerId, this.point(e));
      canvas.setPointerCapture(e.pointerId);
      start = this.point(e);
      startClient = { x: e.clientX, y: e.clientY };
      if (pointers.size > 1) {
        multiPointer = true;
        moved = true;
        this.status('Multi-touch camera gesture. Use a fresh Place action to commit.');
      }
      oldPinch = 0;
      if (pointers.size === 2) {
        const list = Array.from(pointers.values()),
          a = list[0],
          b = list[1];
        if (a && b) {
          oldPinch = Math.hypot(a.x - b.x, a.y - b.y);
          oldMidpoint = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        }
      }
    });
    canvas.addEventListener('pointermove', (e) => {
      const previous = pointers.get(e.pointerId);
      if (!previous) return;
      const current = this.point(e);
      pointers.set(e.pointerId, current);
      const list = Array.from(pointers.values());
      if (list.length === 2) {
        this.fitActive = false;
        moved = true;
        const a = list[0],
          b = list[1];
        if (!a || !b) return;
        const distance = Math.hypot(a.x - b.x, a.y - b.y);
        const midpoint = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        if (oldPinch && oldMidpoint) {
          zoomAt(this.camera, (this.camera.zoom * distance) / oldPinch, {
            x: oldMidpoint.x,
            y: oldMidpoint.y,
          });
          pan(this.camera, midpoint.x - oldMidpoint.x, midpoint.y - oldMidpoint.y);
        }
        oldPinch = distance;
        oldMidpoint = midpoint;
      } else if (list.length === 1 && start) {
        if (startClient && Math.hypot(e.clientX - startClient.x, e.clientY - startClient.y) > 8)
          moved = true;
        if (moved && this.ghost) {
          this.selected = unproject(current, this.camera);
          this.onSelect?.(this.selected);
        } else if (moved) {
          this.fitActive = false;
          pan(this.camera, current.x - previous.x, current.y - previous.y);
        }
      }
      this.draw();
    });
    canvas.addEventListener('pointerup', (e) => {
      if (!moved && !multiPointer && pointers.size === 1) {
        const screen = this.point(e);
        const hits = this.hitRecords
          .filter(
            (r) =>
              screen.x >= r.x &&
              screen.x < r.x + r.width &&
              screen.y >= r.y &&
              screen.y < r.y + r.height,
          )
          .reverse();
        if (this.onInspect && !this.ghost && hits.length) {
          const first = hits[0];
          if (first) this.selected = first.foot;
          this.onInspect?.(hits.map((h) => h.id));
        } else {
          this.selected = unproject(screen, this.camera);
          this.status(`Cell ${Math.floor(this.selected.x)}, ${Math.floor(this.selected.y)}`);
          this.onSelect?.(this.selected);
        }
      }
      pointers.delete(e.pointerId);
      start = undefined;
      oldPinch = 0;
      this.draw();
    });
    canvas.addEventListener('pointercancel', (e) => {
      if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
      pointers.delete(e.pointerId);
      start = undefined;
      oldPinch = 0;
      moved = true;
      this.status('Gesture cancelled. No purchase.');
    });
    canvas.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        this.fitActive = false;
        zoomAt(
          this.camera,
          this.camera.zoom * (e.deltaY < 0 ? 1.1 : 0.9),
          clientPoint({ x: e.clientX, y: e.clientY }, canvas.getBoundingClientRect(), this.camera),
        );
        this.draw();
      },
      { passive: false },
    );
  }
  command(command: string): void {
    if (command === 'fit') {
      this.fitActive = true;
      fitWorld(this.camera);
    } else if (command !== 'rotate') this.fitActive = false;
    if (command === 'recenter') {
      this.camera.x = 30;
      this.camera.y = 30;
    }
    if (command === 'rotate') this.camera.view = ((this.camera.view + 1) % 4) as Camera['view'];
    if (command === 'in' || command === 'out')
      zoomAt(this.camera, this.camera.zoom * (command === 'in' ? 1.25 : 0.8), {
        x: this.camera.width / 2,
        y: this.camera.height / 2,
      });
    if (command === 'left') pan(this.camera, 48, 0);
    if (command === 'right') pan(this.camera, -48, 0);
    if (command === 'up') pan(this.camera, 0, 48);
    if (command === 'down') pan(this.camera, 0, -48);
    this.draw();
  }
  draw(): void {
    const g = this.graphics;
    if (!g) return;
    for (const sprite of this.sprites) sprite.destroy();
    for (const label of this.labels) label.destroy();
    this.labels = [];
    this.hitRecords = [];
    this.sprites = [];
    g.clear();
    const image = (key: string, point: Point, tint = 0xffffff, alpha = 1): void => {
      const f = atlas.frames.find((f) => f.key === key);
      if (!f || !this.scene) throw new Error(`Missing atlas frame ${key}`);
      const p = project(point, this.camera);
      const w = f.native[0],
        h = f.native[1],
        ax = f.anchor[0],
        ay = f.anchor[1];
      if (w === undefined || h === undefined || ax === undefined || ay === undefined)
        throw new Error('Missing anchor');
      const s = this.scene.add
        .image(p.x, p.y, 'foundation', key)
        .setOrigin(ax / w, ay / h)
        .setScale(this.camera.zoom / 2)
        .setTint(tint)
        .setAlpha(alpha);
      this.sprites.push(s);
    };
    for (let y = 0; y < 60; y++)
      for (let x = 0; x < 60; x++) {
        const p = project({ x: x + 0.5, y: y + 0.5 }, this.camera);
        if (p.x < -40 || p.x > this.camera.width + 40 || p.y < -24 || p.y > this.camera.height + 24)
          continue;
        image(
          (x + y * 3) % 6 === 0 ? 'terrain.basalt' : `terrain.basalt.variant${(x + y * 3) % 6}`,
          { x: x + 0.5, y: y + 0.5 },
          x >= 12 && x < 48 && y >= 12 && y < 48 ? 0xffffff : 0x66717c,
        );
      }
    const objects: [string, Point, string, number][] = [
      ['objective.harmonic_core', { x: 30, y: 30 }, 'core', 0],
    ];
    for (const a of this.campaign?.assets ?? []) {
      const r = footprint(a);
      if (!r) continue;
      if (atlas.frames.some((f) => f.key === `${a.type}.view${this.camera.view}`))
        objects.push([
          a.type,
          { x: r.x + r.width / 2, y: r.y + r.height / 2 },
          a.id,
          a.placement?.rotation ?? 0,
        ]);
    }
    objects.sort((a, b) => {
      const pa = project(a[1], this.camera),
        pb = project(b[1], this.camera);
      return pa.y - pb.y || pa.x - pb.x || (a[2] < b[2] ? -1 : a[2] > b[2] ? 1 : 0);
    });
    for (const [key, p, id, rotation] of objects) {
      const artView = (this.camera.view + rotation) % 4;
      const frame = atlas.frames.find((f) => f.key === `${key}.view${artView}`);
      if (!frame) throw new Error('Missing object art');
      const screen = project(p, this.camera),
        scale = this.camera.zoom / 2;
      const [w, h] = frame.native,
        [ax, ay] = frame.anchor;
      if (w === undefined || h === undefined || ax === undefined || ay === undefined)
        throw new Error('Missing hit bounds');
      this.hitRecords.push({
        id,
        x: screen.x - ax * scale,
        y: screen.y - ay * scale,
        width: w * scale,
        height: h * scale,
        foot: p,
      });
      image(`${key}.view${artView}`, p);
      if (this.camera.zoom < 0.65 && this.scene) {
        const text = this.scene.add
          .text(
            screen.x,
            screen.y,
            id === 'core'
              ? 'Core'
              : requireDefinition(this.campaign?.assets.find((a) => a.id === id)?.type ?? 'MISSING')
                  .name,
            {
              fontFamily: 'system-ui',
              fontSize: '16px',
              color: '#ffffff',
              backgroundColor: '#17232e',
            },
          )
          .setOrigin(0.5)
          .setDepth(99998);
        this.labels.push(text);
      }
    }
    const outline = (x: number, y: number, w: number, h: number, color: number): void => {
      const points = [
        { x, y },
        { x: x + w, y },
        { x: x + w, y: y + h },
        { x, y: y + h },
        { x, y },
      ].map((p) => project(p, this.camera));
      g.lineStyle(2, color);
      for (let i = 1; i < points.length; i++) {
        const a = points[i - 1],
          b = points[i];
        if (a && b) g.lineBetween(a.x, a.y, b.x, b.y);
      }
    };
    outline(12, 12, 36, 36, 0x9bb9ae);
    outline(27, 27, 6, 6, 0xe1bf7b);
    outline(29, 33, 2, 2, 0x40baa8);
    for (const [i, entrance] of ENTRANCES.entries()) {
      outline(entrance.x - 2, entrance.y - 2, 4, 4, 0xb18a52);
      const p = project(entrance, this.camera);
      if (
        this.scene &&
        p.x >= 0 &&
        p.x <= this.camera.width &&
        p.y >= 0 &&
        p.y <= this.camera.height
      )
        this.labels.push(
          this.scene.add
            .text(p.x, p.y, `${i + 1}`, {
              fontFamily: 'system-ui',
              fontSize: '18px',
              color: '#e1bf7b',
              backgroundColor: '#17232e',
            })
            .setOrigin(0.5)
            .setDepth(99998),
        );
    }
    // Locked purchase regions remain navigable terrain, never collision walls.
    for (const r of [
      [12, 6, 36, 6],
      [48, 12, 6, 36],
      [12, 48, 36, 6],
      [6, 12, 6, 36],
      [6, 6, 6, 6],
      [48, 6, 6, 6],
      [48, 48, 6, 6],
      [6, 48, 6, 6],
    ]) {
      const [x, y, w, h] = r;
      if (x !== undefined && y !== undefined && w !== undefined && h !== undefined)
        outline(x, y, w, h, 0x617b8d);
    }
    if (this.ghost) {
      const d = foundation[this.ghost.type],
        w = this.ghost.rotation % 2 ? d.height : d.width,
        h = this.ghost.rotation % 2 ? d.width : d.height;
      outline(this.ghost.x, this.ghost.y, w, h, 0xffc266);
      if (atlas.frames.some((f) => f.key === `${this.ghost?.type}.view${this.camera.view}`))
        image(
          `${this.ghost.type}.view${(this.camera.view + this.ghost.rotation) % 4}`,
          { x: this.ghost.x + w / 2, y: this.ghost.y + h / 2 },
          0xe1bf7b,
          0.6,
        );
    }
    g.setDepth(99999);
    const p = project(this.selected, this.camera);
    g.fillStyle(0x58d7c3);
    g.fillCircle(p.x, p.y, 6);
  }
}
