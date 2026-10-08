import type Phaser from 'phaser';
import art from '../../public/assets/combat/manifest.json';
import { combat } from '../data/combat';
import type { Battle, Entity } from '../sim/battle';
import { direction, U } from '../sim/fixed';
import { actorAnimationFrame, eventAnimationFrame } from './animation';
import { PoseDamageBank, type VisualFrame } from './damage';
import { MotionTracker } from './motion';
import { project } from './projection';
import type { WorldView } from './world';

type Frame = (typeof art.frames)[number];
const frames = new Map(art.frames.map((f) => [f.key, f]));
export class CombatRenderer {
  images = new Map<string, Phaser.GameObjects.Image>();
  labels = new Map<string, Phaser.GameObjects.Text>();
  graphics: Phaser.GameObjects.Graphics;
  shadows: Phaser.GameObjects.Graphics;
  knownDeaths = new Set<number>();
  selected = 1;
  range = false;
  reduced = false;
  private interfaceNow = 0;
  private lastBattle: Battle | undefined;
  private health = new Map<number, { hp: number; changed: number }>();
  readonly motion = new MotionTracker();
  private readonly damage: PoseDamageBank;
  constructor(readonly view: WorldView) {
    const scene = view.scene;
    if (!scene) throw new Error('Renderer not ready');
    this.damage = new PoseDamageBank(
      art.atlases.map(
        (_, i) => scene.textures.get(`combat.${i}`).getSourceImage() as HTMLImageElement,
      ),
    );
    this.damage.install(scene);
    this.graphics = scene.add.graphics().setDepth(100000);
    this.shadows = scene.add.graphics().setDepth(1);
    view.onViewChange = () => {
      if (this.lastBattle) this.draw(this.lastBattle);
    };
  }
  private image(
    key: string,
    frame: VisualFrame,
    x: number,
    y: number,
    depth: number,
    scale: number,
  ): Phaser.GameObjects.Image {
    const scene = this.view.scene;
    if (!scene) throw new Error('Missing scene');
    const [tx, ty] = frame.trim,
      [w, h] = frame.rect.slice(2),
      [ax, ay] = frame.anchor;
    if (
      tx === undefined ||
      ty === undefined ||
      w === undefined ||
      h === undefined ||
      ax === undefined ||
      ay === undefined
    )
      throw new Error('Malformed combat anchor');
    let sprite = this.images.get(key);
    if (!sprite) {
      sprite = scene.add.image(0, 0, frame.texture ?? `combat.${frame.atlas}`, frame.key);
      this.images.set(key, sprite);
    }
    sprite
      .setTexture(frame.texture ?? `combat.${frame.atlas}`, frame.key)
      .setPosition(Math.round(x), Math.round(y))
      .setOrigin((ax - tx) / w, (ay - ty) / h)
      .setScale(scale)
      .setDepth(depth)
      .setVisible(true);
    return sprite;
  }
  private frame(e: Entity, b: Battle, alpha: number): Frame {
    return actorAnimationFrame(
      e,
      b.tick,
      this.view.camera.view,
      this.reduced,
      this.motion.sample(e.id, alpha),
    );
  }
  draw(
    b: Battle,
    alpha = 1,
    previous = new Map<number, { x: number; y: number }>(),
    now = this.interfaceNow,
  ): void {
    this.interfaceNow = now;
    this.lastBattle = b;
    const g = this.graphics,
      c = this.view.camera;
    g.clear();
    this.shadows.clear();
    for (const s of this.images.values()) s.setVisible(false);
    for (const t of this.labels.values()) t.setVisible(false);
    this.view.hitRecords = [];
    const drawn: Entity[] = [];
    for (const e of b.entities) {
      if (e.hp === 0 && b.visible(e)) this.knownDeaths.add(e.id);
      if (!b.visible(e) && !this.knownDeaths.has(e.id)) continue;
      drawn.push(e);
      const previousHealth = this.health.get(e.id);
      if (!previousHealth || previousHealth.hp !== e.hp)
        this.health.set(e.id, { hp: e.hp, changed: now });
      const old = previous.get(e.id),
        world = {
          x: (old ? old.x + (e.x - old.x) * alpha : e.x) / U,
          y: (old ? old.y + (e.y - old.y) * alpha : e.y) / U,
        },
        p = project(world, c),
        frame = this.frame(e, b, alpha);
      if (p.x < -100 || p.y < -100 || p.x > c.width + 100 || p.y > c.height + 150) continue;
      this.shadows.fillStyle(0x0d1721, 0.4);
      this.shadows.fillEllipse(
        p.x,
        p.y,
        (e.rect ? (Math.max(e.rect.width, e.rect.height) / U) * 24 : 16) * c.zoom,
        8 * c.zoom,
      );
      const offsets =
        e.type === 'friendly.rifle_squad'
          ? [
              { x: -0.25, y: -0.1 },
              { x: 0.25, y: -0.1 },
              { x: 0, y: 0.2 },
            ]
          : [{ x: 0, y: 0 }];
      for (const [o, n] of offsets.map((o, i) => [o, i] as const)) {
        const pos = project({ x: world.x + o.x, y: world.y + o.y }, c);
        this.image(
          `actor.${e.id}.${n}`,
          frame,
          pos.x,
          pos.y,
          1000 + pos.y + e.id / 1000000 + n / 100000000,
          c.zoom / 2,
        );
        const band =
          e.hp > 0 && e.hp * 100 < e.maxHP * 40
            ? 'damaged'
            : e.hp > 0 && e.hp * 100 <= e.maxHP * 75
              ? 'scuffed'
              : null;
        if (band) {
          const overlay = this.damage.get(frame, band);
          if (overlay)
            this.image(
              `damage.${e.id}.${n}`,
              overlay,
              pos.x,
              pos.y,
              1000 + pos.y + 0.001 + n / 100000000,
              c.zoom / 2,
            );
        }
      }
      if (
        !combat[e.type].radius &&
        e.hp > 0 &&
        e.type !== 'friendly.standard_barricade' &&
        e.type !== 'friendly.proximity_mine'
      ) {
        const light = frames.get(`fx.emissive.${this.reduced ? 0 : Math.floor(b.tick / 10) % 4}`);
        if (!light) throw new Error('Missing light frame');
        this.image(
          `light.${e.id}`,
          light,
          p.x,
          p.y - (frame.native[1] ?? 64) * c.zoom * 0.3,
          1000 + p.y + 0.002,
          c.zoom / 2,
        );
      }
      const contrast = this.view.highContrast,
        color = e.team === 'friendly' ? 0xb8eee0 : 0xffc266,
        shapeSize = Math.max(5, 8 * c.zoom);
      g.lineStyle(contrast ? 3 : 2, 0x111923);
      if (e.team === 'hostile') {
        const pts = [
          { x: p.x, y: p.y - shapeSize },
          { x: p.x + shapeSize, y: p.y },
          { x: p.x, y: p.y + shapeSize },
          { x: p.x - shapeSize, y: p.y },
        ];
        g.strokePoints(pts, true);
        g.lineStyle(contrast ? 2 : 1, contrast ? 0xffffff : color);
        g.strokePoints(pts, true);
        g.lineBetween(p.x - 2, p.y - 2, p.x + 2, p.y + 2);
        g.lineBetween(p.x + 2, p.y - 2, p.x - 2, p.y + 2);
      } else {
        g.lineBetween(p.x - 5, p.y + 2, p.x, p.y + 6);
        g.lineBetween(p.x, p.y + 6, p.x + 5, p.y + 2);
        g.lineStyle(1, contrast ? 0xffffff : color);
        g.lineBetween(p.x - 5, p.y + 2, p.x, p.y + 6);
        g.lineBetween(p.x, p.y + 6, p.x + 5, p.y + 2);
      }
      if (e.id === this.selected) {
        g.lineStyle(4, 0x111923);
        g.strokeCircle(p.x, p.y, 12);
        g.lineStyle(2, 0xffffff);
        g.strokeCircle(p.x, p.y, 12);
        g.lineBetween(p.x - 16, p.y, p.x - 10, p.y);
        g.lineBetween(p.x + 10, p.y, p.x + 16, p.y);
        if (this.range) {
          const r =
            b.definition(e).weapon?.range ??
            (e.type === 'friendly.repair_node'
              ? (b.profile(e.id)?.repair?.range ?? 5 * U)
              : e.type === 'friendly.proximity_mine'
                ? U
                : 0);
          if (r) {
            const points = Array.from({ length: 41 }, (_, i) =>
              project(
                {
                  x: world.x + (Math.cos((i * Math.PI) / 20) * r) / U,
                  y: world.y + (Math.sin((i * Math.PI) / 20) * r) / U,
                },
                c,
              ),
            );
            g.lineStyle(4, 0x111923);
            g.strokePoints(points);
            g.lineStyle(2, 0xffffff);
            g.strokePoints(points);
          }
        }
      }
      if (
        (e.hp < e.maxHP && now - (this.health.get(e.id)?.changed ?? now) < 3000) ||
        e.hp * 100 < e.maxHP * 40 ||
        e.id === this.selected ||
        e.type === 'warden.bulwark' ||
        e.id === 1
      ) {
        const y = p.y - ((frame.anchor[1] ?? 60) * c.zoom) / 2 - 8,
          w = 32;
        g.fillStyle(0x111923);
        g.fillRect(p.x - w / 2 - 2, y - 2, w + 4, 7);
        g.fillStyle(e.hp === 0 ? 0x78848b : color);
        g.fillRect(p.x - w / 2, y, (w * e.hp) / e.maxHP, 3);
        if (e.shield.length) {
          g.lineStyle(2, 0xffffff);
          g.lineBetween(p.x - w / 2, y + 6, p.x + w / 2, y + 6);
        }
      }
      if (e.hp === 0) {
        g.lineStyle(2, 0xffffff);
        g.lineBetween(p.x - 5, p.y - 4, p.x + 5, p.y + 4);
        g.lineBetween(p.x + 5, p.y - 4, p.x - 5, p.y + 4);
      }
      const width = frame.native[0] ?? 48,
        height = frame.native[1] ?? 64,
        anchorY = frame.anchor[1] ?? 60;
      this.view.hitRecords.push({
        id: String(e.id),
        x: p.x - (width * c.zoom) / 4,
        y: p.y - (anchorY * c.zoom) / 2,
        width: Math.max(24, (width * c.zoom) / 2),
        height: Math.max(24, (height * c.zoom) / 2),
        foot: world,
      });
      if (e.mineDue !== null) {
        const r = 1.5,
          points = Array.from({ length: 25 }, (_, i) =>
            project(
              {
                x: world.x + Math.cos((i * Math.PI) / 12) * r,
                y: world.y + Math.sin((i * Math.PI) / 12) * r,
              },
              c,
            ),
          );
        g.lineStyle(4, 0x111923);
        g.strokePoints(points);
        g.lineStyle(2, 0xffffff);
        g.strokePoints(points);
        this.text(`mine.${e.id}`, `△ ${Math.max(0, e.mineDue - b.tick) / 60}s`, p.x + 10, p.y - 24);
      }
      if (e.fieldEnd > b.tick) {
        const points = Array.from({ length: 33 }, (_, i) =>
          project(
            {
              x: world.x + Math.cos((i * Math.PI) / 16) * 4,
              y: world.y + Math.sin((i * Math.PI) / 16) * 4,
            },
            c,
          ),
        );
        g.lineStyle(2, 0xb8eee0);
        g.strokePoints(points);
      }
      if (e.channel) {
        const t = b.get(e.channel);
        if (t && t.hp > 0) {
          const to = project({ x: t.x / U, y: t.y / U }, c);
          g.lineStyle(3, 0x111923);
          g.lineBetween(p.x, p.y - 10, to.x, to.y - 5);
          g.lineStyle(1, 0xb8eee0);
          g.lineBetween(p.x, p.y - 10, to.x, to.y - 5);
        }
      }
    }
    if (this.view.strategicRoles) {
      const groups: { point: { x: number; y: number }; entities: Entity[] }[] = [];
      for (const e of drawn) {
        const p = project({ x: e.x / U, y: e.y / U }, c),
          group = groups.find(
            (a) =>
              a.entities[0]?.team === e.team &&
              Math.abs(a.point.x - p.x) < 30 &&
              Math.abs(a.point.y - p.y) < 30,
          );
        if (group) {
          group.entities.push(e);
          if (e.id === 1) group.point = p;
        } else groups.push({ point: p, entities: [e] });
      }
      this.view.hitRecords = [];
      for (const [index, group] of groups.entries()) {
        const e = group.entities.find((e) => e.id === 1) ?? group.entities[0];
        if (!e || !this.view.scene) continue;
        g.fillStyle(0x111923, 0.96);
        g.fillRoundedRect(group.point.x - 16, group.point.y - 16, 32, 32, 4);
        g.lineStyle(2, 0xffffff);
        g.strokeRoundedRect(group.point.x - 16, group.point.y - 16, 32, 32, 4);
        let icon = this.images.get(`role.${index}`);
        if (!icon) {
          icon = this.view.scene.add.image(0, 0, 'roles', e.type);
          this.images.set(`role.${index}`, icon);
        }
        icon
          .setTexture('roles', e.type)
          .setOrigin(0.5)
          .setScale(1)
          .setDepth(100010)
          .setPosition(Math.round(group.point.x), Math.round(group.point.y))
          .setVisible(true);
        if (group.entities.length > 1)
          this.text(
            `group.${index}`,
            String(group.entities.length),
            group.point.x + 13,
            group.point.y - 17,
          );
        for (const actor of group.entities)
          this.view.hitRecords.push({
            id: String(actor.id),
            x: group.point.x - 18,
            y: group.point.y - 18,
            width: 36,
            height: 36,
            foot: { x: actor.x / U, y: actor.y / U },
          });
      }
    }
    for (const p of b.projectiles) {
      if (p.team === 'hostile' && !b.get(p.source)) continue;
      const pos = project({ x: p.x / U, y: p.y / U }, c),
        f = frames.get('fx.kinetic.0');
      if (f)
        this.image(
          `projectile.${p.id}`,
          f,
          pos.x,
          pos.y,
          100015,
          Math.max(0.5, c.zoom / 2),
        ).setRotation(
          (() => {
            const v = direction(p.heading, U),
              end = project({ x: (p.x + v.x) / U, y: (p.y + v.y) / U }, c);
            return Math.atan2(end.y - pos.y, end.x - pos.x) + Math.atan2(4, 9);
          })(),
        );
    }
    for (const event of b.events) {
      if (!event.visible) continue;
      const f = eventAnimationFrame(event, b.tick, this.reduced);
      if (!f) continue;
      const p = project({ x: event.x / U, y: event.y / U }, c);
      if (f)
        this.image(
          `effect.${event.kind}.${event.tick}.${event.source}.${event.target}`,
          f,
          p.x,
          p.y,
          100020,
          Math.max(0.5, c.zoom / 2),
        );
    }
    for (const [key, sprite] of this.images)
      if (!sprite.visible) {
        sprite.destroy();
        this.images.delete(key);
      }
    for (const [key, text] of this.labels)
      if (!text.visible) {
        text.destroy();
        this.labels.delete(key);
      }
  }
  private text(key: string, value: string, x: number, y: number): void {
    const scene = this.view.scene;
    if (!scene) return;
    let t = this.labels.get(key);
    if (!t) {
      t = scene.add
        .text(0, 0, '', {
          fontFamily: 'system-ui',
          fontSize: '16px',
          color: '#ffffff',
          backgroundColor: '#111923',
        })
        .setDepth(100025);
      this.labels.set(key, t);
    }
    t.setText(value).setPosition(Math.round(x), Math.round(y)).setVisible(true);
  }
  dispose(): void {
    this.view.onViewChange = undefined;
    for (const i of this.images.values()) i.destroy();
    for (const l of this.labels.values()) l.destroy();
    this.graphics.destroy();
    this.shadows.destroy();
  }
}
