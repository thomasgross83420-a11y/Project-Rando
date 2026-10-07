import { chromium } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
const browser = await chromium.launch({
  executablePath: '/usr/bin/chromium',
  args: ['--no-sandbox'],
});
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('http://127.0.0.1:5173/Project-Rando/tests/fixtures/audio-harness.html');
  await page.locator('#unlock').click();
  await page.waitForFunction(
    () => document.querySelector('#result')?.textContent?.startsWith('{'),
    {},
    { timeout: 30000 },
  );
  const result = JSON.parse(await page.locator('#result').textContent());
  if (result.error || errors.length) throw new Error(JSON.stringify({ result, errors }));
  await writeFile(
    '/workspace/shared/Resonance_Bastion_Gate2/audio-browser.json',
    JSON.stringify({ result, errors, browser: await browser.version() }, null, 2),
  );
  console.log(JSON.stringify(result));
} finally {
  await browser.close();
}
