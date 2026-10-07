import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import { preview } from 'vite';
const out = process.env.RB_RECOVERY_REVIEW_DIR ?? '/workspace/shared/Resonance_Bastion_Recovery';
await mkdir(out, { recursive: true });
const server = await preview({
  preview: { host: '127.0.0.1', port: 4174, strictPort: true },
  logLevel: 'error',
});
const browser = await chromium.launch({
  executablePath: '/usr/bin/chromium',
  args: ['--no-sandbox'],
});
try {
  const page = await browser.newPage({
      viewport: { width: 800, height: 1280 },
      hasTouch: true,
      deviceScaleFactor: 1,
    }),
    errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('http://127.0.0.1:4174/Project-Rando/');
  await page.getByRole('button', { name: 'New Game', exact: true }).click();
  await page.getByRole('button', { name: 'Create campaign', exact: true }).first().click();
  await page.getByLabel('Campaign name', { exact: true }).fill('Recovery Review');
  await page.getByRole('button', { name: 'Review Campaign', exact: true }).click();
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await page
    .getByRole('button', { name: 'Buy & Place Standard Barricade · 60 Credits', exact: true })
    .click();
  await page.getByLabel('X', { exact: true }).fill('18');
  await page.getByLabel('Y', { exact: true }).fill('18');
  await page.getByLabel('Y', { exact: true }).press('Tab');
  await page.getByRole('button', { name: 'Place', exact: true }).click();
  await page.locator('#account').filter({ hasText: '540 Credits' }).waitFor();
  await page
    .getByRole('button', { name: 'Data Management', exact: true })
    .filter({ visible: true })
    .click();
  await page.getByRole('heading', { name: 'Slot 1', exact: true }).waitFor();
  await page.locator('#dialog').screenshot({ path: `${out}/data-management.png` });
  await page.getByRole('button', { name: 'Prepare Backup', exact: true }).click();
  await page.getByRole('heading', { name: 'Backup ready', exact: true }).waitFor();
  const text = await page.locator('#prepared-backup').inputValue();
  await page.getByRole('button', { name: 'Download Backup', exact: true }).scrollIntoViewIfNeeded();
  await page.locator('#dialog').screenshot({ path: `${out}/backup-ready.png` });
  await page.getByText('Paste backup text instead', { exact: true }).click();
  await page.locator('#backup-text').fill(text);
  await page.getByRole('button', { name: 'Review Import', exact: true }).click();
  await page
    .getByRole('button', { name: 'Confirm Replace Selected Slots', exact: true })
    .scrollIntoViewIfNeeded();
  await page.locator('#dialog').screenshot({ path: `${out}/import-preview.png` });
  await page.getByRole('button', { name: 'Restore Previous · Slot 1', exact: true }).click();
  await page
    .getByRole('button', { name: 'Confirm Restore Previous', exact: true })
    .scrollIntoViewIfNeeded();
  await page.locator('#dialog').screenshot({ path: `${out}/restore-preview.png` });
  if (errors.length) throw new Error(errors.join('\n'));
  const versions = JSON.parse(await readFile('docs/versions.json', 'utf8'));
  await writeFile(
    `${out}/capture.json`,
    JSON.stringify(
      {
        build: versions.applicationBuild,
        browser: await browser.version(),
        viewport: { width: 800, height: 1280 },
        source:
          'Actual production preview; UI-created disposable example campaign; screenshots show visible dialog portions, not invented mockups',
        errors,
        mutations:
          'One real60 Credit barricade purchase; recovery actions previewed, no import/rollback applied; example is not player progress',
      },
      null,
      2,
    ) + '\n',
  );
  console.log(
    JSON.stringify({
      files: [
        'data-management.png',
        'backup-ready.png',
        'import-preview.png',
        'restore-preview.png',
      ],
      errors,
    }),
  );
} finally {
  await browser.close();
  await new Promise((resolve) => server.httpServer.close(resolve));
}
