import { writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';
const browser = await chromium.launch({
  executablePath: '/usr/bin/chromium',
  args: ['--no-sandbox'],
});
const runs = [],
  errors = [];
async function begin(page) {
  await page.evaluate(() => {
    window.rbNormalMeasure = { frames: [], longTasks: [], last: performance.now() };
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) window.rbNormalMeasure.longTasks.push(e.duration);
    }).observe({ type: 'longtask', buffered: false });
    function frame(now) {
      const m = window.rbNormalMeasure;
      m.frames.push(now - m.last);
      m.last = now;
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  });
}
async function observe(page, cpuThrottle, phase, milliseconds) {
  await page.evaluate(() => {
    window.rbNormalMeasure.frames = [];
    window.rbNormalMeasure.longTasks = [];
    window.rbNormalMeasure.last = performance.now();
  });
  const started = Date.now();
  await page.waitForTimeout(milliseconds);
  const metrics = await page.evaluate(() => {
    const m = window.rbNormalMeasure,
      a = m.frames.slice().sort((a, b) => a - b);
    return {
      samples: a.length,
      medianFrameMs: a[Math.floor(a.length / 2)],
      p95FrameMs: a[Math.floor(a.length * 0.95)],
      maxFrameMs: a.at(-1),
      longTasks: m.longTasks.length,
      maxLongTaskMs: Math.max(0, ...m.longTasks),
      combat: document.querySelector('#full-hud .hud-right span')?.textContent,
    };
  });
  const row = { cpuThrottle, phase, wallSeconds: (Date.now() - started) / 1000, ...metrics };
  runs.push(row);
  console.log(JSON.stringify(row));
}
try {
  for (const cpuThrottle of [1, 4]) {
    const context = await browser.newContext({
        viewport: { width: 800, height: 1280 },
        hasTouch: true,
      }),
      page = await context.newPage(),
      client = await context.newCDPSession(page);
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(process.env.RB_NORMAL_URL || 'http://127.0.0.1:4173/Project-Rando/');
    await page.getByRole('button', { name: 'New game', exact: true }).click();
    await page.getByRole('button', { name: 'Create Bastion', exact: true }).click();
    await page.getByRole('button', { name: 'Create', exact: true }).click();
    await page.waitForTimeout(1000);
    await client.send('Emulation.setCPUThrottlingRate', { rate: cpuThrottle });
    await begin(page);
    await observe(page, cpuThrottle, 'Preparation', 10000);
    if (cpuThrottle === 1 && process.env.RB_FIELD_CAPTURE)
      await page.screenshot({ path: process.env.RB_FIELD_CAPTURE });
    await page.getByRole('button', { name: 'Next siege →', exact: true }).click();
    if (cpuThrottle === 1 && process.env.RB_FORECAST_CAPTURE)
      await page.screenshot({ path: process.env.RB_FORECAST_CAPTURE });
    await page.getByRole('button', { name: 'Start siege', exact: true }).click();
    await page.getByRole('button', { name: 'Pause', exact: true }).waitFor();
    await observe(page, cpuThrottle, 'Tutorial at 1× speed', 30000);
    await context.close();
  }
  if (errors.length) throw Error(errors.join('; '));
  await writeFile(
    'docs/evidence/experience-normal-performance.json',
    JSON.stringify(
      {
        method:
          'Quiet sequential desktop Chromium observations at 800×1280: ten seconds preparation and thirty seconds ordinary first siege at 1× combat speed, separately with 1× and 4× DevTools CPU throttling. rAF cadence is not physical Lenovo GPU FPS. No other audit workload intentionally ran during this measurement.',
        errors,
        runs,
      },
      null,
      2,
    ) + '\n',
  );
} finally {
  await browser.close();
}
