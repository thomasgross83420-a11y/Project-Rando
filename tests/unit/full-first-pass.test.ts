import { buy, place } from '../../src/game/construction';
import { series, offers, encounterCode, readEncounterCode } from '../../src/game/watch';
import { inspectFullBackup } from '../../src/game/store';
import { hash } from '../../src/sim/determinism';
import { FULL_VERSION } from '../../src/game/model';
import { validateSnapshot } from '../../src/game/validation';
import { describe, it, expect } from 'vitest';
import { CATALOG, FRIENDLIES, ENEMIES, BOSSES } from '../../src/game/catalog';
import { newGame, assertGame } from '../../src/game/model';
import { compile, validatePlan } from '../../src/game/director';
import { guidedLayout, validateLayout } from '../../src/game/construction';
import { FullBattle } from '../../src/game/engine';
import { priceResult, claimResult } from '../../src/game/economy';
describe('full first pass integration', () => {
  it('contains the complete ordinary roster, Wardens, enemies, bosses and targetable specials', () => {
    expect(new Set(CATALOG.map((d) => d.id)).size).toBe(CATALOG.length);
    expect(FRIENDLIES.length).toBe(43);
    expect(FRIENDLIES.filter((d) => d.category === 'support')).toHaveLength(6);
    expect(FRIENDLIES.filter((d) => d.category === 'infrastructure')).toHaveLength(4);
    expect(ENEMIES.length).toBe(16);
    expect(BOSSES.length).toBe(8);
  });
  it('compiles immutable army-independent campaign plans for every stage and difficulty', async () => {
    for (const difficulty of ['Cadet', 'Standard', 'Veteran', 'Master', 'Cataclysm'] as const)
      for (let stage = 0; stage < 40; stage++) {
        const p = await compile({
          mode: 'Campaign',
          seed: 'ignored',
          rank: 100,
          difficulty,
          stage,
        });
        validatePlan(p);
        const other = await compile({
          mode: 'Campaign',
          seed: 'different',
          rank: 100,
          difficulty,
          stage,
        });
        expect(other.hash).toBe(p.hash);
        expect(p.spawns.every((s) => s.children + 1 <= 120)).toBe(true);
        expect(p.stage).toBe(stage);
      }
  }, 120000);
  for (const doctrine of ['Bastion', 'Mobile', 'Chokepoint'] as const)
    for (const warden of ['warden.bulwark', 'warden.ranger', 'warden.conductor'])
      it(`free guided ${doctrine}/${warden} clears the tutorial`, async () => {
        const s = newGame('Test', 0, doctrine, warden);
        guidedLayout(s);
        expect(validateLayout(s)).toEqual([]);
        assertGame(s);
        validateSnapshot(s);
        const plan = await compile({
          mode: 'Campaign',
          seed: 'tutorial',
          rank: 1,
          difficulty: 'Standard',
          stage: 0,
        });
        const battle = await FullBattle.create(s, plan);
        for (let i = 0; i < 18000 && !battle.outcome; i++) battle.step();
        expect(
          battle.outcome,
          JSON.stringify({
            core: battle.core.hp,
            alive: battle.alive(1).map((e) => e.d.id),
            events: battle.events.slice(0, 8),
          }),
        ).toBe('Victory');
        expect(s.credits).toBe(600);
        expect(battle.population).toBe(0);
        const r = priceResult(s, battle.result('test', '1'));
        s.sequence = '1';
        claimResult(s, r);
        assertGame(s);
        validateSnapshot(s);
        const wallet = s.credits;
        expect(() => claimResult(s, r)).toThrow();
        expect(s.credits).toBe(wallet);
        expect(s.stages).toEqual([0]);
      }, 120000);
});

