import { expect, test, type Page } from '@playwright/test';
import type * as Fixture from '../../scripts/run-journal-fixture';
import type { RunCheckpoint, PendingResult } from '../../src/persistence/run-journal';
interface Harness {
  api: typeof Fixture;
  session: Awaited<ReturnType<typeof Fixture.setup>>;
  cp: RunCheckpoint | undefined;
  pending: PendingResult | undefined;
}
declare global {
  interface Window {
    RBRunFixture: typeof Fixture;
    runHarness: Harness;
  }
}
async function init(page: Page, create = true) {
  await page.goto('./?legacy=1');
  await page.addScriptTag({ path: '.cache/run-journal-browser/fixture.js' });
  await page.evaluate(async (create) => {
    const api = window.RBRunFixture,
      session = await api.setup();
    const state = await session.store.read(session.campaign);
    const cp =
      state?.checkpoint ??
      (create
        ? await session.store.start(session.campaign, api.fixturePlan, api.fixtureFrozen)
        : undefined);
    window.runHarness = {
      api,
      session,
      cp,
      pending:
        state?.pending ??
        (cp ? await session.store.buildPending(cp, api.fixtureTerminal) : undefined),
    };
  }, create);
}
async function retained(page: Page) {
  return page.evaluate(async () => {
    const db = window.runHarness.session.repo.database;
    if (!db) throw new Error('Native database required');
    return {
      campaign: await db.read('campaigns', 0),
      previous: await db.read('previous', 0),
      run: await db.read('meta', 'run.slot.0'),
      receipt: await db.read('meta', 'receipts.slot.0'),
      fence: await db.read('meta', `fence.${window.runHarness.session.campaign.lineage}`),
    };
  });
}
test('native preflight failure rolls back checkpoint and allocation; exact retry starts sequence one', async ({
  page,
}) => {
  await init(page, false);
  const before = await retained(page);
  const result = await page.evaluate(async () => {
    const h = window.runHarness;
    const original = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (value, key) {
      if (this.name === 'meta' && key === 'run.slot.0')
        throw new DOMException('Injected preflight quota', 'QuotaExceededError');
      return original.call(this, value, key);
    };
    let message = '';
    try {
      await h.session.store.start(h.session.campaign, h.api.fixturePlan, h.api.fixtureFrozen);
    } catch (e) {
      message = String(e);
    } finally {
      IDBObjectStore.prototype.put = original;
    }
    return message;
  });
  expect(result).toContain('QuotaExceededError');
  expect(await retained(page)).toEqual(before);
  expect(
    await page.evaluate(async () => {
      const h = window.runHarness;
      return (
        await h.session.store.start(h.session.campaign, h.api.fixturePlan, h.api.fixtureFrozen)
      ).runID.sequence;
    }),
  ).toBe('1');
});
test('Step 1 failure keeps only durable checkpoint, offers exact in-memory recovery and retry survives reopen', async ({
  page,
}) => {
  await init(page);
  const before = await retained(page);
  const result = await page.evaluate(async () => {
    const h = window.runHarness;
    const original = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (value, key) {
      if (this.name === 'meta' && key === 'run.slot.0')
        throw new DOMException('Injected journal quota', 'QuotaExceededError');
      return original.call(this, value, key);
    };
    if (!h.cp || !h.pending) throw new Error('Missing prepared run');
    let failed = false;
    try {
      await h.session.store.journal(h.cp, h.pending);
    } catch {
      failed = true;
    } finally {
      IDBObjectStore.prototype.put = original;
    }
    return { failed, bundle: JSON.parse(await h.session.store.exportPending(h.cp, h.pending)) };
  });
  expect(result.failed).toBe(true);
  expect(await retained(page)).toEqual(before);
  expect(result.bundle.pending.after.credits).toBe(637);
  await page.evaluate(async () => {
    const h = window.runHarness;
    if (!h.cp || !h.pending) throw new Error('Missing prepared run');
    await h.session.store.journal(h.cp, h.pending);
  });
  const journaled = await retained(page);
  await init(page);
  expect(await retained(page)).toEqual(journaled);
  expect(await page.evaluate(() => window.runHarness.pending?.checksum)).toBe(
    result.bundle.pending.checksum,
  );
});
test('Step 2 abort after queued body/wallet writes leaves every store unchanged, then exact retry commits once', async ({
  page,
}) => {
  await init(page);
  await page.evaluate(async () => {
    const h = window.runHarness;
    if (!h.cp || !h.pending) throw new Error('Missing prepared run');
    await h.session.store.journal(h.cp, h.pending);
  });
  const before = await retained(page);
  const failed = await page.evaluate(async () => {
    const h = window.runHarness;
    const original = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (value, key) {
      if (this.name === 'meta' && key === 'receipts.slot.0')
        throw new DOMException('Injected receipt quota', 'QuotaExceededError');
      return original.call(this, value, key);
    };
    if (!h.cp || !h.pending) throw new Error('Missing prepared run');
    try {
      await h.session.store.finalize(h.cp, h.pending);
      return false;
    } catch {
      return true;
    } finally {
      IDBObjectStore.prototype.put = original;
    }
  });
  expect(failed).toBe(true);
  expect(await retained(page)).toEqual(before);
  await page.evaluate(async () => {
    const h = window.runHarness;
    if (!h.cp || !h.pending) throw new Error('Missing prepared run');
    await h.session.store.finalize(h.cp, h.pending);
    await h.session.store.finalize(h.cp, h.pending);
  });
  const saved = await retained(page);
  expect(saved.campaign).toMatchObject({ credits: 637, revision: 1 });
  expect(saved.previous).toEqual(before.campaign);
  expect(saved.run).toBeUndefined();
  expect(saved.fence).toMatchObject({ allocated: '1', finalized: '1', campaign: ['C01S01'] });
  expect(saved.receipt).toMatchObject({
    receipts: [{ pendingChecksum: await page.evaluate(() => window.runHarness.pending?.checksum) }],
  });
});
test('lost commit acknowledgment reconciles a durable receipt after reopen without applying rewards again', async ({
  page,
}) => {
  await init(page);
  const recovery = await page.evaluate(async () => {
    const h = window.runHarness;
    if (!h.cp || !h.pending) throw new Error('Missing prepared run');
    await h.session.store.journal(h.cp, h.pending);
    const db = h.session.repo.database,
      original = db?.transaction.bind(db);
    if (!db || !original) throw new Error('Native database required');
    db.transaction = async (...args) => {
      const value = await original(...args);
      if (args[0].includes('previous') && args[1] === 'readwrite')
        throw new Error('Injected acknowledgment lost');
      return value;
    };
    if (!h.cp || !h.pending) throw new Error('Missing prepared run');
    let failed = false;
    if (!h.cp || !h.pending) throw new Error('Missing prepared run');
    try {
      await h.session.store.finalize(h.cp, h.pending);
    } catch {
      failed = true;
    } finally {
      db.transaction = original;
    }
    return { failed, cp: h.cp, pending: h.pending };
  });
  expect(recovery.failed).toBe(true);
  expect((await retained(page)).campaign).toMatchObject({ credits: 637 });
  await init(page, false);
  const result = await page.evaluate(async ({ cp, pending }) => {
    const h = window.runHarness;
    if (!cp || !pending) throw new Error('Missing recovered pending');
    const committed = await h.session.store.finalize(cp, pending);
    return { committed, unpresented: await h.session.store.unpresented(0) };
  }, recovery);
  expect(result.committed.status).toBe('committed');
  expect(result.unpresented?.runID).toEqual(recovery.cp.runID);
  expect((await retained(page)).campaign).toMatchObject({ credits: 637, revision: 1 });
});
test('writer takeover rejects stale result application while the new owner can retry the pinned pending result', async ({
  page,
}) => {
  await init(page);
  await page.evaluate(async () => {
    const h = window.runHarness;
    if (!h.cp || !h.pending) throw new Error('Missing prepared run');
    await h.session.store.journal(h.cp, h.pending);
  });
  const before = await retained(page);
  const stale = await page.evaluate(async () => {
    const h = window.runHarness,
      newRepo = new h.api.CampaignRepository(h.session.repo.database);
    await newRepo.acquire(true);
    if (!h.cp || !h.pending) throw new Error('Missing prepared run');
    try {
      await h.session.store.finalize(h.cp, h.pending);
      return '';
    } catch (e) {
      return String(e);
    }
  });
  expect(stale).toContain('writer changed');
  expect(await retained(page)).toEqual(before);
  await init(page);
  await page.evaluate(async () => {
    const h = window.runHarness;
    if (!h.cp || !h.pending) throw new Error('Missing prepared run');
    await h.session.store.finalize(h.cp, h.pending);
  });
  expect((await retained(page)).campaign).toMatchObject({ credits: 637 });
});
test('active runs block preparation edits and current unsupported journals block backup rather than omit state', async ({
  page,
}) => {
  await init(page);
  const before = await retained(page);
  const error = await page.evaluate(async () => {
    const h = window.runHarness;
    if (!h.cp || !h.pending) throw new Error('Missing prepared run');
    try {
      await h.session.repo.commit({ ...h.session.campaign, revision: 1 }, h.session.campaign);
      return '';
    } catch (e) {
      return String(e);
    }
  });
  expect(error).toContain('abort');
  expect(await retained(page)).toEqual(before);
  await page.getByRole('button', { name: 'Data Management', exact: true }).click();
  await page.getByRole('button', { name: 'Prepare Backup', exact: true }).click();
  await expect(page.locator('#data-message')).toContainText('Unsupported retained logical state');
  expect(await retained(page)).toEqual(before);
});
test('competing preflights and result writers cannot allocate or finalize a duplicate attempt', async ({
  page,
}) => {
  await init(page, false);
  const first = await page.evaluate(async () => {
    const h = window.runHarness,
      a = h.session.store,
      b = new h.api.RunJournalStore(h.session.repo, h.api.fixtureRules);
    const results = await Promise.allSettled([
      a.start(h.session.campaign, h.api.fixturePlan, h.api.fixtureFrozen),
      b.start(h.session.campaign, h.api.fixturePlan, h.api.fixtureFrozen),
    ]);
    return results.map((r) => r.status);
  });
  expect(first.filter((r) => r === 'fulfilled')).toHaveLength(1);
  expect(first.filter((r) => r === 'rejected')).toHaveLength(1);
  await init(page);
  const final = await page.evaluate(async () => {
    const h = window.runHarness;
    if (!h.cp || !h.pending) throw new Error('Missing prepared run');
    await h.session.store.journal(h.cp, h.pending);
    const second = new h.api.RunJournalStore(h.session.repo, h.api.fixtureRules);
    const results = await Promise.allSettled([
      h.session.store.finalize(h.cp, h.pending),
      second.finalize(h.cp, h.pending),
    ]);
    const reconciled = await second.finalize(h.cp, h.pending);
    return { statuses: results.map((r) => r.status), reconciled: reconciled.status };
  });
  expect(final.statuses.filter((r) => r === 'fulfilled').length).toBeGreaterThanOrEqual(1);
  expect(final.reconciled).toBe('committed');
  expect((await retained(page)).campaign).toMatchObject({ credits: 637, revision: 1 });
});
test('ordinary preflight and tutorial practice mutually exclude each other inside the native write boundary', async ({
  page,
}) => {
  await init(page, false);
  const result = await page.evaluate(async () => {
    const h = window.runHarness,
      practice = new h.api.PracticeStore(h.session.repo);
    const outcomes = await Promise.allSettled([
      h.session.store.start(h.session.campaign, h.api.fixturePlan, h.api.fixtureFrozen),
      practice.start(h.session.campaign, h.api.practiceArmy(h.session.campaign)),
    ]);
    const db = h.session.repo.database;
    if (!db) throw new Error('Native database required');
    return {
      statuses: outcomes.map((r) => r.status),
      run: (await db.read('meta', 'run.slot.0')) !== undefined,
      practice: (await db.read('meta', 'practice.slot.0')) !== undefined,
    };
  });
  expect(result.statuses.filter((r) => r === 'fulfilled')).toHaveLength(1);
  expect(Number(result.run) + Number(result.practice)).toBe(1);
});
