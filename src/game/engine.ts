import { compareIDs } from './order';
/** Full first-pass fixed-tick action runtime. Saved starts/plans remain immutable;
 * combat bodies, temporary stock, shields and effects belong to this run only. */
import { ENTRANCES, edgeClear, type Rect } from '../construction/geometry';
import {
  U,
  H,
  FRACTION,
  distance,
  bearing,
  direction,
  angleError,
  turn,
  divRound,
  type Vec,
} from '../sim/fixed';
import { boundary, nearest, sweep, type Shape } from '../sim/collision';
import { hash, RandomStream } from '../sim/determinism';
import { accuracyPass, buffAccuracy } from '../progression/accuracy';
import { spendFiniteCharge, EngineerRearm, type RearmObservation } from '../sim/finite-stock';
import { definition, SUPPORT_ROLES, type Definition, type Faction } from './catalog';
import { footprint, solidAsset } from './construction';
import type { Asset, GameState, Plan, Spawn, Result, Performance } from './model';
import { friendlyStats, hostileStats, type Stats } from './stats';
import { findPath } from './navigation';
import { bossReserve } from './director';
export interface Status {
  kind: string;
  until: number;
  value: number;
  source: number;
}
export interface Entity extends Shape {
  id: number;
  owned: string | null;
  d: Definition;
  asset: Asset | null;
  side: 0 | 1;
  faction: Faction;
  stats: Stats;
  hp: number;
  heading: number;
  aim: number;
  target: number | null;
  targetSince: number;
  nextDecision: number;
  score: number;
  nextAttack: number;
  warmup: number;
  lastFire: number;
  lastDamage: number;
  lastMove: number;
  vx: number;
  vy: number;
  moveCarryX: number;
  moveCarryY: number;
  phase: number;
  transition: number;
  variant: number;
  statuses: Status[];
  shield: number;
  bonusPools: { owner: number; capacity: number; until: number }[];
  shieldMax: number;
  shieldFront: boolean;
  shieldUntil: number;
  heat: number;
  overheat: number;
  lock: number;
  channel: number | null;
  channelSince: number;
  signatureShots: number;
  eligibleRestoration: number;
  controlCredit: number;
  detectionCredit: boolean;
  memory: Record<number, { x: number; y: number; tick: number; layer: string }>;
  losLostAt: number;
  gateOpen: boolean;
  gateUntil: number;
  cooldowns: Record<string, number>;
  signature: 'locked' | 'armed' | 'pending' | 'active' | 'used' | 'disabled';
  signatureUntil: number;
  charges: number | null;
  temporary: number;
  reserved: number;
  reserveQTP: number;
  qtp: number;
  segment: number;
  spawnTick: number;
  path: Vec[];
  pathGoal: Vec | null;
  pathVersion: number;
  pathAt: number;
  stuck: number;
  stuckAt: Vec;
  retreat: boolean;
  retreatAt: number;
  childrenReleased: number;
  harvests: number;
  consuming: number;
  consumeAt: number;
  consumeDamage: number;
  burrow: boolean;
  slotOwner: number | null;
  slots: Record<number, number>;
  pool: number;
  jamUntil: number;
  revealUntil: number;
  abilityCast: string | null;
}
export interface Projectile {
  id: number;
  owner: number;
  side: 0 | 1;
  target: number | null;
  x: number;
  y: number;
  previous: Vec;
  carryX: number;
  carryY: number;
  heading: number;
  speed: number;
  radius: number;
  damage: number;
  penetration: number;
  area: number;
  layer: 'ground' | 'air';
  guided: boolean;
  pierces: number;
  hit: number[];
  until: number;
  color: number;
}
export interface Warning {
  id: number;
  owner: number;
  side: 0 | 1;
  kind: 'circle' | 'line' | 'cone' | 'jam';
  origin: Vec;
  point: Vec;
  radius: number;
  width: number;
  angle: number;
  due: number;
  damage: number;
  penetration: number;
  label: string;
  targets: number[];
  layers: 'ground' | 'air' | 'both';
}
export interface Effect {
  id: number;
  kind: string;
  from: Vec;
  to: Vec;
  until: number;
  side: 0 | 1;
}
interface Scheduled {
  due: number;
  owner: number;
  independent: boolean;
  run: () => void;
}
interface Corpse extends Vec {
  id: number;
  expires: number;
  claimed: boolean;
}
const fx = (n: number) => Math.round(n * U),
  secs = (n: number) => Math.round(n * 60);
const scaled = (v: number, n: number) =>
  divRound(BigInt(Math.round(v)) * BigInt(Math.round(n * 10000)), 10000n);
function segmentDistance(p: Vec, a: Vec, b: Vec): number {
  const dx = b.x - a.x,
    dy = b.y - a.y,
    l = dx * dx + dy * dy;
  if (!l) return distance(p, a);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l));
  return distance(p, { x: Math.round(a.x + t * dx), y: Math.round(a.y + t * dy) });
}
export class FullBattle {
  tick = 0;
  directorTick = 0;
  spawnCursor = 0;
  entities: Entity[] = [];
  projectiles: Projectile[] = [];
  warnings: Warning[] = [];
  effects: Effect[] = [];
  events: string[] = [];
  outcome: 'Victory' | 'Defeat' | null = null;
  populationHeld = false;
  quiet = 0;
  phaseChanges = 0;
  barrierDeaths = 0;
  readonly performance = new Map<string, Performance>();
  readonly killed: Record<string, number> = {};
  readonly discovered = new Set<string>();
  readonly timeline: { second: number; friendly: number; enemy: number }[] = [];
  readonly heatmap = Array<number>(36).fill(0);
  readonly destroyed = new Map<number, number>();
  private nextID = 1;
  private armyFingerprint = '';
  private nextVisual = 1;
  private scheduled: Scheduled[] = [];
  private resolvingHealing = false;
  private healingQueue: {
    source: Entity;
    target: Entity;
    amount: number;
    coreHalf: boolean;
    signatureFlat: boolean;
    bodyFactor: number;
  }[] = [];
  private corpses: Corpse[] = [];
  private accuracy: RandomStream;
  private losCache = new Map<string, boolean>();
  private solidsCache = new Map<string, Rect[]>();
  private topology = 0;
  private rearm = new EngineerRearm();
  private damageFriendly = 0;
  private damageEnemy = 0;
  private rearmSources = new Map<number, number>();
  readonly core: Entity;
  constructor(
    readonly start: GameState,
    readonly plan: Plan,
    accuracy: RandomStream,
  ) {
    this.accuracy = accuracy;
    const d: Definition = {
      ...definition('friendly.command_node'),
      id: 'objective.harmonic_core',
      name: 'Harmonic Core',
      health: 10000,
      armor: 0,
      width: 4,
      height: 4,
      range: 0,
    };
    this.core = this.entity(d, null, 0, { x: fx(30), y: fx(30) }, 0, 0, 0, 0);
    this.core.rect = { x: fx(28), y: fx(28), width: fx(4), height: fx(4) };
    this.core.hp = start.coreHP;
    this.core.eligibleRestoration = 10240000 - start.coreHP;
    this.entities.push(this.core);
    for (const a of [...start.assets].sort((a, b) => compareIDs(a.id, b.id))) {
      if (!a.placement) continue;
      const r = footprint(a)!;
      const e = this.entity(
        definition(a.type),
        a,
        0,
        { x: fx(r.x + r.width / 2), y: fx(r.y + r.height / 2) },
        0,
        0,
        0,
        0,
      );
      e.hp = a.hp;
      e.eligibleRestoration = e.stats.health - a.hp;
      e.charges = a.charges;
      e.heading = (Math.round(H / 4 - (a.tactics.heading * H) / 360) + H) % H;
      e.aim = e.heading;
      if (!e.d.speed) e.rect = { x: fx(r.x), y: fx(r.y), width: fx(r.width), height: fx(r.height) };
      this.entities.push(e);
      this.performance.set(a.id, {
        id: a.id,
        type: a.type,
        damage: 0,
        healing: 0,
        shield: 0,
        contribution: 0,
        operational: false,
        blocks: 0,
        endingHP: a.hp,
        endingCharges: a.charges,
        reasons: {},
      });
    }
    this.note(`${plan.name} — ${plan.faction}`);
  }
  static async create(start: GameState, plan: Plan): Promise<FullBattle> {
    const battle = new FullBattle(
      structuredClone(start),
      structuredClone(plan),
      await RandomStream.seeded(plan.seed, 'accuracy', plan.version),
    );
    battle.armyFingerprint = await hash({
      version: start.version,
      rank: start.rank,
      coreHP: start.coreHP,
      land: [...start.land].sort(),
      warden: start.warden,
      assets: start.assets
        .filter((a) => a.placement)
        .sort((a, b) => (a.id < b.id ? -1 : 1))
        .map((a) => ({
          id: a.id,
          type: a.type,
          hp: a.hp,
          charges: a.charges,
          level: a.level,
          enhancement: a.enhancement,
          stars: a.stars,
          branch: a.branch,
          doctrineRole: a.doctrineRole,
          placement: a.placement,
          tactics: a.tactics,
        })),
    });
    return battle;
  }

