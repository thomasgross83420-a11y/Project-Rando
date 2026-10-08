import { compareIDs } from './order';
import Phaser from 'phaser';
import art from '../../public/assets/full/runtime.json';
import {
  project,
  unproject,
  pan,
  zoomAt,
  fitBase,
  type Camera,
  type Point,
} from '../render/projection';
import { ENTRANCES, analyzeRoutes } from '../construction/geometry';
import { friendlyStats } from './stats';
import { definition } from './catalog';
import { footprint, landRects, solidAsset } from './construction';
import { type GameState, maxHealth } from './model';
import type { FullBattle, Entity } from './engine';
interface DrawActor {
  id: string;
  type: string;
  x: number;
  y: number;
  hp: number;
  maximum: number;
  heading: number;
  aim: number;
  moving: boolean;
  firing: boolean;
  pose: number;
  shield: number;
  side: 0 | 1;
  faction: string;
  air: boolean;
  phase: number;
  burrow: boolean;
  jammed: boolean;
  signature: boolean;
}
export class FullView {
  readonly camera: Camera = { x: 30, y: 30, zoom: 1, view: 0, width: 800, height: 600 };
  readonly ready: Promise<void>;
  game: Phaser.Game;
  scene: Phaser.Scene | undefined;
  state: GameState | null = null;
  battle: FullBattle | null = null;
  selected: string | null = null;
  ghost: { type: string; x: number; y: number; rotation: number; valid: boolean } | null = null;
  onTap: (p: Point, id: string | null) => void = () => {};
  onPlacement: (p: Point) => void = () => {};
  private graphics: Phaser.GameObjects.Graphics | undefined;
  private floor: Phaser.GameObjects.Graphics | undefined;
  private coreShape: Phaser.GameObjects.Graphics | undefined;
  private overlay: Phaser.GameObjects.Graphics | undefined;
  contextLost = false;
  routesVisible = false;
  private slowFrames = 0;
  private lastDraw = 0;
  private lastRenderCost = 0;
  private images: Phaser.GameObjects.Image[] = [];
  private used = 0;
  private labels: Phaser.GameObjects.Text[] = [];
  private labelsUsed = 0;
  private hit: { id: string; p: Point; width: number; height: number }[] = [];
  private pointers = new Map<number, Point>();
  private previousPair: { center: Point; distance: number } | null = null;
  private drag = false;
  private gestureStart: Point | null = null;
  private last: Point | null = null;
  private multi = false;
  private terrain: Phaser.GameObjects.Image | undefined;
  private observer: ResizeObserver;
  private faction = 'Fracture';
  private focusFit = true;
  private frame = 0;
  private clips = art.clips as Record<string, number[][]>;
  constructor(readonly parent: HTMLElement) {
    let resolveReady: () => void = () => {};
    this.ready = new Promise<void>((resolve) => {
      resolveReady = resolve;
    });
    const owner = this;
    class Scene extends Phaser.Scene {
      preload() {
        for (const a of art.atlases.filter((a) => a.group === 'friendly' || a.group === 'weapons'))
          this.load.image('full.' + a.file, import.meta.env.BASE_URL + 'assets/full/' + a.file);
      }
      create() {
        owner.scene = this;
        owner.register();
        owner.floor = this.add.graphics().setDepth(-1000);
        owner.coreShape = this.add.graphics();
        owner.overlay = this.add.graphics().setDepth(10000);
        owner.graphics = owner.floor;
        owner.makeTerrain();
        owner.resize();
        resolveReady();
      }
    }
    this.game = new Phaser.Game({
      type: Phaser.AUTO,
      parent,
      backgroundColor: '#141d24',
      width: 800,
      height: 600,
      scene: Scene,
      pixelArt: true,
      antialias: false,
      roundPixels: true,
      audio: { noAudio: true },
      scale: { mode: Phaser.Scale.NONE },
      render: { powerPreference: 'low-power' },
      fps: { target: 60, forceSetTimeOut: false },
    });
    this.game.canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      this.contextLost = true;
    });
    this.game.canvas.addEventListener('webglcontextrestored', () => {
      this.contextLost = false;
    });
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(parent);
    parent.style.touchAction = 'none';
    parent.addEventListener('pointerdown', (e) => this.down(e));
    parent.addEventListener('pointermove', (e) => this.motion(e));
    parent.addEventListener('pointerup', (e) => this.up(e));
    parent.addEventListener('pointercancel', (e) => {
      this.pointers.delete(e.pointerId);
      this.previousPair = null;
      this.multi = true;
    });
    parent.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        this.focusFit = false;
        zoomAt(this.camera, this.camera.zoom * Math.exp(-e.deltaY * 0.001), this.point(e));
      },
      { passive: false },
    );
    parent.addEventListener('keydown', (e) => {
      const moves: Record<string, [number, number]> = {
        ArrowLeft: [40, 0],
        ArrowRight: [-40, 0],
        ArrowUp: [0, 40],
        ArrowDown: [0, -40],
      };
      const m = moves[e.key];
      if (m) {
        e.preventDefault();
        this.focusFit = false;
        pan(this.camera, ...m);
      }
      if (e.key === '+' || e.key === '=') this.zoom(1.15);
      if (e.key === '-') this.zoom(1 / 1.15);
    });
  }
  private register() {
    if (!this.scene) return;
    for (const f of art.images) {
      const texture = this.scene.textures.get('full.' + f.file);
      if (this.scene.textures.exists('full.' + f.file) && !texture.has(f.key))
        texture.add(f.key, 0, ...(f.rect as [number, number, number, number]));
    }
  }
  async ensure(
    faction: string,
    boss: string | null,
    secondary: string | null = null,
  ): Promise<void> {
    await this.ready;
    if (!this.scene) return;
    const groups = [
      'enemy-' + faction,
      ...(secondary ? ['enemy-' + secondary] : []),
      ...(boss ? [boss] : []),
    ];
    const missing = art.atlases.filter(
      (a) => groups.includes(a.group) && !this.scene!.textures.exists('full.' + a.file),
    );
    if (missing.length)
      await new Promise<void>((resolve, reject) => {
        const loader = this.scene!.load;
        loader.once('complete', () => {
          this.register();
          resolve();
        });
        loader.once('loaderror', () =>
          reject(new Error('Combat artwork could not load. Your saved checkpoint is retained.')),
        );
        for (const a of missing)
          loader.image('full.' + a.file, import.meta.env.BASE_URL + 'assets/full/' + a.file);
        loader.start();
      });
    for (const a of art.atlases)
      if (
        ((a.group.startsWith('enemy-') && !groups.includes(a.group)) ||
          (a.group.startsWith('boss.') && !groups.includes(a.group))) &&
        this.scene.textures.exists('full.' + a.file)
      )
        this.scene.textures.remove('full.' + a.file);
    this.faction = faction;
  }
  private makeTerrain() {
    if (!this.scene) return;
    const t = this.scene.textures.createCanvas('full.terrain', 1024, 512);
    if (!t) return;
    const ctx = t.context;
    ctx.fillStyle = '#253238';
    ctx.beginPath();
    ctx.moveTo(512, 0);
    ctx.lineTo(1024, 256);
    ctx.lineTo(512, 512);
    ctx.lineTo(0, 256);
    ctx.closePath();
    ctx.fill();
    for (let x = 0; x < 60; x++)
      for (let y = 0; y < 60; y++) {
        const px = 512 + (x - y) * 8.533,
          py = (x + y) * 4.266;
        const hash = (x * 1619 + y * 3137) % 37;
        ctx.fillStyle = hash < 8 ? '#2b383c' : hash < 12 ? '#26383c' : '#29343a';
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px + 8.533, py + 4.266);
        ctx.lineTo(px, py + 8.533);
        ctx.lineTo(px - 8.533, py + 4.266);
        ctx.closePath();
        ctx.fill();
        if (hash % 9 === 0) {
          ctx.fillStyle = '#364247';
          ctx.fillRect(px - 2, py + 4, 3, 1);
        }
        if ((x < 9 || x > 50 || y < 9 || y > 50) && hash < 5) {
          ctx.fillStyle = '#455354';
          ctx.fillRect(px - 2, py, 3, 4);
          ctx.fillStyle = '#18282d';
          ctx.fillRect(px, py + 3, 3, 2);
        }
      }
    ctx.strokeStyle = '#465459';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(512, 0);
    ctx.lineTo(1024, 256);
    ctx.lineTo(512, 512);
    ctx.lineTo(0, 256);
    ctx.closePath();
    ctx.stroke();
    t.refresh();
    this.terrain = this.scene.add.image(0, 0, 'full.terrain').setDepth(-1000);
  }
  private resize() {
    const r = this.parent.getBoundingClientRect();
    this.camera.width = Math.max(1, Math.round(r.width));
    this.camera.height = Math.max(1, Math.round(r.height));
    this.game.scale.resize(this.camera.width, this.camera.height);
    if (this.focusFit) fitBase(this.camera);
  }
  fit() {
    this.focusFit = true;
    fitBase(this.camera);
  }
  rotate() {
    this.camera.view = ((this.camera.view + 1) % 4) as Camera['view'];
  }
  zoom(factor: number) {
    this.focusFit = false;
    zoomAt(this.camera, this.camera.zoom * factor, {
      x: this.camera.width / 2,
      y: this.camera.height / 2,
    });
  }
  private point(e: PointerEvent | WheelEvent): Point {
    const r = this.parent.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  private pair() {
    const p = [...this.pointers.values()];
    if (p.length < 2) return null;
    return {
      center: { x: (p[0]!.x + p[1]!.x) / 2, y: (p[0]!.y + p[1]!.y) / 2 },
      distance: Math.hypot(p[0]!.x - p[1]!.x, p[0]!.y - p[1]!.y),
    };
  }
  private down(e: PointerEvent) {
    if ((e.target as HTMLElement).closest('button')) return;
    this.parent.setPointerCapture(e.pointerId);
    const p = this.point(e);
    this.pointers.set(e.pointerId, p);
    if (this.pointers.size === 1) {
      this.gestureStart = p;
      this.last = p;
      this.drag = false;
      this.multi = false;
    } else {
      this.multi = true;
      this.previousPair = this.pair();
    }
    e.preventDefault();
  }
  private motion(e: PointerEvent) {
    if (!this.pointers.has(e.pointerId)) return;
    const p = this.point(e);
    this.pointers.set(e.pointerId, p);
    this.focusFit = false;
    if (this.pointers.size >= 2) {
      const pair = this.pair();
      if (pair && this.previousPair) {
        pan(
          this.camera,
          pair.center.x - this.previousPair.center.x,
          pair.center.y - this.previousPair.center.y,
        );
        zoomAt(
          this.camera,
          (this.camera.zoom * pair.distance) / Math.max(1, this.previousPair.distance),
          pair.center,
        );
      }
      this.previousPair = pair;
      this.multi = true;
      return;
    }
    if (this.multi) {
      this.last = p;
      return;
    }
    if (this.gestureStart && Math.hypot(p.x - this.gestureStart.x, p.y - this.gestureStart.y) > 6)
      this.drag = true;
    if (this.ghost) {
      const g = unproject(p, this.camera);
      this.onPlacement({ x: Math.floor(g.x), y: Math.floor(g.y) });
    } else if (this.drag && this.last) pan(this.camera, p.x - this.last.x, p.y - this.last.y);
    this.last = p;
  }
  private up(e: PointerEvent) {
    const p = this.point(e);
    this.pointers.delete(e.pointerId);
    this.previousPair = this.pair();
    if (!this.pointers.size && !this.multi && !this.drag) {
      const world = unproject(p, this.camera);
      const record = [...this.hit]
        .reverse()
        .find(
          (v) =>
            Math.abs(v.p.x - p.x) < Math.max(18, v.width / 2) &&
            p.y >= v.p.y - v.height &&
            p.y <= v.p.y + 8,
        );
      this.onTap({ x: Math.floor(world.x), y: Math.floor(world.y) }, record?.id ?? null);
    }
    if (!this.pointers.size) {
      this.gestureStart = null;
      this.last = null;
      this.multi = false;
    }
  }
  private image(
    key: string,
    p: Point,
    depth: number,
    scale: number,
    alpha = 1,
  ): Phaser.GameObjects.Image | undefined {
    if (!this.scene) return;
    const [group, type, direction, pose] = key.split('|'),
      index = this.clips[`${group}|${type}`]?.[Number(direction)]?.[Number(pose)],
      f = index === undefined ? undefined : art.images[index];
    if (!f || !this.scene.textures.exists('full.' + f.file)) return;
    let image = this.images[this.used];
    if (!image) {
      image = this.scene.add.image(0, 0, 'full.' + f.file, f.key);
      this.images.push(image);
    } else image.setTexture('full.' + f.file, f.key);
    this.used++;
    image
      .setVisible(true)
      .setPosition(p.x, p.y)
      .setDepth(depth)
      .setOrigin(f.pivot[0]! / f.rect[2]!, f.pivot[1]! / f.rect[3]!)
      .setScale(scale)
      .setAlpha(alpha)
      .clearTint();
    return image;
  }
  private label(text: string, p: Point, color = '#c8d8df', size = 12) {
    if (!this.scene) return;
    let t = this.labels[this.labelsUsed];
    if (!t) {
      t = this.scene.add
        .text(0, 0, '', { fontFamily: 'sans-serif', fontSize: 12, color: '#c8d8df' })
        .setOrigin(0.5);
      this.labels.push(t);
    }
    this.labelsUsed++;
    t.setVisible(true)
      .setText(text)
      .setPosition(p.x, p.y)
      .setColor(color)
      .setFontSize(size)
      .setDepth(30000);
  }
  private diamond(
    x: number,
    y: number,
    w: number,
    h: number,
    color: number,
    alpha: number,
    line?: number,
  ) {
    const g = this.graphics!;
    const points = [
      project({ x, y }, this.camera),
      project({ x: x + w, y }, this.camera),
      project({ x: x + w, y: y + h }, this.camera),
      project({ x, y: y + h }, this.camera),
    ];
    g.fillStyle(color, alpha);
    g.fillPoints(points, true);
    if (line) {
      g.lineStyle(1, line, 0.7);
      g.strokePoints(points, true);
    }
  }
  private circle(point: Point, radius: number, color: number, alpha = 0.3) {
    const g = this.graphics!,
      p = project({ x: point.x / 1024, y: point.y / 1024 }, this.camera);
    g.fillStyle(color, alpha);
    g.fillEllipse(
      p.x,
      p.y,
      (radius / 1024) * 45.254834 * this.camera.zoom,
      (radius / 1024) * 22.627417 * this.camera.zoom,
    );
    g.lineStyle(2, color, 0.9);
    g.strokeEllipse(
      p.x,
      p.y,
      (radius / 1024) * 45.254834 * this.camera.zoom,
      (radius / 1024) * 22.627417 * this.camera.zoom,
    );
  }
  render() {
    if (!this.scene || !this.graphics || !this.state) return;
    if (this.contextLost) return;
    const now = performance.now(),
      low =
        this.state.settings.quality === 'Low' ||
        (this.state.settings.quality === 'Auto' && this.slowFrames >= 90);
    if (low && now - this.lastDraw < 32) return;
    this.lastDraw = now;
    this.frame = this.battle?.tick ?? this.frame + 1;
    this.graphics = this.floor!;
    let g = this.graphics;
    const z = this.camera.zoom;
    this.floor!.clear();
    this.coreShape!.clear();
    this.overlay!.clear();
    if (this.lastRenderCost > 12) this.slowFrames = Math.min(120, this.slowFrames + 1);
    else this.slowFrames = Math.max(0, this.slowFrames - 0.25);
    this.used = 0;
    this.labelsUsed = 0;
    this.hit = [];
    const center = project({ x: 30, y: 30 }, this.camera);
    this.terrain
      ?.setPosition(center.x, center.y)
      .setScale(1.875 * z)
      .setRotation(0);
    for (const r of landRects(this.state))
      this.diamond(r.x, r.y, r.width, r.height, 0x48616a, 0.08, 0x547b80);
    this.diamond(27, 27, 6, 6, 0x609297, 0.12, 0x648a8f);
    this.diamond(29, 33, 2, 2, 0xd3a459, 0.15, 0xd3a459);
    for (let i = 0; i < ENTRANCES.length; i++) {
      const e = ENTRANCES[i]!,
        p = project(e, this.camera);
      g.fillStyle(0x4a6870, 0.6);
      g.fillEllipse(p.x, p.y, 24 * z, 12 * z);
      this.label(String(i + 1), p, '#a3b8bd', 12);
    }
    this.groundAppearance();
    this.graphics = this.overlay!;
    g = this.graphics;
    this.drawRoutes();
    const actors: DrawActor[] = this.battle
      ? this.battle.entities
          .filter(
            (e) =>
              e.side === 0 ||
              (this.battle!.perceived(e) && (e.hp > 0 || this.battle!.tick - e.lastDamage < 36)),
          )
          .map((e) => this.actor(e))
      : this.state.assets
          .filter((a) => a.placement)
          .map((a) => {
            const r = footprint(a)!,
              d = definition(a.type);
            return {
              id: a.id,
              type: a.type,
              x: r.x + r.width / 2,
              y: r.y + r.height / 2,
              hp: a.hp,
              maximum: maxHealth(a),
              heading: (Math.round(16384 - (a.tactics.heading * 65536) / 360) + 65536) % 65536,
              aim: (Math.round(16384 - (a.tactics.heading * 65536) / 360) + 65536) % 65536,
              moving: false,
              firing: false,
              pose: 0,
              shield: 0,
              side: 0,
              faction: this.faction,
              air: d.layer === 'air',
              phase: 1,
              burrow: false,
              jammed: false,
              signature: false,
            };
          });
    if (!this.battle)
      actors.push({
        id: 'core',
        type: 'objective.harmonic_core',
        x: 30,
        y: 30,
        hp: this.state.coreHP,
        maximum: 10240000,
        heading: 0,
        aim: 0,
        moving: false,
        firing: false,
        pose: 0,
        shield: 0,
        side: 0,
        faction: this.faction,
        air: false,
        phase: 1,
        burrow: false,
        jammed: false,
        signature: false,
      });
    actors.sort(
      (a, b) => project(a, this.camera).y - project(b, this.camera).y || compareIDs(a.id, b.id),
    );
    for (const a of actors) {
      const foot = project(a, this.camera),
        p = project(
          a,
          this.camera,
          a.type === 'boss.shatterstorm' ? 2 : a.air ? 1 : this.mounted(a.type, a.x, a.y) ? 0.5 : 0,
        ),
        color = a.side ? 0xe48478 : 0x79d8d8;
      if (a.burrow) {
        this.circle({ x: a.x * 1024, y: a.y * 1024 }, 512, 0xa19b72, 0.2);
        continue;
      }
      if (a.type === 'objective.harmonic_core') {
        this.graphics = this.coreShape!;
        this.coreShape!.setDepth(p.y);
        this.coreArt(p, a.hp / a.maximum);
        this.coreAppearance(p);
        this.graphics = this.overlay!;
        continue;
      }
      if (a.id === this.selected) {
        const e = this.battle?.entities.find((e) => (e.owned ?? String(e.id)) === a.id),
          owned = this.state.assets.find((v) => v.id === a.id);
        const range = e?.stats.range ?? (owned ? friendlyStats(owned).range : 0);
        if (range > 0) this.circle({ x: a.x * 1024, y: a.y * 1024 }, range, 0x79d9d0, 0.06);
      }
      if (a.id === this.selected) this.diamond(a.x - 1, a.y - 1, 2, 2, 0xd3a459, 0.16, 0xe8bf70);
      this.floor!.fillStyle(0x071319, 0.28);
      this.floor!.fillEllipse(foot.x, foot.y, 26 * z, 12 * z);
      const d = definition(a.type),
        dirCount = d.speed || d.category === 'boss' ? 8 : 4,
        dir =
          Math.round(((a.heading - this.camera.view * 16384 + 65536) / 65536) * dirCount) %
          dirCount;
      const pose = this.battle ? a.pose : Math.floor(this.frame / 10) % 4;
      const group = a.side ? (d.category === 'boss' ? d.id : 'enemy-' + a.faction) : 'friendly';
      const sprite = this.image(
        `${group}|${a.type}|${dir}|${pose}`,
        p,
        p.y,
        2 * z,
        a.hp === 0 ? 0.35 : 1,
      );
      if (z < 0.9)
        this.label(
          this.roleIcon(d.category, d.weapon),
          { x: p.x, y: p.y - 26 },
          a.side ? '#f3b3aa' : '#abeddf',
          13,
        );
      if (a.hp === 0) sprite?.setTint(0x677477);
      else if (a.jammed) sprite?.setTint(0xcaa0d3);
      const aimDir = Math.round(((a.aim - this.camera.view * 16384 + 65536) / 65536) * 8) % 8;
      if (a.hp > 0 && d.weapon !== 'none' && d.weapon !== 'melee')
        this.image(`weapons|${a.type}|${aimDir}|${a.firing ? 1 : 0}`, p, p.y + 0.1, 2 * z);
      if (a.hp < a.maximum || a.id === this.selected || d.category === 'boss') {
        const width = d.category === 'boss' ? 64 : 36,
          hp = Math.max(0, a.hp / a.maximum);
        g.fillStyle(0x101a21, 0.9);
        g.fillRect(p.x - width / 2, p.y - 61 * z, width, 4);
        g.fillStyle(a.hp === 0 ? 0x687982 : color, 1);
        g.fillRect(p.x - width / 2, p.y - 61 * z, width * hp, 4);
      }
      if (a.shield) {
        g.lineStyle(1, 0x88c9ee, 0.7);
        g.strokeEllipse(p.x, p.y - 16 * z, 38 * z, 38 * z);
      }
      if (a.jammed) this.label('JAM', { x: p.x, y: p.y - 70 * z }, '#d7a6dc', 11);
      if (a.signature) this.label('✦', { x: p.x + 18 * z, y: p.y - 44 * z }, '#e8c473', 16);
      if (d.category === 'boss')
        this.label(`${d.name} · ${a.phase}`, { x: p.x, y: p.y - 88 * z }, '#e9c5e9', 14);
      this.hit.push({ id: a.id, p, width: 52 * z, height: 70 * z });
    }
    if (this.battle) {
      for (const warning of this.battle.warnings) {
        const color = warning.side ? 0xe78c6c : 0x6ed5d6;
        if (warning.kind === 'circle') this.circle(warning.point, warning.radius, color, 0.2);
        else if (warning.kind === 'line' || warning.kind === 'cone') {
          const points: Point[] = [];
          if (warning.kind === 'line') {
            const left = this.offset({ x: 0, y: 0 }, warning.angle + 16384, warning.width / 2);
            for (const [p, sign] of [
              [warning.origin, 1],
              [warning.point, 1],
              [warning.point, -1],
              [warning.origin, -1],
            ] as const)
              points.push(
                project(
                  { x: (p.x + left.x * sign) / 1024, y: (p.y + left.y * sign) / 1024 },
                  this.camera,
                ),
              );
          } else {
            points.push(
              project({ x: warning.origin.x / 1024, y: warning.origin.y / 1024 }, this.camera),
            );
            for (let i = 0; i <= 24; i++) {
              const p = this.offset(
                warning.origin,
                warning.angle - 8192 + (i * 16384) / 24,
                warning.radius,
              );
              points.push(project({ x: p.x / 1024, y: p.y / 1024 }, this.camera));
            }
          }
          g.fillStyle(color, 0.2);
          g.fillPoints(points, true);
          g.lineStyle(2, color, 0.85);
          g.strokePoints(points, true);
        }

        const label = project(
          { x: warning.point.x / 1024, y: warning.point.y / 1024 },
          this.camera,
        );
        this.label(
          `${warning.label} · ${Math.max(0, (warning.due - this.battle.tick) / 60).toFixed(1)}s`,
          { x: label.x, y: label.y - 12 },
          '#f6d1ab',
          13,
        );
      }
      for (const p of this.battle.projectiles) {
        const a = project(
            { x: p.previous.x / 1024, y: p.previous.y / 1024 },
            this.camera,
            p.layer === 'air' ? 1 : 0,
          ),
          b = project({ x: p.x / 1024, y: p.y / 1024 }, this.camera, p.layer === 'air' ? 1 : 0);
        g.lineStyle(2, p.side ? 0xe5a194 : 0xf5dcaa, 0.95);
        g.lineBetween(a.x, a.y, b.x, b.y);
      }
      for (const e of this.battle.effects) {
        const a = project({ x: e.from.x / 1024, y: e.from.y / 1024 }, this.camera),
          b = project({ x: e.to.x / 1024, y: e.to.y / 1024 }, this.camera),
          color =
            e.kind === 'heal'
              ? 0x9acb91
              : e.kind === 'jam'
                ? 0xbe9dd1
                : e.side
                  ? 0xe79879
                  : 0x73d2d2;
        if (['arc', 'beam', 'heal', 'rearm'].includes(e.kind)) {
          g.lineStyle(e.kind === 'beam' ? 2 : 1, color, 0.7);
          g.lineBetween(a.x, a.y - 25 * z, b.x, b.y - 25 * z);
        } else if (!this.state.settings.reducedEffects) {
          g.lineStyle(1, color, 0.6);
          g.strokeEllipse(b.x, b.y, 30 * z, 15 * z);
        }
      }
    }
    this.lastRenderCost = performance.now() - now;
    if (this.ghost) {
      const d = definition(this.ghost.type),
        r = this.ghost.rotation % 2;
      this.diamond(
        this.ghost.x,
        this.ghost.y,
        r ? d.height : d.width,
        r ? d.width : d.height,
        this.ghost.valid ? 0x79d9b8 : 0xe88577,
        0.35,
        this.ghost.valid ? 0x9ef3cf : 0xe88577,
      );
    }
    for (let i = this.used; i < this.images.length; i++) this.images[i]!.setVisible(false);
    for (let i = this.labelsUsed; i < this.labels.length; i++) this.labels[i]!.setVisible(false);
  }
  private offset(p: Point, angle: number, magnitude: number) {
    const a = (-angle / 65536) * Math.PI * 2;
    return { x: p.x + Math.cos(a) * magnitude, y: p.y + Math.sin(a) * magnitude };
  }
  private roleIcon(category: string, weapon: string) {
    return category === 'warden'
      ? '◆'
      : category === 'support' || category === 'infrastructure'
        ? '✚'
        : category === 'trap'
          ? '◇'
          : category === 'route'
            ? '▰'
            : weapon === 'mortar'
              ? '⌒'
              : weapon === 'beam'
                ? '━'
                : weapon === 'arc'
                  ? 'ϟ'
                  : weapon === 'guided'
                    ? '↟'
                    : '•';
  }
  jump(p: Point) {
    this.camera.x = p.x;
    this.camera.y = p.y;
  }
  private mounted(type: string, x: number, y: number) {
    return (
      type !== 'objective.harmonic_core' &&
      definition(type).category === 'tower' &&
      this.state?.assets.some(
        (a) =>
          a.type === 'friendly.elevated_firing_platform' &&
          (this.battle
            ? this.battle.entities.some((e) => e.owned === a.id && e.hp > 0)
            : a.hp > 0) &&
          a.placement?.x === x - 1 &&
          a.placement?.y === y - 1,
      )
    );
  }
  tacticalMap(): string {
    if (!this.state) return '';
    const circles = new Map<
      string,
      { x: number; y: number; side: number; air: boolean; count: number; boss: boolean }
    >();
    const bodies = this.battle
      ? this.battle
          .alive()
          .filter((e) => e.side === 0 || this.battle!.perceived(e))
          .map((e) => ({
            x: e.x / 1024,
            y: e.y / 1024,
            side: e.side,
            air: e.d.layer === 'air',
            boss: e.d.category === 'boss',
          }))
      : this.state.assets
          .filter((a) => a.placement)
          .map((a) => ({
            x: a.placement!.x + 1,
            y: a.placement!.y + 1,
            side: 0,
            air: definition(a.type).layer === 'air',
            boss: false,
          }));
    for (const b of bodies) {
      const key = `${Math.round(b.x / 2)}|${Math.round(b.y / 2)}|${b.side}|${b.air}`;
      const prior = circles.get(key);
      if (prior) {
        prior.count++;
        prior.boss ||= b.boss;
      } else circles.set(key, { ...b, count: 1 });
    }
    const rects = landRects(this.state)
      .map(
        (r) =>
          `<rect x="${r.x}" y="${r.y}" width="${r.width}" height="${r.height}" fill="#344d51" stroke="#65877d" stroke-width=".15"/>`,
      )
      .join('');
    const bounds = [
      { x: 0, y: 0 },
      { x: this.camera.width, y: 0 },
      { x: this.camera.width, y: this.camera.height },
      { x: 0, y: this.camera.height },
    ].map((p) => unproject(p, this.camera));
    const markers = [...circles.values()]
      .map(
        (b) =>
          `<${b.air ? 'path' : 'circle'} ${b.air ? `d="M${b.x} ${b.y - 1}l1 1-1 1-1-1z"` : `cx="${b.x}" cy="${b.y}" r="${b.boss ? 1.4 : 0.7}"`} fill="${b.side ? '#ed997a' : '#79d8d8'}"/>${b.count > 1 ? `<text x="${b.x + 1}" y="${b.y}" fill="#fff" font-size="2">${b.count}</text>` : ''}`,
      )
      .join('');
    const warnings = (this.battle?.warnings ?? [])
      .filter(
        (w) =>
          w.side === 0 ||
          this.battle!.entities.some((e) => e.id === w.owner && this.battle!.perceived(e)),
      )
      .map(
        (w) =>
          `<circle cx="${w.point.x / 1024}" cy="${w.point.y / 1024}" r="${Math.max(1, w.radius / 1024)}" stroke="#efb772" stroke-width=".35" fill="none"/>`,
      )
      .join('');
    return `<svg data-map class="tactical-map" viewBox="0 0 60 60" role="img" aria-label="North-up tactical field overview. Touch a zone to pan."><rect width="60" height="60" fill="#19232d"/>${rects}${ENTRANCES.map((p, i) => `<text x="${Math.max(1, Math.min(57, p.x))}" y="${Math.max(3, Math.min(59, p.y))}" fill="#e6c18b" font-size="3">${i + 1}</text>`).join('')}${warnings}${markers}<rect x="28" y="28" width="4" height="4" fill="#dfc680"/><polygon points="${bounds.map((p) => `${p.x},${p.y}`).join(' ')}" fill="none" stroke="#e5e3d4" stroke-width=".3"/><text x="28" y="3" fill="#e5e3d4" font-size="2.5">N ↑</text></svg>`;
  }
  private drawRoutes() {
    if (!this.routesVisible || !this.state) return;
    const obstacles = this.state.assets
      .filter((a) => a.placement && a.hp && solidAsset(a))
      .map((a) => footprint(a)!);
    for (const radius of [0.35, 0.75])
      for (const trace of analyzeRoutes(obstacles, [Math.round(radius * 1024)]).traces) {
        if (!trace.valid) continue;
        const points = trace.points.map((p) => project(p, this.camera));
        this.graphics!.lineStyle(1, radius === 0.35 ? 0x88ccb9 : 0xd5ad72, 0.4);
        this.graphics!.strokePoints(points, false);
      }
    for (const a of this.state.assets.filter((a) => a.placement && definition(a.type).speed > 0)) {
      const p = project(a.tactics.anchor, this.camera);
      this.graphics!.lineStyle(1, 0x8bd3db, 0.6);
      this.graphics!.strokeCircle(p.x, p.y, 5);
    }
  }
  private groundAppearance() {
    const a = this.state!.appearance,
      g = this.floor!;
    if (!a.ground) return;
    const tint = a.ground === 'COS01' ? 0x73858b : a.ground === 'COS02' ? 0x74618b : 0x667862;
    for (const r of landRects(this.state!)) {
      this.diamond(r.x, r.y, r.width, r.height, tint, 0.16);
      for (let x = r.x; x < r.x + r.width; x += 3) {
        const from = project({ x, y: r.y }, this.camera),
          to = project({ x, y: r.y + r.height }, this.camera);
        g.lineStyle(1, tint, 0.35);
        g.lineBetween(from.x, from.y, to.x, to.y);
      }
      for (let y = r.y; y < r.y + r.height; y += 3) {
        const from = project({ x: r.x, y }, this.camera),
          to = project({ x: r.x + r.width, y }, this.camera);
        g.lineBetween(from.x, from.y, to.x, to.y);
      }
    }
  }
  private coreAppearance(p: Point) {
    const a = this.state!.appearance,
      g = this.coreShape!,
      z = this.camera.zoom;
    if (a.trim) {
      g.lineStyle(2, a.trim === 'COS07' ? 0xc5d0d4 : a.trim === 'COS08' ? 0xd3a459 : 0xb69cdb, 1);
      g.strokeEllipse(p.x, p.y, 110 * z, 54 * z);
    }
    if (a.banner) {
      for (const side of a.banner === 'COS05' ? [-1, 1] : [1]) {
        const x = p.x + side * 48 * z;
        g.lineStyle(2, 0x8b9a9f, 1);
        g.lineBetween(x, p.y - 6 * z, x, p.y - 61 * z);
        g.fillStyle(0x72cfc8, 1);
        g.fillPoints(
          [
            { x, y: p.y - 61 * z },
            { x: x + side * 18 * z, y: p.y - 54 * z },
            { x: x + side * 11 * z, y: p.y - 42 * z },
            { x, y: p.y - 46 * z },
          ],
          true,
        );
      }
    }
    if (a.plaque) {
      g.fillStyle(0xb49d71, 1);
      g.fillRect(p.x - 18 * z, p.y + 19 * z, 36 * z, 8 * z);
      g.lineStyle(1, 0x37464d, 1);
      g.lineBetween(p.x - 12 * z, p.y + 23 * z, p.x + 12 * z, p.y + 23 * z);
      if (a.plaque === 'COS12') {
        g.lineStyle(2, 0xd3a459, 1);
        g.strokeEllipse(p.x, p.y - 36 * z, 115 * z, 92 * z);
      }
    }
  }
  private actor(e: Entity): DrawActor {
    return {
      id: e.owned ?? String(e.id),
      type: e.d.id,
      x: e.x / 1024,
      y: e.y / 1024,
      hp: e.hp,
      maximum: e.stats.health,
      heading: e.heading,
      aim: e.aim,
      moving: e.lastMove === this.battle?.tick,
      firing: (this.battle?.tick ?? 0) - e.lastFire < 8,
      pose: !e.hp
        ? 22 + Math.min(5, Math.floor(((this.battle?.tick ?? 0) - e.lastDamage) / 6))
        : e.abilityCast || e.signature === 'active'
          ? 28 + (Math.floor((this.battle?.tick ?? 0) / 5) % 8)
          : (this.battle?.tick ?? 0) - e.lastFire < 20
            ? 16 + (Math.floor(((this.battle?.tick ?? 0) - e.lastFire) / 5) % 4)
            : (this.battle?.tick ?? 0) - e.lastDamage < 15
              ? 20 + (Math.floor(((this.battle?.tick ?? 0) - e.lastDamage) / 8) % 2)
              : e.warmup
                ? 12 + (Math.floor((this.battle?.tick ?? 0) / 5) % 4)
                : e.lastMove >= (this.battle?.tick ?? 0) - 2
                  ? 4 + (Math.floor((this.battle?.tick ?? 0) / 6) % 8)
                  : Math.floor((this.battle?.tick ?? 0) / 10) % 4,
      shield:
        e.shield +
        e.bonusPools.reduce((n, p) => n + p.capacity, 0) +
        (e.slotOwner
          ? (this.battle?.entities.find((v) => v.id === e.slotOwner)?.slots[e.id] ?? 0)
          : 0),
      side: e.side,
      faction: e.faction,
      air: e.d.layer === 'air',
      phase: e.phase,
      burrow: e.burrow,
      jammed: e.jamUntil > (this.battle?.tick ?? 0),
      signature: e.signature === 'active',
    };
  }
  private coreArt(p: Point, health: number) {
    const g = this.graphics!,
      z = this.camera.zoom;
    g.fillStyle(0x15232b, 1);
    g.fillEllipse(p.x, p.y, 120 * z, 60 * z);
    g.lineStyle(3, 0x55717e, 1);
    g.strokeEllipse(p.x, p.y, 108 * z, 54 * z);
    g.fillStyle(0x3c5362, 1);
    g.fillPoints(
      [
        { x: p.x - 30 * z, y: p.y },
        { x: p.x - 25 * z, y: p.y - 48 * z },
        { x: p.x, y: p.y - 64 * z },
        { x: p.x + 25 * z, y: p.y - 48 * z },
        { x: p.x + 30 * z, y: p.y },
        { x: p.x, y: p.y + 15 * z },
      ],
      true,
    );
    g.fillStyle(0x78dddd, 0.8);
    g.fillPoints(
      [
        { x: p.x, y: p.y - 72 * z },
        { x: p.x + 11 * z, y: p.y - 41 * z },
        { x: p.x, y: p.y - 15 * z },
        { x: p.x - 11 * z, y: p.y - 41 * z },
      ],
      true,
    );
    g.lineStyle(2, 0xc1f3ec, 0.8);
    g.lineBetween(p.x, p.y - 71 * z, p.x, p.y - 17 * z);
    g.fillStyle(0x121c23, 1);
    g.fillRect(p.x - 32, p.y - 86 * z, 64, 5);
    g.fillStyle(0x77d8d2, 1);
    g.fillRect(p.x - 32, p.y - 86 * z, 64 * health, 5);
    this.hit.push({ id: 'core', p, width: 112 * z, height: 100 * z });
  }
  destroy() {
    this.observer.disconnect();
    this.game.destroy(true);
  }
}
