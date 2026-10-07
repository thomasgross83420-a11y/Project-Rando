import './style.css';
import { Database } from './persistence/database';
import { CampaignRepository, Preparation } from './persistence/repository';
import { createCampaign, applyCommand, accounting, type Campaign } from './persistence/campaign';
import {
  constructionTypes,
  coreBaseline,
  foundation,
  requireDefinition,
  type ContentID,
} from './data/foundation';
import { WorldView } from './render/world';
import { AudioMixer } from './audio/mixer';
import { PreferencesStore } from './persistence/preferences';
import { analyzeRoutes } from './construction/geometry';
import { solidFootprints, footprint } from './persistence/campaign';
import { TutorialSession, practiceStore } from './ui/tutorial';
import { BackupStore } from './persistence/backup';
import { DataManagement } from './ui/data-management';
const root = document.querySelector<HTMLElement>('#app');
if (!root) throw new Error('Missing application root');
root.innerHTML = `<header><p class="eyebrow">RESONANCE BASTION · CONSTRUCTION DEVELOPMENT</p><h1>Resonance Bastion</h1><p>Build a permanent fortress. Its defenders will fight autonomously.</p></header><p id="status" role="status">Checking retained storage…</p><div id="title"></div><div id="preparation" hidden><h2 id="campaign-heading"></h2><p id="account"></p><div id="prep-layout"><aside id="prep-sidebar" aria-label="Preparation tools"><h3>Camera and build</h3><nav aria-label="Camera controls">${[
  ['fit-base', 'Fit Base'],
  ['fit', 'Fit field'],
  ['recenter', 'Core'],
  ['rotate', 'Rotate view'],
  ['in', 'Zoom in'],
  ['out', 'Zoom out'],
  ['left', 'Pan left'],
  ['right', 'Pan right'],
  ['up', 'Pan up'],
  ['down', 'Pan down'],
]
  .map(([id, label]) => `<button data-camera="${id}">${label}</button>`)
  .join(
    '',
  )}</nav><nav aria-label="Spatial tools"><button id="routes-toggle" aria-pressed="false">Show Routes</button><label>Route clearance <select id="route-radius"><option value="768">Heavy · 0.75 GU</option><option value="461">Ordinary · 0.45 GU</option></select></label><button id="prep-accessibility">Accessibility</button></nav><div id="inventory-host"></div><div id="catalog-host"></div><nav aria-label="Entrance navigation">${[1, 2, 3, 4, 5, 6].map((n) => `<button data-front="${n}">Front ${n}</button>`).join('')}</nav></aside><div id="prep-field"><section id="world" aria-label="Fortress field"></section><p id="camera-summary" aria-live="off"></p><details class="spatial-legend"><summary>Map and marker legend</summary><p>Strategic badges: crystal = Core; barrel = tower; wall = barrier; chevron = friendly; number = grouped assets. Solid line: purchased land. Hatched square: Core reservation. Narrow double hatch: Warden pad. Numbered entrance: Front 1–6. Dashed line: validated route; ×: blocked entrance. Named inventory provides selection and camera jump.</p></details></div><aside id="prep-details" aria-label="Placement and details"><h3>Placement and inspection</h3><div id="construction"></div><p id="route-summary" aria-live="off"></p><button id="tutorial-practice">Tutorial Practice</button><button id="prep-data">Data Management</button><button id="return-title">Return to title</button></aside></div></div><dialog id="dialog" aria-labelledby="dialog-heading"><h2 id="dialog-heading"></h2><div id="dialog-body"></div><button id="close-dialog">Cancel / close</button></dialog>`;
const byId = (id: string): HTMLElement => {
  const e = document.getElementById(id);
  if (!e) throw new Error(`Missing ${id}`);
  return e;
};
const status = (message: string): void => {
  byId('status').textContent = message;
};
const escapeHTML = (s: string): string =>
  s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
