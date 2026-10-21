import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { chromium } from '@playwright/test';
const root = resolve(process.env.RB_PERF_DIST || '.cache/performance-dist'),
  port = Number(process.env.RB_PERF_PORT || 4175),
  mime = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.ogg': 'audio/ogg',
  };
const server = createServer(async (req, res) => {
  try {
    const relative = decodeURIComponent(new URL(req.url, 'http://localhost').pathname).replace(
        /^\/Project-Rando\//,
        '',
      ),
      file = resolve(root, relative || 'index.html');
    if (!file.startsWith(root + '/')) throw Error('Path');
    res.setHeader('Content-Type', mime[extname(file)] || 'application/octet-stream');
    res.end(await readFile(file));
  } catch {
    res.statusCode = 404;
    res.end('Not found');
  }
});
await new Promise((r) => server.listen(port, '127.0.0.1', r));
const browser = await chromium.launch({
    executablePath: '/usr/bin/chromium',
    args: ['--no-sandbox'],
  }),
  context = await browser.newContext({ viewport: { width: 800, height: 1280 }, hasTouch: true }),
  page = await context.newPage(),
  client = await context.newCDPSession(page),
  errors = [],
  runs = [];
page.on('pageerror', (e) => errors.push(e.message));
async function monitor() {
  await page.evaluate(() => {
    window.rbMeasure = { frames: [], longTasks: [], last: performance.now() };
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) window.rbMeasure.longTasks.push(e.duration);
    }).observe({ type: 'longtask', buffered: false });
    function frame(now) {
      const m = window.rbMeasure;
      m.frames.push(now - m.last);
      if (m.frames.length > 10000) m.frames.shift();
      m.last = now;
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  });
}
async function sample() {
  return page.evaluate(() => {
    const m = window.rbMeasure,
      a = m.frames.splice(0).sort((a, b) => a - b),
      l = m.longTasks.splice(0);
    return {
      frames: a.length,
      medianFrameMs: a[Math.floor(a.length * 0.5)] ?? null,
      p95FrameMs: a[Math.floor(a.length * 0.95)] ?? null,
      maxFrameMs: a.at(-1) ?? null,
      longTasks: l.length,
      maxLongTaskMs: Math.max(0, ...l),
    };
  });
}
try {
  await page.goto(`http://127.0.0.1:${port}/Project-Rando/`);
  await page.getByRole('button', { name: 'New game', exact: true }).click();
  await page.getByRole('button', { name: 'Create Bastion', exact: true }).click();
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await monitor();
  await page.waitForTimeout(10000);
  runs.push({ phase: 'Preparation', cpuThrottle: 1, ...(await sample()) });
  await page.addScriptTag({ path: '.cache/full-browser/fixture.js' });
  await page.evaluate(() => window.RBFullFixture.seed(true));
  await page.reload();
  await page.getByRole('button', { name: /^Continue ·/ }).click();
  await monitor();
  await page.getByRole('button', { name: 'Siege', exact: true }).click();
  await page.getByText('Other ways to play & difficulty', { exact: true }).click();
  await page.getByLabel('Mode', { exact: true }).selectOption('Calibration');
  await page.getByLabel('Enemy role', { exact: true }).selectOption('Carrier');
  await page.getByLabel('Count', { exact: true }).fill('24');
  await page.getByLabel('Variant', { exact: true }).selectOption('Apex');
  await client.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const start = Date.now(),
    deadline = start + Number(process.env.RB_STRESS_MS || 600000);
  let cycles = 0;
  while (Date.now() < deadline) {
    await page.getByRole('button', { name: 'Review forecast', exact: true }).click();
    await page.getByRole('button', { name: 'Start practice', exact: true }).click();
    await page.locator('[data-system="speed"]').click();
    await page.locator('[data-system="speed"]').click();
    let stopped = false;
    for (let i = 0; i < 30 && !stopped; i++) {
      await page.waitForTimeout(1000);
      if (await page.getByRole('button', { name: 'Return to base', exact: true }).isVisible())
        stopped = true;
      else if (await page.getByRole('button', { name: 'Resume', exact: true }).isVisible()) {
        if (
          await page.getByRole('button', { name: 'Restart checkpoint', exact: true }).isVisible()
        ) {
          await page.getByRole('button', { name: 'Withdraw', exact: true }).click();
          await page
            .locator('dialog')
            .getByRole('button', { name: 'Withdraw', exact: true })
            .click();
        } else await page.getByRole('button', { name: 'Resume', exact: true }).click();
      }
    }
    const endedByTest = !stopped;
    if (!stopped) {
      await page.getByRole('button', { name: 'Siege tools', exact: true }).click();
      await page.getByRole('button', { name: 'Withdraw', exact: true }).click();
      await page.locator('dialog').getByRole('button', { name: 'Withdraw', exact: true }).click();
      await page.getByRole('button', { name: 'Return to base', exact: true }).waitFor();
    }
    cycles++;
    const memory = await client.send('Runtime.getHeapUsage');
    runs.push({
      phase: 'Apex Carrier practice cycle',
      cycle: cycles,
      endedByTest,
      wallSeconds: (Date.now() - start) / 1000,
      cpuThrottle: 4,
      ...(await sample()),
      heapUsedBytes: memory.usedSize,
    });
    console.log(JSON.stringify(runs.at(-1)));
    await page.getByRole('button', { name: 'Return to base', exact: true }).click();
    await page.getByRole('button', { name: 'Siege', exact: true }).click();
  }
  if (errors.length) throw Error(errors.join(';'));
  const report = {
    build: '0.4.0-player-experience',
    method:
      'Desktop Chromium at 800x1280. Ten seconds preparation then at least ten minutes of repeated 24 Apex Carrier practice fights, with deliberate withdrawal after each approximately30second observation window at requested4x combat speed and DevTools4xCPU throttle. rAF cadence is a diagnostic, not physical GPU FPS or Lenovo certification. JS heap excludes graphics/audio memory and normal GC fluctuations are retained.',
    stressSeconds: (Date.now() - start) / 1000,
    cycles,
    errors,
    runs,
  };
  await mkdir('docs/evidence', { recursive: true });
  await writeFile(
    process.env.RB_PERF_OUTPUT || 'docs/evidence/experience-performance.json',
    JSON.stringify(report, null, 2) + '\n',
  );
} finally {
  await browser.close();
  server.close();
}
