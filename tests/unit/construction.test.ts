import { foundation } from '../../src/data/foundation';
import { expect, test } from 'vitest';
import {
  createCampaign,
  applyCommand,
  validateCampaign,
  accounting,
} from '../../src/persistence/campaign';
import { edgeClear, validateRoutes } from '../../src/construction/geometry';
import { Preparation, CampaignRepository } from '../../src/persistence/repository';
test('starter grants, exact wallet, empty field and selected Warden are authoritative', () => {
  for (const [doctrine, capacity] of [
    ['Bastion', 9],
    ['Mobile', 11],
    ['Chokepoint', 7],
  ] as const) {
    const c = createCampaign('Test', 0, doctrine, 'warden.bulwark');
    expect(c.credits).toBe(600);
    expect(c.assets.every((a) => !a.placement && a.paidCredits === 0 && a.stars === 1)).toBe(true);
    expect(accounting(c).capacity).toBe(0);
    expect(c.assets.filter((a) => a.type === 'friendly.sentry').length).toBe(
      doctrine === 'Bastion' ? 2 : 1,
    );
    expect(c.assets.reduce((n, a) => n + foundation[a.type].capacity, 0)).toBe(capacity);
  }
  expect(() => createCampaign(' bad\nname ', 0, 'Bastion', 'warden.bulwark')).toThrow();
  expect(() => createCampaign('Test\t', 0, 'Bastion', 'warden.bulwark')).toThrow();
  expect(() => createCampaign('x'.repeat(33), 0, 'Bastion', 'warden.bulwark')).toThrow();
});
test('placement validates precinct, pad, purchased land, occupancy and never charges rejection', () => {
  const c = createCampaign('Test', 0, 'Bastion', 'warden.bulwark');
  const sentry = c.assets.find((a) => a.type === 'friendly.sentry');
  if (!sentry) throw new Error('Missing starter');
  for (const [x, y] of [
    [27, 27],
    [29, 33],
    [11, 20],
    [47, 20],
    [20.5, 20],
  ])
    expect(() =>
      applyCommand(c, {
        kind: 'buy-place',
        type: 'friendly.sentry',
        x: x ?? 0,
        y: y ?? 0,
        rotation: 0,
      }),
    ).toThrow();
  expect(c.credits).toBe(600);
  expect(c.assets.every((a) => !a.placement)).toBe(true);
  const placed = applyCommand(c, { kind: 'place', id: sentry.id, x: 18, y: 18, rotation: 0 });
  expect(placed.credits).toBe(600);
  expect(accounting(placed).capacity).toBe(2);
  expect(() =>
    applyCommand(placed, {
      kind: 'buy-place',
      type: 'friendly.standard_barricade',
      x: 19,
      y: 19,
      rotation: 0,
    }),
  ).toThrow(/overlap/);
  const bought = applyCommand(placed, {
    kind: 'buy-place',
    type: 'friendly.standard_barricade',
    x: 22,
    y: 18,
    rotation: 0,
  });
  expect(bought.credits).toBe(540);
  expect(bought.assets.at(-1)?.paidCredits).toBe(60);
  const bad = structuredClone(c);
  const duplicate = bad.assets[0];
  if (!duplicate) throw new Error('Starter missing');
  bad.assets.push({ ...duplicate });
  expect(() => validateCampaign(bad)).toThrow(/Duplicate/);
});
test('continuous clearance rejects corner squeeze and accepts touching without penetration', () => {
  const wall = { x: 1024, y: 1024, width: 1024, height: 1024 };
  expect(edgeClear({ x: 60928, y: 1024 }, { x: 60928, y: 1024 }, 512, [])).toBe(true);
  expect(edgeClear({ x: 61440, y: 1024 }, { x: 61440, y: 1024 }, 0, [])).toBe(false);
  expect(edgeClear({ x: 512, y: 2048 }, { x: 1024, y: 2560 }, 512, [wall])).toBe(false);
  expect(edgeClear({ x: 512, y: 1024 }, { x: 512, y: 2048 }, 512, [wall])).toBe(true);
  expect(validateRoutes([], [461, 768, 1229])).toBeUndefined();
  expect(
    validateRoutes([
      { x: 26, y: 26, width: 8, height: 1 },
      { x: 26, y: 33, width: 8, height: 1 },
      { x: 26, y: 27, width: 1, height: 6 },
      { x: 33, y: 27, width: 1, height: 6 },
    ]),
  ).toContain('no radius');
});
test('Undo/Redo writes exact owned state and wallet, not refunds, and new edit clears redo', async () => {
  const repository = new CampaignRepository(undefined);
  await repository.acquire();
  const c = createCampaign('Test', 0, 'Bastion', 'warden.bulwark');
  await repository.commit(c, undefined);
  const p = new Preparation(repository, c);
  await p.commit(
    applyCommand(c, { kind: 'buy-place', type: 'friendly.sentry', x: 18, y: 18, rotation: 0 }),
  );
  expect(p.campaign.credits).toBe(350);
  const id = p.campaign.assets.at(-1)?.id;
  await p.history('undo');
  expect(p.campaign.credits).toBe(600);
  expect(p.campaign.assets.some((a) => a.id === id)).toBe(false);
  await p.history('redo');
  expect(p.campaign.credits).toBe(350);
  expect(p.campaign.assets.at(-1)?.id).toBe(id);
  await p.history('undo');
  await p.commit(
    applyCommand(p.campaign, {
      kind: 'buy-place',
      type: 'friendly.standard_barricade',
      x: 22,
      y: 22,
      rotation: 0,
    }),
  );
  expect(p.redoStack).toHaveLength(0);
  await repository.opened(0);
  expect(await repository.lastOpened()).toBe(0);
});

test('storage-key mismatch is damaged data and cannot be opened as another slot', async () => {
  const repository = new CampaignRepository(undefined);
  await repository.acquire();
  const wrong = createCampaign('Wrong key', 1, 'Bastion', 'warden.bulwark');
  repository.memory.set(0, wrong);
  const slots = await repository.slots();
  expect(slots[0]).toBeInstanceOf(Error);
  expect(slots[1]).toBeUndefined();
  expect(repository.memory.get(0)).toEqual(wrong);
});
