import { expect, test, type Page } from '@playwright/test';
import type * as Fixture from '../../scripts/run-journal-fixture';
type Session = Awaited<ReturnType<typeof Fixture.productionSetup>>;
declare global {
  interface Window {
    resultHarness: {
      session: Session;
      result: Awaited<ReturnType<typeof Fixture.productionPending>> | undefined;
    };
  }
}
async function initialize(page: Page, create = true, pending = true) {
  await page.goto('./');
  await page.addScriptTag({ path: '.cache/run-journal-browser/fixture.js' });
  await page.evaluate(
    async ({ create, pending }) => {
      const session = await window.RBRunFixture.productionSetup(create);
      window.resultHarness = {
        session,
        result: pending ? await window.RBRunFixture.productionPending(session) : undefined,
      };
    },
    { create, pending },
  );
}
test('native IndexedDB preserves a real pending result across reload and a backup imported into a different slot', async ({
  page,
  browser,
}) => {
  await initialize(page);
  const text = await page.evaluate(async () =>
    JSON.stringify(await window.resultHarness.session.backup.export([0], null)),
  );
  await page.reload();
  await page.addScriptTag({ path: '.cache/run-journal-browser/fixture.js' });
  const resumed = await page.evaluate(async () => {
    const s = await window.RBRunFixture.productionSetup(),
      c = s.campaign;
    if (!c) throw new Error('Missing');
    const state = await s.journal.read(c);
    return {
      sequence: state?.checkpoint.runID.sequence,
      pending: !!state?.pending,
      credits: c.credits,
    };
  });
  expect(resumed).toEqual({ sequence: '1', pending: true, credits: 600 });
  const context = await browser.newContext(),
    destination = await context.newPage();
  await initialize(destination, false, false);
  const imported = await destination.evaluate(async (text) => {
    const s = window.resultHarness.session,
      backup = (await window.RBRunFixture.readBackup(text)).backup;
    await s.backup.replace(backup, [{ source: 0, destination: 2 }], await s.backup.inspect());
    const c = (await s.repo.slots())[2];
    if (!c || c instanceof Error) throw new Error('Missing import');
    const state = await s.journal.read(c);
    if (!state?.pending) throw new Error('Missing pending');
    const first = await s.journal.finalize(state.checkpoint, state.pending),
      second = await s.journal.finalize(state.checkpoint, state.pending);
    const after = (await s.repo.slots())[2];
    if (!after || after instanceof Error) throw new Error('Missing result');
    const finalized = await s.backup.export([2], null),
      exported = finalized.slots[0];
    if (!exported || !('receipts' in exported)) throw new Error('Missing exported receipts');
    return {
      slot: after.slot,
      revision: after.revision,
      credits: after.credits,
      expected: state.pending.after.credits,
      first,
      second,
      unpresented: !!(await s.journal.unpresented(2)),
      exportedReceipts: exported.receipts.receipts.length,
      exportedUnpresented: exported.receipts.unpresented,
      retainedRun: (await s.repo.database?.read('meta', 'run.slot.2')) ?? null,
    };
  }, text);
  expect(imported.slot).toBe(2);
  expect(imported.revision).toBe(3);
  expect(imported.credits).toBe(imported.expected);
  expect(imported.first).toEqual(imported.second);
  expect(imported.unpresented).toBe(true);
  expect(imported.exportedReceipts).toBe(1);
  expect(imported.exportedUnpresented?.sequence).toBe('1');
  expect(imported.retainedRun).toBeNull();
  await context.close();
});
test('an abort while importing the paid checkpoint rolls back every store and the exact same preview can retry', async ({
  page,
  browser,
}) => {
  await initialize(page);
  const text = await page.evaluate(async () =>
    JSON.stringify(await window.resultHarness.session.backup.export([0], null)),
  );
  const context = await browser.newContext(),
    destination = await context.newPage();
  await initialize(destination, false, false);
  const result = await destination.evaluate(async (text) => {
    const s = window.resultHarness.session,
      backup = (await window.RBRunFixture.readBackup(text)).backup,
      before = await s.backup.inspect(),
      put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (value, key) {
      if (this.name === 'meta' && key === 'run.slot.0')
        throw new DOMException('Injected checkpoint failure', 'QuotaExceededError');
      return put.call(this, value, key);
    };
    let error = '';
    try {
      await s.backup.replace(backup, [{ source: 0, destination: 0 }], before);
    } catch (e) {
      error = String(e);
    } finally {
      IDBObjectStore.prototype.put = put;
    }
    const after = await s.backup.inspect();
    await s.backup.replace(backup, [{ source: 0, destination: 0 }], before);
    const c = (await s.repo.slots())[0];
    if (!c || c instanceof Error) throw new Error('Missing retry');
    return {
      error,
      before,
      after,
      pending: !!(await s.journal.read(c))?.pending,
      credits: c.credits,
    };
  }, text);
  expect(result.error).toContain('Injected checkpoint failure');
  expect(result.after).toEqual(result.before);
  expect(result.pending).toBe(true);
  expect(result.credits).toBe(600);
  await context.close();
});
test('a real result commit abort leaves its exact pending journal and wallet intact, then retry pays once', async ({
  page,
}) => {
  await initialize(page);
  const result = await page.evaluate(async () => {
    const { session: s, result: r } = window.resultHarness;
    if (!r) throw new Error('Missing pending');
    const before = await s.backup.inspect(),
      put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (value, key) {
      if (this.name === 'meta' && key === 'receipts.slot.0')
        throw new DOMException('Injected receipt failure', 'QuotaExceededError');
      return put.call(this, value, key);
    };
    let error = '';
    try {
      await s.journal.finalize(r.cp, r.pending);
    } catch (e) {
      error = String(e);
    } finally {
      IDBObjectStore.prototype.put = put;
    }
    const after = await s.backup.inspect(),
      first = await s.journal.finalize(r.cp, r.pending),
      second = await s.journal.finalize(r.cp, r.pending);
    const c = (await s.repo.slots())[0];
    if (!c || c instanceof Error) throw new Error('Missing result');
    return {
      before,
      after,
      error,
      first,
      second,
      credits: c.credits,
      expected: r.pending.after.credits,
    };
  });
  expect(result.error).toContain('Injected receipt failure');
  expect(result.after).toEqual(result.before);
  expect(result.first).toEqual(result.second);
  expect(result.credits).toBe(result.expected);
});