  checkpointClock() {
    return { accuracy: this.accuracy.state, nextID: this.nextID };
  }
  restoreClock(clock: { accuracy: number; nextID: number }) {
    if (
      !Number.isInteger(clock.accuracy) ||
      clock.accuracy < 1 ||
      clock.accuracy > 4294967295 ||
      clock.nextID < this.nextID
    )
      throw new Error('Invalid block stream/ID checkpoint');
    this.accuracy.state = clock.accuracy;
    this.nextID = clock.nextID;
  }
  private entity(
    d: Definition,
    a: Asset | null,
    side: 0 | 1,
    p: Vec,
    variant: number,
    qtp: number,
    segment: number,
    reserved: number,
  ): Entity {
    const stats = a
      ? friendlyStats(a)
      : d.id === 'objective.harmonic_core'
        ? {
            ...hostileStats(d, 0, {
              ...this.plan,
              band: 1,
              tier: 0,
              modifiers: [],
              mode: 'Calibration',
            }),
            health: 10240000,
            damage: 0,
          }
        : hostileStats(d, variant, this.plan);
    const shield = d.id === 'friendly.aegis_walkers' ? 800 : d.id === 'enemy.bulwark' ? 300 : 0,
      outputFactor = a ? 1 + (0.6 * (a.level - 1)) / 99 : 1,
      boost =
        (a && a.stars >= 2 && d.profile === 'Protection' ? 1.15 : 1) *
        outputFactor *
        (a ? 1 + 0.03 * a.enhancement : 1);
    return {
      id: this.nextID++,
      owned: a?.id ?? null,
      d,
      asset: a,
      side,
      faction: this.plan.faction,
      stats,
      hp: stats.health,
      ...p,
      radius: fx(d.radius),
      rect: null,
      heading: 0,
      aim: 0,
      target: null,
      targetSince: 0,
      nextDecision: 0,
      score: 0,
      nextAttack: 0,
      warmup: 0,
      lastFire: -1000,
      lastDamage: -1000,
      lastMove: -1000,
      vx: 0,
      vy: 0,
      moveCarryX: 0,
      moveCarryY: 0,
      phase: 1,
      transition: 0,
      variant,
      statuses: [],
      shield: fx(shield * boost),
      bonusPools: [],
      shieldMax: fx(shield * boost),
      shieldFront: d.id === 'enemy.bulwark',
      shieldUntil: 0,
      heat: 0,
      overheat: 0,
      lock: 0,
      channel: null,
      channelSince: 0,
      signatureShots: 0,
      eligibleRestoration: stats.health,
      controlCredit: 0,
      detectionCredit: false,
      memory: {},
      losLostAt: 0,
      gateOpen: a?.tactics.gate === 'Open',
      gateUntil: 0,
      cooldowns: {},
      signature: a?.stars === 6 ? 'armed' : 'locked',
      signatureUntil: 0,
      charges: a?.charges ?? null,
      temporary: 0,
      reserved,
      reserveQTP: 0,
      qtp,
      segment,
      spawnTick: this.tick,
      path: [],
      pathGoal: null,
      pathVersion: -1,
      pathAt: -1000,
      stuck: 0,
      stuckAt: { ...p },
      retreat: false,
      retreatAt: 0,
      childrenReleased: 0,
      harvests: 0,
      consuming: 0,
      consumeAt: 0,
      consumeDamage: 0,
      burrow: false,
      slotOwner: null,
      slots: {},
      pool: d.id === 'friendly.shield_projector' ? fx(1000 * boost) : 0,
      jamUntil: 0,
      revealUntil: 0,
      abilityCast: null,
    };
  }
  alive(side?: 0 | 1): Entity[] {
    return this.entities.filter((e) => e.hp > 0 && (side === undefined || e.side === side));
  }
  get population(): number {
    return this.alive(1).length + this.entities.reduce((n, e) => n + e.reserved, 0);
  }
  private get(id: number | null): Entity | undefined {
    return id === null ? undefined : this.entities.find((e) => e.id === id);
  }
  private note(message: string): void {
    this.events = [`${(this.tick / 60).toFixed(1)}s · ${message}`, ...this.events].slice(0, 100);
  }
  private reason(e: Entity, r: string): void {
    if (e.owned) {
      const p = this.performance.get(e.owned)!;
      p.reasons[r] = (p.reasons[r] ?? 0) + 1;
    }
  }
  private effect(kind: string, from: Vec, to: Vec, side: 0 | 1, duration = 0.25) {
    this.effects.push({
      id: this.nextVisual++,
      kind,
      from: { x: from.x, y: from.y },
      to: { x: to.x, y: to.y },
      until: this.tick + secs(duration),
      side,
    });
    if (this.effects.length > 256) this.effects.splice(0, this.effects.length - 256);
  }
  private status(e: Entity, kind: string, value: number, duration: number, source: Entity): void {
    if (kind === 'root') {
      if ((e.cooldowns.rootImmune ?? 0) > this.tick) return;
      const active = e.statuses.find((s) => s.kind === 'root' && s.until > this.tick),
        cap = secs(e.d.category === 'boss' ? 0.5 : 2);
      if (!active) e.cooldowns.rootStart = this.tick;
      duration =
        Math.max(
          0,
          Math.min(secs(duration), (e.cooldowns.rootStart ?? this.tick) + cap - this.tick),
        ) / 60;
      if (!duration) return;
    }
    if (kind === 'burn') {
      kind = `burn.${source.id}.${source.cooldowns.burnActivation ?? 0}`;
      const existing = e.statuses.find((s) => s.kind === kind);
      if (existing) {
        existing.until = this.tick + secs(duration);
        return;
      }
      const burning = e.statuses.filter((s) => s.kind.startsWith('burn.') && s.until > this.tick);
      if (burning.length >= 3) {
        const owned = burning
          .filter((s) => s.source === source.id)
          .sort((a, b) => a.until - b.until);
        const replace =
          owned[0] ??
          burning.sort((a, b) => a.value - b.value || a.until - b.until || a.source - b.source)[0];
        if (!replace || (!owned.length && value < replace.value)) return;
        replace.until = this.tick + secs(duration);
        if (!owned.length) {
          replace.value = value;
          replace.kind = kind;
          replace.source = source.id;
        }
        return;
      }
    }
    const existing = e.statuses.find((s) => s.kind === kind && s.source === source.id);
    if (existing) {
      existing.until = this.tick + secs(duration);
      existing.value = value;
    } else e.statuses.push({ kind, value, until: this.tick + secs(duration), source: source.id });
  }
  private value(e: Entity, kind: string): number {
    if (kind === 'root-immune' && (e.cooldowns.rootImmune ?? 0) > this.tick) return 1;
    return e.statuses
      .filter((s) => s.kind === kind && s.until > this.tick)
      .reduce((n, s) => Math.max(n, s.value), 0);
  }
  private has(e: Entity, kind: string): boolean {
    return this.value(e, kind) > 0;
  }
  private schedule(owner: Entity, seconds: number, run: () => void, independent = false) {
    this.scheduled.push({ due: this.tick + secs(seconds), owner: owner.id, independent, run });
  }
  private solids(e: Entity, exclude: Entity | null = null): Rect[] {
    const key = `${e.id}|${e.side}|${e.radius}|${exclude?.id ?? 0}`;
    const cached = this.solidsCache.get(key);
    if (cached) return cached;
    const r = this.alive()
      .filter(
        (v) =>
          v.id !== e.id &&
          v.id !== exclude?.id &&
          v.rect &&
          (v.d.id === 'objective.harmonic_core' ||
            (v.asset &&
              (v.d.id === 'friendly.controlled_gate'
                ? !v.gateOpen
                : solidAsset(v.asset, e.radius / U, e.side === 0)))),
      )
      .map((v) => v.rect!);
    if (e.burrow) return [{ x: fx(24), y: fx(24), width: fx(12), height: fx(12) }];
    this.solidsCache.set(key, r);
    return r;
  }
  private los(a: Entity, b: Entity): boolean {
    const key = `${a.id}|${b.id}|${a.x}|${a.y}|${b.x}|${b.y}|${this.topology}`,
      cached = this.losCache.get(key);
    if (cached !== undefined) return cached;
    const end = nearest(a, b);
    for (const e of this.alive()) {
      if (
        e.id === a.id ||
        e.id === b.id ||
        !e.rect ||
        e.d.category === 'trap' ||
        e.d.id === 'friendly.resonance_channel' ||
        e.d.id === 'friendly.razor_field' ||
        e.d.id === 'friendly.anti_vehicle_obstacle' ||
        e.d.id === 'friendly.elevated_firing_platform'
      )
        continue;
      if (e.d.id === 'friendly.low_cover') continue;
      if (e.d.id === 'friendly.controlled_gate' && e.gateOpen) continue;
      if (sweep(a, end, e, 0) !== null) {
        this.losCache.set(key, false);
        return false;
      }
    }
    this.losCache.set(key, true);
    return true;
  }
  private detected(a: Entity, b: Entity): boolean {
    if (b.burrow) return false;
    if (b.side === a.side) return true;
    const hidden =
      b.d.id === 'enemy.veil' ||
      (b.d.id === 'boss.silent_crown' && this.tick % 600 < 240) ||
      this.has(b, 'cloak');
    if (!hidden || b.revealUntil > this.tick) return true;
    if (distance(a, b) <= fx(2)) return true;
    return this.alive(a.side).some(
      (e) =>
        (e.d.id === 'friendly.detection_relay' || e.d.id === 'friendly.nullifier') &&
        e.jamUntil <= this.tick &&
        boundary(e, b) <= e.stats.range &&
        this.los(e, b),
    );
  }
  perceived(e: Entity): boolean {
    return (
      !e.burrow &&
      (e.side === 0 ||
        this.alive(0).some(
          (a) =>
            a.id !== this.core.id &&
            boundary(a, e) <=
              Math.max(a.stats.range, fx(a.d.category === 'warden' ? 12 : a.d.speed ? 10 : 6)) &&
            this.detected(a, e) &&
            this.los(a, e),
        ))
    );
  }
  private validTarget(a: Entity, b: Entity): boolean {
    return (
      b.hp > 0 &&
      a.side !== b.side &&
      !b.burrow &&
      this.detected(a, b) &&
      (a.d.targets === 'both' ||
        a.d.targets === b.d.layer ||
        (a.d.id === 'friendly.skyguard' &&
          !!a.asset?.tactics.groundFallback &&
          b.d.layer === 'ground' &&
          boundary(a, b) <= fx(6)))
    );
  }
  private coreThreat(b: Entity): number {
    return Math.max(0, 1 - boundary(b, this.core) / fx(12));
  }
  private score(a: Entity, b: Entity): number {
    const d = boundary(a, b) / U,
      nearCore = a.side === 0 ? this.coreThreat(b) : b.id === this.core.id ? 1 : 0,
      self = b.target === a.id ? 1 : 0,
      vulnerability = this.value(b, 'vulnerable') > 0 ? 1 : 1 - b.hp / b.stats.health;
    const taunt = a.statuses
        .filter((s) => s.kind === 'challenge' && s.source === b.id && s.until > this.tick)
        .reduce((n, s) => Math.max(n, s.value), 0),
      lure = a.statuses
        .filter((s) => s.kind === 'lure' && s.source === b.id && s.until > this.tick)
        .reduce((n, s) => Math.max(n, s.value), 0);
    let sector = 0;
    if (a.asset?.tactics.sector) {
      const front = ENTRANCES[a.asset.tactics.sector - 1]!,
        h = bearing({ x: fx(front.x) - this.core.x, y: fx(front.y) - this.core.y });
      sector =
        angleError(h, bearing({ x: b.x - this.core.x, y: b.y - this.core.y })) <= H / 8 ? 5 : 0;
    }
    let policy = 0;
    if (a.asset) {
      const p = a.asset.tactics.priorities.findIndex(
        (k) =>
          (k === 'Core threats' && nearCore > 0.2) ||
          (k === 'Support' && SUPPORT_ROLES.has(b.d.id)) ||
          (k === 'Elite' && (b.variant >= 2 || b.d.category === 'boss')) ||
          (k === 'Air' && b.d.layer === 'air') ||
          k === 'Nearest',
      );
      policy = (5 - Math.max(0, p)) / 5;
    } else
      policy =
        (a.d.id === 'enemy.raider' && b.d.speed > 0) ||
        (a.d.id === 'enemy.skimmer' && ['support', 'infrastructure'].includes(b.d.category)) ||
        (a.d.id === 'enemy.veil' && b.d.biological) ||
        (a.d.id === 'enemy.bombard' && b.rect !== null) ||
        (a.d.id === 'enemy.sapper' && b.d.category === 'route') ||
        (a.d.id === 'enemy.drainer' && b.id === this.core.id)
          ? 1
          : 0;
    const reserved = this.projectiles
        .filter((p) => p.target === b.id && p.side === a.side)
        .reduce((n, p) => n + p.damage, 0),
      queued =
        (a.asset && a.asset.stars >= 2 && a.d.profile === 'Precision') ||
        this.alive(a.side).some((v) => v.d.id === 'warden.conductor' && distance(a, v) <= fx(5))
          ? this.alive(a.side)
              .filter((v) => v.id !== a.id && v.target === b.id && v.warmup > this.tick)
              .reduce((sum, v) => sum + v.stats.damage, 0)
          : 0,
      overkill = reserved + queued >= b.hp ? 1 : 0;
    const marked = this.value(b, 'mark'),
      challenged = this.value(b, 'challenge'),
      coreCoefficient =
        a.asset?.tactics.core === 'Low' ? 50 : a.asset?.tactics.core === 'High' ? 70 : 60;
    return (
      sector +
      (a.asset?.doctrineRole &&
      a.asset.tactics.priorities.includes(a.asset.doctrineRole) &&
      this.start.rank >= 5
        ? this.doctrineUtility(a, b) * 0.05
        : 0) +
      taunt +
      lure +
      coreCoefficient * nearCore +
      20 * self +
      15 * policy +
      10 * vulnerability +
      10 * Math.max(0, 1 - d / 16) +
      8 * Number(this.alive(a.side).some((v) => v.id !== a.id && v.target === b.id)) -
      (12 * Math.max(0, d - a.stats.range / U)) / 12 -
      15 * Number(!this.los(a, b)) -
      20 * overkill +
      marked +
      (b.d.category === 'boss' ? this.value(a, 'boss-priority') : 0) +
      nearCore * this.value(a, 'core-defense') +
      (challenged &&
      this.get(b.statuses.find((s) => s.kind === 'challenge')?.source ?? null)?.id === a.id
        ? challenged
        : 0)
    );
  }
  private doctrineUtility(a: Entity, b: Entity): number {
    switch (a.asset?.doctrineRole) {
      case 'Core threats':
        return this.coreThreat(b) * 60;
      case 'Support':
        return SUPPORT_ROLES.has(b.d.id) ? 15 : 0;
      case 'Elite':
        return b.variant >= 2 || b.d.category === 'boss' ? 15 : 0;
      case 'Air':
        return b.d.layer === 'air' ? 15 : 0;
      case 'Nearest':
        return Math.max(0, 1 - boundary(a, b) / fx(16)) * 10;
      default:
        return 0;
    }
  }
  private decide(e: Entity): void {
    if (
      e.d.category === 'trap' ||
      e.d.category === 'route' ||
      (e.d.weapon === 'none' && e.side === 0)
    )
      return;
    const posture = e.asset?.tactics.posture ?? 'Aggressive',
      engage = posture === 'Defensive' ? 6 : posture === 'Balanced' ? 9 : 12;
    let perception =
      e.side === 1 ? (e.d.category === 'boss' ? 16 : 10) : Math.max(engage, e.stats.range / U);
    if (
      e.side === 0 &&
      this.alive(0).some(
        (v) =>
          v.d.id === 'friendly.command_node' &&
          v.jamUntil <= this.tick &&
          boundary(v, e) <= v.stats.range,
      )
    )
      perception *= 1.25;
    const memorySeconds =
      2 +
      (e.side === 0 &&
      this.alive(0).some(
        (v) =>
          ['friendly.tactical_uplink', 'friendly.command_node'].includes(v.d.id) &&
          v.jamUntil <= this.tick &&
          boundary(v, e) <= v.stats.range,
      )
        ? 1
        : 0);
    for (const t of this.alive(e.side === 0 ? 1 : 0))
      if (boundary(e, t) <= fx(perception) && this.detected(e, t) && this.los(e, t)) {
        e.memory[t.id] = { x: t.x, y: t.y, tick: this.tick, layer: t.d.layer };
        if (e.side === 0 && !t.d.id.startsWith('special.')) this.discovered.add(t.d.id);
      }
    for (const id of Object.keys(e.memory).map(Number))
      if (this.tick - e.memory[id]!.tick > secs(memorySeconds) || !this.get(id)?.hp)
        delete e.memory[id];
    let candidates = this.alive(e.side === 0 ? 1 : 0).filter(
      (t) =>
        this.validTarget(e, t) &&
        (e.memory[t.id]?.tick === this.tick || (e.side === 1 && t.id === this.core.id)),
    );
    if (e.d.targets === 'ground') candidates = candidates.filter((t) => t.d.layer === 'ground');
    if (e.side === 1) {
      let preferred: Entity[] = [];
      if (e.d.id === 'enemy.runner')
        preferred = candidates.filter(
          (t) => t.id === this.core.id || (e.stuck >= 120 && t.rect !== null),
        );
      if (e.d.id === 'enemy.raider')
        preferred = candidates.filter(
          (t) => t.d.speed > 0 && t.d.layer === 'ground' && boundary(e, t) <= fx(4),
        );
      if (e.d.id === 'enemy.lancer')
        preferred = candidates.filter((t) => t.d.biological || t.d.category === 'tower');
      if (e.d.id === 'enemy.bombard')
        preferred = candidates.filter((t) => t.rect !== null && t.d.category !== 'trap');
      if (e.d.id === 'enemy.skimmer' || e.d.id === 'enemy.jammer')
        preferred = candidates.filter((t) => ['support', 'infrastructure'].includes(t.d.category));
      if (e.d.id === 'enemy.veil')
        preferred = candidates.filter(
          (t) =>
            ['friendly.field_medics', 'friendly.combat_engineers'].includes(t.d.id) ||
            t.d.biological,
        );
      if (e.d.id === 'enemy.drainer')
        preferred = candidates.filter(
          (t) => t.id === this.core.id || t.shield > 0 || t.slotOwner !== null,
        );
      if (
        e.d.id === 'enemy.sapper' &&
        (!edgeClear(e, nearest(e, this.core), e.radius, this.solids(e)) ||
          (e.path.length &&
            e.path.reduce((sum, p, i) => sum + distance(i ? e.path[i - 1]! : e, p), 0) >
              distance(e, this.core) + fx(8)))
      )
        preferred = candidates.filter((t) => t.d.category === 'route');
      if (e.d.id === 'enemy.breaker')
        preferred = candidates.filter((t) => t.rect !== null && t.id !== this.core.id);
      if (preferred.length) candidates = preferred;
    }

    const ordered = candidates
      .map((t) => ({ t, score: this.score(e, t) }))
      .sort((a, b) => b.score - a.score || a.t.id - b.t.id);
    const best = ordered[0],
      current = this.get(e.target);
    if (!best) {
      const remembered = this.get(e.target);
      if (remembered && e.memory[remembered.id]) {
        this.reason(e, 'Remembering last seen contact');
        return;
      }
      e.target = null;
      e.warmup = 0;
      this.reason(e, 'No detected target');
      return;
    }
    if (
      current &&
      this.validTarget(e, current) &&
      boundary(e, current) <= fx(perception) &&
      this.tick - e.targetSince <
        (e.asset &&
        e.asset.stars >= 2 &&
        e.d.profile === 'Suppression' &&
        ['friendly.rifle_squad', 'friendly.arc_spire'].includes(e.d.id)
          ? 45
          : 60) &&
      best.t.id !== current.id
    )
      return;
    if (
      current &&
      this.validTarget(e, current) &&
      best.t.id !== current.id &&
      best.score < this.score(e, current) + 10
    )
      return;
    if (
      e.d.id === 'friendly.skyguard' &&
      e.signature === 'armed' &&
      best.t.d.layer === 'air' &&
      best.t.variant >= 2 &&
      boundary(e, best.t) <= e.stats.range &&
      this.los(e, best.t)
    ) {
      const selected = best.t;
      e.signature = 'pending';
      e.abilityCast = 'sky-signature';
      for (let i = 0; i < 3; i++)
        this.schedule(e, i * 0.15, () => {
          if (!selected.hp) {
            e.abilityCast = null;
            e.signature = 'used';
            return;
          }
          if (i === 0) this.activateSignature(e, 0);
          this.fireProjectile(e, selected, scaled(this.output(e, e.stats.damage, selected), 0.6));
          if (i === 2) e.abilityCast = null;
        });
    }
    if (e.target !== best.t.id) {
      if (
        current &&
        e.asset &&
        e.asset.stars >= 4 &&
        e.d.profile === 'Suppression' &&
        this.tick >= (e.cooldowns.quickSwitch ?? 0)
      ) {
        this.status(e, 'quick-switch', 1, 1, e);
        e.cooldowns.quickSwitch = this.tick + 180;
      }
      e.target = best.t.id;
      e.targetSince = this.tick;
      e.lock = 0;
      e.warmup = 0;
    }
    e.score = best.score;
  }
  private roleMove(e: Entity, target: Entity): boolean {
    if (
      e.d.id === 'enemy.harvester' &&
      e.harvests < (e.variant >= 2 ? 4 : 3) &&
      this.tick - e.lastDamage > 60
    ) {
      const corpse = this.corpses
        .filter((c) => !c.claimed && distance(e, c) <= fx(10))
        .sort((a, b) => distance(e, a) - distance(e, b) || a.id - b.id)[0];
      if (corpse && distance(e, corpse) > U) {
        this.move(e, corpse, fx(0.8));
        return true;
      }
    }
    if (e.d.id === 'enemy.bulwark') {
      const support = this.alive(1)
        .filter((v) => SUPPORT_ROLES.has(v.d.id) && distance(e, v) <= fx(10) && this.los(e, v))
        .sort((a, b) => distance(e, a) - distance(e, b) || a.id - b.id)[0];
      if (support && distance(e, support) > fx(2)) {
        const delta = direction(
          bearing({ x: target.x - support.x, y: target.y - support.y }),
          fx(1.5),
        );
        this.move(e, { x: support.x + delta.x, y: support.y + delta.y }, fx(0.4));
        return true;
      }
    }
    if (['enemy.herald', 'enemy.carrier', 'enemy.jammer'].includes(e.d.id)) {
      const front = this.alive(1)
        .filter(
          (v) =>
            v.id !== e.id &&
            !SUPPORT_ROLES.has(v.d.id) &&
            distance(e, v) <= fx(10) &&
            this.los(e, v),
        )
        .sort((a, b) => distance(a, this.core) - distance(b, this.core) || a.id - b.id)[0];
      if (front && distance(e, this.core) < distance(front, this.core) + fx(1.5)) {
        const delta = direction(
          bearing({ x: front.x - this.core.x, y: front.y - this.core.y }),
          fx(2),
        );
        this.move(e, { x: front.x + delta.x, y: front.y + delta.y }, fx(0.5));
        return true;
      }
    }
    return false;
  }
  private separate(e: Entity) {
    const spacing = e.asset?.tactics.spacing ?? (e.variant ? 'Spread' : 'Balanced'),
      gap = spacing === 'Compact' ? 0.1 : spacing === 'Spread' ? 0.8 : 0.35;
    const other = this.alive(e.side)
      .filter(
        (v) =>
          v.id !== e.id &&
          !v.rect &&
          v.d.layer === e.d.layer &&
          distance(e, v) < e.radius + v.radius + fx(gap),
      )
      .sort((a, b) => distance(e, a) - distance(e, b) || a.id - b.id)[0];
    if (other) {
      const h = bearing({ x: e.x - other.x || (e.id < other.id ? 1 : -1), y: e.y - other.y }),
        delta = direction(h, fx(0.5));
      this.move(e, { x: e.x + delta.x, y: e.y + delta.y }, fx(0.05), 0.7);
    }
  }
  private terrain(e: Entity): number {
    let multiplier = 1;
    if (
      e.d.layer === 'ground' &&
      this.entities.some(
        (t) =>
          !t.hp &&
          t.rect &&
          e.x >= t.rect.x &&
          e.x < t.rect.x + t.rect.width &&
          e.y >= t.rect.y &&
          e.y < t.rect.y + t.rect.height,
      )
    )
      multiplier /= 1.15;
    for (const t of this.alive(0)) {
      if (!t.rect || e.d.layer === 'air') continue;
      const inRect =
        e.x >= t.rect.x &&
        e.x < t.rect.x + t.rect.width &&
        e.y >= t.rect.y &&
        e.y < t.rect.y + t.rect.height;
      if (!inRect) continue;
      if (t.d.id === 'friendly.low_cover') multiplier = Math.min(multiplier, 0.8);
      if (t.d.id === 'friendly.anti_vehicle_obstacle' && e.radius < fx(0.6))
        multiplier = Math.min(multiplier, 0.8);
      if (t.d.id === 'friendly.resonance_channel') multiplier *= e.side === 0 ? 1.15 : 0.9;
      if (t.d.id === 'friendly.razor_field' && e.side === 1) {
        this.status(e, 'slow', 0.15, 0.3, t);
        if (this.tick % 15 === 0) this.damage(t, e, fx(15 * 0.25), 0, false);
      }
    }
    return multiplier;
  }
  private move(e: Entity, goal: Vec, arrival = fx(0.15), speedMultiplier = 1): boolean {
    if (e.side === 1) {
      const root = e.statuses
          .filter((s) => s.kind === 'root' && s.until > this.tick)
          .sort((a, b) => a.source - b.source)[0],
        slow = e.statuses
          .filter((s) => s.kind === 'slow' && s.until > this.tick)
          .sort((a, b) => b.value - a.value || a.source - b.source)[0],
        winner = root ?? slow;
      if (winner && e.controlCredit < fx(100)) {
        const amount = Math.min(
            fx(100) - e.controlCredit,
            Math.round(
              (fx(10) / 60) *
                (root ? 1 : Math.min(e.d.category === 'boss' ? 0.35 : 0.5, winner.value)),
            ),
          ),
          source = this.get(winner.source);
        if (source?.owned && source.d.profile) {
          this.performance.get(source.owned)!.contribution += amount;
          e.controlCredit += amount;
        }
      }
    }
    if (!e.stats.speed || this.has(e, 'root') || e.transition > this.tick) return false;
    const solids = e.d.layer === 'air' ? [] : this.solids(e);
    let point = goal;
    const clear = edgeClear(e, goal, e.radius, solids);
    if (!clear) {
      if (
        e.pathVersion !== this.topology ||
        !e.pathGoal ||
        distance(e.pathGoal, goal) > fx(1) ||
        this.tick - e.pathAt >= 120
      ) {
        e.path = findPath(e, goal, e.radius, solids, arrival, (p) => {
          const terrain = this.alive(0).find(
            (t) =>
              t.rect &&
              p.x >= t.rect.x &&
              p.x < t.rect.x + t.rect.width &&
              p.y >= t.rect.y &&
              p.y < t.rect.y + t.rect.height &&
              ['friendly.low_cover', 'friendly.resonance_channel', 'friendly.razor_field'].includes(
                t.d.id,
              ),
          );
          return terrain
            ? terrain.d.id === 'friendly.resonance_channel'
              ? e.side === 0
                ? 870
                : 1111
              : 1250
            : 1000;
        });
        e.pathGoal = { ...goal };
        e.pathAt = this.tick;
        e.pathVersion = this.topology;
      }
      while (e.path.length && distance(e, e.path[0]!) < fx(0.3)) e.path.shift();
      if (!e.path.length) {
        this.reason(e, 'Route blocked');
        this.breach(e, goal);
        return false;
      }
      point = e.path[0]!;
    }
    if (distance(e, point) <= arrival) return false;
    const slow = Math.min(e.d.category === 'boss' ? 0.35 : 0.5, this.value(e, 'slow')),
      mult = this.terrain(e) * speedMultiplier * (1 - slow);
    const advance = Math.min(
        distance(e, point),
        Math.max(1, Math.round((e.stats.speed * mult) / 60)),
      ),
      h = bearing({ x: point.x - e.x, y: point.y - e.y });
    for (const offset of [0, 4096, -4096, 8192, -8192, 16384, -16384]) {
      const perSecond = direction((h + offset + H) % H, Math.round(e.stats.speed * mult)),
        sumX = perSecond.x + e.moveCarryX,
        sumY = perSecond.y + e.moveCarryY,
        step = { x: Math.trunc(sumX / 60), y: Math.trunc(sumY / 60) };
      if (distance({ x: 0, y: 0 }, step) > advance) {
        const capped = direction((h + offset + H) % H, advance);
        step.x = capped.x;
        step.y = capped.y;
      }
      const p = { x: e.x + step.x, y: e.y + step.y };
      if (!edgeClear(e, p, e.radius, solids)) continue;
      if (
        this.alive().some(
          (other) =>
            other.id !== e.id &&
            !other.rect &&
            other.d.layer === e.d.layer &&
            distance(p, other) < e.radius + other.radius &&
            distance(p, other) < distance(e, other),
        )
      )
        continue;
      e.moveCarryX = sumX - Math.trunc(sumX / 60) * 60;
      e.moveCarryY = sumY - Math.trunc(sumY / 60) * 60;
      e.vx = p.x - e.x;
      e.vy = p.y - e.y;
      e.x = p.x;
      e.y = p.y;
      e.heading = this.turnWithCarry(e, e.heading, bearing(step), 360, 'bodyTurn');
      e.lastMove = this.tick;
      if (
        e.side === 0 &&
        e.asset?.stars &&
        e.asset.stars >= 3 &&
        e.asset.branch === 'B' &&
        e.d.profile === 'Precision'
      )
        e.lock = 0;
      return true;
    }
    this.reason(e, 'Body avoidance');
    return false;
  }
  private breach(e: Entity, goal: Vec) {
    if (e.side === 0 || e.d.layer === 'air' || e.burrow) return;
    const barriers = this.alive(0).filter(
      (b) => b.rect && b.d.id !== 'objective.harmonic_core' && this.los(e, b),
    );
    barriers.sort(
      (a, b) =>
        boundary(e, a) +
        distance(a, goal) +
        a.hp / 100 -
        boundary(e, b) -
        distance(b, goal) -
        b.hp / 100,
    );
    const b = barriers[0];
    if (b) {
      e.cooldowns.breachTarget = b.id;
      e.target = b.id;
      e.targetSince = this.tick;
    }
  }
  private turnWithCarry(e: Entity, current: number, target: number, degrees: number, key: string) {
    const denominator = 360 * 60,
      sum = H * degrees + (e.cooldowns[key] ?? 0),
      budget = Math.floor(sum / denominator);
    e.cooldowns[key] = sum - budget * denominator;
    return turn(current, target, budget);
  }
  private output(e: Entity, base = e.stats.damage, target: Entity | null = null): number {
    let multiplier = e.d.category === 'mobile' ? 0.5 + (0.5 * e.hp) / e.stats.health : 1;
    if (e.asset && target) {
      const a = e.asset;
      if (a.stars >= 2 && e.d.profile === 'Siege' && target.stats.armor >= 30) multiplier *= 1.15;
      if (
        a.stars >= 3 &&
        a.branch === 'A' &&
        e.d.profile === 'Precision' &&
        (target.variant >= 2 || target.d.category === 'boss')
      )
        multiplier *= a.stars >= 5 ? 1.25 : 1.15;
      if (
        a.stars >= 3 &&
        a.branch === 'B' &&
        e.d.profile === 'Suppression' &&
        this.tick - e.targetSince >= 120
      )
        multiplier *= a.stars >= 5 ? 1.15 : 1.1;
    }
    multiplier *= 1 + this.value(e, 'output');
    if (e.side === 1) {
      const buffs = this.alive(1)
        .filter((v) => distance(e, v) <= fx(4))
        .map((v) =>
          v.d.id === 'enemy.herald'
            ? (v.variant >= 2 ? 0.2 : 0.15) * (this.has(v, 'suppressed') ? 0.75 : 1)
            : v.d.id === 'boss.marshal' && v.phase >= 2
              ? 0.2 * (this.has(v, 'suppressed') ? 0.75 : 1)
              : 0,
        );
      multiplier *= 1 + Math.max(0, ...buffs);
    }
    return scaled(base, multiplier);
  }
  private heal(
    source: Entity,
    target: Entity,
    amount: number,
    coreHalf = false,
    signatureFlat = false,
  ): number {
    if (!this.resolvingHealing) {
      this.healingQueue.push({
        source,
        target,
        amount,
        coreHalf,
        signatureFlat,
        bodyFactor:
          source.d.category === 'mobile' && !signatureFlat
            ? 0.5 + (0.5 * source.hp) / source.stats.health
            : 1,
      });
      return 0;
    }
    if (target.hp <= 0 || source.hp <= 0 || source.jamUntil > this.tick) return 0;
    let value = coreHalf && target.id === this.core.id ? scaled(amount, 0.5) : amount;
    if (
      !signatureFlat &&
      source.asset?.stars &&
      source.asset.stars >= 3 &&
      source.asset.branch === 'B' &&
      source.d.profile === 'Recovery' &&
      target.hp < target.stats.health * 0.3
    )
      value = scaled(value, source.asset.stars >= 5 ? 1.3 : 1.2);
    if (this.has(target, 'suppressed')) value = scaled(value, 0.5);
    value = Math.min(target.stats.health - target.hp, value);
    target.hp += value;
    if (source.owned) {
      const p = this.performance.get(source.owned)!;
      p.healing += value;
      const eligible = Math.min(value, target.eligibleRestoration);
      target.eligibleRestoration -= eligible;
      p.contribution += eligible;
    }
    if (value) this.effect('heal', source, target, source.side, 0.3);
    return value;
  }
  private reduction(e: Entity): number {
    let r = this.value(e, 'reduction');
    if (
      e.side === 0 &&
      (e.d.category === 'warden' || (e.d.category === 'mobile' && e.d.layer === 'ground')) &&
      this.alive(0).some(
        (v) =>
          v.d.id === 'friendly.barracks' &&
          v.jamUntil <= this.tick &&
          boundary(v, e) <= v.stats.range,
      )
    )
      r = Math.max(r, 0.1);
    if (e.side === 1)
      r = Math.max(
        r,
        ...this.alive(1)
          .filter((v) => v.variant === 3 && v.id !== e.id && boundary(v, e) <= fx(4))
          .map((v) => 0.1 * (this.has(v, 'suppressed') ? 0.75 : 1)),
      );
    return Math.min(e.d.category === 'boss' ? 0.35 : 0.4, r);
  }
  private absorb(
    e: Entity,
    raw: number,
    source: Entity | null,
    direct: boolean,
    impact?: Vec,
    burn = false,
  ): number {
    let remaining = raw;
    if (e.side === 0 && direct && source?.d.weapon === 'bullet' && source.stats.area === 0) {
      const aegis = this.alive(0)
        .filter(
          (v) =>
            v.id !== e.id &&
            v.d.id === 'friendly.aegis_walkers' &&
            v.shield > 0 &&
            boundary(v, e) <= this.auraRange(v, 2.5),
        )
        .sort((a, b) => b.shieldMax - a.shieldMax || a.id - b.id)[0];
      if (aegis) {
        const taken = Math.min(aegis.shield, scaled(remaining, 0.2));
        aegis.shield -= taken;
        remaining -= taken;
        aegis.lastDamage = this.tick;
        this.creditShield(aegis, taken);
      }
    }
    for (const pool of e.bonusPools
      .filter((p) => p.until > this.tick)
      .sort((a, b) => a.until - b.until || a.owner - b.owner)) {
      const taken = Math.min(pool.capacity, remaining);
      pool.capacity -= taken;
      remaining -= taken;
      const owner = this.get(pool.owner);
      if (owner) this.creditShield(owner, taken);
    }
    if (
      e.shield > 0 &&
      (!e.shieldFront ||
        (!burn &&
          source &&
          angleError(
            e.aim,
            bearing({ x: (impact ?? source).x - e.x, y: (impact ?? source).y - e.y }),
          ) <= Math.round(H / 6)))
    ) {
      const taken = Math.min(e.shield, remaining);
      e.shield -= taken;
      remaining -= taken;
      this.creditShield(e, taken);
    }
    if (e.slotOwner) {
      const owner = this.get(e.slotOwner);
      const available = owner?.hp && owner.jamUntil <= this.tick ? (owner.slots[e.id] ?? 0) : 0;
      const taken = Math.min(remaining, available);
      if (owner && taken) {
        owner.slots[e.id] = available - taken;
        remaining -= taken;
        owner.lastDamage = this.tick;
        this.creditShield(owner, taken);
      }
    }
    if (raw !== remaining) this.effect('shield', e, e, e.side, 0.2);
    return remaining;
  }
  private bonusShield(source: Entity, target: Entity, amount: number, duration: number) {
    target.bonusPools.push({
      owner: source.id,
      capacity: amount,
      until: this.tick + secs(duration),
    });
  }
  private creditShield(e: Entity, value: number) {
    if (e.owned) {
      const p = this.performance.get(e.owned)!;
      p.shield += value;
      p.contribution += value;
    }
  }
  private damage(
    source: Entity | null,
    target: Entity,
    raw: number,
    penetration = 0,
    direct = true,
    impact?: Vec,
    burn = false,
  ): number {
    if (target.hp <= 0 || target.burrow || raw <= 0) return 0;
    if (
      source?.d.id === 'enemy.raider' &&
      source.variant >= 2 &&
      angleError(target.heading, bearing({ x: source.x - target.x, y: source.y - target.y })) >
        H / 3
    )
      raw = scaled(raw, 1.15);
    const residual = this.absorb(target, Math.round(raw), source, direct, impact, burn);
    const passiveArmor =
      target.d.id === 'warden.bulwark' ? 30 * (1 - this.core.hp / this.core.stats.health) : 0;
    let armor =
      Math.max(0, target.stats.armor + passiveArmor - this.value(target, 'shred')) *
      (1 - Math.min(1, penetration));
    if (
      target.d.id === 'boss.choir_dreadnought' &&
      source &&
      this.has(target, 'rear-vents') &&
      angleError(target.aim, bearing({ x: source.x - target.x, y: source.y - target.y })) > H / 3
    )
      armor = 0;
    if (
      (target.d.id === 'boss.marshal' && this.has(target, 'exposed')) ||
      (target.d.id === 'boss.black_conductor' && this.has(target, 'exposed'))
    )
      armor = 0;
    let cover = 1;
    if (direct && target.d.biological && source?.d.weapon === 'bullet' && target.side === 0) {
      for (const c of this.alive(0)) {
        if (c.d.id !== 'friendly.low_cover' || !c.rect) continue;
        if (boundary(target, c) > fx(0.6)) continue;
        if (
          segmentDistance(c, source, target) < fx(0.8) &&
          distance(source, c) < distance(source, target)
        ) {
          cover = 0.8;
          break;
        }
      }
    }

    const value = Math.min(
      target.hp,
      Math.max(
        0,
        Math.round(
          ((residual * 100) / (100 + armor)) *
            cover *
            (1 - this.reduction(target)) *
            (1 + this.value(target, 'vulnerable')),
        ),
      ),
    );
    const priorHP = target.hp;
    target.hp -= value;
    if (target.id === this.core.id)
      for (const threshold of [0.25, 0.1])
        if (
          priorHP > target.stats.health * threshold &&
          target.hp <= target.stats.health * threshold
        )
          this.note(`Core critical: ${Math.round(threshold * 100)}% Integrity`);
    if (source && source.side !== target.side) target.eligibleRestoration += value;
    target.lastDamage = this.tick;
    target.consumeDamage += value;
    if (source?.owned && target.d.id !== 'special.decoy') {
      const p = this.performance.get(source.owned)!;
      const total = value + Math.max(0, Math.round(raw) - residual);
      p.damage += total;
      p.contribution += total;
    }
    if (target.side === 0 && source?.side === 1) {
      const before = Math.min(
          priorHP,
          Math.round(
            ((residual * 100) / (100 + armor)) * cover * (1 + this.value(target, 'vulnerable')),
          ),
        ),
        prevented = Math.max(0, before - value);
      let provider = this.get(
        target.statuses
          .filter((s) => s.kind === 'reduction' && s.until > this.tick)
          .sort((a, b) => b.value - a.value || a.source - b.source)[0]?.source ?? null,
      );
      if (!provider || this.value(target, 'reduction') < 0.1)
        provider = this.alive(0)
          .filter((v) => v.d.id === 'friendly.barracks' && boundary(v, target) <= v.stats.range)
          .sort((a, b) => boundary(a, target) - boundary(b, target) || a.id - b.id)[0];
      if (provider?.owned && provider.d.profile)
        this.performance.get(provider.owned)!.contribution += prevented;
    }
    if (source?.side === 0) this.damageFriendly += value;
    else this.damageEnemy += value;
    const bin =
      Math.max(0, Math.min(5, Math.floor(target.x / (10 * U)))) +
      6 * Math.max(0, Math.min(5, Math.floor(target.y / (10 * U))));
    this.heatmap[bin] = (this.heatmap[bin] ?? 0) + value;
    if (value) this.effect('hit', target, target, target.side, 0.15);
    if (source?.d.id === 'friendly.nullifier')
      this.status(target, 'suppressed', 1, source.asset && source.asset.stars >= 4 ? 4 : 3, source);
    if (source?.d.id === 'friendly.rotary' || source?.d.id === 'friendly.heavy_squad') {
      const key = `hits:${source.id}`,
        count = this.value(target, key) + 1;
      this.status(target, key, count, 2, source);
      if (count >= 3) {
        const a = source.asset;
        const addition = a && a.stars >= 3 && a.branch === 'A' ? (a.stars >= 5 ? 0.15 : 0.1) : 0;
        const duration = 2 * (a && a.stars >= 2 ? 1.2 : 1);
        this.status(
          target,
          'slow',
          (source.d.id === 'friendly.rotary' ? 0.15 : 0.2) + addition,
          duration,
          source,
        );
        this.status(target, key, 0, 0, source);
      }
    }
    if (source?.d.id === 'enemy.sapper' && source.variant >= 2)
      this.status(target, 'shred', 10, 4, source);
    if (!target.hp) this.die(target, source);
    if (source?.d.id === 'enemy.drainer')
      this.heal(
        source,
        source,
        Math.min(Math.round(value * 0.5), fx((source.variant >= 2 ? 35 : 25) * 0.1)),
      );
    if (
      target.d.id === 'enemy.carrier' &&
      target.hp <= target.stats.health * 0.5 &&
      target.childrenReleased === 0
    )
      this.summon(target, 2);
    if (source?.asset?.stars === 6) {
      if (
        source.d.id === 'friendly.breaker_cannon' &&
        target.stats.armor >= 60 &&
        source.signature === 'armed'
      ) {
        this.activateSignature(source, 0);
        this.status(target, 'shred', 40, 8, source);
      }
    }
    return value;
  }
  private die(e: Entity, _source: Entity | null): void {
    e.hp = 0;
    e.signature = e.signature === 'active' || e.signature === 'pending' ? 'disabled' : e.signature;
    e.channel = null;
    e.abilityCast = null;
    this.warnings = this.warnings.filter((w) => w.owner !== e.id || w.damage > 0);
    this.topology++;
    this.solidsCache.clear();
    if (e.d.category === 'route') this.barrierDeaths++;
    if (e.side === 1) {
      if (e.d.category === 'boss') {
        e.reserved = 0;
        e.reserveQTP = 0;
      }
      this.killed[e.d.id] = (this.killed[e.d.id] ?? 0) + 1;
      this.destroyed.set(e.segment, (this.destroyed.get(e.segment) ?? 0) + e.qtp);
    }
    if ((e.d.speed || e.d.category === 'boss') && e.d.id !== 'special.decoy')
      this.corpses.push({ id: e.id, x: e.x, y: e.y, expires: this.tick + 1200, claimed: false });
    this.corpses = this.corpses.slice(-50);
    if (e.d.id === 'friendly.elevated_firing_platform') {
      const mounted = this.alive(0).find(
        (v) =>
          v.rect && v.rect.x === e.rect?.x && v.rect.y === e.rect?.y && v.d.category === 'tower',
      );
      if (mounted) {
        mounted.hp = Math.max(
          0,
          mounted.hp -
            Math.round(mounted.stats.health * (e.asset && e.asset.stars >= 4 ? 0.05 : 0.1)),
        );
        if (!mounted.hp) this.die(mounted, null);
      }
    }
    if (e.id === this.core.id) {
      this.outcome = 'Defeat';
      this.note('Harmonic Core incapacitated');
    } else if (e.owned || e.d.category === 'boss') this.note(`${e.d.name} incapacitated`);
  }
  private fireProjectile(
    e: Entity,
    t: Entity,
    damage: number,
    extra: Partial<Projectile> = {},
    unmissable = false,
  ): void {
    if (this.projectiles.length >= 300) {
      this.schedule(e, 1 / 60, () => this.fireProjectile(e, t, damage, extra, unmissable));
      this.reason(e, 'Projectile capacity held');
      return;
    }
    let accuracy = e.stats.accuracy;
    if (this.has(t, 'mark')) accuracy = buffAccuracy(accuracy, { n: 1n, d: 20n });
    if (
      e.d.id === 'warden.ranger' &&
      e.cooldowns.clearSince &&
      this.tick - e.cooldowns.clearSince >= 120
    )
      accuracy = buffAccuracy(accuracy, { n: 1n, d: 20n });
    if (
      this.alive(e.side).some(
        (v) =>
          v.d.id === 'friendly.tactical_uplink' &&
          v.jamUntil <= this.tick &&
          boundary(v, e) <= v.stats.range,
      )
    )
      accuracy = buffAccuracy(accuracy, { n: 1n, d: 20n });
    const hit = unmissable || accuracyPass(this.accuracy.next(), accuracy),
      missHeading = unmissable ? 0 : this.accuracy.next() % H,
      missRadius = unmissable ? 0 : U + (this.accuracy.next() % (U + 1)),
      offset = hit ? { x: 0, y: 0 } : direction(missHeading, missRadius),
      point = { x: t.x + offset.x, y: t.y + offset.y },
      aim = bearing({ x: point.x - e.x, y: point.y - e.y });
    const guided = e.d.weapon === 'guided',
      speed = fx(e.stats.velocity);
    this.projectiles.push({
      id: this.nextVisual++,
      owner: e.id,
      side: e.side,
      target: hit ? t.id : null,
      x: e.x,
      y: e.y,
      previous: { x: e.x, y: e.y },
      carryX: 0,
      carryY: 0,
      heading: aim,
      speed,
      radius: fx(0.05),
      damage,
      penetration:
        e.stats.penetration +
        (this.has(e, 'signature-penetration') ? this.value(e, 'signature-penetration') : 0),
      area: e.stats.area,
      layer: t.d.layer,
      guided,
      pierces: e.d.id === 'enemy.lancer' && e.variant >= 2 ? 2 : 1,
      hit: [],
      until:
        this.tick + Math.max(1, Math.ceil(((e.stats.range + fx(2)) * 60) / (extra.speed ?? speed))),
      color: e.d.color,
      ...extra,
    });
  }
  private warn(
    e: Entity,
    kind: Warning['kind'],
    point: Vec,
    radius: number,
    damage: number,
    delay: number,
    label: string,
    extra: Partial<Warning> = {},
    ownerBound = true,
  ): void {
    const w: Warning = {
      id: this.nextVisual++,
      owner: e.id,
      side: e.side,
      kind,
      origin: { x: e.x, y: e.y },
      point: { x: point.x, y: point.y },
      radius: fx(radius),
      width: fx(1),
      angle: bearing({ x: point.x - e.x, y: point.y - e.y }),
      due: this.tick + secs(delay),
      damage,
      penetration: e.stats.penetration,
      label,
      targets: [],
      layers: e.d.targets,
      ...extra,
    };
    this.warnings.push(w);
    this.note(label);
    this.schedule(
      e,
      delay,
      () => {
        this.warnings = this.warnings.filter((v) => v.id !== w.id);
        if (kind === 'jam') {
          for (const id of w.targets) {
            const t = this.get(id);
            if (t?.hp) this.jam(e, t, radius);
          }
          return;
        }
        for (const target of this.alive(e.side === 0 ? 1 : 0)) {
          if (target.burrow || (w.layers !== 'both' && target.d.layer !== w.layers)) continue;
          let inside = false;
          if (kind === 'circle') inside = boundary(w.point, target) <= w.radius;
          if (kind === 'line')
            inside = sweep(w.origin, w.point, target, Math.round(w.width / 2)) !== null;
          if (kind === 'cone') {
            const p = nearest(w.origin, target),
              left = direction((w.angle - H / 8 + H) % H, w.radius),
              right = direction((w.angle + H / 8) % H, w.radius);
            inside =
              boundary(w.origin, target) <= w.radius &&
              (angleError(w.angle, bearing({ x: p.x - w.origin.x, y: p.y - w.origin.y })) <=
                H / 8 ||
                sweep(w.origin, { x: w.origin.x + left.x, y: w.origin.y + left.y }, target, 0) !==
                  null ||
                sweep(w.origin, { x: w.origin.x + right.x, y: w.origin.y + right.y }, target, 0) !==
                  null);
          }
          if (inside)
            this.damage(
              e,
              target,
              Math.round(
                w.damage *
                  (kind === 'circle' && w.radius
                    ? 1 - 0.6 * Math.min(1, boundary(w.point, target) / w.radius)
                    : 1),
              ),
              w.penetration,
              false,
              w.kind === 'circle' ? w.point : w.origin,
            );
        }
        this.effect('blast', w.point, w.point, e.side, 0.6);
      },
      !ownerBound,
    );
  }
  private interval(e: Entity): number {
    let multiplier = 1;
    if (this.has(e, 'overclock')) multiplier *= 0.85;
    if (
      [
        'friendly.sentry',
        'friendly.rotary',
        'friendly.rifle_squad',
        'friendly.heavy_squad',
      ].includes(e.d.id) &&
      this.alive(e.side).some(
        (v) =>
          v.d.id === 'friendly.ammunition_fabricator' &&
          v.jamUntil <= this.tick &&
          boundary(v, e) <= v.stats.range,
      )
    )
      multiplier *= 0.9;
    return Math.max(1, Math.round(e.stats.interval * Math.max(0.7, multiplier)));
  }
  private bombard(e: Entity, t: Entity): void {
    if (e.abilityCast || this.tick < e.nextAttack) return;
    const lead = { x: Math.round(t.vx * 156), y: Math.round(t.vy * 156) },
      length = distance({ x: 0, y: 0 }, lead),
      factor = length > fx(3) ? fx(3) / length : 1;
    const point = { x: t.x + Math.round(lead.x * factor), y: t.y + Math.round(lead.y * factor) },
      damage = this.output(e, e.stats.damage, t);
    const preview: Warning = {
      id: this.nextVisual++,
      owner: e.id,
      side: e.side,
      kind: 'circle',
      origin: { x: e.x, y: e.y },
      point,
      radius: fx(e.stats.area),
      width: 0,
      angle: 0,
      due: this.tick + 156,
      damage: 0,
      penetration: 0,
      label: 'Bombard launch',
      targets: [],
      layers: 'ground',
    };
    this.warnings.push(preview);
    e.abilityCast = 'bombard';
    this.note('Bombard launch · impact in 2.6 seconds');
    this.schedule(e, 1.2, () => {
      e.abilityCast = null;
      this.warnings = this.warnings.filter((w) => w.id !== preview.id);
      e.lastFire = this.tick;
      e.nextAttack = this.tick + e.stats.interval;
      this.warn(e, 'circle', point, e.stats.area, damage, 1.4, 'Bombard impact', {}, false);
      if (e.variant >= 2)
        this.schedule(
          e,
          0.6,
          () =>
            this.warn(
              e,
              'circle',
              point,
              e.stats.area,
              scaled(damage, 0.5),
              1.4,
              'Second shell',
              {},
              false,
            ),
          true,
        );
    });
  }
  private basic(e: Entity): void {
    const t = this.get(e.target);
    if (!t || !this.validTarget(e, t) || e.d.weapon === 'none') {
      e.cooldowns.clearSince = 0;
      return;
    }
    if (
      e.d.category === 'boss' &&
      e.d.layer === 'ground' &&
      t.rect &&
      t.id !== this.core.id &&
      e.cooldowns.breachTarget === t.id
    ) {
      if (e.abilityCast || e.transition > this.tick || boundary(e, t) > fx(1.5) || !this.los(e, t))
        return;
      e.aim = turn(e.aim, bearing({ x: t.x - e.x, y: t.y - e.y }), 1092);
      if (this.tick < e.nextAttack) return;
      if (!e.warmup) {
        e.warmup = this.tick + 6;
        return;
      }
      if (this.tick < e.warmup) return;
      e.warmup = 0;
      this.damage(
        e,
        t,
        this.abilityOutput(e, e.d.id === 'boss.choir_dreadnought' ? 216 : 120),
        0,
        false,
      );
      e.lastFire = this.tick;
      e.nextAttack = this.tick + secs(e.d.id === 'boss.choir_dreadnought' ? 3 : 2);
      this.effect('breach', e, t, 1, 0.2);
      return;
    }
    if (
      e.side === 0 &&
      e.memory[t.id]?.tick !== this.tick &&
      (!this.los(e, t) || !this.detected(e, t))
    )
      return;
    let range = e.stats.range;
    if (
      e.d.id === 'warden.ranger' &&
      e.cooldowns.clearSince &&
      this.tick - e.cooldowns.clearSince >= 120
    )
      range += U;
    if (e.d.id === 'friendly.skyguard' && t.d.layer === 'ground') range = fx(6);
    const mounted =
      e.rect &&
      this.alive(0).some(
        (p) =>
          p.d.id === 'friendly.elevated_firing_platform' &&
          p.rect?.x === e.rect?.x &&
          p.rect?.y === e.rect?.y,
      );
    if (mounted) {
      const platform = this.alive(0).find(
        (p) =>
          p.d.id === 'friendly.elevated_firing_platform' &&
          p.rect?.x === e.rect?.x &&
          p.rect?.y === e.rect?.y,
      );
      range +=
        U +
        (platform?.asset && platform.asset.stars >= 3 && platform.asset.branch === 'A'
          ? fx(platform.asset.stars >= 5 ? 1.25 : 0.75)
          : 0);
    }
    const d = boundary(e, t);
    if (d > range || d < fx(e.d.minimum)) {
      e.warmup = 0;
      e.lock = 0;
      this.reason(e, d < fx(e.d.minimum) ? 'Inside minimum range' : 'Out of range');
      return;
    }
    if (e.d.weapon !== 'mortar' && !this.los(e, t)) {
      e.warmup = 0;
      e.lock = 0;
      e.cooldowns.clearSince = 0;
      this.reason(e, 'Line of sight blocked');
      return;
    }
    if (e.d.id === 'warden.ranger') {
      if (this.tick - e.lastMove < 2) e.cooldowns.clearSince = 0;
      else if (!e.cooldowns.clearSince) e.cooldowns.clearSince = this.tick;
    }
    const desiredAim = bearing({ x: t.x - e.x, y: t.y - e.y }),
      turnRate =
        e.d.category === 'tower'
          ? e.d.id === 'friendly.breaker_cannon' || e.d.id === 'friendly.mortar_nest'
            ? 90
            : 180
          : 360;
    e.aim = this.turnWithCarry(e, e.aim, desiredAim, turnRate, 'aimTurn');
    if (angleError(e.aim, desiredAim) > 364) {
      e.warmup = 0;
      this.reason(e, 'Turning weapon');
      return;
    }
    if (e.d.id === 'enemy.bombard') {
      this.bombard(e, t);
      return;
    }
    if (e.d.id === 'boss.prism_sovereign') return;
    if (e.overheat > this.tick || e.abilityCast || e.transition > this.tick) return;
    if (this.projectiles.length >= 300 && ['bullet', 'shell', 'guided'].includes(e.d.weapon)) {
      this.reason(e, 'Projectile capacity held');
      return;
    }
    const previousBeamTick = e.cooldowns.beamTick;
    e.cooldowns.beamTick = this.tick;
    const warmup =
      e.d.weapon === 'beam' && previousBeamTick === this.tick - 1 && e.cooldowns.beamTarget === t.id
        ? 0
        : this.has(e, 'quick-switch')
          ? 0
          : e.d.id === 'enemy.sapper' && t.rect
            ? 48
            : e.d.weapon === 'beam'
              ? 6
              : e.asset?.stars && e.asset.stars >= 4 && e.d.profile === 'Precision'
                ? 3
                : 6;
    if (this.tick < e.nextAttack - warmup) return;
    if (!e.warmup && warmup) {
      e.warmup = Math.max(e.nextAttack, this.tick + warmup);
      if (warmup === 48) this.warn(e, 'line', t, 0, 0, 0.8, 'Sapper breach', { width: 0 });
      return;
    }
    if (e.warmup > this.tick) return;
    e.warmup = 0;
    let damage = this.output(e, e.stats.damage, t);
    if (e.d.id === 'friendly.skyguard' && t.d.layer === 'ground') damage = scaled(damage, 0.4);
    if (e.d.id === 'friendly.lance_array') {
      e.lock += 6;
      damage = scaled(damage * 0.1, 1 + Math.min(0.5, (e.lock / 60) * 0.1));
      if (this.has(e, 'overclock')) damage = scaled(damage, 1.15);
    }
    if (e.d.id === 'enemy.drainer' || e.d.id === 'boss.prism_sovereign')
      damage = scaled(damage, 0.1);
    if (e.d.id === 'enemy.sapper' && !t.rect) damage = scaled(e.stats.damage, 1 / 3);
    if (e.d.id === 'enemy.breaker' && !t.rect) damage = scaled(damage, 0.5);
    e.lastFire = this.tick;
    e.cooldowns.beamTarget = t.id;
    this.effect('shot:' + e.d.id, e, t, e.side, 0.08);
    e.nextAttack = this.tick + this.interval(e);
    e.revealUntil = this.tick + secs(e.d.id === 'boss.silent_crown' ? 3 : 2);
    if (e.d.weapon === 'arc') {
      this.damage(e, t, damage, e.stats.penetration);
      this.effect('arc', e, t, e.side);
      let previous = t;
      const factors =
        e.d.id === 'friendly.arc_spire'
          ? e.signature === 'pending' && e.cooldowns.arcSignature
            ? [0.65, 0.45, 0.3, 0.3, 0.3, 0.3, 0.3]
            : [0.65, 0.45, 0.3]
          : e.d.id === 'warden.conductor'
            ? [0.6, 0.35]
            : e.d.id === 'boss.black_conductor'
              ? [0.7, 0.5, 0.3]
              : [];
      if (e.d.id === 'friendly.arc_spire' && e.signature === 'pending' && e.cooldowns.arcSignature)
        this.activateSignature(e, 0);
      const used = new Set([t.id]);
      for (const factor of factors) {
        const next = this.alive(t.side)
          .filter(
            (v) =>
              !used.has(v.id) &&
              v.d.layer === t.d.layer &&
              distance(previous, v) <= fx(2.5) &&
              this.detected(e, v) &&
              this.los(previous, v),
          )
          .sort((a, b) => distance(previous, a) - distance(previous, b) || a.id - b.id)[0];
        if (!next) break;
        this.damage(e, next, scaled(damage, factor));
        this.effect('arc', previous, next, e.side);
        used.add(next.id);
        previous = next;
      }
    } else if (e.d.weapon === 'beam') {
      this.damage(
        e,
        t,
        damage,
        e.stats.penetration + (this.has(e, 'signature-penetration') ? 0.5 : 0),
      );
      this.effect('beam', e, t, e.side, 0.12);
    } else if (e.d.weapon === 'melee') {
      if (this.los(e, t)) this.damage(e, t, damage, e.stats.penetration);
    } else if (e.d.weapon === 'mortar') {
      const flight = e.side === 1 ? 1.4 : e.asset && e.asset.stars >= 4 ? 1 : 1.2;
      const lead = { x: Math.round(t.vx * 60 * flight), y: Math.round(t.vy * 60 * flight) },
        len = distance({ x: 0, y: 0 }, lead),
        factor = len > fx(3) ? fx(3) / len : 1;
      const point = { x: t.x + Math.round(lead.x * factor), y: t.y + Math.round(lead.y * factor) };
      this.warn(
        e,
        'circle',
        point,
        e.stats.area,
        damage,
        flight,
        e.side ? 'Incoming bombardment' : 'Mortar impact',
        {},
        false,
      );
      if (e.d.id === 'enemy.bombard' && e.variant >= 2)
        this.schedule(
          e,
          0.6,
          () =>
            this.warn(
              e,
              'circle',
              point,
              e.stats.area,
              scaled(damage, 0.5),
              flight,
              'Second shell',
              {},
              false,
            ),
          true,
        );
    } else {
      if (e.d.id === 'friendly.heavy_squad' && e.signatureShots) {
        if (e.signature === 'pending') this.activateSignature(e, 0);
        this.fireProjectile(e, t, damage, { penetration: Math.min(1, e.stats.penetration + 0.3) });
        e.signatureShots--;
      } else this.fireProjectile(e, t, damage);
      if (e.d.id === 'boss.shatterstorm')
        for (const offset of [-2731, 2731])
          this.fireProjectile(e, t, damage, { heading: (e.aim + offset + H) % H, target: null });
    }
    if (e.d.id === 'friendly.rotary') {
      const gain = this.alive(0).some(
        (v) =>
          v.d.id === 'friendly.ammunition_fabricator' &&
          v.signature === 'active' &&
          distance(e, v) <= v.stats.range,
      )
        ? 2
        : 4;
      e.heat = Math.min(100, e.heat + gain);
      if (e.heat >= 100) {
        if (e.signature === 'armed') {
          this.activateSignature(e, 0);
          for (const v of this.alive(1).filter((v) => boundary(e, v) <= fx(2)))
            this.damage(e, v, fx(120), 0, false);
          e.heat = 0;
        } else {
          e.overheat = this.tick + 180;
          this.note('Rotary overheated');
        }
      }
    }
    if (
      e.asset &&
      e.asset.stars >= 3 &&
      e.asset.branch === 'A' &&
      e.d.profile === 'Siege' &&
      ['friendly.skyguard', 'friendly.interceptor_drones'].includes(e.d.id)
    ) {
      const second = this.alive(t.side)
        .filter(
          (v) =>
            v.id !== t.id &&
            v.d.layer === t.d.layer &&
            distance(t, v) <= fx(1.5) &&
            this.validTarget(e, v),
        )
        .sort((a, b) => a.id - b.id)[0];
      if (second) this.fireProjectile(e, second, scaled(damage, e.asset.stars >= 5 ? 0.5 : 0.35));
    }
    if (e.d.id === 'friendly.sentry' && e.signature === 'active') {
      const second = this.alive(1).find(
        (v) => v.id !== t.id && boundary(e, v) <= range && this.validTarget(e, v) && this.los(e, v),
      );
      if (second) this.fireProjectile(e, second, damage);
    }
    if (e.d.id === 'friendly.mortar_nest' && t.d.category === 'boss' && e.signature === 'armed') {
      this.activateSignature(e, 0);
      for (const delay of [1, 2])
        this.schedule(e, delay, () =>
          this.warn(e, 'circle', t, e.stats.area, scaled(damage, 0.4), 1, 'Siege salvo', {}, false),
        );
    }
  }
  private updateProjectiles(): void {
    for (const p of this.projectiles) {
      if (p.until <= this.tick) continue;
      const target = this.get(p.target);
      if (
        p.guided &&
        target?.hp &&
        !target.burrow &&
        this.get(p.owner) &&
        this.detected(this.get(p.owner)!, target)
      )
        p.heading = turn(p.heading, bearing({ x: target.x - p.x, y: target.y - p.y }), 546);
      p.previous = { x: p.x, y: p.y };
      const perSecond = direction(p.heading, p.speed),
        sumX = perSecond.x + p.carryX,
        sumY = perSecond.y + p.carryY,
        delta = { x: Math.trunc(sumX / 60), y: Math.trunc(sumY / 60) },
        end = { x: p.x + delta.x, y: p.y + delta.y };
      const hits = this.alive(p.side === 0 ? 1 : 0)
        .filter((v) => v.d.layer === p.layer && !v.burrow && !p.hit.includes(v.id))
        .map((v) => ({ v, t: sweep(p.previous, end, v, p.radius) }))
        .filter((v) => v.t !== null)
        .sort((a, b) => a.t! - b.t! || a.v.id - b.v.id);
      const blocker = this.alive()
        .filter(
          (v) =>
            v.rect &&
            v.id !== p.owner &&
            v.d.id !== 'friendly.low_cover' &&
            v.d.id !== 'friendly.resonance_channel' &&
            v.d.id !== 'friendly.razor_field' &&
            v.d.id !== 'friendly.anti_vehicle_obstacle' &&
            v.d.id !== 'friendly.elevated_firing_platform' &&
            v.d.category !== 'trap' &&
            !(v.d.id === 'friendly.controlled_gate' && v.gateOpen),
        )
        .map((v) => ({ v, t: sweep(p.previous, end, v, p.radius) }))
        .filter((v) => v.t !== null)
        .sort((a, b) => a.t! - b.t! || a.v.id - b.v.id)[0];
      for (const hit of hits) {
        if (blocker && blocker.t! < hit.t! && blocker.v.id !== hit.v.id) break;
        const point = {
            x: p.x + Math.round((delta.x * hit.t!) / FRACTION),
            y: p.y + Math.round((delta.y * hit.t!) / FRACTION),
          },
          owner = this.get(p.owner) ?? null;
        if (p.area) {
          for (const v of this.alive(p.side === 0 ? 1 : 0).filter(
            (v) => v.d.layer === p.layer && boundary(point, v) <= fx(p.area),
          ))
            this.damage(
              owner,
              v,
              Math.round(p.damage * (1 - 0.6 * Math.min(1, boundary(point, v) / fx(p.area)))),
              p.penetration,
              false,
              point,
            );
        } else this.damage(owner, hit.v, p.damage, p.penetration, true, p.previous);
        p.hit.push(hit.v.id);
        p.pierces--;
        if (!p.pierces) {
          p.until = this.tick;
          break;
        }
        p.damage = scaled(p.damage, owner?.d.id === 'enemy.lancer' ? 0.7 : 0.8);
      }
      if (blocker && !p.hit.includes(blocker.v.id) && p.layer === 'ground') p.until = this.tick;
      p.carryX = sumX - delta.x * 60;
      p.carryY = sumY - delta.y * 60;
      p.x = end.x;
      p.y = end.y;
    }
    this.projectiles = this.projectiles.filter((p) => p.until > this.tick);
  }
  private auraRange(e: Entity, base = e.d.range): number {
    if (!e.asset) return fx(base);
    const a = e.asset,
      flat = a.stars >= 3 ? (a.stars >= 5 ? 1.5 : 1) : 0;
    let range = fx(base) * (1 + (0.15 * (a.level - 1)) / 99);
    if (e.d.category === 'warden') range = fx(base);
    if (
      [
        'friendly.ammunition_fabricator',
        'friendly.tactical_uplink',
        'friendly.power_relay',
        'friendly.command_node',
      ].includes(e.d.id)
    )
      range += fx(0.05 * a.enhancement);
    if (e.d.profile === 'Utility' && a.stars >= 2) range *= 1.1;
    if (a.branch === 'A') {
      if (e.d.profile === 'Recovery' || e.d.profile === 'Utility') range += fx(flat);
      if (e.d.profile === 'Protection' && a.stars >= 3) range += fx(a.stars >= 5 ? 1.25 : 0.75);
    }
    if (
      [
        'friendly.repair_node',
        'friendly.medical_station',
        'friendly.detection_relay',
        'friendly.shield_projector',
        'friendly.ammunition_fabricator',
        'friendly.tactical_uplink',
        'friendly.barracks',
        'friendly.drone_bay',
        'friendly.command_node',
      ].includes(e.d.id) &&
      this.alive(e.side).some(
        (v) =>
          v.d.id === 'friendly.power_relay' &&
          v.jamUntil <= this.tick &&
          boundary(v, e) <= v.stats.range,
      )
    )
      range += fx(0.75);
    return Math.round(range);
  }
  private support(e: Entity): boolean {
    if (e.jamUntil > this.tick) {
      this.reason(e, 'Jammed');
      return false;
    }
    if (e.d.id === 'friendly.detection_relay') {
      const nearby = this.alive(1).filter((v) => distance(e, v) <= this.auraRange(e));
      for (const v of nearby) v.revealUntil = Math.max(v.revealUntil, this.tick + 15);
      if (this.tick >= (e.cooldowns.surface ?? 0)) {
        const burrowed = nearby.filter((v) => v.burrow && distance(e, v) <= this.auraRange(e, 6));
        for (const v of burrowed) {
          if (!v.detectionCredit && e.owned) {
            v.detectionCredit = true;
            this.performance.get(e.owned)!.contribution += fx(10);
          }
          v.burrow = false;
          v.revealUntil = this.tick + 180;
          v.cooldowns.burrow = this.tick + 180;
          this.effect('detect', e, v, 0, 0.6);
        }
        e.cooldowns.surface = this.tick + 360;
      }
    }
    if (e.d.id === 'friendly.shield_projector') {
      this.projector(e);
      return true;
    }
    const engineer = e.d.id === 'friendly.combat_engineers',
      medic = e.d.id === 'friendly.field_medics',
      node = e.d.id === 'friendly.repair_node',
      medical = e.d.id === 'friendly.medical_station',
      bay = e.d.id === 'friendly.drone_bay',
      barracks = e.d.id === 'friendly.barracks',
      mender = e.d.id === 'enemy.mender';
    if (!(medical && e.signature === 'active')) e.cooldowns.secondaryChannel = 0;
    if (!engineer && !medic && !node && !medical && !bay && !barracks && !mender) return false;
    let range = this.auraRange(e, engineer ? 2 : medic ? 3 : e.d.range);
    const candidates = this.alive(e.side).filter(
      (v) =>
        v.hp < v.stats.health &&
        (!mender || v.id !== e.id) &&
        (engineer || node
          ? !v.d.biological
          : medic || medical
            ? v.d.biological
            : bay
              ? v.d.layer === 'air' &&
                !v.d.biological &&
                (e.signature !== 'active' || v.id === e.cooldowns.signatureRecipient)
              : barracks
                ? v.d.biological &&
                  (e.signature === 'active'
                    ? v.retreat
                    : this.tick - v.lastFire > 300 &&
                      this.tick - v.lastDamage > 300 &&
                      !this.alive(1).some((h) => h.target === v.id))
                : this.validRecipient(e, v)),
    );
    const importance = (v: Entity) =>
      v.id === this.core.id
        ? 1.5
        : v.d.category === 'warden'
          ? 1.3
          : v.d.category === 'route'
            ? 1.1
            : 1;
    candidates.sort(
      (a, b) =>
        (1 - b.hp / b.stats.health) * importance(b) - (1 - a.hp / a.stats.health) * importance(a) ||
        boundary(e, a) - boundary(e, b) ||
        a.id - b.id,
    );
    const assigned = (target: Entity) =>
      this.alive(e.side).filter(
        (v) =>
          v.id !== e.id &&
          (v.channel === target.id || v.cooldowns.secondaryChannel === target.id) &&
          (mender
            ? v.d.id === 'enemy.mender'
            : [
                'friendly.combat_engineers',
                'friendly.field_medics',
                'friendly.repair_node',
                'friendly.medical_station',
                'friendly.drone_bay',
              ].includes(v.d.id)),
      ).length;
    const valid = (v: Entity) =>
      boundary(e, v) <= range &&
      (this.los(e, v) ||
        (v.id === e.channel &&
          e.asset &&
          e.asset.stars >= 4 &&
          e.d.profile === 'Recovery' &&
          e.losLostAt > 0 &&
          this.tick - e.losLostAt <= 15)) &&
      (barracks || assigned(v) < (mender ? 1 : 2));
    let target = this.get(e.channel);
    if (target && !this.los(e, target)) {
      if (!e.losLostAt) e.losLostAt = this.tick;
    } else e.losLostAt = 0;
    if (!target?.hp || !candidates.some((v) => v.id === target!.id) || !valid(target)) {
      target = candidates.find((v) => v.stats.health - v.hp >= fx(20) && valid(v));
      if (e.channel !== target?.id) {
        e.channel = target?.id ?? null;
        e.channelSince = this.tick;
      }
    }
    if (!target) {
      if (
        (engineer || medic) &&
        candidates[0] &&
        boundary(e, candidates[0]) <= fx(e.asset?.tactics.posture === 'Defensive' ? 6 : 9)
      ) {
        this.approach(e, candidates[0], range * 0.8);
        return true;
      }
      if (mender) {
        const front = this.alive(1)
          .filter(
            (v) =>
              v.id !== e.id &&
              !SUPPORT_ROLES.has(v.d.id) &&
              distance(e, v) <= fx(10) &&
              this.los(e, v),
          )
          .sort((a, b) => distance(a, this.core) - distance(b, this.core) || a.id - b.id)[0];
        if (front)
          this.move(
            e,
            {
              x: front.x + Math.sign(front.x - this.core.x) * fx(2),
              y: front.y + Math.sign(front.y - this.core.y) * fx(2),
            },
            fx(0.5),
          );
        else this.approach(e, this.core, fx(5));
        return true;
      }
      if (engineer && this.tryRearm(e)) return true;
      return false;
    }
    e.vx = 0;
    e.vy = 0;
    range = Math.round(range);
    const commit = e.asset && e.asset.stars >= 2 ? 0.25 : 0.5;
    if (this.tick - e.channelSince < secs(commit)) return true;
    if (this.tick % 15 === 0) {
      const base = engineer ? 35 : medic ? 40 : mender ? (e.variant >= 2 ? 40 : 30) : e.d.damage;
      const o = e.d.damage > 0 ? e.stats.damage / fx(e.d.damage) : 1;
      let amount = fx(base * 0.25 * o);
      if (e.d.category === 'mobile') amount = scaled(amount, 0.5 + (0.5 * e.hp) / e.stats.health);
      if (e.signature === 'active') {
        if (engineer) amount = fx(100 * 0.25);
        if (barracks) amount = fx(40 * 0.25);
        if (bay) amount = fx(60 * 0.25);
      }
      this.heal(
        e,
        target,
        amount,
        (engineer || node) && !(node && e.signature === 'active'),
        e.signature === 'active' && (engineer || barracks || bay),
      );
      if (medical && e.signature === 'active') {
        const second = candidates.find((v) => v.id !== target!.id && valid(v));
        e.cooldowns.secondaryChannel = second?.id ?? 0;
        if (second) this.heal(e, second, amount);
      }
    }
    return engineer || medic || mender;
  }
  private validRecipient(e: Entity, v: Entity): boolean {
    return e.side === v.side;
  }
  private projector(e: Entity): void {
    const eligible = this.alive(e.side)
      .filter((v) => v.id !== e.id && boundary(e, v) <= this.auraRange(e) && this.los(e, v))
      .sort(
        (a, b) =>
          Number(b.id === this.core.id || b.d.category === 'warden') -
            Number(a.id === this.core.id || a.d.category === 'warden') ||
          a.hp / a.stats.health - b.hp / b.stats.health ||
          a.id - b.id,
      );
    const ids = eligible.slice(0, 4).map((v) => v.id);
    for (const id of Object.keys(e.slots).map(Number)) {
      const t = this.get(id);
      if (!ids.includes(id) || !t?.hp) {
        e.pool += e.slots[id] ?? 0;
        delete e.slots[id];
        if (t?.slotOwner === e.id) t.slotOwner = null;
      }
    }
    const output = e.asset
        ? (1 + (0.6 * (e.asset.level - 1)) / 99) * (1 + 0.03 * e.asset.enhancement)
        : 1,
      cap = fx(250 * output) * (e.asset && e.asset.stars >= 2 ? 1.15 : 1),
      max = fx(1000 * output) * (e.asset && e.asset.stars >= 2 ? 1.15 : 1);
    if (this.tick - e.lastDamage >= 240 && this.tick % 15 === 0) {
      const stock = e.pool + Object.values(e.slots).reduce((a, b) => a + b, 0);
      e.pool += Math.min(
        max - stock,
        this.output(e, fx(25 * 0.25)) *
          (e.asset && e.asset.stars >= 4 ? 1.2 : 1) *
          (this.has(e, 'suppressed') ? 0.5 : 1),
      );
    }
    for (const target of eligible.slice(0, 4)) {
      if (target.slotOwner && target.slotOwner !== e.id) {
        const old = this.get(target.slotOwner);
        if (old && old.hp > 0 && (old.slots[target.id] ?? 0) >= (e.slots[target.id] ?? 0)) continue;
        if (old) {
          old.pool += old.slots[target.id] ?? 0;
          delete old.slots[target.id];
        }
      }
      const current = e.slots[target.id] ?? 0,
        add = Math.min(cap - current, e.pool);
      e.slots[target.id] = Math.round(current + add);
      e.pool = Math.round(e.pool - add);
      target.slotOwner = e.id;
    }
  }
  private observeRearm(source: number, trap: number): RearmObservation | null {
    const e = this.get(source),
      t = this.get(trap);
    if (!e || !t || t.d.charges === null || t.charges === null) return null;
    return {
      stock: { initial: t.d.charges, permanent: t.charges, temporary: t.temporary },
      conditions: {
        sourceAlive: e.hp > 0,
        trapAlive: t.hp > 0,
        inRange: boundary(e, t) <= this.auraRange(e, 2),
        lineOfSight: this.los(e, t),
        stationary: e.lastMove < this.tick,
        hostileWithinFourGU: this.alive(1).some((v) => distance(e, v) <= fx(4)),
        underAttack: this.tick - e.lastDamage < 60,
        damagedThisTick: e.lastDamage === this.tick,
        higherPriorityAction: e.channel !== null,
      },
    };
  }
  private tryRearm(e: Entity): boolean {
    const active = this.rearm.active.find((c) => c.source === e.id);
    if (active) {
      this.rearmSources.set(e.id, active.trap);
      return true;
    }
    if (this.rearm.completed(e.id) >= 8) return false;
    const trap = this.alive(0)
      .filter(
        (v) =>
          v.d.charges !== null &&
          v.charges !== null &&
          v.charges + v.temporary < v.d.charges &&
          boundary(e, v) <= this.auraRange(e, 2),
      )
      .sort((a, b) => boundary(e, a) - boundary(e, b) || a.id - b.id)[0];
    if (!trap) return false;
    const observation = this.observeRearm(e.id, trap.id);
    if (observation && this.rearm.begin(e.id, trap.id, observation)) {
      this.rearmSources.set(e.id, trap.id);
      return true;
    }
    return false;
  }
  private spendTrap(e: Entity): boolean {
    if (e.d.charges === null) return true;
    const stock = spendFiniteCharge({
      initial: e.d.charges,
      permanent: e.charges ?? 0,
      temporary: e.temporary,
    });
    if (!stock) return false;
    e.charges = stock.permanent;
    e.temporary = stock.temporary;
    return true;
  }
  private gate(e: Entity): void {
    const policy = e.asset!.tactics.gate;
    let wanted = policy === 'Open';
    if (policy === 'Allied passage') {
      const ally = this.alive(0).some(
        (v) => v.id !== e.id && v.d.speed > 0 && v.d.layer === 'ground' && boundary(v, e) <= fx(1),
      );
      if (ally) e.gateUntil = this.tick + 60;
      wanted = e.gateUntil > this.tick;
    }
    if (wanted === e.gateOpen) {
      e.cooldowns.gateTransition = 0;
      return;
    }
    if (
      !wanted &&
      this.alive().some((v) => !v.rect && v.d.layer === 'ground' && boundary(v, e) <= v.radius)
    ) {
      e.cooldowns.gateTransition = 0;
      return;
    }
    if (!e.cooldowns.gateTransition) e.cooldowns.gateTransition = this.tick + 18;
    if (this.tick >= e.cooldowns.gateTransition) {
      e.gateOpen = wanted;
      e.cooldowns.gateTransition = 0;
      this.topology++;
      this.solidsCache.clear();
      this.effect('gate', e, e, 0, 0.3);
    }
  }
  private detection(): void {
    for (const target of this.alive(1)) {
      const cloaked =
        target.burrow ||
        (target.d.id === 'enemy.veil' && target.revealUntil <= this.tick) ||
        (target.d.id === 'boss.silent_crown' &&
          this.tick % 600 < 240 &&
          target.revealUntil <= this.tick);
      if (!cloaked || target.detectionCredit) continue;
      if (
        !target.burrow &&
        this.alive(0).some((e) => distance(e, target) <= fx(2) && this.los(e, target))
      ) {
        target.detectionCredit = true;
        continue;
      }
      const detectors = this.alive(0)
        .filter(
          (e) =>
            ['friendly.detection_relay', 'friendly.nullifier'].includes(e.d.id) &&
            e.jamUntil <= this.tick &&
            boundary(e, target) <= e.stats.range &&
            this.los(e, target) &&
            !target.burrow,
        )
        .sort((a, b) => boundary(a, target) - boundary(b, target) || a.id - b.id);
      const source = detectors[0];
      if (source?.owned) {
        target.detectionCredit = true;
        this.performance.get(source.owned)!.contribution += fx(10);
        this.effect('detect', source, target, 0, 0.5);
      }
    }
  }
  private traps(e: Entity): void {
    const foes = this.alive(1)
      .filter(
        (v) =>
          !v.burrow &&
          (e.d.targets === 'both' || v.d.layer === 'ground') &&
          boundary(e, v) <= e.stats.range,
      )
      .sort((a, b) => boundary(e, a) - boundary(e, b) || a.id - b.id);
    if (e.d.id === 'friendly.slow_field') {
      for (const v of foes) this.status(v, 'slow', 0.35, 0.5, e);
      return;
    }
    if (this.tick < e.nextAttack || !foes.length) return;
    const t = foes[0]!;
    if (e.d.id === 'friendly.gravity_snare' && (this.has(t, 'root-immune') || this.has(t, 'root')))
      return;
    if (!this.spendTrap(e)) return;
    e.nextAttack = this.tick + secs(e.d.interval);
    switch (e.d.id) {
      case 'friendly.proximity_mine':
        this.warn(e, 'circle', e, 1.5, fx(300), 0.3, 'Mine armed', {}, false);
        break;
      case 'friendly.arc_plate':
        for (const v of foes.slice(0, 3)) {
          this.damage(e, v, fx(80), 0, false);
          this.status(v, 'slow', 0.2, 2, e);
          this.effect('arc', e, v, 0);
        }
        break;
      case 'friendly.incendiary_vent': {
        e.cooldowns.burnActivation = (e.cooldowns.burnActivation ?? 0) + 1;
        const heading = (H / 4 - ((e.asset?.placement?.rotation ?? 0) * H) / 4 + H) % H;
        for (let i = 1; i <= 12; i++)
          this.schedule(
            e,
            i * 0.25,
            () => {
              for (const v of this.alive(1).filter(
                (v) =>
                  v.d.layer === 'ground' &&
                  boundary(e, v) <= fx(3) &&
                  angleError(heading, bearing({ x: v.x - e.x, y: v.y - e.y })) <= H / 8,
              )) {
                this.damage(e, v, fx(10), 0, false);
                this.status(v, 'burn', 10, 4, e);
              }
            },
            true,
          );
        this.effect(
          'vent',
          e,
          { x: e.x + direction(heading, fx(3)).x, y: e.y + direction(heading, fx(3)).y },
          0,
          3,
        );
        break;
      }
      case 'friendly.armor_shredding_charge':
        for (const v of this.alive(1).filter(
          (v) => v.d.layer === 'ground' && boundary(e, v) <= fx(2),
        )) {
          this.damage(e, v, fx(100), 0, false);
          this.status(v, 'shred', 30, 8, e);
        }
        this.effect('blast', e, e, 0, 0.5);
        break;
      case 'friendly.gravity_snare':
        this.status(t, 'root', 1, t.d.category === 'boss' ? 0.5 : 2, e);
        this.schedule(
          e,
          t.d.category === 'boss' ? 0.5 : 2,
          () => {
            if (t.hp) this.status(t, 'slow', 0.25, 3, e);
          },
          true,
        );

        this.effect('snare', e, t, 0, 2);
        break;
      case 'friendly.decoy_beacon':
        this.status(e, 'decoy', 30, 10, e);
        for (const v of this.alive(1).filter(
          (v) => v.d.layer === 'ground' && boundary(e, v) <= fx(6),
        ))
          this.status(v, 'lure', 30, 10, e);
        this.effect('decoy', e, e, 0, 10);
        break;
      case 'friendly.collapse_charge':
        this.warn(e, 'circle', e, 2.5, fx(500), 1, 'Collapse charge', { penetration: 0.5 }, false);
        this.schedule(
          e,
          1,
          () => {
            const point = { x: e.x, y: e.y };
            for (let pulse = 0; pulse < 32; pulse++)
              this.schedule(
                e,
                pulse * 0.25,
                () => {
                  for (const v of this.alive(1).filter(
                    (v) => v.d.layer === 'ground' && distance(v, point) <= fx(2.5),
                  ))
                    this.status(v, 'slow', 0.2, 0.25, e);
                },
                true,
              );
          },
          true,
        );
        break;
    }
  }
  private fallbackAnchor(e: Entity, forced = false): boolean {
    const secondary = e.asset?.tactics.secondary;
    if (!e.asset || !secondary || e.cooldowns.fallbackUsed) {
      if (forced && !secondary) this.reason(e, 'No secondary anchor configured');
      return false;
    }
    if (
      !forced &&
      !this.alive(0).some(
        (v) =>
          v.d.id === 'friendly.command_node' &&
          v.jamUntil <= this.tick &&
          boundary(v, e) <= this.auraRange(v),
      )
    )
      return false;
    const goal = { x: fx(secondary.x), y: fx(secondary.y) },
      solids = e.d.layer === 'air' ? [] : this.solids(e);
    if (distance(e, goal) > fx(0.75) && !findPath(e, goal, e.radius, solids, fx(0.75)).length) {
      this.reason(e, 'Secondary anchor unreachable');
      return false;
    }
    e.asset.tactics.anchor = { ...secondary };
    e.cooldowns.fallbackUsed = 1;
    e.pathVersion = -1;
    this.reason(e, 'Secondary anchor fallback');
    return true;
  }
  private approach(e: Entity, t: Entity, preferred: number): boolean {
    const p = nearest(e, t),
      h = bearing({ x: e.x - p.x, y: e.y - p.y }),
      offset = direction(h, Math.max(e.radius + fx(0.15), Math.round(preferred)));
    return this.move(
      e,
      {
        x: Math.max(e.radius, Math.min(60 * U - e.radius, p.x + offset.x)),
        y: Math.max(e.radius, Math.min(60 * U - e.radius, p.y + offset.y)),
      },
      fx(0.25),
    );
  }
  private jam(source: Entity, target: Entity, duration: number): void {
    if (target.d.id === 'friendly.power_relay' && target.signature === 'armed') {
      this.activateSignature(target, 5);
      return;
    }
    if (target.d.id === 'friendly.power_relay' && target.signature === 'active') return;
    const seconds = Math.max(
      1,
      duration -
        (target.asset && target.asset.stars >= 4 && target.d.profile === 'Utility' ? 1 : 0),
    );
    target.jamUntil = Math.max(target.jamUntil, this.tick + secs(seconds));
    target.channel = null;
    if (target.d.id === 'friendly.shield_projector')
      for (const id of Object.keys(target.slots).map(Number)) {
        const t = this.get(id);
        target.pool += target.slots[id] ?? 0;
        delete target.slots[id];
        if (t?.slotOwner === target.id) t.slotOwner = null;
      }
    this.effect('jam', source, target, source.side, seconds);
  }
  private cast(e: Entity, key: string, cd: number, label: string, release: () => boolean): boolean {
    if (
      e.abilityCast ||
      this.tick < (e.cooldowns[key] ?? 0) ||
      e.asset?.tactics.ability === 'Disabled'
    )
      return false;
    e.abilityCast = key;
    const delay = e.d.id === 'warden.conductor' && e.asset && e.asset.stars >= 2 ? 0.1 : 0.2;
    this.schedule(e, delay, () => {
      e.abilityCast = null;
      if (release()) {
        e.cooldowns[key] = this.tick + secs(cd);
        this.note(`${e.d.name}: ${label}`);
        this.effect('ability', e, e, e.side, 0.8);
      }
    });
    return true;
  }
  private abilityOutput(e: Entity, base: number): number {
    return Math.round((fx(base) * e.stats.damage) / fx(e.d.damage || 1));
  }
  private dash(e: Entity, goal: Vec, protection = 0): boolean {
    const max = fx(5),
      len = distance(e, goal),
      ratio = len > max ? max / len : 1,
      end = {
        x: e.x + Math.round((goal.x - e.x) * ratio),
        y: e.y + Math.round((goal.y - e.y) * ratio),
      };
    if (
      !edgeClear(e, end, e.radius, e.d.layer === 'air' ? [] : this.solids(e)) ||
      this.has(e, 'root')
    )
      return false;
    const start = { x: e.x, y: e.y };
    if (protection) this.status(e, 'reduction', protection, 0.3, e);
    for (let i = 1; i <= 18; i++)
      this.schedule(e, i / 60, () => {
        const p = {
          x: start.x + Math.round(((end.x - start.x) * i) / 18),
          y: start.y + Math.round(((end.y - start.y) * i) / 18),
        };
        if (
          !this.has(e, 'root') &&
          edgeClear(e, p, e.radius, e.d.layer === 'air' ? [] : this.solids(e)) &&
          !this.alive().some(
            (v) =>
              v.id !== e.id &&
              !v.rect &&
              v.d.layer === e.d.layer &&
              distance(p, v) < e.radius + v.radius,
          )
        ) {
          e.moveCarryX = 0;
          e.moveCarryY = 0;
          e.vx = p.x - e.x;
          e.vy = p.y - e.y;
          e.x = p.x;
          e.y = p.y;
          e.lastMove = this.tick;
        }
      });
    this.status(e, 'dashing', 1, 0.3, e);
    return true;
  }
  private activeRange(e: Entity, base: number) {
    const a = e.asset;
    return (
      fx(base) +
      (a &&
      a.stars >= 3 &&
      a.branch === 'A' &&
      (e.d.profile === 'Recovery' || e.d.profile === 'Protection')
        ? fx(e.d.profile === 'Protection' ? (a.stars >= 5 ? 1.25 : 0.75) : a.stars >= 5 ? 1.5 : 1)
        : 0)
    );
  }
  private abilities(e: Entity): void {
    if (e.abilityCast || this.has(e, 'dashing') || e.asset?.tactics.ability === 'Disabled') return;
    const mode = e.asset?.tactics.ability ?? 'Balanced',
      threshold = (n: number) =>
        Math.ceil(n * (mode === 'Frequent' ? 0.7 : mode === 'Conservative' ? 1.3 : 1));
    const hpThreshold = (n: number) =>
        Math.max(
          0.05,
          Math.min(0.95, n + (mode === 'Frequent' ? 0.1 : mode === 'Conservative' ? -0.1 : 0)),
        ),
      emergencyOnly = mode === 'Emergency';
    const nearbyAllies = this.alive(0).filter((v) => boundary(e, v) <= this.activeRange(e, 4)),
      foes = this.alive(1).filter((v) => this.detected(e, v)),
      threat = foes.some((v) => boundary(v, this.core) <= fx(5));
    if (e.d.id === 'warden.bulwark') {
      const protect = this.alive(0)
        .filter(
          (v) =>
            v.id !== e.id &&
            v.hp < v.stats.health * hpThreshold(0.6) &&
            this.tick - v.lastDamage < 120 &&
            boundary(e, v) <= fx(8) &&
            this.los(e, v),
        )
        .sort(
          (a, b) =>
            Number(b.id === this.core.id) - Number(a.id === this.core.id) ||
            a.hp / a.stats.health - b.hp / b.stats.health ||
            a.id - b.id,
        )[0];
      if (
        protect &&
        e.hp > e.stats.health * 0.25 &&
        this.cast(e, 'interpose', e.asset && e.asset.stars >= 4 ? 15 : 18, 'Interposing', () => {
          const danger = foes.sort(
            (a, b) => distance(a, protect) - distance(b, protect) || a.id - b.id,
          )[0];
          if (!protect.hp || !danger) return false;
          const h = bearing({ x: danger.x - protect.x, y: danger.y - protect.y }),
            offset = direction(h, fx(2)),
            goal = { x: protect.x + offset.x, y: protect.y + offset.y };
          if (distance(e, goal) > fx(5) || !this.dash(e, goal)) return false;
          this.schedule(e, 0.3, () => {
            if (
              protect.hp &&
              boundary(e, protect) <= fx(2) &&
              this.los(e, protect) &&
              !this.has(e, 'root')
            ) {
              e.shieldMax = this.abilityOutput(e, 600) * (e.asset && e.asset.stars >= 2 ? 1.15 : 1);
              e.shield = Math.round(e.shieldMax);
              e.shieldFront = true;
              e.aim = h;
              e.shieldUntil = this.tick + 360;
            }
          });
          return true;
        })
      )
        return;
      if (
        (nearbyAllies.filter((v) => this.tick - v.lastDamage < 120).length >= threshold(2) ||
          (this.core.hp < this.core.stats.health * hpThreshold(0.4) &&
            boundary(e, this.core) <= this.activeRange(e, 4))) &&
        this.cast(e, 'holdfast', 24, 'Holdfast field', () => {
          for (const v of this.alive(0).filter((v) => boundary(e, v) <= this.activeRange(e, 4)))
            this.status(v, 'reduction', 0.2, 6, e);
          return true;
        })
      )
        return;
      if (
        !emergencyOnly &&
        (foes.filter((v) => v.d.layer === 'ground' && boundary(e, v) <= this.activeRange(e, 4))
          .length >= threshold(3) ||
          threat)
      )
        this.cast(e, 'challenge', 16, 'Challenge pulse', () => {
          for (const v of foes.filter(
            (v) => v.hp && v.d.layer === 'ground' && boundary(e, v) <= this.activeRange(e, 4),
          ))
            this.status(v, 'challenge', v.d.category === 'boss' ? 15 : 60, 4, e);
          return true;
        });
    }
    if (e.d.id === 'warden.ranger') {
      const danger = this.warnings.some(
        (w) => w.side === 1 && distance(w.point, e) <= w.radius + e.radius,
      );
      if (
        (danger ||
          (e.hp < e.stats.health * hpThreshold(0.35) && this.tick - e.lastDamage < 120) ||
          threat) &&
        this.cast(e, 'dash', 12, 'Vector dash', () => {
          const closest = foes.sort((a, b) => distance(e, a) - distance(e, b) || a.id - b.id)[0];
          if (!closest) return false;
          const h = bearing({ x: e.x - closest.x, y: e.y - closest.y }),
            step = direction(h, fx(5));
          return this.dash(e, { x: e.x + step.x, y: e.y + step.y }, 0.3);
        })
      )
        return;
      if (!emergencyOnly) {
        const marked = foes
          .filter(
            (v) =>
              boundary(e, v) <= fx(12) &&
              (v.variant >= 2 || v.d.category === 'boss' || SUPPORT_ROLES.has(v.d.id)),
          )
          .sort((a, b) => this.score(e, b) - this.score(e, a) || a.id - b.id)[0];
        if (
          marked &&
          this.cast(e, 'mark', 18, 'Priority mark', () => {
            if (!marked.hp || !this.detected(e, marked)) return false;
            this.status(marked, 'mark', 1, 8, e);
            this.status(marked, 'vulnerable', 0.15, 8, e);
            return true;
          })
        )
          return;
        const target = foes
          .filter((v) => boundary(e, v) <= fx(12) && this.los(e, v))
          .find(
            (v) =>
              (v.d.category === 'boss' && v.stats.armor >= 30) ||
              foes.filter(
                (w) => w.d.layer === v.d.layer && segmentDistance(w, e, v) <= fx(0.3) + w.radius,
              ).length >= threshold(3),
          );
        if (target)
          this.cast(e, 'volley', 20, 'Piercing volley', () => {
            if (!target.hp || !this.los(e, target)) return false;
            const lockedHeading = bearing({ x: target.x - e.x, y: target.y - e.y });
            e.abilityCast = 'volley_burst';
            for (let i = 0; i < 3; i++)
              this.schedule(e, i * 0.15, () => {
                if (target.hp)
                  this.fireProjectile(
                    e,
                    target,
                    this.abilityOutput(e, 120),
                    {
                      penetration: 0.6,
                      pierces: 4,
                      speed: fx(32),
                      radius: fx(0.3),
                      heading: lockedHeading,
                    },
                    true,
                  );
                if (i === 2 || !target.hp) e.abilityCast = null;
              });
            return true;
          });
      }
    }
    if (e.d.id === 'warden.conductor') {
      const low = nearbyAllies.filter((v) => v.hp < v.stats.health * hpThreshold(0.5));
      if (
        (low.length >= threshold(2) ||
          (this.core.hp < this.core.stats.health * hpThreshold(0.35) &&
            boundary(e, this.core) <= this.activeRange(e, 4))) &&
        this.cast(e, 'refrain', 28, 'Emergency refrain', () => {
          for (let i = 1; i <= 16; i++)
            this.schedule(e, i * 0.25, () => {
              for (const v of this.alive(0).filter((v) => boundary(e, v) <= this.activeRange(e, 4)))
                this.heal(
                  e,
                  v,
                  this.abilityOutput(e, v.id === this.core.id ? 25 * 0.25 : 50 * 0.25),
                );
            });
          return true;
        })
      )
        return;
      if (!emergencyOnly) {
        const cluster = foes.find(
          (v) =>
            boundary(e, v) <= this.activeRange(e, 7) &&
            (threat || foes.filter((w) => distance(v, w) <= fx(2.5)).length >= threshold(3)),
        );
        if (
          cluster &&
          this.cast(e, 'snare', 18, 'Resonance snare', () => {
            if (!cluster.hp) return false;
            const point = { x: cluster.x, y: cluster.y },
              radius = this.activeRange(e, 2.5);
            for (let pulse = 0; pulse < 20; pulse++)
              this.schedule(
                e,
                pulse * 0.25,
                () => {
                  for (const v of this.alive(1).filter((v) => distance(point, v) <= radius)) {
                    this.status(v, 'slow', v.d.category === 'boss' ? 0.25 : 0.35, 0.25, e);
                    this.status(v, 'vulnerable', 0.1, 0.25, e);
                  }
                  this.effect('snare', point, point, 0, 0.25);
                },
                true,
              );
            return true;
          })
        )
          return;
        const tower = this.alive(0)
          .filter(
            (v) =>
              v.d.category === 'tower' &&
              this.tick - v.lastFire < 120 &&
              boundary(e, v) <= this.activeRange(e, 6) &&
              this.los(e, v),
          )
          .sort(
            (a, b) =>
              b.stats.damage / b.stats.interval - a.stats.damage / a.stats.interval || a.id - b.id,
          )[0];
        if (tower)
          this.cast(e, 'overclock', 20, 'Overclock node', () => {
            if (!tower.hp) return false;
            this.status(tower, 'overclock', 1, 8, e);
            return true;
          });
      }
    }
  }
  private legalSpawn(type: string, entrance: number, around: Vec | null = null): Vec | null {
    const d = definition(type),
      origin = around ?? { x: fx(ENTRANCES[entrance]!.x), y: fx(ENTRANCES[entrance]!.y) },
      radius = fx(d.radius);
    const solids = this.alive()
      .filter(
        (v) =>
          v.rect &&
          v.d.id !== 'friendly.low_cover' &&
          v.d.id !== 'friendly.razor_field' &&
          v.d.id !== 'friendly.resonance_channel' &&
          v.d.id !== 'friendly.elevated_firing_platform' &&
          v.d.category !== 'trap',
      )
      .map((v) => v.rect!);
    for (let ring = 0; ring <= 8; ring++)
      for (let n = 0; n < (ring ? 16 : 1); n++) {
        const delta = direction(Math.round((n * H) / 16), fx(ring)),
          p = { x: origin.x + delta.x, y: origin.y + delta.y };
        if (!edgeClear(p, p, radius, d.layer === 'air' ? [] : solids)) continue;
        if (
          this.alive().some(
            (v) => !v.rect && v.d.layer === d.layer && distance(v, p) < v.radius + radius,
          )
        )
          continue;
        return p;
      }
    return null;
  }
  private spawn(s: Spawn): boolean {
    if (this.population + 1 + s.children > 120) return false;
    const p = this.legalSpawn(s.type, s.entrance, s.position ?? null);
    if (!p) return false;
    const d = { ...definition(s.type), biological: s.faction === 'Maw' },
      reserved = s.children,
      reserve = d.id === 'enemy.carrier' ? (s.rank >= 2 ? 20 : 16) : (bossReserve[d.id]?.qtp ?? 0);
    const e = this.entity(d, null, 1, p, s.rank, s.qtp - reserve, s.segment, reserved);
    e.faction = s.faction;
    e.reserveQTP = reserve;
    e.heading = bearing({ x: this.core.x - e.x, y: this.core.y - e.y });
    e.aim = e.heading;
    this.entities.push(e);
    if (d.category === 'boss') this.note(`${d.name} arrived`);
    return true;
  }
  private summon(e: Entity, count: number): void {
    const info =
      e.d.id === 'enemy.carrier'
        ? { type: 'enemy.runner', count: 4, qtp: e.reserveQTP }
        : bossReserve[e.d.id];
    if (!info) return;
    const total = Math.min(count, e.reserved);
    for (let i = 0; i < total; i++) {
      const p = this.legalSpawn(info.type, 0, e);
      if (!p) {
        if (!e.cooldowns.summonBlocked) e.cooldowns.summonBlocked = this.tick;
        if (this.tick - e.cooldowns.summonBlocked >= 600) {
          this.note(`${e.d.name}: unspawned descendants cancelled after 10 seconds; no reward`);
          e.reserved = 0;
          e.reserveQTP = 0;
        }
        break;
      }
      e.cooldowns.summonBlocked = 0;
      const tp = Math.floor(e.reserveQTP / e.reserved),
        variant = e.d.id === 'enemy.carrier' && e.variant >= 2 ? 1 : 0;
      const child = this.entity(
        { ...definition(info.type), biological: e.faction === 'Maw' },
        null,
        1,
        p,
        variant,
        tp,
        e.segment,
        0,
      );
      e.reserveQTP -= tp;
      e.reserved--;
      e.childrenReleased++;
      child.faction = e.faction;
      child.heading = e.heading;
      child.aim = e.aim;
      if (info.type === 'special.root') {
        child.rect = null;
        child.stats.speed = 0;
      }
      this.entities.push(child);
      this.effect('summon', e, child, 1, 0.8);
    }
  }
  private enemy(e: Entity): void {
    if (e.d.id === 'special.decoy' || e.d.id === 'special.prism') return;
    if (e.d.id === 'special.root') {
      const t = this.alive(0)
        .filter((v) => boundary(e, v) <= fx(2))
        .sort((a, b) => a.id - b.id)[0];
      if (t && this.tick % 6 === 0) this.damage(e, t, fx(3), 0, false);
      return;
    }
    if (e.d.id === 'enemy.mole' || e.d.id === 'boss.root_below') {
      const root = e.d.category === 'boss',
        cycle = root ? 780 : e.variant >= 2 ? 600 : 720,
        period = root ? 300 : 360;
      const close =
        this.core.x - fx(6) <= e.x &&
        e.x < this.core.x + fx(6) &&
        this.core.y - fx(6) <= e.y &&
        e.y < this.core.y + fx(6);
      const burrow =
        (this.tick - e.spawnTick) % cycle < period &&
        this.tick > (e.cooldowns.burrow ?? 0) &&
        !close;
      if (e.burrow !== burrow) {
        e.burrow = burrow;
        e.pathVersion = -1;
        this.solidsCache.clear();
        if (!burrow) {
          e.revealUntil = this.tick + 90;
          e.cooldowns.burrow = this.tick + 90;
          this.effect('surface', e, e, 1, 0.8);
        }
      }
    }
    if (e.d.id === 'enemy.jammer' && this.tick >= (e.cooldowns.jam ?? 0)) {
      const targets = this.alive(0)
        .filter(
          (v) =>
            ['support', 'infrastructure'].includes(v.d.category) &&
            boundary(e, v) <= fx(4) &&
            this.los(e, v),
        )
        .sort((a, b) => boundary(e, a) - boundary(e, b) || a.id - b.id)
        .slice(0, e.variant >= 2 ? 3 : 2);
      if (targets.length) {
        e.cooldowns.jam = this.tick + 612;
        e.abilityCast = 'jammer_pulse';
        this.schedule(e, 0.2, () => {
          e.abilityCast = null;
          for (const t of targets)
            if (t.hp && boundary(e, t) <= fx(4) && this.los(e, t)) this.jam(e, t, 4);
          this.note('Jammer pulse');
        });
      }
    }
    if (e.d.id === 'enemy.harvester' || (e.d.id === 'boss.gorger_titan' && e.phase >= 2)) {
      const max = e.d.category === 'boss' ? 3 : e.variant >= 2 ? 4 : 3;
      if (e.harvests < max) {
        const corpse = this.corpses.find((c) => !c.claimed && distance(e, c) <= U);
        if (corpse) {
          if (e.consuming !== corpse.id) {
            e.consuming = corpse.id;
            e.consumeAt = this.tick;
            e.consumeDamage = 0;
          }
          if (e.d.category === 'boss' && e.consumeDamage >= fx(200)) {
            e.consuming = 0;
            e.consumeAt = this.tick;
          } else if (this.tick - e.consumeAt >= 120) {
            corpse.claimed = true;
            e.harvests++;
            e.consuming = 0;
            if (e.d.category === 'boss') this.heal(e, e, fx(300));
            else {
              const addition = scaled(e.stats.health / (1 + 0.1 * (e.harvests - 1)), 0.1);
              e.stats.health += addition;
              e.hp += addition;
              e.stats.damage = scaled(
                e.stats.damage,
                (1 + 0.1 * e.harvests) / (1 + 0.1 * (e.harvests - 1)),
              );
            }
            this.effect('consume', e, e, 1, 0.8);
          } else return;
        } else e.consuming = 0;
      }
    }
    if (e.variant >= 2) {
      if (
        (e.d.id === 'enemy.runner' || e.d.id === 'enemy.skimmer') &&
        this.tick >= (e.cooldowns.dash ?? 0)
      ) {
        const t = this.get(e.target);
        const incoming = this.projectiles.find(
          (p) => p.side === 0 && p.target === e.id && distance(e, p) <= fx(3),
        );
        if (t && (e.d.id === 'enemy.runner' ? boundary(e, t) > fx(3) : !!incoming)) {
          const h =
              e.d.id === 'enemy.runner'
                ? bearing({ x: t.x - e.x, y: t.y - e.y })
                : (incoming!.heading + (e.id % 2 ? 16384 : -16384) + H) % H,
            step = direction(h, fx(e.d.id === 'enemy.runner' ? 3 : 2));
          if (this.dash(e, { x: e.x + step.x, y: e.y + step.y })) {
            e.cooldowns.dash = this.tick + secs(e.d.id === 'enemy.runner' ? 10 : 12);
            if (e.d.id === 'enemy.runner') e.nextAttack = Math.max(e.nextAttack, this.tick + 78);
          }
        }
      }
      if (
        e.d.id === 'enemy.veil' &&
        e.lastFire === this.tick - 1 &&
        this.tick >= (e.cooldowns.cloak ?? 0)
      ) {
        this.status(e, 'cloak', 1, 0.5, e);
        const visibleUntil = e.revealUntil;
        e.revealUntil = 0;
        this.schedule(e, 0.5, () => {
          e.revealUntil = Math.max(e.revealUntil, visibleUntil);
        });
        e.cooldowns.cloak = this.tick + 720;
      }
      if (
        e.d.id === 'enemy.breaker' &&
        this.tick >= (e.cooldowns.slam ?? 0) &&
        this.alive(0).some((v) => boundary(e, v) <= fx(2))
      ) {
        this.warn(e, 'circle', e, 2, this.abilityOutput(e, 120), 1, 'Breaker slam');
        e.cooldowns.slam = this.tick + 600;
      }
    }
    if (e.d.category === 'boss') this.boss(e);
  }
  private boss(e: Entity): void {
    const wanted = e.hp <= e.stats.health * 0.35 ? 3 : e.hp <= e.stats.health * 0.7 ? 2 : 1;
    if (e.phase < wanted && e.transition <= this.tick) {
      e.phase++;
      e.transition = this.tick + 120;
      e.abilityCast = null;
      e.nextAttack = Math.max(e.nextAttack, e.transition);
      this.phaseChanges++;
      this.note(`${e.d.name} · Phase ${e.phase}`);
      this.effect('phase', e, e, 1, 2);
      if (e.d.id === 'boss.silent_crown' && e.phase === 2) this.summon(e, 3);
    }
    if (e.transition > this.tick) return;
    const target = this.get(e.target) ?? this.core;
    const areaReady =
      this.tick >= (e.cooldowns.area ?? 0) && !this.warnings.some((w) => w.owner === e.id);
    const area = (
      kind: Warning['kind'],
      point: Vec,
      r: number,
      damage: number,
      delay: number,
      cd: number,
      label: string,
      extra: Partial<Warning> = {},
    ) => {
      this.warn(e, kind, point, r, this.abilityOutput(e, damage), delay, label, extra);
      e.cooldowns.area = this.tick + secs(cd);
      e.nextAttack = Math.max(e.nextAttack, this.tick + secs(delay));
    };
    switch (e.d.id) {
      case 'boss.prism_sovereign':
        if (e.phase >= 2 && e.reserved) this.summon(e, e.reserved);
        if (this.alive(1).some((v) => v.d.id === 'special.prism') && !e.cooldowns.prismShield) {
          e.shield = fx(300);
          e.cooldowns.prismShield = 1;
        }
        if (!this.alive(1).some((v) => v.d.id === 'special.prism')) e.shield = 0;
        if (areaReady && e.phase >= 3) {
          const h = bearing({ x: target.x - e.x, y: target.y - e.y }),
            end = direction(h, fx(12));
          area('line', { x: e.x + end.x, y: e.y + end.y }, 0, 250, 2, 8, 'Prism line blast');
        } else if (
          this.tick >= (e.cooldowns.prismBeam ?? 0) &&
          boundary(e, target) <= fx(10) &&
          this.los(e, target)
        ) {
          const origin = { x: e.x, y: e.y },
            h = bearing({ x: target.x - e.x, y: target.y - e.y }),
            offset = direction(h, fx(10)),
            end = { x: e.x + offset.x, y: e.y + offset.y };
          this.warn(e, 'line', end, 0, 0, 1.5, 'Prism beam lock', { width: fx(0.5) });
          e.nextAttack = this.tick + 210;
          e.cooldowns.prismBeam = this.tick + 600;
          for (let i = 1; i <= 20; i++)
            this.schedule(e, 1.5 + i * 0.1, () => {
              if (e.transition <= this.tick) {
                for (const victim of this.alive(0).filter(
                  (v) =>
                    v.d.layer === 'ground' &&
                    sweep(origin, end, v, fx(0.25)) !== null &&
                    this.los(e, v),
                ))
                  this.damage(e, victim, this.abilityOutput(e, 8));
                this.effect('beam', origin, end, 1, 0.12);
              }
            });
          this.schedule(e, 3.5, () => this.status(e, 'vulnerable', 0.2, 2, e));
        }
        break;
      case 'boss.choir_dreadnought':
        if (e.phase >= 2 && e.reserved) this.summon(e, e.reserved);
        if (e.phase >= 3) {
          e.shieldMax = fx(600);
          e.shieldFront = true;
          if (!e.cooldowns.frontShield) {
            e.shield = e.shieldMax;
            e.cooldowns.frontShield = 1;
          }
        }
        if (
          e.phase >= 2 &&
          areaReady &&
          boundary(e, target) >= fx(6) &&
          boundary(e, target) <= fx(15)
        ) {
          area('circle', target, 2, 200, 2, 10, 'Dreadnought mortar');
          this.schedule(e, 2, () => this.status(e, 'rear-vents', 1, 4, e));
        }
        break;
      case 'boss.silent_crown':
        if (e.phase >= 3 && areaReady) {
          const targets = this.alive(0)
            .filter((v) => v.id !== this.core.id)
            .sort((a, b) => boundary(e, a) - boundary(e, b) || a.id - b.id)
            .slice(0, 3);
          if (!targets.length) targets.push(this.core);
          for (const t of targets)
            this.warn(e, 'circle', t, 1.5, this.abilityOutput(e, 140), 2, 'Crown impact');
          e.cooldowns.area = this.tick + 720;
          this.schedule(e, 2, () => {
            e.revealUntil = this.tick + 240;
          });
        }
        break;
      case 'boss.gorger_titan':
        if (e.phase >= 2 && e.reserved) this.summon(e, e.reserved);
        if (e.phase >= 3 && areaReady && boundary(e, target) <= fx(4)) {
          area('cone', target, 4, 220, 2, 10, 'Gorger cone');
          this.schedule(e, 2, () => this.status(e, 'vulnerable', 0.2, 3, e));
        }
        break;
      case 'boss.shatterstorm':
        if (e.phase >= 3 && e.reserved && this.tick >= (e.cooldowns.summon ?? 0)) {
          this.summon(e, 2);
          e.cooldowns.summon = this.tick + 600;
        }
        if (e.phase >= 2 && areaReady) {
          for (let i = 0; i < 5; i++) {
            const offset = direction(Math.round((i * H) / 5), fx(2));
            this.warn(
              e,
              'circle',
              { x: target.x + offset.x, y: target.y + offset.y },
              1,
              this.abilityOutput(e, 120),
              2,
              'Shatterstorm spiral',
              { layers: 'ground' },
            );
          }
          e.cooldowns.area = this.tick + 720;
          this.schedule(e, 2, () => this.status(e, 'vulnerable', 0.2, 3, e));
        }
        break;
      case 'boss.marshal':
        if (e.phase >= 2 && e.reserved && this.tick >= (e.cooldowns.summon ?? 0)) {
          this.status(e, 'exposed', 1, 3, e);
          this.schedule(e, 3, () => this.summon(e, e.reserved));
          e.cooldowns.summon = this.tick + 180;
        }
        if (e.phase >= 3 && areaReady && distance(e, target) <= fx(8)) {
          const h = bearing({ x: target.x - e.x, y: target.y - e.y }),
            offset = direction(h, fx(5)),
            end = { x: e.x + offset.x, y: e.y + offset.y };
          area('line', end, 0, 150, 2, 10, 'Marshal charge', { width: fx(1.2) });
          this.schedule(e, 2, () => this.dash(e, end));
        }
        break;
      case 'boss.black_conductor':
        if (e.phase >= 2 && e.reserved) this.summon(e, e.reserved);
        if (e.phase >= 2 && areaReady) {
          const supports = this.alive(0)
            .filter(
              (v) =>
                ['support', 'infrastructure'].includes(v.d.category) && boundary(e, v) <= fx(10),
            )
            .sort((a, b) => a.id - b.id)
            .slice(0, 3);
          if (supports.length) {
            this.warn(e, 'jam', e, 5, 0, 1.5, 'Black Conductor jam', {
              targets: supports.map((v) => v.id),
            });
            e.cooldowns.area = this.tick + 720;
            this.schedule(e, 1.5, () => this.status(e, 'exposed', 1, 3, e));
          }
        }
        if (
          e.phase >= 3 &&
          this.tick >= (e.cooldowns.drain ?? 0) &&
          boundary(e, this.core) <= fx(5) &&
          this.los(e, this.core)
        ) {
          this.status(e, 'exposed', 1, 4, e);
          e.cooldowns.drain = this.tick + 720;
          for (let i = 1; i <= 40; i++)
            this.schedule(e, i * 0.1, () => {
              if (
                e.transition <= this.tick &&
                this.los(e, this.core) &&
                boundary(e, this.core) <= fx(5)
              ) {
                this.damage(e, this.core, this.abilityOutput(e, 4));
                this.effect('beam', e, this.core, 1, 0.12);
              }
            });
        }
        break;
      case 'boss.root_below':
        if (e.phase >= 2 && e.reserved && !e.burrow) this.summon(e, e.reserved);
        if (e.phase >= 3 && areaReady && !e.burrow) {
          const h = bearing({ x: target.x - e.x, y: target.y - e.y }),
            offset = direction(h, fx(10));
          area('line', { x: e.x + offset.x, y: e.y + offset.y }, 0, 250, 2, 12, 'Root eruption');
          this.schedule(e, 2, () => {
            e.revealUntil = this.tick + 180;
            this.status(e, 'vulnerable', 0.2, 3, e);
          });
        }
        break;
    }
  }
  private activateSignature(e: Entity, duration: number): void {
    if (e.signature !== 'armed' && e.signature !== 'pending') return;
    e.signature = duration ? 'active' : 'used';
    e.signatureUntil = this.tick + secs(duration);
    this.note(`${e.d.name} · Signature`);
    this.effect('signature', e, e, 0, 1);
  }
  private signatures(e: Entity): void {
    if (e.signature === 'active' && this.tick >= e.signatureUntil) e.signature = 'used';
    if (
      (e.signature !== 'armed' && e.signature !== 'pending') ||
      e.abilityCast === 'signature_chain' ||
      e.abilityCast === 'signature_nullifier'
    )
      return;
    const near = this.alive(0).filter((v) => boundary(e, v) <= this.auraRange(e)),
      foes = this.alive(1).filter(
        (v) => boundary(e, v) <= Math.max(e.stats.range, fx(6)) && this.detected(e, v),
      ),
      breach = this.barrierDeaths > 0 || this.alive(1).some((v) => boundary(v, this.core) <= fx(6));
    switch (e.d.id) {
      case 'friendly.sentry':
        if (breach) this.activateSignature(e, 6);
        break;
      case 'friendly.arc_spire': {
        const primary = this.get(e.target);
        if (!primary) break;
        const chain = [primary];
        while (chain.length < 6) {
          const last = chain.at(-1)!;
          const next = foes
            .filter(
              (v) =>
                v.d.layer === primary.d.layer &&
                !chain.includes(v) &&
                distance(last, v) <= fx(2.5) &&
                this.los(last, v),
            )
            .sort((a, b) => distance(last, a) - distance(last, b) || a.id - b.id)[0];
          if (!next) break;
          chain.push(next);
        }
        if (e.signature === 'pending' || chain.length >= 6) {
          e.signature = 'pending';
          e.cooldowns.arcSignature = 1;
        }
        break;
      }
      case 'friendly.lance_array':
        if (e.lock >= 240) {
          this.activateSignature(e, 3);
          this.status(e, 'signature-penetration', 0.5, 3, e);
        }
        break;
      case 'friendly.nullifier': {
        if (e.abilityCast) break;
        const target = foes
          .filter((v) => boundary(e, v) <= e.stats.range && this.los(e, v))
          .find(
            (v) =>
              (v.d.id === 'enemy.mender' && v.channel !== null) ||
              (v.d.id === 'enemy.herald' &&
                this.alive(1).some((a) => a.id !== v.id && distance(a, v) <= fx(4))) ||
              (v.variant === 3 &&
                this.alive(1).some((a) => a.id !== v.id && distance(a, v) <= fx(4))) ||
              (v.d.id === 'boss.marshal' && v.phase >= 2) ||
              (v.shieldMax > v.shield && this.tick - v.lastDamage >= 240),
          );
        if (target) {
          e.signature = 'pending';
          e.abilityCast = 'signature_nullifier';
          const point = { x: target.x, y: target.y },
            layer = target.d.layer;
          this.schedule(e, 0.1, () => {
            e.abilityCast = null;
            this.activateSignature(e, 0);
            for (const v of this.alive(1).filter(
              (v) => v.d.layer === layer && distance(point, v) <= fx(2) && this.detected(e, v),
            ))
              this.status(v, 'suppressed', 1, 5, e);
          });
        }
        break;
      }
      case 'friendly.rifle_squad':
        if (this.core.hp < this.core.stats.health * 0.5) {
          this.activateSignature(e, 8);
          this.status(e, 'output', 0.25, 8, e);
        }
        break;
      case 'friendly.heavy_squad': {
        const target = foes.find((v) => v.d.layer === 'ground' && v.d.armor >= 40);
        if (target && e.signature === 'armed') {
          e.signature = 'pending';
          e.signatureShots = 5;
        }
        break;
      }
      case 'friendly.combat_engineers':
        if (this.barrierDeaths || e.signature === 'pending') {
          e.signature = 'pending';
          const wall = near.find(
            (v) =>
              v.d.category === 'route' &&
              v.hp < v.stats.health &&
              boundary(e, v) <= this.auraRange(e, 2),
          );
          if (wall) {
            this.activateSignature(e, 4);
            e.channel = wall.id;
            e.channelSince = this.tick - 30;
          }
        }
        break;
      case 'friendly.field_medics': {
        const w = near.find(
          (v) =>
            v.d.category === 'warden' && (e.signature === 'pending' || v.hp < v.stats.health * 0.2),
        );
        if (this.alive(0).some((v) => v.d.category === 'warden' && v.hp < v.stats.health * 0.2))
          e.signature = 'pending';
        if (w && boundary(e, w) <= this.auraRange(e, 3) && this.los(e, w)) {
          this.activateSignature(e, 0);
          this.heal(e, w, fx(250), false, true);
        }
        break;
      }
      case 'friendly.interceptor_drones': {
        const boss = foes.find((v) => v.d.category === 'boss' && v.d.layer === 'air');
        if (boss) {
          this.activateSignature(e, 6);
          this.status(e, 'output', 0.2, 6, e);
          this.dash(e, { x: boss.x, y: boss.y });
        }
        break;
      }
      case 'friendly.aegis_walkers':
        if (e.shield === 0 && e.lastDamage >= 0) {
          this.activateSignature(e, 0);
          this.schedule(e, 1, () => {
            e.shield = Math.min(e.shieldMax, e.shield + fx(400));
          });
        }
        break;
      case 'friendly.repair_node':
        if (
          this.core.hp < this.core.stats.health * 0.3 &&
          boundary(e, this.core) <= this.auraRange(e)
        ) {
          this.activateSignature(e, 6);
          e.channel = this.core.id;
          e.channelSince = this.tick - 30;
        }
        break;
      case 'friendly.medical_station':
        if (near.filter((v) => v.d.biological && v.hp < v.stats.health * 0.3).length >= 2)
          this.activateSignature(e, 6);
        break;
      case 'friendly.detection_relay': {
        const group = foes.filter(
          (v) =>
            v.d.id === 'enemy.veil' || v.d.id === 'enemy.mole' || v.d.id === 'boss.silent_crown',
        );
        if (group.length >= 3) {
          this.activateSignature(e, 0);
          for (const v of group) v.revealUntil = this.tick + 480;
        }
        break;
      }
      case 'friendly.shield_projector':
        if (
          this.core.hp < this.core.stats.health * 0.25 &&
          boundary(e, this.core) <= this.auraRange(e)
        ) {
          this.activateSignature(e, 6);
          this.bonusShield(e, this.core, fx(500), 6);
        }
        break;
      case 'friendly.ammunition_fabricator': {
        const eligible = near.filter((v) =>
          [
            'friendly.sentry',
            'friendly.rotary',
            'friendly.rifle_squad',
            'friendly.heavy_squad',
          ].includes(v.d.id),
        );
        if (eligible.filter((v) => this.tick - v.lastFire < 60).length >= 3)
          e.signature = 'pending';
        if (e.signature === 'pending' && eligible.some((v) => v.d.id === 'friendly.rotary'))
          this.activateSignature(e, 8);
        break;
      }
      case 'friendly.tactical_uplink':
        if (foes.some((v) => v.d.category === 'boss')) {
          this.activateSignature(e, 8);
          for (const v of near) this.status(v, 'boss-priority', 20, 8, e);
        }
        break;
      case 'friendly.barracks':
        if (near.some((v) => v.retreat)) this.activateSignature(e, 6);
        break;
      case 'friendly.drone_bay': {
        const drone = near.find(
          (v) =>
            v.d.id === 'friendly.interceptor_drones' &&
            v.hp < v.stats.health * 0.25 &&
            this.los(e, v),
        );
        if (drone) {
          e.cooldowns.signatureRecipient = drone.id;
          e.channel = drone.id;
          e.channelSince = this.tick - 30;
          this.activateSignature(e, 6);
        }
        break;
      }
      case 'friendly.command_node':
        if (breach) {
          this.activateSignature(e, 8);
          for (const v of near) {
            this.status(v, 'core-defense', 20, 8, e);
            this.fallbackAnchor(v, true);
          }
        }
        break;
      case 'friendly.elevated_firing_platform': {
        const mounted = near.find(
          (v) =>
            v.d.category === 'tower' &&
            v.rect?.x === e.rect?.x &&
            v.rect?.y === e.rect?.y &&
            v.hp < v.stats.health * 0.25,
        );
        if (mounted) {
          this.activateSignature(e, 6);
          this.bonusShield(e, mounted, fx(250), 6);
        }
        break;
      }
      case 'warden.bulwark':
        if (this.core.hp < this.core.stats.health * 0.25) {
          this.activateSignature(e, 0);
          e.cooldowns.interpose = 0;
          e.shield = fx(800);
          e.shieldFront = false;
        }
        break;
      case 'warden.ranger':
        if (this.phaseChanges) {
          this.activateSignature(e, 0);
          e.cooldowns.volley = 0;
        }
        break;
      case 'warden.conductor':
        if (near.filter((v) => v.hp < v.stats.health * 0.25).length >= 2) {
          this.activateSignature(e, 0);
          e.cooldowns.refrain = 0;
        }
        break;
    }
  }
  step(): void {
    if (this.outcome) return;
    this.tick++;
    this.losCache.clear();
    const due = this.scheduled.filter((s) => s.due <= this.tick);
    this.scheduled = this.scheduled.filter((s) => s.due > this.tick);
    for (const s of due) {
      const owner = this.get(s.owner);
      if (s.independent || owner?.hp) s.run();
    }
    this.warnings = this.warnings.filter((w) => w.due > this.tick);
    for (const parent of this.entities.filter((v) => v.d.id === 'enemy.carrier' && v.reserved))
      if (!parent.hp) this.summon(parent, parent.reserved);
      else if (parent.hp <= parent.stats.health * 0.5 && parent.childrenReleased < 2)
        this.summon(parent, 2 - parent.childrenReleased);
    this.populationHeld = false;
    if (this.directorTick < secs(this.plan.duration)) {
      while (
        this.spawnCursor < this.plan.spawns.length &&
        this.plan.spawns[this.spawnCursor]!.tick <= this.directorTick
      ) {
        const spawn = this.plan.spawns[this.spawnCursor]!;
        const packet = this.plan.spawns
          .slice(this.spawnCursor)
          .filter((s) => s.packet === spawn.packet);
        const count = this.entities.length,
          nextID = this.nextID,
          eventCount = this.events.length;
        if (
          this.population + packet.reduce((n, s) => n + 1 + s.children, 0) > 120 ||
          !packet.every((s) => this.spawn(s))
        ) {
          this.entities.length = count;
          this.nextID = nextID;
          this.events.length = eventCount;
          this.populationHeld = true;
          break;
        }
        this.spawnCursor += packet.length;
      }
      if (!this.populationHeld) this.directorTick++;
    }
    if (this.plan.boss && this.directorTick === 10320)
      this.note(`${definition(this.plan.boss).name} arriving in 8 seconds`);
    for (const e of this.alive()) {
      e.vx = 0;
      e.vy = 0;
      if (
        e.statuses.some((s) => s.kind === 'root' && s.until <= this.tick) &&
        !e.statuses.some((s) => s.kind === 'root' && s.until > this.tick)
      )
        e.cooldowns.rootImmune = this.tick + 240;
      e.statuses = e.statuses.filter((s) => s.until > this.tick);
      e.bonusPools = e.bonusPools.filter((p) => p.until > this.tick && p.capacity > 0);
      if (e.owned) {
        const p = this.performance.get(e.owned)!;
        p.operational = true;
        p.blocks = 1;
      }
      if (e.shieldUntil && this.tick >= e.shieldUntil) {
        e.shield = 0;
        e.shieldUntil = 0;
      }
      if (e.d.id === 'friendly.rotary' && (this.tick - e.lastFire > 1 || e.overheat > this.tick)) {
        const fabricator = this.alive(0).some(
          (v) =>
            v.d.id === 'friendly.ammunition_fabricator' &&
            v.jamUntil <= this.tick &&
            boundary(v, e) <= v.stats.range,
        );
        e.heat = Math.max(0, e.heat - (15 / 60) * (fabricator ? 1.2 : 1));
        if (this.tick >= e.overheat && e.overheat && e.heat > 40) e.overheat = this.tick + 1;
      }
      if (
        (e.d.id === 'friendly.aegis_walkers' || (e.d.id === 'enemy.bulwark' && e.variant >= 2)) &&
        this.tick - e.lastDamage >= 240 &&
        this.tick % 15 === 0
      )
        e.shield = Math.min(
          e.shieldMax,
          e.shield +
            fx(
              (e.d.id === 'friendly.aegis_walkers' ? 20 : 15) *
                0.25 *
                (e.asset ? e.stats.damage / fx(e.d.damage) : 1) *
                (e.asset && e.asset.stars >= 4 ? 1.2 : 1) *
                (this.has(e, 'suppressed') ? 0.5 : 1),
            ),
        );
      if (this.tick % 15 === 0)
        for (const burn of e.statuses
          .filter((s) => s.kind.startsWith('burn.') && s.until > this.tick)
          .sort((a, b) => a.source - b.source || compareIDs(a.kind, b.kind)))
          this.damage(
            this.get(burn.source) ?? null,
            e,
            fx(burn.value * 0.25),
            0.5,
            false,
            undefined,
            true,
          );
      if (!e.hp) continue;
      if (e.id === this.core.id) continue;
      if (e.side === 0) this.signatures(e);
      else this.enemy(e);
      if (e.d.category === 'trap') {
        this.traps(e);
        continue;
      }
      if (e.d.category === 'route') {
        if (e.d.id === 'friendly.controlled_gate') this.gate(e);
        continue;
      }
      if (e.d.category === 'warden') this.abilities(e);
      if (e.consuming) continue;
      if (e.transition > this.tick || e.burrow) {
        if (e.burrow) this.move(e, { x: fx(24), y: fx(30) }, fx(0.5));
        continue;
      }
      if (this.support(e)) continue;
      if (this.tick >= e.nextDecision) {
        const links = this.alive(e.side).filter(
          (v) =>
            v.id !== e.id &&
            v.jamUntil <= this.tick &&
            boundary(v, e) <=
              (v.d.id === 'warden.conductor'
                ? fx(5) * (1 + (0.15 * ((v.asset?.level ?? 1) - 1)) / 99)
                : this.auraRange(v)),
        );
        const buff = links.some((v) => v.d.id === 'friendly.tactical_uplink')
          ? 0.8
          : links.some((v) => v.d.id === 'warden.conductor')
            ? 0.9
            : 1;
        e.nextDecision =
          this.tick +
          Math.max(
            1,
            Math.round(
              (e.side === 1
                ? { Cadet: 30, Standard: 21, Veteran: 15, Master: 12, Cataclysm: 12 }[
                    this.plan.difficulty
                  ]
                : 15) * buff,
            ),
          );
        this.decide(e);
      }
      if (e.stats.speed && !e.abilityCast && !this.has(e, 'dashing')) {
        const target = this.get(e.target),
          posture = e.asset?.tactics.posture ?? 'Aggressive',
          retreatHP = posture === 'Defensive' ? 0.4 : posture === 'Balanced' ? 0.3 : 0.2;
        if (e.side === 0 && e.hp / e.stats.health < retreatHP && !e.retreat) {
          e.retreat = true;
          e.retreatAt = this.tick;
          this.reason(e, 'Retreating');
        }
        if (e.retreat && e.hp / e.stats.health >= 0.7) e.retreat = false;
        const anchor = e.asset?.tactics.anchor ?? { x: 25, y: 30 },
          anchorPoint = { x: fx(anchor.x), y: fx(anchor.y) },
          leash = posture === 'Defensive' ? 4 : posture === 'Balanced' ? 7 : 10;
        if (e.retreat) {
          this.move(e, anchorPoint, fx(0.75));
          if (distance(e, anchorPoint) <= fx(0.75) && this.tick - e.retreatAt > 300)
            e.retreat = false;
        } else if (target?.hp) {
          const memory = e.memory[target.id];
          if (memory && memory.tick < this.tick - 21 && !this.los(e, target)) {
            this.move(e, memory, fx(0.5));
            continue;
          }
          const desired =
            e.d.weapon === 'melee'
              ? fx(0.4)
              : Math.max(
                  fx(e.d.minimum + 0.5),
                  Math.round(
                    e.stats.range *
                      (posture === 'Defensive' ? 0.85 : posture === 'Balanced' ? 0.75 : 0.65),
                  ),
                );
          if (e.side === 1 && this.roleMove(e, target)) {
          } else if (
            e.side === 0 &&
            distance(e, anchorPoint) > fx(leash) &&
            this.coreThreat(target) < 0.8
          )
            this.move(e, anchorPoint, fx(0.75));
          else if (
            boundary(e, target) > desired ||
            !this.los(e, target) ||
            boundary(e, target) < fx(e.d.minimum)
          ) {
            this.approach(e, target, desired);
          } else this.separate(e);
        } else if (e.side === 0) this.move(e, anchorPoint, fx(0.75));
        else if (
          e.d.id !== 'special.decoy' &&
          e.d.id !== 'special.prism' &&
          e.d.id !== 'special.root'
        )
          this.approach(e, this.core, e.stats.range * 0.8);
        if (this.tick % 120 === 0) {
          if (distance(e, e.stuckAt) < fx(0.15) && e.lastMove < this.tick - 30) {
            e.stuck += 120;
            e.pathVersion = -1;
            if (e.side === 0) this.fallbackAnchor(e);
            this.reason(e, 'Repath after stalled movement');
          } else e.stuck = 0;
          e.stuckAt = { x: e.x, y: e.y };
        }
      }
      this.basic(e);
    }
    if (this.tick % 15 === 0) this.detection();
    this.updateProjectiles();
    this.resolvingHealing = true;
    for (const request of this.healingQueue) {
      const factor =
        request.source.d.category === 'mobile' && !request.signatureFlat
          ? 0.5 + (0.5 * request.source.hp) / request.source.stats.health
          : 1;
      this.heal(
        request.source,
        request.target,
        scaled(request.amount, factor / request.bodyFactor),
        request.coreHalf,
        request.signatureFlat,
      );
    }
    this.healingQueue.length = 0;
    this.resolvingHealing = false;
    for (const completion of this.rearm.advance(this.tick, (source, trap) =>
      this.observeRearm(source, trap),
    )) {
      const t = this.get(completion.trap);
      if (t) {
        t.temporary = completion.stock.temporary;
        this.effect('rearm', this.get(completion.source)!, t, 0, 0.5);
        this.note('Engineer restored one temporary trap charge');
      }
    }
    for (const e of this.entities.filter((v) => !v.hp && v.reserved && v.d.id === 'enemy.carrier'))
      this.summon(e, e.reserved);
    const combatThreats =
      this.alive(1).length +
      this.entities.reduce((n, e) => n + e.reserved, 0) +
      this.projectiles.filter((p) => p.side === 1).length +
      this.warnings.filter((w) => w.side === 1).length;
    if (
      !combatThreats &&
      this.spawnCursor === this.plan.spawns.length &&
      this.directorTick >= secs(this.plan.duration)
    ) {
      this.quiet++;
      if (this.quiet >= 60) {
        this.outcome = 'Victory';
        this.note('Siege cleared');
      }
    } else this.quiet = 0;
    this.effects = this.effects.filter((e) => e.until > this.tick);
    this.corpses = this.corpses.filter((c) => c.expires > this.tick && !c.claimed);
    if (this.tick % 60 === 0) {
      if (this.timeline.length < 3600)
        this.timeline.push({
          second: this.tick / 60,
          friendly: this.damageFriendly,
          enemy: this.damageEnemy,
        });
      this.damageFriendly = 0;
      this.damageEnemy = 0;
      const refs = new Set([
        ...this.projectiles.map((p) => p.owner),
        ...this.scheduled.map((s) => s.owner),
        ...this.entities.flatMap((e) =>
          e.statuses.filter((s) => s.until > this.tick).map((s) => s.source),
        ),
        ...this.entities.flatMap((e) =>
          e.bonusPools.filter((p) => p.until > this.tick && p.capacity > 0).map((p) => p.owner),
        ),
      ]);
      this.entities = this.entities.filter(
        (e) => e.hp > 0 || e.owned || e.id === this.core.id || e.reserved || refs.has(e.id),
      );
    }
  }
  surrender(): void {
    if (!this.outcome) {
      this.outcome = 'Defeat';
      this.note('Siege withdrawn; actual losses and destroyed-threat rewards preserved');
    }
  }
  result(id: string, sequence: string, practice = false): Result {
    if (!this.outcome) throw new Error('A running siege cannot produce a result');
    for (const e of this.entities) {
      if (e.owned) {
        const p = this.performance.get(e.owned)!;
        p.endingHP = e.hp;
        p.endingCharges = e.charges;
      }
    }
    const planned = new Map<number, number>();
    for (const s of this.plan.spawns) planned.set(s.segment, (planned.get(s.segment) ?? 0) + s.qtp);
    return {
      id,
      sequence,
      epoch: this.start.epoch,
      plan: this.plan,
      outcome: this.outcome,
      practice,
      seconds: this.tick / 60,
      coreHP: this.core.hp,
      performance: [...this.performance.values()],
      armyFingerprint: this.armyFingerprint,
      allocations: [],
      unusedAssetXP: '0',
      killed: this.killed,
      discovered: [...this.discovered],
      timeline: this.timeline,
      heatmap: this.heatmap,
      buckets: [...planned].map(([segment, plannedQTP]) => ({
        block: this.plan.block,
        segment,
        pressure: this.plan.pressure[segment - 1] ?? 35,
        pressureFraction: this.plan.pressureFractions[segment - 1] ?? { n: 35, d: 100 },
        plannedQTP,
        destroyedQTP: this.destroyed.get(segment) ?? 0,
      })),
      wrecks: [...this.performance.values()].filter((p) => p.endingHP === 0).length,
      events: this.events,
      credits: '0',
      xp: '0',
      assetXP: '0',
      cores: '0',
      bonuses: [],
      claimed: false,
      clipped: '0',
    };
  }
}
