import { combat } from '../src/data/combat';
import { Battle, type BattleEvent } from '../src/sim/battle';
import { hash } from '../src/sim/determinism';
import { distance, U } from '../src/sim/fixed';
import { tutorialArmy } from '../tests/fixtures/tutorial';

export async function measureTutorialBalance() {
  const base = tutorialArmy();
  const cases = [
    { id: 'authored-baseline', scope: 'Current tutorial fixture', army: base },
    {
      id: 'former-mine-position',
      scope: 'Controlled v2 placement comparison; all other inputs unchanged',
      army: base.map((a) => (a.type === 'friendly.proximity_mine' ? { ...a, x: 22, y: 30 } : a)),
    },
    {
      id: 'no-repair',
      scope: 'Role contribution comparison',
      army: base.filter((a) => a.type !== 'friendly.repair_node'),
    },
    {
      id: 'no-mine',
      scope: 'Role contribution comparison',
      army: base.filter((a) => a.type !== 'friendly.proximity_mine'),
    },
    {
      id: 'no-barrier',
      scope: 'Role contribution comparison',
      army: base.filter((a) => a.type !== 'friendly.standard_barricade'),
    },
    {
      id: 'one-sentry',
      scope: 'Reduced deployment comparison',
      army: base.filter((a, i) => a.type !== 'friendly.sentry' || i === 0),
    },
    {
      id: 'no-sentries',
      scope: 'Mobile-defense comparison',
      army: base.filter((a) => a.type !== 'friendly.sentry'),
    },
    {
      id: 'no-rifle',
      scope: 'Role contribution comparison',
      army: base.filter((a) => a.type !== 'friendly.rifle_squad'),
    },
    {
      id: 'rifle-half-health',
      scope: 'Injury sensitivity',
      army: base.map((a) => ({
        ...a,
        hp: a.type === 'friendly.rifle_squad' ? Math.floor(a.hp / 2) : a.hp,
      })),
    },
    {
      id: 'sentries-half-health',
      scope: 'Repair sensitivity',
      army: base.map((a) => ({
        ...a,
        hp: a.type === 'friendly.sentry' ? Math.floor(a.hp / 2) : a.hp,
      })),
    },
    {
      id: 'warden-alone',
      scope: 'Diagnostic isolation, not the guided tutorial',
      army: base.filter((a) => a.type === 'warden.bulwark'),
    },
    {
      id: 'unarmed-core',
      scope: 'Diagnostic defeat mechanism; not a playable tutorial setup',
      army: [],
    },
  ];
  const results = [];
  for (const c of cases) {
    const b = await Battle.create(c.army),
      damage = new Map<string, number>(),
      shots = new Map<string, number>(),
      movement = new Map<string, number>(),
      movementTicks = new Map<string, number>(),
      flags: string[] = [];
    let last: BattleEvent | undefined,
      healing = 0,
      impacts = 0,
      events = 0,
      maximumProjectiles = 0;
    while ((b.state === 'Siege' || b.state === 'Cleanup') && b.tick < 21600) {
      const positions = b.entities.map((e) => ({ id: e.id, x: e.x, y: e.y }));
      b.step();
      maximumProjectiles = Math.max(maximumProjectiles, b.projectiles.length);
      for (const e of b.entities) {
        const before = positions.find((p) => p.id === e.id);
        if (before && e.team === 'friendly' && combat[e.type].radius) {
          const moved = distance(e, before);
          movement.set(e.type, (movement.get(e.type) ?? 0) + moved);
          if (moved) movementTicks.set(e.type, (movementTicks.get(e.type) ?? 0) + 1);
        }
      }
      if (b.events.at(-1) === last) continue;
      const index = last ? b.events.indexOf(last) : -1;
      if (last && index < 0)
        throw new Error('Balance event collector overflow; incomplete evidence');
      for (const event of b.events.slice(index + 1)) {
        events++;
        const source = b.get(event.source),
          target = b.get(event.target);
        if (event.kind === 'impact' && source && target?.team !== source.team) {
          impacts++;
          damage.set(source.type, (damage.get(source.type) ?? 0) + event.value);
        }
        if (event.kind === 'shot' || event.kind === 'melee') {
          const type = source?.type ?? 'unknown';
          shots.set(type, (shots.get(type) ?? 0) + 1);
        }
        if (event.kind === 'repair') healing += event.value;
      }
      last = b.events.at(-1);
    }
    if (!['Victory', 'Defeat', 'Stalemate'].includes(b.state))
      flags.push(
        'Observation ended at 360 seconds during active combat; not an automatic timeout/defeat',
      );
    if (healing === 0 && c.army.some((a) => a.type === 'friendly.repair_node'))
      flags.push('Repair not exercised by this scenario');
    if (
      ![...damage.keys()].includes('friendly.proximity_mine') &&
      c.army.some((a) => a.type === 'friendly.proximity_mine')
    )
      flags.push('Mine not exercised by this scenario');
    const result = {
      id: c.id,
      scope: c.scope,
      outcome: b.state,
      reason: b.reason,
      ticks: b.tick,
      combatSeconds: b.tick / 60,
      kills: b.kills,
      tp: b.destroyedTP,
      coreRemaining: b.core.hp / U,
      damageByRole: Object.fromEntries([...damage].sort().map(([k, v]) => [k, v / U])),
      releasesByRole: Object.fromEntries([...shots].sort()),
      actualRepair: healing / U,
      travelGU: Object.fromEntries([...movement].sort().map(([k, v]) => [k, v / U])),
      movingTicks: Object.fromEntries([...movementTicks].sort()),
      friendlyDown: b.entities
        .filter((e) => e.team === 'friendly' && e.hp === 0)
        .map((e) => e.type),
      maximumProjectiles,
      collectedEvents: events,
      impacts,
      hash: await hash(b.snapshot()),
      flags,
    };
    results.push(result);
    console.log(
      JSON.stringify({
        id: c.id,
        outcome: result.outcome,
        seconds: result.combatSeconds,
        core: result.coreRemaining,
        healing: result.actualRepair,
        flags,
      }),
    );
  }
  const report = {
    date: '2026-10-07',
    scope: 'Measured current fixed Bulwark/Bastion tutorial; not whole-game balance certification',
    method:
      'Authoritative simulation; fixed authored army UUIDs/schedule, controlled role/health changes. Capture new native events every tick with overflow rejection. Damage is actual capped body loss, not theoretical DPS.',
    tuningChanged: false,
    simulation: 'rb-sim-v2',
    limitations: [
      'No progression/economy/boss/full-roster balance claim',
      'Tutorial intended to teach and be survivable; unused support is a coverage gap, not permission to weaken it',
      'Single layout/fixed schedule; broader map/doctrine/rank scenarios follow their implementation',
    ],
    results,
  };
  return report;
}
