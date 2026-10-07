import { foundation } from '../data/foundation';
import { combat, tuning, type CombatID } from '../data/combat';
import { CORE, ENTRANCES, edgeClear, type Rect } from '../construction/geometry';
import { RandomStream } from './determinism';
import {
  U,
  direction,
  bearing,
  angleError,
  turn,
  distance,
  delta,
  divRound,
  type Vec,
} from './fixed';
import { boundary, nearest, sweep, type Shape } from './collision';
import { SpatialIndex } from './spatial';
import { Flow, cellIndex } from './navigation';
import {
  tutorialPlan,
  tutorialSchema,
  startSchema,
  type TutorialPlan,
  type StartAsset,
} from './tutorial';
export type Action =
  | 'Idle'
  | 'Moving'
  | 'Aiming'
  | 'Firing'
  | 'Channeling'
  | 'Casting'
  | 'Hit'
  | 'Incapacitated'
  | 'Wrecked'
  | 'Destroyed';
interface Shield {
  pool: number;
  expires: number;
  heading: number;
  source: number;
}
interface Cast {
  ability: 0 | 1 | 2;
  release: number;
  recipient: number;
  point: Vec;
  heading: number;
}
interface Contact extends Vec {
  id: number;
  hp: number;
  armor: number;
  target: number;
  tick: number;
  type: CombatID;
}
export interface Entity extends Shape {
  id: number;
  type: CombatID;
  team: 'friendly' | 'hostile';
  hp: number;
  maxHP: number;
  heading: number;
  turnCarry: number;
  carryX: number;
  carryY: number;
  anchor: Vec;
  target: number;
  commitUntil: number;
  warmup: number | null;
  lastRelease: number;
  state: Action;
  reason: string;
  contacts: Contact[];
  memory: Contact[];
  lastHit: number;
  lastAction: number;
  lastAbility: number;
  lastMove: number;
  progressPoint: Vec;
  lastProgress: number;
  goal: Vec | null;
  shield: Shield[];
  reduction: number;
  charges: number;
  mineDue: number | null;
  channel: number;
  channelPulse: number;
  channelCommit: number;
  cast: Cast | null;
  dash: { end: number; recipient: number; point: Vec; heading: number } | null;
  abilities: [number, number, number];
  fieldEnd: number;
  challenge: { owner: number; expires: number } | null;
  deadTick: number | null;
  rampartArmor: number;
}
export interface Projectile extends Vec {
  id: number;
  source: number;
  team: Entity['team'];
  target: number;
  heading: number;
  speed: number;
  carryX: number;
  carryY: number;
  raw: number;
  traveled: number;
  maxTravel: number;
  sequence: number;
  release: Vec;
}
export interface BattleEvent {
  tick: number;
  kind: string;
  source: number;
  target: number;
  x: number;
  y: number;
  value: number;
  message: string;
  visible: boolean;
}
interface Impact {
  fraction: number;
  source: number;
  sequence: number;
  target: number;
  raw: number;
  origin: Vec;
}
const fixedRect = (r: Rect): Rect => ({
  x: r.x * U,
  y: r.y * U,
  width: r.width * U,
  height: r.height * U,
});
export class Battle {
  tick = 0;
  director = 0;
  cleanupTick: number | null = null;
  private alerts = new Map<number, { fifty: boolean; critical: boolean; warden: boolean }>();
  packet = 0;
  state: 'Siege' | 'Cleanup' | 'Victory' | 'Defeat' | 'Stalemate' = 'Siege';
  reason = '';
  entities: Entity[] = [];
  projectiles: Projectile[] = [];
  events: BattleEvent[] = [];
  eventSequence = 0;
  projectileSequence = 0;
  kills = 0;
  destroyedTP = 0;
  victoryQuiet = 0;
  inevitableTicks = 0;
  lastMeaningful = 0;
  topology = 0;
  private spatial = new SpatialIndex<Entity>();
  private dirty = true;
  private flows = new Map<string, Flow>();
  private detected = new Set<number>();
  private impacts: Impact[] = [];
  constructor(
    readonly plan: TutorialPlan,
    readonly accuracy: RandomStream,
    army: StartAsset[],
  ) {
    tutorialSchema.parse(plan);
    this.add(
      1,
      'objective.harmonic_core',
      'friendly',
      { x: 30 * U, y: 30 * U },
      fixedRect(CORE),
      combat['objective.harmonic_core'].hp,
    );
    if (new Set(army.map((a) => a.uuid.toLowerCase())).size !== army.length)
      throw new Error('Duplicate army UUID');
    const sorted = army
      .map((a) => startSchema.parse(a))
      .sort((a, b) => (a.uuid < b.uuid ? -1 : a.uuid > b.uuid ? 1 : 0));
    if (sorted.length > tuning.allyCap) throw new Error('Friendly cap');
    for (const [a, index] of sorted.map((a, i) => [a, i] as const)) {
      if (a.type.startsWith('enemy.') || a.type === 'objective.harmonic_core')
        throw new Error('Invalid tutorial army');
      const d = foundation[a.type as keyof typeof foundation],
        rotated = (a.heading / 16384) % 2;
      if (
        !d ||
        a.heading % 16384 ||
        a.width !== (rotated ? d.height : d.width) ||
        a.height !== (rotated ? d.width : d.height)
      )
        throw new Error('Army footprint/heading mismatch');
      const r = { x: a.x * U, y: a.y * U, width: a.width * U, height: a.height * U };
      const actor = this.add(
        index + 2,
        a.type,
        'friendly',
        { x: r.x + r.width / 2, y: r.y + r.height / 2 },
        combat[a.type].radius ? null : r,
        a.hp,
      );
      actor.heading = a.heading;
    }
  }
  static async create(army: StartAsset[], plan = tutorialPlan()): Promise<Battle> {
    return new Battle(
      plan,
      await RandomStream.seeded(plan.seed, 'accuracy', plan.simulation),
      army,
    );
  }
  private add(
    id: number,
    type: CombatID,
    team: Entity['team'],
    point: Vec,
    rect: Rect | null,
    hp: number,
  ): Entity {
    const d = combat[type];
    if (hp > d.hp) throw new Error('Durability exceeds baseline');
    const e: Entity = {
      ...point,
      id,
      type,
      team,
      rect,
      radius: d.radius,
      hp,
      maxHP: d.hp,
      heading: 0,
      turnCarry: 0,
      carryX: 0,
      carryY: 0,
      anchor: { ...point },
      target: 0,
      commitUntil: 0,
      warmup: null,
      lastRelease: -100000,
      state: 'Idle',
      reason: 'Waiting for a perceived legal target',
      contacts: [],
      memory: [],
      lastHit: -10000,
      lastAction: -10000,
      lastAbility: -10000,
      lastMove: -10000,
      progressPoint: { ...point },
      lastProgress: 0,
      goal: null,
      shield: [],
      reduction: 0,
      charges: type === 'friendly.proximity_mine' ? 1 : 0,
      mineDue: null,
      channel: 0,
      channelPulse: 0,
      channelCommit: 0,
      cast: null,
      dash: null,
      abilities: [0, 0, 0],
      fieldEnd: 0,
      challenge: null,
      deadTick: null,
      rampartArmor: 0,
    };
    this.entities.push(e);
    this.entities.sort((a, b) => a.id - b.id);
    return e;
  }
  get core(): Entity {
    const e = this.entities[0];
    if (e?.id !== 1) throw new Error('Missing Core');
    return e;
  }
  get(id: number): Entity | undefined {
    return this.entities.find((e) => e.id === id);
  }
  private solids(exclude: number[] = []): Rect[] {
    return this.entities
      .filter((e) => e.hp > 0 && combat[e.type].solid && e.rect && !exclude.includes(e.id))
      .map((e) => {
        if (!e.rect) throw new Error('Missing solid rectangle');
        return e.rect;
      });
  }
  private los(a: Vec, t: Entity, owner = 0): boolean {
    return this.entities.every(
      (e) =>
        e.hp <= 0 ||
        !combat[e.type].solid ||
        !e.rect ||
        e.id === owner ||
        e.id === t.id ||
        sweep(a, nearest(a, t), e, 0) === null,
    );
  }
  private canSee(a: Entity, t: Entity): boolean {
    return t.hp > 0 && boundary(a, t) <= combat[a.type].vision && this.los(a, t, a.id);
  }
  visible(e: Entity): boolean {
    return (
      e.team === 'friendly' ||
      (this.detected.has(e.id) &&
        this.entities.some(
          (sensor) =>
            sensor.team === 'friendly' &&
            sensor.hp > 0 &&
            boundary(sensor, e) <= combat[sensor.type].vision &&
            this.los(sensor, e, sensor.id),
        ))
    );
  }
  private event(
    kind: string,
    source: number,
    target: number,
    p: Vec,
    value: number,
    message: string,
  ): void {
    const a = this.get(source),
      b = this.get(target);
    this.events.push({
      tick: this.tick,
      kind,
      source,
      target,
      x: p.x,
      y: p.y,
      value,
      message,
      visible:
        kind === 'impact' && b?.team === 'hostile'
          ? this.visible(b)
          : kind === 'deployment' ||
            kind === 'warning' ||
            Boolean(a && this.visible(a)) ||
            Boolean(b && this.visible(b)),
    });
    if (this.events.length > 200) this.events.shift();
    this.eventSequence++;
  }
  private flow(e: Entity, target = this.core, range = 819): Flow {
    const key = [
      this.topology,
      e.radius,
      target.id,
      target.rect ? 'rect' : `${Math.floor(target.x / 512)},${Math.floor(target.y / 512)}`,
      range,
    ].join('|');
    let f = this.flows.get(key);
    if (!f) {
      const debris = this.entities
        .filter((a) => a.hp === 0 && a.rect)
        .map((a) => {
          if (!a.rect) throw new Error('Missing debris');
          return a.rect;
        });
      f = new Flow(e.radius, this.solids(), (p) => boundary(p, target) <= range, debris);
      if (this.flows.size >= 24) this.flows.clear();
      this.flows.set(key, f);
    }
    return f;
  }
  private deploy(): boolean {
    const packet = this.plan.packets[this.packet];
    if (!packet || packet.tick > this.director) return false;
    if (this.entities.filter((e) => e.team === 'hostile' && e.hp > 0).length >= tuning.hostileCap)
      return true;
    const marker = ENTRANCES[packet.entrance - 1];
    if (!marker) throw new Error('Unknown entrance');
    const spots: Vec[] = [];
    for (let y = (marker.y - 2) * 2; y < (marker.y + 2) * 2; y++)
      for (let x = (marker.x - 2) * 2; x < (marker.x + 2) * 2; x++)
        spots.push({ x: x * 512 + 256, y: y * 512 + 256 });
    spots.sort(
      (a, b) =>
        (a.x - marker.x * U) ** 2 +
          (a.y - marker.y * U) ** 2 -
          ((b.x - marker.x * U) ** 2 + (b.y - marker.y * U) ** 2) ||
        a.y - b.y ||
        a.x - b.x,
    );
    const radius = combat[packet.type].radius,
      spot = spots.find(
        (p) =>
          edgeClear(p, p, radius, this.solids()) &&
          this.entities.every((e) => e.hp <= 0 || !e.radius || distance(p, e) >= radius + e.radius),
      );
    if (!spot) {
      this.reason = 'Deployment held: staging space occupied';
      return true;
    }
    this.add(1000 + packet.id, packet.type, 'hostile', spot, null, combat[packet.type].hp);
    const deployed = this.get(1000 + packet.id);
    if (deployed) this.spatial.update(deployed);
    this.packet++;
    this.event(
      'deployment',
      0,
      1000 + packet.id,
      { x: marker.x * U, y: marker.y * U },
      1,
      `Front 1: ${combat[packet.type].name} deployed`,
    );
    if (this.packet === this.plan.packets.length) {
      this.state = 'Cleanup';
      this.cleanupTick = this.tick;
    }
    return false;
  }
  private perceive(): void {
    for (const e of this.entities) {
      if (
        e.hp <= 0 ||
        !combat[e.type].vision ||
        this.tick % tuning.perception !== e.id % tuning.perception
      )
        continue;
      const contacts = this.entities
        .filter((t) => t.team !== e.team && this.canSee(e, t))
        .map((t) => ({
          id: t.id,
          type: t.type,
          x: t.x,
          y: t.y,
          hp: t.hp,
          armor: this.armor(t),
          target: t.target,
          tick: this.tick,
        }));
      const fresh = new Set(contacts.map((c) => c.id));
      e.memory = [
        ...contacts,
        ...e.memory.filter((c) => !fresh.has(c.id) && this.tick - c.tick <= tuning.memory),
      ];
      e.contacts = contacts;
    }
    this.detected = new Set(
      this.entities
        .filter((e) => e.team === 'friendly' && e.hp > 0)
        .flatMap((e) => e.contacts.map((c) => c.id)),
    );
  }
  private perceived(e: Entity, t: Entity): boolean {
    return e.team === 'friendly'
      ? this.visible(t)
      : e.contacts.some((c) => c.id === t.id) && this.canSee(e, t);
  }
  private known(e: Entity): Entity[] {
    return this.entities.filter((t) => t.hp > 0 && t.team !== e.team && this.perceived(e, t));
  }
  private underAttack(e: Entity): boolean {
    return (
      this.entities.some(
        (t) => t.hp > 0 && t.team !== e.team && t.target === e.id && this.visible(t),
      ) ||
      this.projectiles.some(
        (p) =>
          p.team !== e.team &&
          p.target === e.id &&
          Boolean(this.get(p.source) && this.visible(this.get(p.source) as Entity)),
      )
    );
  }
  armor(e: Entity): number {
    return combat[e.type].armor * U + e.rampartArmor;
  }
  private movePoint(e: Entity, t: Entity, preferred: number): Vec | null {
    const near = nearest(e, t),
      h = bearing(delta(t, e)),
      v = direction(h, preferred + (t.rect ? 0 : t.radius)),
      p = { x: (t.rect ? near.x : t.x) + v.x, y: (t.rect ? near.y : t.y) + v.y };
    if (edgeClear(e, p, e.radius, this.solids())) return p;
    return this.flow(e, t, preferred).waypoint(e);
  }
  private anchorPoint(e: Entity): Vec | null {
    if (edgeClear(e, e.anchor, e.radius, this.solids())) return { ...e.anchor };
    return this.flow(
      e,
      { ...e, x: e.anchor.x, y: e.anchor.y, radius: 0, rect: null },
      410,
    ).waypoint(e);
  }
  private score(e: Entity, t: Entity): number {
    const d = combat[e.type],
      w = d.weapon;
    if (!w) return -Infinity;
    const dist = boundary(e, t),
      proximity = Math.max(0, 1000 - divRound(BigInt(dist) * 1000n, BigInt(d.vision))),
      travel = Math.min(
        1000,
        divRound(BigInt(Math.max(0, dist - w.range)) * 1000n, BigInt(15 * U)),
      ),
      self = t.target === e.id ? 1000 : 0;
    let exposure = 0;
    for (const k of this.known(e)) {
      const kw = combat[k.type].weapon;
      if (kw && boundary(e, k) <= kw.range)
        exposure += divRound(
          BigInt(kw.damage) * 60n * 5000n,
          BigInt(kw.interval) * BigInt(e.maxHP),
        );
    }
    exposure = Math.min(1000, exposure);
    if (e.team === 'hostile') {
      const pref =
        t.id === 1
          ? 0
          : e.type === 'enemy.raider' && combat[t.type].radius && dist <= 4 * U
            ? 60000
            : t.type === 'friendly.standard_barricade'
              ? 45000
              : -100000;
      return (
        pref +
        20 * self +
        10 * proximity -
        12 * travel -
        15 * exposure +
        (e.challenge?.owner === t.id && e.challenge.expires > this.tick ? 60000 : 0)
      );
    }
    const coreThreat =
        t.target === 1
          ? 1000
          : boundary(t, this.core) <= 6 * U
            ? 800
            : t.target && this.get(t.target)?.type === 'friendly.standard_barricade'
              ? 500
              : 200,
      priority = 300,
      missing = divRound(BigInt(t.maxHP - t.hp) * 1000n, BigInt(t.maxHP)),
      next = divRound(BigInt(w.damage) * 100n * BigInt(U), BigInt(100 * U + this.armor(t))),
      vulnerability = divRound(
        BigInt(missing + Math.min(1000, divRound(BigInt(next) * 1000n, BigInt(t.hp)))),
        2n,
      ),
      focus = Math.min(
        1000,
        Math.floor(
          (this.entities.filter(
            (a) => a.team === e.team && a.id !== e.id && a.hp > 0 && a.target === t.id,
          ).length *
            1000) /
            3,
        ),
      );
    return (
      60 * coreThreat +
      20 * self +
      15 * priority +
      10 * vulnerability +
      10 * proximity +
      8 * focus -
      12 * travel -
      15 * exposure
    );
  }
  private decide(e: Entity): void {
    if (e.cast || e.dash) return;
    const d = combat[e.type];
    if (!d.weapon) return;
    const weapon = d.weapon;
    const candidates = this.known(e);
    if (e.team === 'hostile' && !candidates.some((t) => t.id === 1)) candidates.push(this.core);
    let target: Entity | undefined;
    if (e.type === 'enemy.runner') {
      target = this.core;
      const f = this.flow(e);
      const coreCost = f.costs[cellIndex(e)] ?? Infinity;
      const blockers = candidates.filter(
        (t) =>
          t.id !== 1 &&
          ((t.rect && combat[t.type].solid) ||
            (!t.rect &&
              boundary(e, t) <= weapon.range + 64 &&
              e.goal &&
              this.tick - e.lastMove >= 30)),
      );
      const estimate = (t: Entity) => {
        const hit = divRound(
          BigInt(weapon.damage) * 100n * BigInt(U),
          BigInt(100 * U + this.armor(t)),
        );
        const path = this.flow(e, t, weapon.range).costs[cellIndex(e)] ?? Infinity;
        return (path * 60) / d.speed + Math.ceil(t.hp / Math.max(1, hit)) * weapon.interval;
      };
      const coreTime = (coreCost * 60) / d.speed;
      const better = blockers
        .filter((t) => !t.rect || !Number.isFinite(coreCost) || estimate(t) + 30 < coreTime)
        .sort((a, b) => estimate(a) - estimate(b) || a.id - b.id);
      target = better[0] ?? this.core;
    } else {
      candidates.sort(
        (a, b) =>
          this.score(e, b) - this.score(e, a) || boundary(e, a) - boundary(e, b) || a.id - b.id,
      );
      target = candidates[0];
      const old = this.get(e.target);
      if (
        old &&
        old.hp > 0 &&
        (old.id === 1 || this.perceived(e, old)) &&
        target &&
        old.id !== target.id &&
        (this.tick < e.commitUntil ||
          this.score(e, target) < this.score(e, old) + tuning.hysteresis)
      )
        target = old;
    }
    if (target?.id !== e.target) {
      e.target = target?.id ?? 0;
      e.commitUntil = this.tick + tuning.commitment;
      e.warmup = null;
    }
    if (!target) {
      e.goal = d.speed ? { ...e.anchor } : null;
      e.reason = 'No detected hostile target; guarding deployment anchor';
      return;
    }
    e.reason =
      e.type === 'enemy.runner'
        ? target.id === 1
          ? 'Core beacon objective; legal Core route'
          : target.rect
            ? 'Detected destructible obstruction: cheaper breach than Core detour'
            : 'Detected unit physically blocking Core path'
        : e.type === 'enemy.raider' && target.id !== 1
          ? 'Detected operational defender within 4 GU'
          : 'Highest permitted utility; stable commitment';
    if (!d.speed) return;
    if (e.team === 'friendly' && e.hp * 100 < e.maxHP * 30 && this.underAttack(e)) {
      e.goal = this.anchorPoint(e);
      e.reason = 'Below 30% and under attack: safe-anchor retreat';
      return;
    }
    if (e.team === 'friendly' && distance(e.anchor, target) > 9 * U) {
      e.goal = this.anchorPoint(e);
      e.reason = 'Target outside Balanced engagement radius';
      return;
    }
    if (boundary(e, target) <= d.weapon.range && this.los(e, target, e.id)) {
      e.goal = null;
      return;
    }
    if (e.team === 'hostile') e.goal = this.movePoint(e, target, Math.max(0, d.weapon.range - 32));
    else {
      e.goal = this.movePoint(e, target, divRound(BigInt(d.weapon.range) * 3n, 4n));
      if (e.goal && distance(e.anchor, e.goal) > 7 * U) {
        e.goal = this.anchorPoint(e);
        e.reason = 'Balanced leash limit: return to anchor';
      }
    }
    if (!e.goal) e.reason = 'No legal route: recovery pending';
  }
  private chooseAbility(e: Entity): void {
    if (e.type !== 'warden.bulwark' || e.cast || e.dash) return;
    const nearAllies = this.entities.filter(
        (t) => t.team === 'friendly' && t.hp > 0 && boundary(e, t) <= 4 * U,
      ),
      threats = this.known(e);
    if (e.abilities[0] <= this.tick && e.hp * 4 > e.maxHP) {
      const allies = this.entities
        .filter(
          (t) =>
            t.id !== e.id &&
            t.team === 'friendly' &&
            t.hp > 0 &&
            t.hp * 100 < t.maxHP * 60 &&
            boundary(e, t) <= 8 * U &&
            this.los(e, t, e.id) &&
            this.underAttack(t),
        )
        .sort(
          (a, b) =>
            a.hp * b.maxHP - b.hp * a.maxHP || boundary(e, a) - boundary(e, b) || a.id - b.id,
        );
      for (const t of allies) {
        const attacker = threats.find((a) => a.target === t.id);
        if (!attacker) continue;
        const h = bearing(delta(t, attacker));
        for (const offset of [1536, 1024, 512]) {
          const v = direction(h, offset + (t.rect ? 0 : t.radius)),
            base = nearest(attacker, t),
            p = { x: base.x + v.x, y: base.y + v.y };
          if (
            distance(e, p) <= 5 * U &&
            boundary(p, t) <= 2 * U &&
            edgeClear(e, p, e.radius, this.solids())
          ) {
            e.cast = { ability: 0, release: this.tick + 12, recipient: t.id, point: p, heading: h };
            e.state = 'Casting';
            e.warmup = null;
            e.reason = 'Automatic Interpose: threatened injured ally and legal intercept';
            return;
          }
        }
      }
    }
    if (
      e.abilities[2] <= this.tick &&
      (nearAllies.filter((t) => this.underAttack(t)).length >= 2 ||
        (nearAllies.includes(this.core) && this.core.hp * 100 < this.core.maxHP * 40))
    ) {
      e.cast = {
        ability: 2,
        release: this.tick + 12,
        recipient: e.id,
        point: { x: e.x, y: e.y },
        heading: e.heading,
      };
      e.state = 'Casting';
      e.warmup = null;
      e.reason = 'Automatic Holdfast: nearby allies/Core need protection';
      return;
    }
    const contacts = threats.filter((t) => boundary(e, t) <= 4 * U);
    if (
      e.abilities[1] <= this.tick &&
      (contacts.length >= 3 || contacts.some((t) => boundary(t, this.core) <= 5 * U))
    ) {
      e.cast = {
        ability: 1,
        release: this.tick + 12,
        recipient: e.id,
        point: { x: e.x, y: e.y },
        heading: e.heading,
      };
      e.state = 'Casting';
      e.warmup = null;
      e.reason = 'Automatic Challenge: nearby ground threat group/Core threat';
    }
  }
  private safeMove(e: Entity, p: Vec): boolean {
    return (
      edgeClear(e, p, e.radius, this.solids()) &&
      this.spatial
        .query(p, p, e.radius)
        .every(
          (t) => t.hp <= 0 || !t.radius || t.id === e.id || distance(p, t) >= e.radius + t.radius,
        )
    );
  }
  private move(e: Entity): void {
    const d = combat[e.type];
    if (!d.speed || e.hp <= 0 || e.cast) return;
    const goal = e.dash?.point ?? e.goal;
    if (!goal) return;
    const remaining = distance(e, goal);
    if (remaining < 12) return;
    const desired = bearing(delta(e, goal));
    const slow = this.entities.some(
      (t) =>
        t.hp === 0 &&
        t.rect &&
        e.x >= t.rect.x &&
        e.x < t.rect.x + t.rect.width &&
        e.y >= t.rect.y &&
        e.y < t.rect.y + t.rect.height,
    );
    const speed = e.dash
      ? Math.min((5 * U * 60) / 18, (remaining * 60) / Math.max(1, e.dash.end - this.tick))
      : slow
        ? divRound(BigInt(d.speed) * 100n, 115n)
        : d.speed;
    let best: { p: Vec; xCarry: number; yCarry: number; progress: number } | null = null;
    for (const offset of tuning.movementOffsets) {
      const velocity = direction(desired + offset, Math.round(speed)),
        cx = velocity.x + e.carryX,
        cy = velocity.y + e.carryY,
        dx = Math.trunc(cx / 60),
        dy = Math.trunc(cy / 60),
        p = { x: e.x + dx, y: e.y + dy };
      if (distance(e, p) > remaining) {
        p.x = goal.x;
        p.y = goal.y;
      }
      if (!this.safeMove(e, p)) continue;
      const progress = remaining - distance(p, goal);
      if (!best || progress > best.progress)
        best = { p, xCarry: cx - dx * 60, yCarry: cy - dy * 60, progress };
    }
    if (best && best.progress > 0) {
      e.x = best.p.x;
      e.y = best.p.y;
      e.carryX = best.xCarry;
      e.carryY = best.yCarry;
      e.state = 'Moving';
      e.lastMove = this.tick;
      this.spatial.update(e);
    }
    if (this.tick % 120 === e.id % 120) {
      if (
        distance(e.progressPoint, e) >= 154 &&
        remaining < distance(e.progressPoint, goal) - 154
      ) {
        this.lastMeaningful = this.tick;
        e.lastProgress = this.tick;
      }
      e.progressPoint = { x: e.x, y: e.y };
    }
    if (this.tick - e.lastProgress >= 120 && this.tick - e.lastMove > 30) {
      e.goal = null;
      e.reason = 'Stuck: local avoidance then legal repath';
      e.target = 0;
      e.commitUntil = 0;
    }
  }

