import { newGame, maxHealth, type GameState, type Plan } from '../src/game/model';
import { guidedLayout, buy } from '../src/game/construction';
import { compile, stageInfo } from '../src/game/director';
import { FullBattle } from '../src/game/engine';
import {
  repair,
  repairQuote,
  rearm,
  rearmQuote,
  priceResult,
  claimResult,
} from '../src/game/economy';
export async function experienceBalanceAudit(
  policy: string[] = [],
  attempts = 6,
  reinforceBoss = false,
  bossExtras: string[] = [],
  doctrines: readonly ('Bastion' | 'Mobile' | 'Chokepoint')[] = ['Bastion', 'Mobile', 'Chokepoint'],
  onBoss?: (s: GameState, p: Plan) => Promise<void>,
) {
  const runs = [];
  for (const doctrine of doctrines) {
    const s = newGame('Balance audit', 0, doctrine, 'warden.bulwark');
    const pinIDs = () =>
      s.assets.forEach((a, i) => {
        a.id = `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`;
      });
    pinIDs();
    guidedLayout(s);
    for (let attempt = 0; attempt < attempts; attempt++) {
      const next = Array.from({ length: 40 }, (_, i) => i).find((i) => !s.stages.includes(i)) ?? 39,
        stage = s.rank >= stageInfo(next).rank ? next : Math.max(0, next - 1),
        before = { rank: s.rank, credits: s.credits };
      let maintenance = 0;
      const coreCost = Math.ceil((10240000 - s.coreHP) / 10240);
      if (coreCost <= s.credits) maintenance += repair(s, null);
      for (const a of s.assets.filter((a) => a.placement)) {
        if (repairQuote(a) <= s.credits) maintenance += repair(s, a);
        if (a.hp && a.hp < maxHealth(a) && repairQuote(a) <= s.credits) maintenance += repair(s, a);
        const cost = rearmQuote(a);
        if (cost <= s.credits) {
          rearm(s, a);
          maintenance += cost;
        }
      }
      const plan = await compile({
        mode: 'Campaign',
        stage,
        seed: 'experience-audit',
        rank: s.rank,
        difficulty: 'Standard',
      });
      if (attempt === 1) {
        for (const type of policy) buy(s, type);
        pinIDs();
      }
      guidedLayout(s, stage ? plan.spawns[0]!.entrance : 0);
      if (stage === 4 && onBoss) await onBoss(structuredClone(s), plan);
      if (reinforceBoss && stage === 4 && !s.stages.includes(4)) {
        for (const type of [
          s.rank >= 7 ? 'friendly.rotary' : 'friendly.sentry',
          s.rank >= 6 ? 'friendly.heavy_squad' : 'friendly.rifle_squad',
        ])
          buy(s, type);
        for (const type of bossExtras) buy(s, type);
        pinIDs();
        guidedLayout(s, plan.spawns[0]!.entrance);
      }
      const battle = await FullBattle.create(s, plan),
        started = performance.now();
      let slowestTick = 0;
      while (!battle.outcome && !battle.needsRecovery && battle.tick < (plan.duration + 180) * 60) {
        const t = performance.now();
        battle.step();
        slowestTick = Math.max(slowestTick, performance.now() - t);
      }
      if (!battle.outcome)
        throw Error(
          `Unresolved ${doctrine}/${stage}: ${battle
            .alive(1)
            .map((e) => `${e.d.id}@${e.x / 1024},${e.y / 1024}`)
            .join(';')}`,
        );
      const result = priceResult(
        s,
        battle.result(`audit-${doctrine}-${attempt}`, String(attempt + 1)),
      );
      s.sequence = String(attempt + 1);
      claimResult(s, result);
      const row = {
        doctrine,
        attempt: attempt + 1,
        stage,
        repeat: stage !== next,
        before,
        after: { rank: s.rank, credits: s.credits },
        outcome: result.outcome,
        corePercent: Math.round(result.coreHP / 102400),
        wrecks: result.wrecks,
        maintenance,
        reward: Number(result.credits),
        seconds: result.seconds,
        simulationMs: Math.round(performance.now() - started),
        slowestTickMs: Math.round(slowestTick),
      };
      runs.push(row);
      console.log(JSON.stringify(row));
      if (result.outcome === 'Defeat') break;
    }
  }
  return {
    method:
      'Standard; fixed identities; legal guided force; affordable maintenance; face disclosed fronts; purchase policy after tutorial; first six attempts or defeat. Not an optimal strategy or universal balance certification.',
    policy,
    reinforceBoss,
    bossExtras,
    runs,
  };
}
