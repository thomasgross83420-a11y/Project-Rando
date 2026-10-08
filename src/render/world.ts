import Phaser from 'phaser';
import atlas from '../../public/assets/foundation.json';
import roles from '../../public/assets/roles.json';
import combatArt from '../../public/assets/combat/manifest.json';
import { type RouteAnalysis, PAD } from '../construction/geometry';
import { footprint, type Campaign } from '../persistence/campaign';
import { foundation, type ContentID } from '../data/foundation';
import { ENTRANCES } from '../construction/geometry';
import {
  clientPoint,
  fit as fitWorld,
  fitBase,
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
  fitMode: 'field' | 'base' = 'base';
  highContrast = false;
  routeAnalysis: RouteAnalysis | undefined;
  routesVisible = false;
  routeRadius = 768;
  invalidReason = '';
  scene: Phaser.Scene | undefined;
  sprites: Phaser.GameObjects.Image[] = [];
  private imagePool: Phaser.GameObjects.Image[] = [];
  private labelPool: Phaser.GameObjects.Text[] = [];
  private labelKinds: string[] = [];
  campaign: Campaign | undefined;
  ghost: { type: ContentID; x: number; y: number; rotation: number; valid: boolean } | undefined;
  onSelect: ((point: Point) => void) | undefined;
  onInspect: ((ids: string[]) => void) | undefined;
  hitRecords: {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    foot: Point;
    frame?: string;
    scale?: number;
  }[] = [];
  labels: Phaser.GameObjects.Text[] = [];
  onViewChange: (() => void) | undefined;
  onRendererPause: (() => void) | undefined;
  rendererAvailable = true;
  readonly observer: ResizeObserver;
  backgroundOnly = false;
  selected: Point = { x: 30, y: 30 };
  get strategicRoles(): boolean {
    return this.camera.zoom < 0.65 || (this.fitActive && this.fitMode === 'base');
  }
  constructor(
    readonly parent: HTMLElement,
    readonly status: (message: string) => void,
    readonly combatAssets = false,
  ) {
    const owner = this;
    class Scene extends Phaser.Scene {
      preload(): void {
        this.load.image('foundation', `${import.meta.env.BASE_URL}assets/foundation.png`);
        this.load.image('roles', `${import.meta.env.BASE_URL}assets/roles.png`);
        if (owner.combatAssets)
          for (const [i, a] of combatArt.atlases.entries())
            this.load.image('combat.' + i, import.meta.env.BASE_URL + 'assets/combat/' + a.file);
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
        const icons = this.textures.get('roles');
        for (const f of roles.frames) {
          const [x, y, w, h] = f.rect;
          if (x === undefined || y === undefined || w === undefined || h === undefined)
            throw new Error('Malformed role icon');
          icons.add(f.key, 0, x, y, w, h);
        }
        if (owner.combatAssets) {
          for (const [i] of combatArt.atlases.entries())
            if (!this.textures.exists('combat.' + i)) {
              owner.status(
                'Combat artwork unavailable; checkpoint retained. Return Title and retry when assets load.',
              );
              return;
            }
          for (const f of combatArt.frames) {
            const [x, y, w, h] = f.rect;
            if (x === undefined || y === undefined || w === undefined || h === undefined)
              throw new Error('Invalid combat frame');
            this.textures.get('combat.' + f.atlas).add(f.key, 0, x, y, w, h);
          }
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
      backgroundColor: atlas.lighting.runtimeBackground,
      pixelArt: true,
      antialias: false,
      banner: false,
      audio: { noAudio: true },
      fps: { target: 30 },
      scene: Scene,
    });
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(parent);
    this.game.canvas.setAttribute(
      'aria-label',
      'Fortress world. Use coordinate fields and camera controls below.',
    );
    this.game.canvas.addEventListener('webglcontextlost', (event) => {
      event.preventDefault();
      this.rendererAvailable = false;
      this.onRendererPause?.();
      this.status('Renderer paused. Restoring world…');
    });
    this.game.canvas.addEventListener('webglcontextrestored', () => {
      this.rendererAvailable = true;
      this.draw();
      this.status('Renderer restored. Camera and saved state preserved.');
    });
    this.bindInput();
  }
  dispose(): void {
    this.observer.disconnect();
    this.onViewChange = undefined;
    this.game.destroy(true);
    this.imagePool = [];
    this.labelPool = [];
    this.labelKinds = [];
    this.sprites = [];
    this.labels = [];
  }
  resize(): void {
    const width = this.parent.clientWidth,
      height = this.parent.clientHeight;
    // Title hides the preparation container. Zero-sized WebGL attachments are
    // invalid; retain the last usable size until its layout becomes visible.
    if (width <= 0 || height <= 0) return;
    this.camera.width = width;
    this.camera.height = height;
    if (this.fitActive) (this.fitMode === 'base' ? fitBase : fitWorld)(this.camera);
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
              screen.y < r.y + r.height &&
              (!r.frame ||
                !r.scale ||
                (this.scene?.textures.getPixelAlpha(
                  Math.floor((screen.x - r.x) / r.scale),
                  Math.floor((screen.y - r.y) / r.scale),
                  'foundation',
                  r.frame,
                ) ?? 0) >= 128),
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
    if (command === 'fit' || command === 'fit-base') {
      this.fitActive = true;
      this.fitMode = command === 'fit' ? 'field' : 'base';
      (this.fitMode === 'base' ? fitBase : fitWorld)(this.camera);
    } else if (command !== 'rotate') this.fitActive = false;
    if (command === 'recenter') {
      this.camera.x = 30;
      this.camera.y = 30;
    }
    if (command === 'rotate') {
      this.camera.view = ((this.camera.view + 1) % 4) as Camera['view'];
      if (this.fitActive) (this.fitMode === 'base' ? fitBase : fitWorld)(this.camera);
    }
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
  /** Reuse presentation objects by draw slot; active arrays retain their meaning.
   * Every acquisition resets properties that differ between terrain, actors,
   * strategic icons and translucent ghosts. Hidden surplus stays scene-owned. */
  private pooledImage(texture: string, frame: string): Phaser.GameObjects.Image {
    if (!this.scene) throw new Error('World scene unavailable');
    const index = this.sprites.length;
    let sprite = this.imagePool[index];
    if (!sprite) {
      sprite = this.scene.add.image(0, 0, texture, frame);
      this.imagePool.push(sprite);
    } else if (sprite.texture.key !== texture || sprite.frame.name !== frame)
      sprite.setTexture(texture, frame);
    sprite.setOrigin(0.5).setScale(1).setTint(0xffffff).setAlpha(1).setVisible(true);
    this.sprites.push(sprite);
    return sprite;
  }
  private pooledLabel(
    kind: string,
    text: string,
    x: number,
    y: number,
    style: Phaser.Types.GameObjects.Text.TextStyle,
  ): Phaser.GameObjects.Text {
    if (!this.scene) throw new Error('World scene unavailable');
    const index = this.labels.length;
    let label = this.labelPool[index];
    if (!label) {
      label = this.scene.add.text(x, y, text, style);
      this.labelPool.push(label);
    } else {
      if (this.labelKinds[index] !== kind) label.setStyle(style);
      if (label.text !== text) label.setText(text);
    }
    this.labelKinds[index] = kind;
    label.setPosition(x, y).setOrigin(0).setVisible(true);
    this.labels.push(label);
    return label;
  }
  draw(): void {
    const g = this.graphics;
    if (!g) return;
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
      this.pooledImage('foundation', key)
        .setPosition(p.x, p.y)
        .setOrigin(ax / w, ay / h)
        .setScale(this.camera.zoom / 2)
        .setDepth(key.startsWith('terrain.') ? 0 : 1000 + p.y)
        .setTint(tint)
        .setAlpha(alpha);
    };
    for (let y = 0; y < 60; y++)
      for (let x = 0; x < 60; x++) {
        const p = project({ x: x + 0.5, y: y + 0.5 }, this.camera);
        if (p.x < -40 || p.x > this.camera.width + 40 || p.y < -24 || p.y > this.camera.height + 24)
          continue;
        image(
          (x + y * 3) % 6 === 0 ? 'terrain.basalt' : `terrain.basalt.variant${(x + y * 3) % 6}`,
          { x: x + 0.5, y: y + 0.5 },
          x >= 12 && x < 48 && y >= 12 && y < 48
            ? 0xffffff
            : Number.parseInt(atlas.lighting.unownedTerrainTint.slice(1), 16),
        );
      }
    const objects: [string, Point, string, number][] = this.backgroundOnly
      ? []
      : [['objective.harmonic_core', { x: 30, y: 30 }, 'core', 0]];
    for (const a of this.backgroundOnly ? [] : (this.campaign?.assets ?? [])) {
      const r = footprint(a);
      if (!r) continue;
      if (
        atlas.frames.some((f) => f.key === `${a.type}.view${this.camera.view}`) ||
        (this.combatAssets && combatArt.frames.some((f) => f.content === a.type))
      )
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
      if (
        this.combatAssets &&
        !['objective.harmonic_core', 'friendly.sentry', 'friendly.standard_barricade'].includes(key)
      ) {
        const facing = (1 + this.camera.view * 2 + rotation * 2) % 8;
        const artKey =
          key +
          '.' +
          (['friendly.rifle_squad', 'warden.bulwark'].includes(key)
            ? 'face' + facing
            : 'view' + this.camera.view) +
          '.idle.0';
        const f = combatArt.frames.find((f) => f.key === artKey);
        if (!f || !this.scene) throw new Error('Missing production preparation art ' + artKey);
        const [tx, ty] = f.trim,
          [w, h] = f.rect.slice(2),
          [ax, ay] = f.anchor;
        if (
          tx === undefined ||
          ty === undefined ||
          w === undefined ||
          h === undefined ||
          ax === undefined ||
          ay === undefined
        )
          throw new Error('Invalid trimmed preparation frame');
        for (const o of key === 'friendly.rifle_squad'
          ? [
              { x: -0.25, y: -0.1 },
              { x: 0.25, y: -0.1 },
              { x: 0, y: 0.2 },
            ]
          : [{ x: 0, y: 0 }]) {
          const pos = project({ x: p.x + o.x, y: p.y + o.y }, this.camera);
          this.pooledImage('combat.' + f.atlas, f.key)
            .setPosition(Math.round(pos.x), Math.round(pos.y))
            .setOrigin((ax - tx) / w, (ay - ty) / h)
            .setScale(this.camera.zoom / 2)
            .setDepth(1000 + pos.y);
        }
        const pos = project(p, this.camera);
        this.hitRecords.push({
          id,
          x: pos.x - ((ax - tx) * this.camera.zoom) / 2,
          y: pos.y - ((ay - ty) * this.camera.zoom) / 2,
          width: (w * this.camera.zoom) / 2,
          height: (h * this.camera.zoom) / 2,
          foot: p,
        });
        continue;
      }
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
        frame: `${key}.view${artView}`,
        scale,
      });
      image(`${key}.view${artView}`, p);
    }
    // Strategic icons keep their UI pixel size; ordinary sprites keep native density.
    // Overlapping icon bounds share one badge and the named multi-object picker.
    if (this.strategicRoles && this.scene) {
      const groups: { point: Point; ids: string[]; key: string }[] = [];
      for (const [key, point, id] of objects) {
        const screen = project(point, this.camera);
        const group = groups.find(
          (b) => Math.abs(b.point.x - screen.x) < 28 && Math.abs(b.point.y - screen.y) < 28,
        );
        if (group) {
          group.ids.push(id);
          if (id === 'core') {
            group.key = key;
            group.point = screen;
          }
        } else groups.push({ point: screen, ids: [id], key });
      }
      this.hitRecords = [];
      for (const b of groups) {
        if (!roles.frames.some((f) => f.key === b.key))
          throw new Error(`Missing strategic icon ${b.key}`);
        const p = b.point;
        g.fillStyle(0x111923, 0.96);
        g.fillRoundedRect(p.x - 16, p.y - 16, 32, 32, 4);
        g.lineStyle(this.highContrast ? 3 : 2, 0xb8eee0);
        g.strokeRoundedRect(p.x - 16, p.y - 16, 32, 32, 4);
        this.pooledImage('roles', b.key)
          .setPosition(Math.round(p.x), Math.round(p.y))
          .setDepth(100000);
        if (b.ids.length > 1)
          this.pooledLabel('group', String(b.ids.length), p.x + 13, p.y - 17, {
            fontFamily: 'system-ui',
            fontSize: '16px',
            color: '#ffffff',
            backgroundColor: '#111923',
          }).setDepth(100001);
        for (const id of b.ids) {
          const object = objects.find((o) => o[2] === id);
          if (object)
            this.hitRecords.push({
              id,
              x: p.x - 18,
              y: p.y - 18,
              width: 36,
              height: 36,
              foot: object[1],
            });
        }
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
      // A dark backing preserves boundary contrast on brighter terrain and art.
      // Draw the complete backing first so adjacent colored segments stay clear.
      for (const [width, stroke] of [
        [this.highContrast ? 6 : 4, 0x111923],
        [this.highContrast ? 3 : 2, this.highContrast ? 0xffffff : color],
      ] as const) {
        g.lineStyle(width, stroke);
        for (let i = 1; i < points.length; i++) {
          const a = points[i - 1],
            b = points[i];
          if (a && b) g.lineBetween(a.x, a.y, b.x, b.y);
        }
      }
    };
    if (this.routesVisible && this.routeAnalysis) {
      for (const trace of this.routeAnalysis.traces.filter((t) => t.radius === this.routeRadius)) {
        const points = trace.points.map((p) => project(p, this.camera));
        for (const [width, color] of [
          [5, 0x111923],
          [2, this.highContrast ? 0xffffff : 0xb8eee0],
        ] as const) {
          g.lineStyle(width, color);
          // Dashed routes distinguish previews from solid occupancy boundaries.
          for (let i = 1; i < points.length; i += 2) {
            const a = points[i - 1],
              b = points[i];
            if (a && b) g.lineBetween(a.x, a.y, b.x, b.y);
          }
        }
        if (!trace.valid) {
          const entrance = ENTRANCES[trace.entrance - 1];
          if (entrance) {
            const p = project(entrance, this.camera);
            g.lineStyle(5, 0x111923);
            g.strokeCircle(p.x, p.y, 14);
            g.lineStyle(3, 0xffffff);
            g.lineBetween(p.x - 9, p.y - 9, p.x + 9, p.y + 9);
            g.lineBetween(p.x - 9, p.y + 9, p.x + 9, p.y - 9);
          }
        }
      }
    }
    // Hatching stays in the precinct's free border, never across the Core body.
    for (const [r, step] of [
      [{ x: 27, y: 27, width: 1, height: 6 }, 0.5],
      [{ x: 32, y: 27, width: 1, height: 6 }, 0.5],
      [{ x: 28, y: 27, width: 4, height: 1 }, 0.5],
      [{ x: 28, y: 32, width: 4, height: 1 }, 0.5],
      [PAD, 0.5],
    ] as const) {
      g.lineStyle(1, this.highContrast ? 0xffffff : 0xb8c4cf, 0.65);
      for (let x = r.x; x < r.x + r.width; x += step) {
        const a = project({ x, y: r.y }, this.camera),
          b = project({ x, y: r.y + r.height }, this.camera);
        g.lineBetween(a.x, a.y, b.x, b.y);
      }
    }
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
        this.pooledLabel('entrance', `${i + 1}`, p.x, p.y, {
          fontFamily: 'system-ui',
          fontSize: '18px',
          color: '#e1bf7b',
          backgroundColor: '#17232e',
        })
          .setOrigin(0.5)
          .setDepth(99998);
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
    if (this.ghost && this.scene) {
      const d = foundation[this.ghost.type],
        w = this.ghost.rotation % 2 ? d.height : d.width,
        h = this.ghost.rotation % 2 ? d.width : d.height;
      outline(this.ghost.x, this.ghost.y, w, h, this.ghost.valid ? 0x40baa8 : 0xff6b6b);
      const p = project({ x: this.ghost.x + w / 2, y: this.ghost.y + h / 2 }, this.camera);
      this.pooledLabel('ghost', this.ghost.valid ? '✓' : '×', p.x + 12, p.y + 8, {
        fontFamily: 'system-ui',
        fontSize: '24px',
        color: '#ffffff',
        backgroundColor: '#111923',
      }).setDepth(100001);
      if (atlas.frames.some((f) => f.key === `${this.ghost?.type}.view${this.camera.view}`))
        image(
          `${this.ghost.type}.view${(this.camera.view + this.ghost.rotation) % 4}`,
          { x: this.ghost.x + w / 2, y: this.ghost.y + h / 2 },
          this.ghost.valid ? 0xb9e5d9 : 0xf8ac9e,
          0.6,
        );
    }
    g.setDepth(99999);
    const p = project(this.selected, this.camera);
    g.lineStyle(4, 0x111923);
    g.strokeCircle(p.x, p.y, 7);
    g.lineStyle(2, 0x58d7c3);
    g.strokeCircle(p.x, p.y, 7);
    g.lineBetween(p.x - 10, p.y, p.x + 10, p.y);
    g.lineBetween(p.x, p.y - 10, p.x, p.y + 10);
    for (let i = this.sprites.length; i < this.imagePool.length; i++)
      this.imagePool[i]?.setVisible(false);
    for (let i = this.labels.length; i < this.labelPool.length; i++)
      this.labelPool[i]?.setVisible(false);
    this.parent.dataset.zoom = String(this.camera.zoom);
    this.parent.dataset.orientation = String(this.camera.view * 90);
    this.parent.dataset.presentation = this.strategicRoles ? 'strategic' : 'detailed';
    this.parent.dataset.fit = this.fitActive ? this.fitMode : 'manual';
    this.onViewChange?.();
    this.parent.dataset.roleGroups = String(
      this.strategicRoles ? new Set(this.hitRecords.map((r) => `${r.x},${r.y}`)).size : 0,
    );
  }
}