const button = (id: string, fn: () => void | Promise<void>): void => {
  byId(id).onclick = () => {
    void Promise.resolve()
      .then(fn)
      .catch((e) => status(`Action failed: ${String(e)}. Last saved campaign preserved.`));
  };
};
const dialog = byId('dialog') as HTMLDialogElement;
function modal(title: string, html: string): void {
  byId('dialog-heading').textContent = title;
  byId('dialog-body').innerHTML = html;
  dialog.showModal();
  byId('close-dialog').focus();
}
let creationBusy = false;
let dataManagement: DataManagement | undefined;
button('close-dialog', () => {
  if (!creationBusy && !dataManagement?.busy) dialog.close();
});
dialog.addEventListener('cancel', (e) => {
  if (creationBusy || dataManagement?.busy) e.preventDefault();
});
let database: Database | undefined;
try {
  database = await Database.open();
  await database.probe();
} catch (e) {
  status(
    `Retained storage unavailable: ${String(e)}. You may explicitly start a Temporary Session.`,
  );
}
let repository: CampaignRepository | undefined;
if (database) {
  repository = new CampaignRepository(database);
  await repository.acquire();
}
const preferences = new PreferencesStore(database, status);
try {
  await preferences.load();
} catch (e) {
  status(
    `Saved preferences could not be loaded: ${String(e)}. Campaigns preserved; current defaults retained.`,
  );
}
let preparation: Preparation | undefined, view: WorldView | undefined;
let tutorial: TutorialSession | undefined;
function openAccessibility(): void {
  const v = preferences.value;
  modal(
    'Accessibility',
    `<label>Interface scale <select id="ui-scale"><option value="18">100%</option><option value="27">150%</option><option value="36">200%</option></select></label><label><input id="reduce" type="checkbox" ${v.reducedEffects ? 'checked' : ''}> Reduced effects</label><label><input id="contrast" type="checkbox" ${v.highContrast ? 'checked' : ''}> High contrast construction</label><p>High contrast gives land, reservation, route and placement boundaries opaque contrasting edges and patterned state cues. Detailed artwork and simulation are unchanged.</p><button id="retry-preferences">Retry Save Preferences</button>`,
  );
  (byId('ui-scale') as HTMLSelectElement).value = String(v.uiScale);
  byId('ui-scale').onchange = () => {
    preferences.change({
      uiScale: Number((byId('ui-scale') as HTMLSelectElement).value) as 18 | 27 | 36,
    });
    view?.resize();
  };
  byId('reduce').onchange = () =>
    preferences.change({ reducedEffects: (byId('reduce') as HTMLInputElement).checked });
  byId('contrast').onchange = () => {
    preferences.change({ highContrast: (byId('contrast') as HTMLInputElement).checked });
    if (view) {
      view.highContrast = preferences.value.highContrast;
      view.draw();
    }
  };
  button('retry-preferences', () => preferences.save());
}
button('prep-accessibility', openAccessibility);
let routeCacheKey = '';
let choice: { id: string } | { type: ContentID } | undefined;
let x = 18,
  y = 18,
  rotation: 0 | 1 | 2 | 3 = 0;
