import { expect, it } from 'vitest';
import {
  createCampaign,
  migrateProgression,
  validateCampaign,
  maximumBody,
  rankAllowances,
} from '../../src/persistence/campaign';
import { CampaignRepository } from '../../src/persistence/repository';
import { emptyFence, fenceSchema } from '../../src/persistence/fence';
import { createBackup, readBackup } from '../../src/persistence/backup';
import { sequenceSchema } from '../../src/persistence/sequence';
import { previewProgression } from '../../src/progression/preparation';
import { canonical } from '../../src/sim/determinism';
const required = <T>(v: T | undefined): T => {
  if (!v) throw new Error('Missing fixture');
  return v;
};
it('migrates explicitly without altering identities, money, wounds or deployments and preserves the previous save atomically', async () => {
  const repo = new CampaignRepository(undefined);
  await repo.acquire();
  const legacy = createCampaign('Migration', 0, 'Bastion', 'warden.bulwark');
  const rifle = required(legacy.assets.find((a) => a.type === 'friendly.rifle_squad'));
  rifle.hp -= 73 * 1024;
  rifle.placement = { x: 20, y: 20, rotation: 1 };
  await repo.commit(legacy, undefined);
  const migrated = migrateProgression(legacy);
  expect(legacy.schema).toBe(1);
  expect(migrated.revision).toBe(1);
  expect(migrated.credits).toBe(600);
  expect(
    migrated.assets.map(
      ({
        enhancementPaid: _e,
        permanentCharges: _p,
        refundLocked: _r,
        emergencyCreated: _c,
        ...a
      }) => a,
    ),
  ).toEqual(legacy.assets);
  repo.practiceSlots.add(0);
  await expect(repo.commit(migrated, legacy)).rejects.toThrow('run/practice');
  expect(repo.memory.get(0)).toEqual(legacy);
  repo.practiceSlots.delete(0);
  await repo.commit(migrated, legacy);
  expect(repo.memoryPrevious.get(0)).toEqual(legacy);
  expect(migrateProgression(migrated)).toEqual(migrated);
  const backup = await createBackup(
    [
      {
        campaign: migrated,
        previous: { campaign: legacy, fence: emptyFence(legacy.lineage) },
        fence: emptyFence(migrated.lineage),
        practice: null,
        practiceSequence: '0',
      },
    ],
    null,
  );
  expect((await readBackup(canonical(backup))).backup).toEqual(backup);
});
it('rejects contradictory levels, free paid tiers, fixed-object XP, invalid stock, rank and lifetime state', () => {
  const base = migrateProgression(createCampaign('Validation', 0, 'Bastion', 'warden.bulwark'));
  const change = (fn: (c: typeof base) => void) => {
    const c = structuredClone(base);
    fn(c);
    return c;
  };
  expect(() =>
    validateCampaign(
      change((c) => {
        required(c.assets.find((a) => a.type === 'friendly.sentry')).level = 2;
      }),
    ),
  ).toThrow('XP/level');
  expect(() =>
    validateCampaign(
      change((c) => {
        const a = required(c.assets.find((a) => a.type === 'friendly.sentry'));
        a.xp = 1502;
        a.level = 10;
        a.enhancement = 1;
      }),
    ),
  ).toThrow('investment');
  expect(() =>
    validateCampaign(
      change((c) => {
        const a = required(c.assets.find((a) => a.type === 'friendly.standard_barricade'));
        a.xp = 40;
        a.level = 2;
      }),
    ),
  ).toThrow('not implemented');
  expect(() =>
    validateCampaign(
      change((c) => {
        required(c.assets.find((a) => a.type === 'friendly.proximity_mine')).permanentCharges = 2;
      }),
    ),
  ).toThrow('stock');
  expect(() =>
    validateCampaign(
      change((c) => {
        c.accountXP = 100;
      }),
    ),
  ).toThrow('Rank progress');
  expect(() =>
    validateCampaign(
      change((c) => {
        c.lifetimeXP = '1';
      }),
    ),
  ).toThrow('Lifetime');
  expect(rankAllowances(1)).toEqual({ capacity: 20, barriers: 40, traps: 8 });
  expect(rankAllowances(100)).toEqual({ capacity: 120, barriers: 200, traps: 40 });
});
it('preserves living wounds and wrecks through paid enhancement; only explicit restore revives at half maximum', () => {
  const c = migrateProgression(createCampaign('Upgrade', 0, 'Bastion', 'warden.bulwark'));
  const a = required(c.assets.find((a) => a.type === 'friendly.sentry'));
  a.xp = 1502;
  a.level = 10;
  const old = maximumBody(a);
  a.hp = old - 101 * 1024;
  const q = previewProgression(c, { kind: 'enhance', id: a.id });
  const upgraded = required(q.after.assets.find((x) => x.id === a.id));
  expect(q.creditsSpent).toBe(100);
  expect(upgraded.enhancementPaid).toBe(100);
  expect(maximumBody(upgraded) - upgraded.hp).toBe(101 * 1024);
  expect(c.credits).toBe(600);
  a.hp = 0;
  const dead = previewProgression(c, { kind: 'enhance', id: a.id });
  expect(required(dead.after.assets.find((x) => x.id === a.id)).hp).toBe(0);
  expect(() =>
    previewProgression(dead.after, { kind: 'repair', id: a.id, requested: 1024 }),
  ).toThrow('Restore');
  const restore = previewProgression(dead.after, { kind: 'restore', id: a.id });
  expect(restore.creditsSpent).toBe(105);
  expect(required(restore.after.assets.find((x) => x.id === a.id)).hp).toBe(
    Math.ceil(maximumBody(required(dead.after.assets.find((x) => x.id === a.id))) / 2),
  );
});
it('charges body repair and stock rearm independently and cannot profit by enhancing and selling', () => {
  const c = migrateProgression(createCampaign('Costs', 0, 'Bastion', 'warden.bulwark'));
  const mine = required(c.assets.find((a) => a.type === 'friendly.proximity_mine'));
  mine.permanentCharges = 0;
  const q = previewProgression(c, { kind: 'rearm', id: mine.id, requested: 1 });
  expect(q.creditsSpent).toBe(19);
  expect(required(q.after.assets.find((a) => a.id === mine.id)).hp).toBe(200 * 1024);
  mine.hp = 0;
  expect(() => previewProgression(c, { kind: 'rearm', id: mine.id, requested: 1 })).toThrow(
    'Restore',
  );
  c.coreHP = 0;
  const core = previewProgression(c, { kind: 'repair-core', requested: 1 });
  expect(core.after.coreHP).toBe(1);
  expect(core.creditsSpent).toBe(1);
  const a = required(c.assets.find((a) => a.type === 'friendly.sentry'));
  a.xp = 1502;
  a.level = 10;
  a.hp = maximumBody(a);
  const e = previewProgression(c, { kind: 'enhance', id: a.id });
  const s = previewProgression(e.after, { kind: 'sell', id: a.id });
  expect(s.creditsRefunded).toBe('237');
  expect(s.after.credits).toBe(737);
  expect(s.after.credits - c.credits).toBeLessThan(250);
  const poor = { ...c, credits: 0 };
  expect(() => previewProgression(poor, { kind: 'enhance', id: a.id })).toThrow('Insufficient');
  expect(c.credits).toBe(600);
});
it('caps every sequence reader at unsigned 64-bit rather than accepting any 20-digit value', () => {
  expect(sequenceSchema.parse('18446744073709551615')).toBe('18446744073709551615');
  for (const x of ['18446744073709551616', '99999999999999999999', '01', '-1']) {
    expect(() => sequenceSchema.parse(x)).toThrow();
    expect(() => fenceSchema.parse({ ...emptyFence(crypto.randomUUID()), allocated: x })).toThrow();
  }
});