  private face(e: Entity): void {
    const d = combat[e.type],
      t = this.get(e.target),
      goal = e.dash?.point ?? e.goal;
    const aim =
      t &&
      t.hp > 0 &&
      this.perceived(e, t) &&
      d.weapon &&
      boundary(e, t) <= d.weapon.range &&
      this.los(e, t, e.id)
        ? bearing(delta(e, nearest(e, t)))
        : goal
          ? bearing(delta(e, goal))
          : e.heading;
    e.turnCarry += (d.weapon?.turn ?? 360) * 65536;
    const limit = Math.floor(e.turnCarry / 21600);
    e.turnCarry -= limit * 21600;
    e.heading = turn(e.heading, aim, limit);
  }
  private releases(e: Entity): void {
    if (e.cast && e.cast.release <= this.tick) {
      const c = e.cast;
      e.cast = null;
      const recipient = this.get(c.recipient);
      if (
        c.ability === 0 &&
        (!recipient ||
          recipient.hp <= 0 ||
          recipient.hp * 100 >= recipient.maxHP * 60 ||
          e.hp * 4 <= e.maxHP ||
          boundary(e, recipient) > 8 * U ||
          !this.los(e, recipient, e.id) ||
          !edgeClear(e, c.point, e.radius, this.solids()))
      ) {
        e.reason =
          'Interpose canceled at release: recipient or intercept no longer eligible; cooldown not spent';
        return;
      }
      e.abilities[c.ability] =
        this.tick +
        ([tuning.interposeCD, tuning.challengeCD, tuning.holdfastCD] as const)[c.ability];
      if (c.ability === 0)
        e.dash = {
          end: this.tick + 18,
          recipient: c.recipient,
          point: c.point,
          heading: c.heading,
        };
      if (c.ability === 1)
        for (const t of this.known(e).filter((t) => boundary(e, t) <= 4 * U))
          t.challenge = { owner: e.id, expires: this.tick + 240 };
      if (c.ability === 2) {
        e.fieldEnd = this.tick + 360;
        for (const ally of this.entities)
          if (ally.hp > 0 && ally.team === e.team && boundary(e, ally) <= 4 * U)
            ally.reduction = 20;
      }
      e.lastAbility = this.tick;
      this.event(
        'ability',
        e.id,
        c.recipient,
        e,
        0,
        [
          'Interpose released',
          'Challenge Pulse: ordinary utility +60 for 4 seconds',
          'Holdfast Field: nearby 20% reduction for 6 seconds',
        ][c.ability] ?? 'Ability',
      );
    }
    if (e.mineDue !== null && e.mineDue <= this.tick) {
      e.mineDue = null;
      for (const t of this.entities.filter((t) => t.team === 'hostile' && t.hp > 0)) {
        const dist = boundary(e, t),
          r = 1536;
        if (dist <= r)
          this.impacts.push({
            fraction: 0,
            source: e.id,
            sequence: ++this.projectileSequence,
            target: t.id,
            raw:
              dist <= r / 2
                ? 300 * U
                : divRound(BigInt(300 * U) * BigInt(3 * r - 2 * dist), BigInt(2 * r)),
            origin: { x: e.x, y: e.y },
          });
      }
      this.event('explosion', e.id, 0, e, 300 * U, 'Proximity Mine detonated: fixed ground area');
    }
    const w = combat[e.type].weapon,
      t = this.get(e.target);
    if (
      !w ||
      e.cast ||
      e.dash ||
      !t ||
      t.hp <= 0 ||
      !this.perceived(e, t) ||
      boundary(e, t) > w.range ||
      !this.los(e, t, e.id)
    ) {
      e.warmup = null;
      if (w && !e.cast && !e.dash && e.state !== 'Moving') {
        e.state = 'Idle';
        e.reason = !t
          ? 'No Target'
          : !this.perceived(e, t)
            ? 'Contact lost'
            : boundary(e, t) > w.range
              ? 'Target out of range'
              : 'Blocked: intervening solid';
      }
      return;
    }
    const aim = bearing(delta(e, nearest(e, t)));
    if (angleError(e.heading, aim) > tuning.aimTolerance) {
      e.warmup = null;
      e.state = 'Aiming';
      return;
    }
    if (e.warmup === null) e.warmup = this.tick;
    e.state = 'Aiming';
    if (this.tick < e.warmup + w.warmup || this.tick < e.lastRelease + w.interval) return;
    if (w.speed && this.projectiles.length >= tuning.projectileCap) {
      e.reason = 'Projectile population limit: valid release held';
      return;
    }
    const raw =
        e.type === 'friendly.rifle_squad'
          ? divRound(BigInt(w.damage) * BigInt(e.maxHP + e.hp), 2n * BigInt(e.maxHP))
          : w.damage,
      sequence = ++this.projectileSequence;
    e.lastRelease = this.tick;
    e.warmup = null;
    e.lastAction = this.tick;
    e.state = 'Firing';
    if (!w.speed) {
      this.event('melee', e.id, t.id, e, raw, `${combat[e.type].name} automatic contact attack`);
      this.impacts.push({
        fraction: 0,
        source: e.id,
        sequence,
        target: t.id,
        raw,
        origin: { x: e.x, y: e.y },
      });
      return;
    }
    const hit = this.accuracy.next(),
      missAngle = this.accuracy.next(),
      missRadius = this.accuracy.next();
    let p = nearest(e, t);
    if (BigInt(hit) * 100n >= BigInt(w.accuracy) * 4294967296n) {
      const offset = direction(
        Math.floor((missAngle * 65536) / 4294967296),
        1024 + Math.floor((missRadius * 1025) / 4294967296),
      );
      p = { x: p.x + offset.x, y: p.y + offset.y };
    }
    this.projectiles.push({
      id: sequence,
      source: e.id,
      team: e.team,
      target: t.id,
      x: e.x,
      y: e.y,
      heading: bearing(delta(e, p)),
      speed: w.speed,
      carryX: 0,
      carryY: 0,
      raw,
      traveled: 0,
      maxTravel: w.range + 2 * U,
      sequence,
      release: { x: e.x, y: e.y },
    });
    this.event('shot', e.id, t.id, e, raw, `${combat[e.type].name} automatic shot`);
  }
  private advanceProjectiles(): void {
    const keep: Projectile[] = [];
    for (const p of this.projectiles) {
      const v = direction(p.heading, p.speed),
        cx = v.x + p.carryX,
        cy = v.y + p.carryY,
        dx = Math.trunc(cx / 60),
        dy = Math.trunc(cy / 60),
        a = { x: p.x, y: p.y },
        b = { x: p.x + dx, y: p.y + dy };
      const length = distance(a, b),
        remaining = p.maxTravel - p.traveled;
      if (length > remaining) {
        b.x = a.x + divRound(BigInt(dx) * BigInt(remaining), BigInt(length));
        b.y = a.y + divRound(BigInt(dy) * BigInt(remaining), BigInt(length));
      }
      p.carryX = cx - dx * 60;
      p.carryY = cy - dy * 60;
      const contacts = this.spatial
          .query(a, b, 51)
          .filter(
            (t) =>
              t.hp > 0 &&
              t.id !== p.source &&
              (t.team !== p.team || (combat[t.type].solid && t.rect)),
          )
          .map((t) => ({ t, f: sweep(a, b, t) }))
          .filter((c): c is { t: Entity; f: number } => c.f !== null)
          .sort((a, b) => a.f - b.f || a.t.id - b.t.id),
        first = contacts[0];
      if (first) {
        if (first.t.team !== p.team)
          this.impacts.push({
            fraction: first.f,
            source: p.source,
            sequence: p.sequence,
            target: first.t.id,
            raw: p.raw,
            origin: p.release,
          });
        else
          this.event(
            'blocked',
            p.source,
            first.t.id,
            first.t,
            0,
            'Projectile stopped by friendly solid; no friendly fire',
          );
        continue;
      }
      p.x = b.x;
      p.y = b.y;
      p.traveled += distance(a, b);
      if (p.traveled < p.maxTravel && p.x >= 0 && p.y >= 0 && p.x < 60 * U && p.y < 60 * U)
        keep.push(p);
    }
    this.projectiles = keep;
  }
  private damage(): void {
    this.impacts.sort(
      (a, b) =>
        a.fraction - b.fraction ||
        a.source - b.source ||
        a.sequence - b.sequence ||
        a.target - b.target,
    );
    for (const hit of this.impacts) {
      const t = this.get(hit.target);
      if (!t || t.hp <= 0) continue;
      let raw = hit.raw,
        absorbed = 0;
      for (const s of t.shield.sort((a, b) => a.expires - b.expires || a.source - b.source)) {
        if (s.expires <= this.tick || angleError(s.heading, bearing(delta(t, hit.origin))) > 10923)
          continue;
        const amount = Math.min(s.pool, raw);
        s.pool -= amount;
        raw -= amount;
        absorbed += amount;
        if (!raw) break;
      }
      const loss = Math.min(
        t.hp,
        divRound(
          BigInt(raw) * BigInt(100 * U) * BigInt(100 - t.reduction),
          BigInt(100 * U + this.armor(t)) * 100n,
        ),
      );
      t.hp -= loss;
      t.lastHit = this.tick;
      if (loss || absorbed) {
        this.lastMeaningful = this.tick;
        this.event(
          'impact',
          hit.source,
          t.id,
          t,
          loss,
          `Body loss ${(loss / U).toFixed(2)}; shield absorbed ${(absorbed / U).toFixed(2)}`,
        );
      }
    }
    this.impacts = [];
  }
  private deaths(): void {
    for (const e of this.entities)
      if (e.hp === 0 && e.deadTick === null) {
        e.deadTick = this.tick;
        e.state =
          e.team === 'hostile'
            ? 'Destroyed'
            : combat[e.type].mechanical || e.rect
              ? 'Wrecked'
              : 'Incapacitated';
        e.reason =
          e.team === 'friendly'
            ? e.rect
              ? 'Wrecked—restore after siege'
              : 'Incapacitated—restore after siege'
            : 'Destroyed';
        e.warmup = null;
        e.cast = null;
        e.dash = null;
        e.mineDue = null;
        e.channel = 0;
        e.fieldEnd = 0;
        e.goal = null;
        this.dirty = true;
        if (e.team === 'hostile') {
          this.kills++;
          this.destroyedTP += e.type === 'enemy.raider' ? 2 : 1;
        }
        this.event('death', e.id, e.id, e, 0, `${combat[e.type].name} ${e.reason}`);
      }
  }
  private support(): void {
    const slots = new Map<number, number>(),
      reserved = new Map<number, number>();
    for (const e of this.entities) {
      if (e.hp <= 0 || e.type !== 'friendly.repair_node') continue;
      const valid = (t: Entity): boolean =>
        t.team === 'friendly' &&
        t.hp > 0 &&
        combat[t.type].mechanical &&
        boundary(e, t) <= 5 * U &&
        this.los(e, t, e.id) &&
        (slots.get(t.id) ?? 0) < 2;
      const score = (t: Entity): number =>
        divRound(
          BigInt(Math.max(0, t.maxHP - t.hp - (reserved.get(t.id) ?? 0))) *
            BigInt(
              t.id === 1
                ? 1500
                : t.type === 'warden.bulwark'
                  ? 1300
                  : t.type === 'friendly.standard_barricade'
                    ? 1100
                    : 1000,
            ),
          BigInt(t.maxHP),
        );
      const candidates = this.entities
        .filter((t) => valid(t) && t.maxHP - t.hp - (reserved.get(t.id) ?? 0) >= 20 * U)
        .sort((a, b) => score(b) - score(a) || boundary(e, a) - boundary(e, b) || a.id - b.id);
      let t = this.get(e.channel),
        best = candidates[0];
      if (
        !t ||
        !valid(t) ||
        t.hp === t.maxHP ||
        (best && best.id !== t.id && this.tick >= e.channelCommit) ||
        (best && t && score(best) >= score(t) + 250)
      )
        t = best;
      if (!t) {
        e.channel = 0;
        e.state = 'Idle';
        e.reason = 'No eligible living mechanical recipient with ≥20 missing Integrity';
        continue;
      }
      if (t.id !== e.channel) {
        e.channel = t.id;
        e.channelPulse = this.tick + 15;
        e.channelCommit = this.tick + 30;
      }
      slots.set(t.id, (slots.get(t.id) ?? 0) + 1);
      const output = t.id === 1 ? 3200 : 6400;
      reserved.set(t.id, (reserved.get(t.id) ?? 0) + Math.min(output, t.maxHP - t.hp));
      e.state = 'Channeling';
      e.reason = 'Stationary repair channel; living mechanical ally; LOS; Core half rate';
      if (this.tick >= e.channelPulse) {
        const gain = Math.min(output, t.maxHP - t.hp);
        t.hp += gain;
        e.channelPulse += 15;
        if (gain)
          this.event(
            'repair',
            e.id,
            t.id,
            t,
            gain,
            `Actual Integrity restored ${(gain / U).toFixed(2)}`,
          );
      }
    }
  }
  step(): void {
    if (this.state !== 'Siege' && this.state !== 'Cleanup') return;
    this.tick++;
    this.spatial.rebuild(this.entities);
    // 1. Expirations and synchronous topology. No worker/render completion can govern this boundary.
    if (this.dirty) {
      this.topology++;
      this.flows.clear();
      this.dirty = false;
    }
    for (const e of this.entities) {
      if (e.type === 'warden.bulwark' && this.tick % 60 === 0)
        e.rampartArmor = divRound(
          BigInt(30 * U) * BigInt(this.core.maxHP - this.core.hp),
          BigInt(this.core.maxHP),
        );
      e.shield = e.shield.filter((s) => s.pool > 0 && s.expires > this.tick);
      if (e.challenge && e.challenge.expires <= this.tick) e.challenge = null;
      const activeField = this.entities.some(
        (a) => a.hp > 0 && a.fieldEnd > this.tick && a.team === e.team,
      );
      if (this.tick % 15 === 0 || !activeField) {
        e.reduction = this.entities.some(
          (a) =>
            a.hp > 0 &&
            a.type === 'warden.bulwark' &&
            a.fieldEnd > this.tick &&
            a.team === e.team &&
            boundary(a, e) <= 4 * U,
        )
          ? 20
          : 0;
      }
    }
    // 2. Director/ordinary deployment. The bounded tutorial never needs a population hold beyond staging.
    const pending = this.plan.packets[this.packet];
    const held = Boolean(
      pending &&
        pending.tick <= this.director &&
        this.entities.filter((e) => e.team === 'hostile' && e.hp > 0).length >= tuning.hostileCap,
    );
    const previousDirector = this.director;
    if (!held && pending) this.director++;
    if (this.deploy()) this.director = previousDirector;
    if (this.director === this.plan.warningTick && this.director !== previousDirector)
      this.event(
        'warning',
        0,
        0,
        ENTRANCES[0] ? { x: ENTRANCES[0].x * U, y: ENTRANCES[0].y * U } : this.core,
        0,
        'Front 1: the 75-second peak approaches in 10 director seconds',
      );
    // 3. Perception and stable due decisions.
    this.perceive();
    for (const e of this.entities)
      if (
        e.hp > 0 &&
        this.tick % (e.team === 'friendly' ? 15 : 21) === e.id % (e.team === 'friendly' ? 15 : 21)
      ) {
        this.chooseAbility(e);
        this.decide(e);
      }
    // 4–6. Movement, validated releases, swept projectile advancement.
    for (const e of this.entities) {
      this.move(e);
      if (e.dash && this.tick >= e.dash.end) {
        const d = e.dash,
          t = this.get(d.recipient);
        if (
          distance(e, d.point) <= 64 &&
          t &&
          t.hp > 0 &&
          boundary(e, t) <= 2 * U &&
          this.los(e, t, e.id)
        )
          t.shield.push({
            pool: 600 * U,
            expires: this.tick + 360,
            heading: d.heading,
            source: e.id,
          });
        e.dash = null;
      }
    }
    for (const e of this.entities) if (e.hp > 0) this.face(e);
    for (const e of this.entities) if (e.hp > 0) this.releases(e);
    this.advanceProjectiles();
    // 7–9. Ordered damage, terminal deaths, living-only support. Core cannot revive.
    this.damage();
    this.deaths();
    this.support();
    // 10. Visible threshold crossings; latches rearm only ten percentage points above.
    for (const e of this.entities.filter((e) => e.id === 1 || e.type === 'warden.bulwark')) {
      const a = this.alerts.get(e.id) ?? { fifty: true, critical: true, warden: true },
        ratio = e.hp * 100;
      if (e.id === 1) {
        if (a.fifty && ratio < e.maxHP * 50) {
          a.fifty = false;
          this.event('critical', e.id, e.id, e, 50, 'Core below 50% Integrity');
        }
        if (a.critical && ratio < e.maxHP * 25) {
          a.critical = false;
          this.event('critical', e.id, e.id, e, 25, 'Core critical: below 25% Integrity');
        }
        if (ratio >= e.maxHP * 60) a.fifty = true;
        if (ratio >= e.maxHP * 35) a.critical = true;
      } else {
        if (a.warden && ratio < e.maxHP * 30) {
          a.warden = false;
          this.event('critical', e.id, e.id, e, 30, 'Bulwark below 30% Health');
        }
        if (ratio >= e.maxHP * 40) a.warden = true;
      }
      this.alerts.set(e.id, a);
    }
    // Triggers and terminal precedence.
    for (const e of this.entities)
      if (
        e.hp > 0 &&
        e.type === 'friendly.proximity_mine' &&
        e.charges > 0 &&
        this.known(e).some((t) => boundary(e, t) <= U)
      ) {
        e.charges--;
        e.mineDue = this.tick + 18;
        e.reason = 'Triggered: fixed-location blast in 0.3 combat seconds';
        this.event(
          'mine-warning',
          e.id,
          0,
          e,
          18,
          'Proximity Mine ground blast warning: 0.3 seconds',
        );
      }
    if (!this.core.hp) {
      this.finish('Defeat', 'Core Integrity reached zero');
      return;
    }
    const hostiles = this.entities.filter((e) => e.team === 'hostile' && e.hp > 0),
      capable =
        this.entities.some(
          (e) =>
            e.team === 'friendly' &&
            e.hp > 0 &&
            (combat[e.type].weapon || e.charges > 0 || e.mineDue !== null),
        ) || this.projectiles.some((p) => p.team === 'friendly');
    if (!capable && hostiles.some((e) => Number.isFinite(this.flow(e).costs[cellIndex(e)])))
      this.inevitableTicks++;
    else this.inevitableTicks = 0;
    if (this.inevitableTicks >= 180) {
      this.finish(
        'Defeat',
        'Inevitable Defeat: no friendly damage capability for 3 combat seconds',
      );
      return;
    }
    const quiet =
      this.packet === this.plan.packets.length &&
      !hostiles.length &&
      !this.projectiles.some((p) => p.team === 'hostile');
    this.victoryQuiet = quiet ? this.victoryQuiet + 1 : 0;
    if (this.victoryQuiet >= 60) {
      this.finish(
        'Victory',
        'All deployments and hostile damage potential cleared for one combat second',
      );
      return;
    }
    const next = this.plan.packets[this.packet];
    if (this.tick - this.lastMeaningful >= 1800 && (!next || next.tick - this.director > 1800)) {
      if (this.tick - this.lastMeaningful === 1800) {
        this.flows.clear();
        this.event(
          'recovery',
          0,
          0,
          this.core,
          0,
          'No meaningful progress: legal route recovery requested',
        );
      }
      if (this.tick - this.lastMeaningful >= 5400) {
        this.state = 'Stalemate';
        this.reason = '90 seconds without progress: Restart Checkpoint or Surrender';
      }
    }
  }
  private finish(state: 'Victory' | 'Defeat', reason: string): void {
    this.state = state;
    this.reason = reason;
    this.event('outcome', 1, 1, this.core, 0, `${state}: ${reason}`);
  }
  surrender(): void {
    if (this.state === 'Victory' || this.state === 'Defeat') return;
    this.finish('Defeat', 'Confirmed practice surrender; no campaign rewards or damage');
  }
  snapshot(): object {
    return {
      tick: this.tick,
      director: this.director,
      cleanupTick: this.cleanupTick,
      alerts: [...this.alerts].sort((a, b) => a[0] - b[0]),
      packet: this.packet,
      state: this.state,
      reason: this.reason,
      entities: this.entities,
      projectiles: this.projectiles,
      events: this.events,
      eventSequence: this.eventSequence,
      projectileSequence: this.projectileSequence,
      kills: this.kills,
      destroyedTP: this.destroyedTP,
      victoryQuiet: this.victoryQuiet,
      inevitableTicks: this.inevitableTicks,
      lastMeaningful: this.lastMeaningful,
      topology: this.topology,
      accuracy: this.accuracy.state,
    };
  }
}