const audio = new AudioMixer();
audio.configure(preferences.value.audio);
document.addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest('button');
  if (b && !b.disabled) void audio.play('ui.confirm', 0, false, 'ui');
});
setInterval(() => {
  void repository
    ?.heartbeat()
    .catch((e) =>
      status(`Writer check failed: ${String(e)}. Editing requires a fresh storage check.`),
    );
}, 5000);
function hidePreparation(): void {
  if (preparation?.busy) {
    status('Wait for the preparation save to finish before leaving.');
    return;
  }
  byId('preparation').hidden = true;
  document.body.classList.remove('in-preparation');
  byId('title').hidden = false;
  preparation = undefined;
  choice = undefined;
  if (view) {
    view.campaign = undefined;
    view.ghost = undefined;
  }
  void renderTitle();
}
async function renderTitle(): Promise<void> {
  const slots = (await repository?.slots()) ?? [],
    last = await repository?.lastOpened();
  const resumable =
    typeof last === 'number' && slots[last] !== undefined && !(slots[last] instanceof Error);
  byId('title').innerHTML =
    `<img class="title-art" src="${import.meta.env.BASE_URL}assets/title-foundation.png" alt="Candidate raster fortress scene: a crystal Core, two Sentries and armored walls on basalt ground"><p class="notice">Gate 2 in development. Construction and the Bulwark/Bastion autonomous tutorial practice are playable. Campaign progression remains Designed.</p><nav aria-label="Title"><button id="continue" ${resumable ? '' : 'disabled'}>Continue</button><button id="new-game" ${repository?.writer ? '' : 'disabled'}>New Game</button><button id="load" ${repository ? '' : 'disabled'}>Load Campaign</button><button id="help">How to Play</button><button id="accessibility">Accessibility</button><button id="settings">Settings</button><button id="credits">Credits</button><button id="data">Data Management</button>${!repository ? '<button id="temporary">Start Temporary Session</button>' : ''}${repository && !repository.writer ? '<button id="take-over">Take Over Editing</button>' : ''}</nav><p>Continue opens the last opened campaign. Three slots are available. ${repository?.temporary ? 'Temporary Session: closing loses unexported progress.' : repository?.writer ? 'Retained storage ready.' : 'Editing unavailable until storage or writer ownership is resolved.'}</p>`;
  if (resumable)
    button('continue', () => {
      void audio.unlock();
      const c = slots[last];
      if (c && !(c instanceof Error)) return openCampaign(c);
    });
  button('new-game', () => {
    void audio.unlock().then((enabled) => {
      if (enabled) void audio.music('music.title');
    });
    return slotDialog(true);
  });
  button('load', () => slotDialog(false));
  if (!repository)
    button('temporary', async () => {
      repository = new CampaignRepository(undefined);
      await repository.acquire();
      status('Temporary Session enabled. No retained Saved claim; export before closing.');
      await renderTitle();
    });
  if (repository && !repository.writer)
    button('take-over', () => {
      modal(
        'Take Over Editing',
        '<p>This increments the writer generation. Other tabs become read-only.</p><button id="confirm-take-over">Confirm Take Over</button>',
      );
      button('confirm-take-over', async () => {
        await repository?.acquire(true);
        dialog.close();
        await renderTitle();
        status('This tab now owns editing.');
      });
    });
  button('help', () =>
    modal(
      'How to Play',
      '<p>Choose New Game, select one of three slots, a doctrine and a Warden. All assets start in storage.</p><p>Choose an owned Sentry or Barricade, set integer X and Y coordinates, then Place. A world tap sets the coordinates; it never purchases. Move and Store are free. Undo restores the exact previous wallet and layout.</p><p>The amber Core precinct and Warden pad are reserved. Keep routes open for ordinary and heavy bodies. Camera controls work by touch or keyboard arrows and +/−. Tutorial Practice runs a disposable Bulwark/Bastion clone with autonomous combat, pause, speeds and durable checkpoint restart; no campaign rewards or damage.</p>',
    ),
  );
  button('accessibility', openAccessibility);
  button('settings', () => {
    modal(
      'Settings',
      '<button id="unlock-audio">Enable Sound</button><button id="mute-audio">Mute</button><p id="audio-status">Audio architecture is ready; three original 96-second cues and tutorial effects are available; full eight-cue soundtrack remains Gate7.</p>',
    );
    button('unlock-audio', async () => {
      byId('audio-status').textContent = (await audio.unlock())
        ? 'Audio unlocked. Original Title theme available; full soundtrack remains in development.'
        : 'Audio unavailable; gameplay is unaffected.';
      if (audio.context?.state === 'running') void audio.music('music.title');
    });
    button('mute-audio', () => {
      preferences.change({ audio: { ...preferences.value.audio, muted: !audio.muted } });
      audio.configure(preferences.value.audio);
      byId('mute-audio').setAttribute('aria-pressed', String(audio.muted));
    });
  });
  button('credits', () =>
    modal(
      'Credits',
      '<p>Original Resonance Bastion design and raster candidates. Dependency notices are bundled.</p><a href="' +
        import.meta.env.BASE_URL +
        'THIRD_PARTY_NOTICES.txt">Third-party licenses</a><p>Visual foundation conditionally approved. Combat candidates and complete roster review remain separate.</p>',
    ),
  );
  button('data', () => openData());
}
async function openData(exportSlots?: number[]): Promise<void> {
  const repo = repository;
  if (!repo) throw new Error('Start a retained or explicit temporary session first');
  modal('Data Management', '<div id="data-host"></div>');
  dataManagement = new DataManagement(
    byId('data-host'),
    repo,
    new BackupStore(repo, practiceStore(repo)),
    preferences,
    status,
    async () => {
      preparation = undefined;
      choice = undefined;
      if (view) {
        view.campaign = undefined;
        view.ghost = undefined;
      }
      byId('preparation').hidden = true;
      byId('title').hidden = false;
      audio.configure(preferences.value.audio);
      await renderTitle();
    },
  );
  await dataManagement.open();
  if (exportSlots) await dataManagement.prepare(exportSlots);
}
button('prep-data', () => openData());
async function slotDialog(isNew: boolean): Promise<void> {
  const slots = (await repository?.slots()) ?? [];
  modal(
    isNew ? 'New Campaign — Select Slot' : 'Load Campaign',
    slots.length
      ? slots
          .map(
            (c, i) =>
              `<section class="slot"><h3>Slot ${i + 1}</h3><p>${c instanceof Error ? 'Corrupt or unsupported — retained for recovery' : c ? escapeHTML(c.name) : 'Empty'}</p><button id="slot-${i}" ${c instanceof Error || (!isNew && !c) ? 'disabled' : ''}>${isNew ? (c ? 'Review replacement' : 'Create campaign') : 'Open campaign'}</button></section>`,
          )
          .join('')
      : '<p>No storage session available.</p>',
  );
  for (let slot = 0; slot < 3; slot++) {
    const existing = slots[slot];
    if (existing instanceof Error || (!isNew && !existing)) continue;
    button(`slot-${slot}`, async () => {
      if (!isNew && existing) {
        dialog.close();
        await openCampaign(existing);
        return;
      }
      byId('dialog-heading').textContent = 'Create Campaign';
      byId('dialog-body').innerHTML =
        `<form id="new-form"><label>Campaign name <input id="name" required maxlength="64" autocomplete="off"></label><label>Doctrine <select id="doctrine"><option>Bastion</option><option>Mobile</option><option>Chokepoint</option></select></label><label>Warden <select id="warden"><option value="warden.bulwark">Bulwark</option><option value="warden.ranger">Ranger</option><option value="warden.conductor">Conductor</option></select></label><p>600 Credits; granted assets start in storage. Bulwark/Bastion tutorial combat is implemented; Ranger, Conductor and other doctrine combat remain Gate4. Owned Rifle, Mine and Repair Node deployment is available.</p>${existing ? `<p>Replacing ${escapeHTML(existing.name)} requires its exact name.</p><label>Existing campaign name <input id="overwrite" required autocomplete="off"></label>` : ''}<button type="submit">Review Campaign</button></form>`;
      (byId('name') as HTMLInputElement).focus();
      byId('new-form').onsubmit = (e) => {
        e.preventDefault();
        void (async () => {
          if (existing && (byId('overwrite') as HTMLInputElement).value !== existing.name)
            throw new Error('Replacement name does not match');
          const c = createCampaign(
            (byId('name') as HTMLInputElement).value,
            slot,
            (byId('doctrine') as HTMLSelectElement).value as Campaign['doctrine'],
            (byId('warden') as HTMLSelectElement).value as Campaign['warden'],
          );
          const summary = c.assets.map((a) => foundation[a.type].name).join(', ');
          byId('dialog-body').innerHTML =
            `<p>${escapeHTML(c.name)} · ${c.doctrine} · ${foundation[c.warden].name}</p><p>600 Credits. Storage: ${summary}.</p><p>Nothing is committed until Create.</p><button id="commit-new">${existing ? 'Replace and Create' : 'Create'}</button>`;
          button('commit-new', async () => {
            if (!repository) throw new Error('No session');
            creationBusy = true;
            (byId('close-dialog') as HTMLButtonElement).disabled = true;
            (byId('commit-new') as HTMLButtonElement).disabled = true;
            try {
              await repository.commit(c, existing);
              dialog.close();
              await openCampaign(c);
            } catch (e) {
              (byId('commit-new') as HTMLButtonElement).disabled = false;
              throw e;
            } finally {
              creationBusy = false;
              (byId('close-dialog') as HTMLButtonElement).disabled = false;
            }
          });
        })().catch((e) => status(`Campaign not created: ${String(e)}`));
      };
    });
  }
}
async function openCampaign(c: Campaign): Promise<void> {
  if (!repository) throw new Error('No session');
  await repository.opened(c.slot);
  preparation = new Preparation(repository, c);
  choice = undefined;
  byId('title').hidden = true;
  byId('preparation').hidden = false;
  document.body.classList.add('in-preparation');
  if (!view) {
    view = new WorldView(byId('world'), status, true);
    view.onSelect = (p) => {
      x = Math.floor(p.x);
      y = Math.floor(p.y);
      renderPreparation();
    };
    view.onInspect = (ids) => {
      if (!preparation) return;
      const campaign = preparation.campaign;
      modal(
        'Inspect selected objects',
        ids
          .map((id) =>
            id === 'core'
              ? `<p>Harmonic Core · Integrity ${coreBaseline.hp} / ${coreBaseline.hp} · Armor ${coreBaseline.armor} · immovable [28,32)². No manual combat control.</p>`
              : `<button data-inspect="${id}">${requireDefinition(campaign.assets.find((a) => a.id === id)?.type ?? 'MISSING').name} · Select owned placement</button>`,
          )
          .join(''),
      );
      for (const b of document.querySelectorAll<HTMLButtonElement>('[data-inspect]'))
        b.onclick = () => {
          const asset = campaign.assets.find((a) => a.id === b.dataset.inspect);
          if (!asset?.placement) return;
          choice = { id: asset.id };
          x = asset.placement.x;
          y = asset.placement.y;
          rotation = asset.placement.rotation;
          dialog.close();
          renderPreparation();
          byId('place').focus();
        };
    };
    for (const b of document.querySelectorAll<HTMLButtonElement>('[data-camera]'))
      b.onclick = () => {
        view?.command(b.dataset.camera ?? '');
        updateCameraSummary();
      };
  }
  view.campaign = c;
  view.highContrast = preferences.value.highContrast;
  view.command('fit-base');
  renderPreparation();
  status(
    repository.temporary
      ? 'Temporary Session campaign opened; export before closing.'
      : 'Campaign opened from retained storage.',
  );
  try {
    if (await practiceStore(repository).read(c)) byId('tutorial-practice').click();
  } catch {
    byId('tutorial-practice').click();
  }
  if (audio.context?.state === 'running') void audio.music('music.preparation');
}
function renderPreparation(): void {
  const sentryBaseline = foundation['friendly.sentry'],
    barrierBaseline = foundation['friendly.standard_barricade'];
  const weapon = sentryBaseline.weapon;
  if (!weapon) throw new Error('Missing Sentry weapon baseline');
  const p = preparation;
  if (!p) return;
  const c = p.campaign,
    totals = accounting(c);
  byId('campaign-heading').textContent = c.name;
  byId('account').textContent =
    `Rank 1 · ${c.credits} Credits · Capacity ${totals.capacity}/20 · Barriers ${totals.barriers}/40 · Traps ${totals.traps}/8 · ${repository?.temporary ? 'Temporary Session' : 'Retained storage'}`;
  const chosen = choice;
  const selected = chosen && 'id' in chosen ? c.assets.find((a) => a.id === chosen.id) : undefined,
    type = choice && 'type' in choice ? choice.type : selected?.type;
  const canEdit = Boolean(repository?.writer) && !p.busy;
  byId('construction').innerHTML =
    `<p>Purchased land: [12,48) × [12,48). Core precinct: [27,33)². Selected Warden pad: [29,31) × [33,35). Expansions unlock at Rank 15/40/60/80; corners at 85/88/92/95. Purchase interface arrives with progression.</p><section aria-label="Owned inventory">${c.assets
      .map((a, i) => {
        const implemented = constructionTypes.includes(a.type);
        return `<button data-owned="${a.id}" ${implemented && canEdit ? '' : 'disabled'}>${foundation[a.type].name} ${i + 1} · ${a.placement ? `at ${a.placement.x},${a.placement.y}` : 'Stored'}${implemented ? '' : ' · deployment Designed'}</button>`;
      })
      .join('')}</section><nav aria-label="Construction catalog">${constructionTypes
      .filter((t) => foundation[t].category !== 'warden')
      .map(
        (t) =>
          `<button data-buy="${t}" ${canEdit && foundation[t].rank <= c.rank ? '' : 'disabled'}>Buy & Place ${foundation[t].name} · ${foundation[t].cost} Credits${foundation[t].rank > c.rank ? ' · unlock Rank ' + foundation[t].rank : ''}</button>`,
      )
      .join(
        '',
      )}</nav><section aria-label="Placement"><p>${type ? `${foundation[type].name} · ${foundation[type].width}×${foundation[type].height} GU · ${foundation[type].capacity} capacity · ${selected ? 'Owned: free placement' : `${foundation[type].cost} Credits only when Place succeeds`}` : 'Select an owned asset or Buy & Place.'}</p><label>X <input id="place-x" type="number" min="0" max="59" step="1" value="${x}"></label><label>Y <input id="place-y" type="number" min="0" max="59" step="1" value="${y}"></label><button id="nudge-x-minus">X −1</button><button id="nudge-x-plus">X +1</button><button id="nudge-y-minus">Y −1</button><button id="nudge-y-plus">Y +1</button><button id="rotate-placement">Rotate footprint · ${rotation * 90}°</button><button id="place" aria-describedby="placement-reason" ${type && canEdit ? '' : 'disabled'}>Place</button><button id="cancel-placement" ${choice ? '' : 'disabled'}>Cancel Placement</button><button id="store" ${selected?.placement && canEdit ? '' : 'disabled'}>Store Selected</button><output id="placement-reason" aria-live="off">${type ? 'Awaiting explicit Place. Every entrance is checked for ordinary and heavy body clearance.' : 'No placement selected.'}</output></section><nav aria-label="Preparation history"><button id="undo" ${p.undoStack.length && canEdit ? '' : 'disabled'}>Undo</button><button id="redo" ${p.redoStack.length && canEdit ? '' : 'disabled'}>Redo</button><button id="export-campaign">Export Campaign</button></nav><p>Core Integrity ${coreBaseline.hp} / ${coreBaseline.hp} · Armor ${coreBaseline.armor}. Sentry: Integrity ${sentryBaseline.hp}, Armor ${sentryBaseline.armor}, ${weapon.damage} damage / ${weapon.intervalTicks / 60} s, range ${weapon.rangeGU} GU, ${weapon.targets} layers. Barricade: Integrity ${barrierBaseline.hp}, Armor ${barrierBaseline.armor}. Tutorial Practice uses a disposable clone and durable start. Normal campaign results, rewards and repairs remain Gate3.</p>`;
  for (const b of document.querySelectorAll<HTMLButtonElement>('[data-owned]'))
    b.onclick = () => {
      const id = b.dataset.owned;
      if (id) {
        choice = { id };
        const a = c.assets.find((a) => a.id === id);
        if (a && foundation[a.type].category === 'warden' && !a.placement) {
          x = 29;
          y = 33;
        }
        if (a?.placement) {
          x = a.placement.x;
          y = a.placement.y;
          rotation = a.placement.rotation;
        }
        renderPreparation();
        byId('place').focus();
      }
    };
  for (const b of document.querySelectorAll<HTMLButtonElement>('[data-buy]'))
    b.onclick = () => {
      choice = { type: b.dataset.buy as ContentID };
      renderPreparation();
      byId('place').focus();
    };
  for (const id of ['place-x', 'place-y'])
    byId(id).onchange = () => {
      x = Number((byId('place-x') as HTMLInputElement).value);
      y = Number((byId('place-y') as HTMLInputElement).value);
      updateGhost();
    };
  for (const [id, dx, dy] of [
    ['nudge-x-minus', -1, 0],
    ['nudge-x-plus', 1, 0],
    ['nudge-y-minus', 0, -1],
    ['nudge-y-plus', 0, 1],
  ] as const)
    button(id, () => {
      x += dx;
      y += dy;
      renderPreparation();
      byId(id).focus();
    });
  button('rotate-placement', () => {
    rotation = ((rotation + 1) % 4) as typeof rotation;
    renderPreparation();
    byId('rotate-placement').focus();
  });
  button('cancel-placement', () => {
    choice = undefined;
    renderPreparation();
    status('Placement cancelled. Wallet and ownership unchanged.');
  });
  button('place', async () => {
    if (!choice) throw new Error('No placement');
    const command =
      'id' in choice
        ? { kind: 'place' as const, id: choice.id, x, y, rotation }
        : { kind: 'buy-place' as const, type: choice.type, x, y, rotation };
    await transact(() => p.commit(applyCommand(p.campaign, command)));
  });
  button('store', async () => {
    if (!selected) throw new Error('No owned selection');
    await transact(() => p.commit(applyCommand(p.campaign, { kind: 'store', id: selected.id })));
  });
  button('undo', () => transact(() => p.history('undo')));
  button('redo', () => transact(() => p.history('redo')));
  button('export-campaign', () => openData([c.slot]));
  // Real landscape tools/details regions; preserve one set of semantic controls.
  const inventory = byId('construction').querySelector('[aria-label="Owned inventory"]');
  const catalog = byId('construction').querySelector('[aria-label="Construction catalog"]');
  byId('inventory-host').replaceChildren(...(inventory ? [inventory] : []));
  byId('catalog-host').replaceChildren(...(catalog ? [catalog] : []));
  const jump = document.createElement('button');
  jump.textContent = 'Jump to selected';
  jump.disabled = !selected?.placement;
  jump.onclick = () => {
    if (selected?.placement && view) {
      const r = footprint(selected);
      if (r) {
        view.fitActive = false;
        view.camera.x = r.x + r.width / 2;
        view.camera.y = r.y + r.height / 2;
        view.draw();
        updateCameraSummary();
      }
    }
  };
  byId('construction').append(jump);
  updateGhost();
}
function updateCameraSummary(): void {
  if (!view) return;
  byId('camera-summary').textContent =
    `Camera ${view.camera.view * 90}° · ${view.camera.zoom < 0.65 ? 'Strategic role icons' : view.camera.zoom > 1.35 ? 'Close detailed sprites' : 'Tactical detailed sprites'} · zoom ${view.camera.zoom.toFixed(3)} · ${view.fitActive ? (view.fitMode === 'base' ? 'Fit Base: purchased terrain plus sprite-height margin (pan if viewport is too narrow at minimum zoom)' : 'Fit Field: full world and staging perimeter') : 'Manual camera'}`;
}
function updateGhost(): void {
  if (!view || !preparation) return;
  const chosen = choice;
  const a =
    chosen && 'id' in chosen
      ? preparation.campaign.assets.find((a) => a.id === chosen.id)
      : undefined;
  const type = choice && 'type' in choice ? choice.type : a?.type;
  let valid = false;
  let reason = '';
  view.campaign = preparation.campaign;
  if (type && choice) {
    try {
      const preview = applyCommand(
        preparation.campaign,
        'id' in choice
          ? { kind: 'place', id: choice.id, x, y, rotation }
          : { kind: 'buy-place', type: choice.type, x, y, rotation },
      );
      const totals = accounting(preview);
      valid = true;
      (byId('place') as HTMLButtonElement).disabled = !repository?.writer || preparation.busy;
      byId('placement-reason').textContent =
        `Legal placement. After Place: ${preview.credits} Credits; capacity ${totals.capacity}/20; barriers ${totals.barriers}/40; traps ${totals.traps}/8. Commit only with Place.`;
    } catch (error) {
      reason = String(error);
      (byId('place') as HTMLButtonElement).disabled = true;
      byId('placement-reason').textContent = `Invalid placement: ${String(error)}`;
    }
  }
  view.ghost = type ? { type, x, y, rotation, valid } : undefined;
  view.invalidReason = reason;
  const solids = solidFootprints(preparation.campaign).filter(
    (r) => !a?.placement || r.x !== a.placement.x || r.y !== a.placement.y,
  );
  if (type && foundation[type].solid && Number.isInteger(x) && Number.isInteger(y)) {
    const d = foundation[type];
    solids.push({
      x,
      y,
      width: rotation % 2 ? d.height : d.width,
      height: rotation % 2 ? d.width : d.height,
    });
  }
  const key = JSON.stringify(solids);
  if (key !== routeCacheKey || !view.routeAnalysis) {
    view.routeAnalysis = analyzeRoutes(solids);
    routeCacheKey = key;
  }
  view.routesVisible =
    Boolean(choice) || byId('routes-toggle').getAttribute('aria-pressed') === 'true';
  byId('route-summary').textContent = reason
    ? `Invalid Placement: ${reason}. ${view.routeAnalysis.failure ?? 'Open routes remain valid; occupancy or reservation prevents this placement.'}`
    : (view.routeAnalysis.failure ??
      'Valid Open Route: all six entrances reach Core-adjacent goals with ordinary 0.45 and heavy 0.75 GU clearance. Dashed preview lines are not hidden battle information.');
  view.draw();
  updateCameraSummary();
}
async function transact(work: () => Promise<void>): Promise<void> {
  try {
    await work();
    status(
      repository?.temporary
        ? 'Temporary Session command committed in memory. Closing loses unexported progress.'
        : 'Saved: preparation transaction committed.',
    );
    choice = undefined;
  } catch (e) {
    status(`Save / placement failed: ${String(e)}. Wallet, layout and history remain unchanged.`);
  }
  renderPreparation();
}
button('return-title', hidePreparation);
button('routes-toggle', () => {
  const b = byId('routes-toggle');
  const shown = b.getAttribute('aria-pressed') !== 'true';
  b.setAttribute('aria-pressed', String(shown));
  b.textContent = shown ? 'Hide Routes' : 'Show Routes';
  updateGhost();
});
byId('route-radius').onchange = () => {
  if (view) {
    view.routeRadius = Number((byId('route-radius') as HTMLSelectElement).value);
    view.draw();
  }
};
for (const b of document.querySelectorAll<HTMLButtonElement>('[data-front]'))
  b.onclick = () => {
    const fronts = [
      { x: 3, y: 18 },
      { x: 3, y: 42 },
      { x: 18, y: 3 },
      { x: 42, y: 3 },
      { x: 57, y: 30 },
      { x: 30, y: 57 },
    ];
    const p = fronts[Number(b.dataset.front) - 1];
    if (view && p) {
      view.fitActive = false;
      view.camera.x = p.x;
      view.camera.y = p.y;
      view.draw();
      updateCameraSummary();
    }
  };
