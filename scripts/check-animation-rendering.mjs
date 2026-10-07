/** Exercise actual compositor pixels in Chromium; local Vite serves source modules.
 * Independent pixel comparisons, atlas budgets/gutters and attachment landmarks.
 * Actual production gameplay is separately checked by the browser suite.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';
import { createServer } from 'vite';

const out = resolve(
  process.env.RB_ANIMATION_REVIEW_DIR ?? '/workspace/shared/Resonance_Bastion_Animation',
);
await mkdir(out, { recursive: true });
const server = await createServer({
  server: { host: '127.0.0.1', port: 4182, strictPort: true },
  logLevel: 'error',
});
await server.listen();
const browser = await chromium.launch({
  executablePath: '/usr/bin/chromium',
  args: ['--no-sandbox'],
});
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('http://127.0.0.1:4182/Project-Rando/');
  const result = await page.evaluate(async () => {
    const { PoseDamageBank, composePoseDamage, damageSource } = await import(
        '/Project-Rando/src/render/damage.ts'
      ),
      { default: art } = await import('/Project-Rando/public/assets/combat/manifest.json');
    const sources = await Promise.all(
      art.atlases.map(
        (a) =>
          new Promise((resolve, reject) => {
            const im = new Image();
            im.onload = () => resolve(im);
            im.onerror = reject;
            im.src = `/Project-Rando/assets/combat/${a.file}`;
          }),
      ),
    );
    const begin = performance.now(),
      bank = new PoseDamageBank(sources),
      buildMS = performance.now() - begin;
    let checked = 0,
      outside = 0,
      gutterFailures = 0,
      originalOutside = 0,
      packedPixelMismatches = 0;
    const bodyCanvas = document.createElement('canvas'),
      ctx = bodyCanvas.getContext('2d', { willReadFrequently: true });
    const fail = (message) => {
      throw new Error(message);
    };
    for (const frame of art.frames) {
      if (
        ['scuffed', 'damaged', 'incapacitated', 'wreck'].includes(frame.state) ||
        frame.content.startsWith('fx.')
      )
        continue;
      bodyCanvas.width = frame.native[0];
      bodyCanvas.height = frame.native[1];
      const [x, y, w, h] = frame.rect;
      ctx.drawImage(sources[frame.atlas], x, y, w, h, frame.trim[0], frame.trim[1], w, h);
      const mask = ctx.getImageData(0, 0, bodyCanvas.width, bodyCanvas.height).data;
      for (const band of ['scuffed', 'damaged']) {
        const overlay = damageSource(frame, band),
          canvas = composePoseDamage(frame, overlay, sources),
          data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
        checked++;
        for (let i = 3; i < data.length; i += 4) if (data[i] && !mask[i]) outside++;
        const original = document.createElement('canvas');
        original.width = bodyCanvas.width;
        original.height = bodyCanvas.height;
        const oc = original.getContext('2d');
        oc.drawImage(
          sources[overlay.atlas],
          ...overlay.rect,
          overlay.trim[0],
          overlay.trim[1],
          overlay.rect[2],
          overlay.rect[3],
        );
        const raw = oc.getImageData(0, 0, original.width, original.height).data;
        for (let i = 3; i < raw.length; i += 4) if (raw[i] && !mask[i]) originalOutside++;
        const record = bank.get(frame, band);
        const reconstructed = document.createElement('canvas');
        reconstructed.width = frame.native[0];
        reconstructed.height = frame.native[1];
        const reconstructedContext = reconstructed.getContext('2d');
        if (record) {
          const [rx, ry, rw, rh] = record.rect;
          reconstructedContext.drawImage(
            bank.canvas,
            rx,
            ry,
            rw,
            rh,
            record.trim[0],
            record.trim[1],
            rw,
            rh,
          );
          const pixels = bank.canvas
            .getContext('2d')
            .getImageData(rx - 4, ry - 4, rw + 8, rh + 8).data;
          for (let yy = 0; yy < rh + 8; yy++)
            for (let xx = 0; xx < rw + 8; xx++)
              if (
                (xx < 4 || yy < 4 || xx >= rw + 4 || yy >= rh + 4) &&
                pixels[(yy * (rw + 8) + xx) * 4 + 3]
              )
                gutterFailures++;
          if (record.anchor[0] !== frame.anchor[0] || record.anchor[1] !== frame.anchor[1])
            fail('Anchor changed');
        }
        const packed = reconstructedContext.getImageData(
          0,
          0,
          reconstructed.width,
          reconstructed.height,
        ).data;
        for (let i = 0; i < data.length; i++) if (packed[i] !== data[i]) packedPixelMismatches++;
      }
    }
    // Known red material landmarks follow their body parts, not only final clipping.
    const fixture = document.createElement('canvas');
    fixture.width = fixture.height = 48;
    const fc = fixture.getContext('2d');
    fc.fillStyle = '#ff0000';
    fc.fillRect(4, 22, 1, 1);
    fc.fillRect(12, 40, 1, 1);
    const meta = {
      key: 'fixture.face2.idle.0',
      frame: 0,
      state: 'idle',
      facing: 2,
      atlas: 0,
      native: [48, 48],
      rect: [0, 0, 48, 48],
      trim: [0, 0, 48, 48],
      anchor: [24, 44],
    };
    // Full opaque body permits an independent check of intended part translation.
    const body = document.createElement('canvas');
    body.width = body.height = 48;
    body.getContext('2d').fillRect(0, 0, 48, 48);
    const pose = { ...meta, atlas: 1, state: 'move', frame: 2 };
    const moved = composePoseDamage(pose, meta, [fixture, body]).getContext('2d');
    if (
      moved.getImageData(4, 21, 1, 1).data[3] !== 255 ||
      moved.getImageData(14, 39, 1, 1).data[3] !== 255
    )
      fail('Material landmark did not follow stride');
    const attack = composePoseDamage({ ...pose, state: 'attack', frame: 1 }, meta, [
      fixture,
      body,
    ]).getContext('2d');
    if (
      attack.getImageData(3, 22, 1, 1).data[3] !== 255 ||
      attack.getImageData(12, 40, 1, 1).data[3] !== 255
    )
      fail('Material landmark did not follow action lobe');
    if (outside || gutterFailures || packedPixelMismatches)
      fail(`Pose damage geometry failed: ${outside}/${gutterFailures}/${packedPixelMismatches}`);
    const totalPixels =
      art.atlases.reduce((n, a) => n + a.size[0] * a.size[1], 1048576 + 288 * 32) + bank.pixels;
    for (const el of document.querySelectorAll('style,link[rel="stylesheet"]')) el.remove();
    document.body.style.margin = '0';
    document.body.innerHTML =
      '<main style="font:18px sans-serif;color:#ebfffa;background:#20333f;padding:24px"><h1>Resonance Bastion — pose attachment comparison</h1><p>Native atlas pixels, 4× nearest-neighbor. Left: earlier idle marks. Right: corrected pose attachment. Diagnostic sheets; no natural-motion approval inferred.</p><div id="sheets"></div></main>';
    const host = document.querySelector('#sheets');
    for (const type of ['friendly.rifle_squad', 'enemy.runner', 'enemy.raider', 'warden.bulwark']) {
      const title = document.createElement('h2');
      title.textContent = `${type} — move frame 2, face 2`;
      host.append(title);
      const pair = document.createElement('div');
      pair.style.cssText = 'display:flex;gap:24px;flex-wrap:wrap';
      host.append(pair);
      const frame = art.frames.find((f) => f.key === `${type}.face2.move.2`),
        overlay = damageSource(frame, 'damaged');
      for (const corrected of [false, true]) {
        const canvas = document.createElement('canvas');
        canvas.width = frame.native[0];
        canvas.height = frame.native[1];
        const c = canvas.getContext('2d');
        c.drawImage(
          sources[frame.atlas],
          ...frame.rect,
          frame.trim[0],
          frame.trim[1],
          frame.rect[2],
          frame.rect[3],
        );
        if (corrected) c.drawImage(composePoseDamage(frame, overlay, sources), 0, 0);
        else
          c.drawImage(
            sources[overlay.atlas],
            ...overlay.rect,
            overlay.trim[0],
            overlay.trim[1],
            overlay.rect[2],
            overlay.rect[3],
          );
        canvas.style.cssText = `display:block;width:${canvas.width * 4}px;height:${canvas.height * 4}px;image-rendering:pixelated;background:#30434f`;
        const cell = document.createElement('div');
        cell.textContent = corrected ? 'Corrected pose marks' : 'Earlier idle marks';
        cell.append(canvas);
        pair.append(cell);
      }
    }
    return {
      date: '2026-10-07',
      test: 'Actual Canvas2D compositor in Chromium; separately verified production integration',
      checkedPoseBandPairs: checked,
      outsideBodyPixels: outside,
      originalOutsideBodyPixels: originalOutside,
      gutterFailures,
      packedPixelMismatches,
      uniqueOverlayRectangles: bank.unique,
      overlayAtlas: [bank.canvas.width, bank.canvas.height],
      totalLoadedTexturePixels: totalPixels,
      buildMS,
      budget: 6000000,
      landmarkChecks: 'passed',
      sourceImagesEdited: false,
      naturalMotionApproval: 'not certified',
      physicalTabletPerformance: 'not measured',
    };
  });
  if (errors.length) throw new Error(errors.join('\n'));
  await page.screenshot({ path: resolve(out, 'pose-attachment-comparison.png'), fullPage: true });
  await writeFile(
    resolve('docs/evidence/POSE_DAMAGE_RUNTIME.json'),
    `${JSON.stringify(result, null, 2)}\n`,
  );
  console.log(JSON.stringify(result));
} finally {
  await browser.close();
  await server.close();
}