describe('complete game contracts', () => {
  it('compiles every noncampaign mode, recipe, fixed mastery trial and six-block Endurance', async () => {
    for (const recipe of [
      'Balanced',
      'Armored',
      'Air',
      'Infiltration',
      'Support',
      'Alternating fronts',
    ]) {
      const p = await compile({
        mode: 'Expedition',
        seed: 'firstpass-mode-' + recipe,
        rank: 100,
        band: 20,
        difficulty: 'Standard',
        recipe,
      });
      validatePlan(p);
    }
    for (const boss of BOSSES) {
      const p = await compile({
        mode: 'Boss Siege',
        seed: 'firstpass-boss-' + boss.id,
        rank: 100,
        band: 20,
        difficulty: 'Standard',
        boss: boss.id,
      });
      validatePlan(p);
      expect(p.spawns.filter((s) => s.type === boss.id)).toHaveLength(1);
    }
    for (let trial = 0; trial < 12; trial++)
      validatePlan(
        await compile({ mode: 'Mastery', seed: 'fixed', rank: 100, difficulty: 'Standard', trial }),
      );
    const p = await compile({
      mode: 'Endurance',
      seed: 'captured-six',
      rank: 100,
      band: 20,
      difficulty: 'Standard',
      blocks: 6,
    });
    expect(p.following.map((p) => p.block)).toEqual([2, 3, 4, 5, 6]);
    validatePlan(p);
    for (const c of p.following) validatePlan(c);
  }, 120000);
  it('keeps Watch offers, backup checksums and imported encounters immutable', async () => {
    const s = newGame('Watch', 0, 'Mobile', 'warden.ranger');
    s.rank = 100;
    guidedLayout(s);
    s.watch = series(s, 20, 'Standard', [], 0);
    s.watchOrdinal = '3';
    await offers(s);
    expect(s.watch.offers).toHaveLength(3);
    expect(new Set(s.watch.offers.map((p) => p.boss)).size).toBe(1);
    const hashes = s.watch.offers.map((p) => p.hash);
    await offers(s);
    expect(s.watch.offers.map((p) => p.hash)).toEqual(hashes);
    validateSnapshot(s);
    const text = JSON.stringify({
      format: 'resonance-bastion-backup',
      version: FULL_VERSION,
      campaign: s,
      checksum: await hash(s),
    });
    expect((await inspectFullBackup(text)).watch?.offers.map((p) => p.hash)).toEqual(hashes);
    const replay = await readEncounterCode(await encounterCode(s.watch.offers[0]!), s);
    expect(replay.hash).toBe(hashes[0]);
    expect(replay.originMode).toBe('Long Watch');
    await expect(inspectFullBackup(text.replace('Watch', 'Broken'))).rejects.toThrow();
  }, 120000);
  it('deploys the complete ordinary roster without invented capacity and exercises all roles together', async () => {
    const s = newGame('Roster', 0, 'Bastion', 'warden.conductor');
    s.rank = 100;
    s.credits = 1000000;
    s.land = ['North', 'South', 'East', 'West', 'NE', 'NW', 'SE', 'SW'];
    s.assets = s.assets.filter((a) => a.type === s.warden);
    s.assets[0]!.placement = { x: 29, y: 33, rotation: 0 };
    for (const d of FRIENDLIES.filter((d) => d.category !== 'warden')) {
      const a = buy(s, d.id);
      let placed = false;
      for (let y = 12; y < 48 && !placed; y += 4)
        for (let x = 12; x < 48 && !placed; x += 4) {
          try {
            place(s, a.id, x, y, 0);
            placed = true;
          } catch {
            /* Search the next legal owned site. */
          }
        }
      expect(placed, d.id).toBe(true);
    }
    expect(validateLayout(s)).toEqual([]);
    validateSnapshot(s);
    const p = await compile({
      mode: 'Calibration',
      seed: 'roster-runtime',
      rank: 100,
      band: 20,
      difficulty: 'Standard',
      calibration: { type: 'enemy.carrier', count: 3, variant: 3, entrance: 0 },
    });
    const b = await FullBattle.create(s, p);
    for (let tick = 0; tick < 900 && !b.outcome; tick++) b.step();
    expect(b.population).toBeLessThanOrEqual(120);
    expect(b.projectiles.length).toBeLessThanOrEqual(300);
    expect(
      b.entities.every(
        (e) => Number.isSafeInteger(e.hp) && Number.isSafeInteger(e.x) && Number.isSafeInteger(e.y),
      ),
    ).toBe(true);
    expect(s.assets).toHaveLength(41);
  }, 120000);
  it('runs every enemy variant and each boss through phase and descendant transitions', async () => {
    const s = newGame('Mechanics', 0, 'Bastion', 'warden.bulwark');
    s.rank = 100;
    guidedLayout(s);
    for (const d of ENEMIES)
      for (const variant of [0, 1, 2, 3] as const) {
        const p = await compile({
          mode: 'Calibration',
          seed: d.id + variant,
          rank: 100,
          band: 20,
          difficulty: 'Standard',
          calibration: { type: d.id, count: 1, variant, entrance: 0 },
        });
        const b = await FullBattle.create(s, p);
        for (let tick = 0; tick < 660 && !b.outcome; tick++) b.step();
        expect(
          b.entities.every(
            (e) =>
              Number.isSafeInteger(e.hp) &&
              e.hp >= 0 &&
              Number.isSafeInteger(e.x) &&
              Number.isSafeInteger(e.y),
          ),
          d.id,
        ).toBe(true);
        expect(b.population).toBeLessThanOrEqual(120);
      }
    for (const d of BOSSES) {
      const p = await compile({
        mode: 'Boss Siege',
        seed: d.id,
        rank: 100,
        band: 20,
        difficulty: 'Standard',
        boss: d.id,
      });
      const b = await FullBattle.create(s, p);
      const spawn = p.spawns.find((v) => v.type === d.id)!;
      const adapter = b as unknown as { spawn(s: typeof spawn): boolean };
      expect(adapter.spawn({ ...spawn, position: { x: 24 * 1024, y: 30 * 1024 } })).toBe(true);
      const boss = b.entities.find((e) => e.d.id === d.id)!;
      boss.hp = Math.floor(boss.stats.health * 0.3);
      for (let tick = 0; tick < 320 && !b.outcome; tick++) b.step();
      expect(boss.phase, d.id).toBe(3);
      expect(b.phaseChanges, d.id).toBe(2);
      expect(b.population).toBeLessThanOrEqual(120);
      expect(
        b.entities.every((e) => Number.isSafeInteger(e.hp) && e.hp >= 0),
        d.id,
      ).toBe(true);
    }
  }, 120000);
});