dialog.addEventListener('close', () => void preferences.save());
window.addEventListener('keydown', (e) => {
  if (dialog.open || (e.target as HTMLElement).matches('input,select,textarea')) return;
  if (tutorial) return;
  if (e.key === 'Escape') {
    choice = undefined;
    renderPreparation();
    return;
  }
  const command: Record<string, string> = {
    ArrowLeft: 'left',
    ArrowRight: 'right',
    ArrowUp: 'up',
    ArrowDown: 'down',
    '+': 'in',
    '-': 'out',
  };
  const id = command[e.key];
  if (id && view && !byId('preparation').hidden) {
    e.preventDefault();
    view.command(id);
  }
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    void audio.suspend();
    void preferences.save();
  } else void repository?.heartbeat().catch((e) => status(`Writer check failed: ${String(e)}`));
});
button('tutorial-practice', async () => {
  if (tutorial || !preparation || !repository) return;
  preparation.undoStack = [];
  preparation.redoStack = [];
  choice = undefined;
  byId('preparation').hidden = true;
  view?.dispose();
  view = undefined;
  const host = document.createElement('div');
  host.id = 'battle-root';
  root.append(host);
  tutorial = new TutorialSession(
    host,
    preparation.campaign,
    repository,
    preferences,
    audio,
    (title) => {
      tutorial = undefined;

      if (title) {
        byId('preparation').hidden = true;
        document.body.classList.remove('in-preparation');
        void renderTitle();
      } else {
        if (preparation)
          void openCampaign(preparation.campaign).then(() => byId('tutorial-practice').focus());
      }
    },
  );
  await tutorial.initialize();
});
await renderTitle();
if (database)
  status(
    repository?.writer
      ? 'Retained storage verified. Ready to create or load a campaign.'
      : 'Another tab owns editing. This tab is read-only; Take Over requires confirmation.',
  );
