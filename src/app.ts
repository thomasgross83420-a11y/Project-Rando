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
const root = document.querySelector<HTMLElement>('#app');
if (!root) throw new Error('Missing application root');
root.innerHTML = `<header><p class="eyebrow">RESONANCE BASTION · CONSTRUCTION DEVELOPMENT</p><h1>Resonance Bastion</h1><p>Build a permanent fortress. Its defenders will fight autonomously.</p></header><p id="status" role="status">Checking retained storage…</p><div id="title"></div><div id="preparation" hidden><h2 id="campaign-heading"></h2><p id="account"></p><section id="world" aria-label="Fortress field"></section><nav aria-label="Camera controls">${[
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
  )}</nav><div id="construction"></div><button id="return-title">Return to title</button></div><dialog id="dialog" aria-labelledby="dialog-heading"><h2 id="dialog-heading"></h2><div id="dialog-body"></div><button id="close-dialog">Cancel / close</button></dialog>`;
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
button('close-dialog', () => {
  if (!creationBusy) dialog.close();
});
dialog.addEventListener('cancel', (e) => {
  if (creationBusy) e.preventDefault();
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
let preparation: Preparation | undefined, view: WorldView | undefined;
let choice: { id: string } | { type: ContentID } | undefined;
let x = 18,
  y = 18,
  rotation: 0 | 1 | 2 | 3 = 0;
const audio = new AudioMixer();
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
    `<img class="title-art" src="${import.meta.env.BASE_URL}assets/title-foundation.png" alt="Candidate raster fortress scene: a crystal Core, two Sentries and armored walls on basalt ground"><p class="notice">Gate 1 work in progress. Construction is functional; siege combat and progression are still Designed.</p><nav aria-label="Title"><button id="continue" ${resumable ? '' : 'disabled'}>Continue</button><button id="new-game" ${repository?.writer ? '' : 'disabled'}>New Game</button><button id="load" ${repository ? '' : 'disabled'}>Load Campaign</button><button id="help">How to Play</button><button id="accessibility">Accessibility</button><button id="settings">Settings</button><button id="credits">Credits</button><button id="data">Data Management</button>${!repository ? '<button id="temporary">Start Temporary Session</button>' : ''}${repository && !repository.writer ? '<button id="take-over">Take Over Editing</button>' : ''}</nav><p>Continue opens the last opened campaign. Three slots are available. ${repository?.temporary ? 'Temporary Session: closing loses unexported progress.' : repository?.writer ? 'Retained storage ready.' : 'Editing unavailable until storage or writer ownership is resolved.'}</p>`;
  if (resumable)
    button('continue', () => {
      const c = slots[last];
      if (c && !(c instanceof Error)) return openCampaign(c);
    });
  button('new-game', () => slotDialog(true));
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
      '<p>Choose New Game, select one of three slots, a doctrine and a Warden. All assets start in storage.</p><p>Choose an owned Sentry or Barricade, set integer X and Y coordinates, then Place. A world tap sets the coordinates; it never purchases. Move and Store are free. Undo restores the exact previous wallet and layout.</p><p>The amber Core precinct and Warden pad are reserved. Keep routes open for ordinary and heavy bodies. Camera controls work by touch or keyboard arrows and +/−. Combat is not implemented in this milestone.</p>',
    ),
  );
  button('accessibility', () => {
    modal(
      'Accessibility',
      '<label>Interface scale <select id="ui-scale"><option value="18">100%</option><option value="27">150%</option><option value="36">200%</option></select></label><p>All preparation commands have named buttons and coordinate alternatives. Color is accompanied by text. Focus outlines remain visible.</p><label><input id="reduce" type="checkbox"> Reduced effects</label>',
    );
    byId('ui-scale').onchange = () => {
      document.documentElement.style.fontSize = `${(byId('ui-scale') as HTMLSelectElement).value}px`;
    };
    byId('reduce').onchange = () => {
      document.documentElement.classList.toggle(
        'reduced-effects',
        (byId('reduce') as HTMLInputElement).checked,
      );
    };
  });
  button('settings', () => {
    modal(
      'Settings',
      '<button id="unlock-audio">Enable Sound</button><button id="mute-audio">Mute</button><p id="audio-status">Audio architecture is ready; original music and effects arrive in Gate 2.</p>',
    );
    button('unlock-audio', async () => {
      byId('audio-status').textContent = (await audio.unlock())
        ? 'Audio unlocked. No Gate 1 track is present.'
        : 'Audio unavailable; gameplay is unaffected.';
    });
    button('mute-audio', () => {
      audio.setMuted(!audio.muted);
      byId('mute-audio').setAttribute('aria-pressed', String(audio.muted));
    });
  });
  button('credits', () =>
    modal(
      'Credits',
      '<p>Original Resonance Bastion design and raster candidates. Dependency notices are bundled.</p><a href="' +
        import.meta.env.BASE_URL +
        'THIRD_PARTY_NOTICES.txt">Third-party licenses</a><p>Raster style approval and complete roster production remain pending.</p>',
    ),
  );
  button('data', () => {
    modal(
      'Data Management',
      '<p>Export a currently opened campaign from Preparation. Import, Restore Previous and deletion require the complete validated recovery interface in Gate 3 and remain Designed.</p>',
    );
  });
}
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
        `<form id="new-form"><label>Campaign name <input id="name" required maxlength="64" autocomplete="off"></label><label>Doctrine <select id="doctrine"><option>Bastion</option><option>Mobile</option><option>Chokepoint</option></select></label><label>Warden <select id="warden"><option value="warden.bulwark">Bulwark</option><option value="warden.ranger">Ranger</option><option value="warden.conductor">Conductor</option></select></label><p>600 Credits; granted assets start in storage. Warden combat and non-Sentry/non-Barricade deployment are still under development.</p>${existing ? `<p>Replacing ${escapeHTML(existing.name)} requires its exact name.</p><label>Existing campaign name <input id="overwrite" required autocomplete="off"></label>` : ''}<button type="submit">Review Campaign</button></form>`;
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
  if (!view) {
    view = new WorldView(byId('world'), status);
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
      b.onclick = () => view?.command(b.dataset.camera ?? '');
  }
  view.campaign = c;
  view.command('fit');
  renderPreparation();
  status(
    repository.temporary
      ? 'Temporary Session campaign opened; export before closing.'
      : 'Campaign opened from retained storage.',
  );
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
      .join(
        '',
      )}</section><nav aria-label="Construction catalog">${constructionTypes.map((t) => `<button data-buy="${t}" ${canEdit ? '' : 'disabled'}>Buy & Place ${foundation[t].name} · ${foundation[t].cost} Credits</button>`).join('')}</nav><section aria-label="Placement"><p>${type ? `${foundation[type].name} · ${foundation[type].width}×${foundation[type].height} GU · ${foundation[type].capacity} capacity · ${selected ? 'Owned: free placement' : `${foundation[type].cost} Credits only when Place succeeds`}` : 'Select an owned asset or Buy & Place.'}</p><label>X <input id="place-x" type="number" min="0" max="59" step="1" value="${x}"></label><label>Y <input id="place-y" type="number" min="0" max="59" step="1" value="${y}"></label><button id="nudge-x-minus">X −1</button><button id="nudge-x-plus">X +1</button><button id="nudge-y-minus">Y −1</button><button id="nudge-y-plus">Y +1</button><button id="rotate-placement">Rotate footprint · ${rotation * 90}°</button><button id="place" ${type && canEdit ? '' : 'disabled'}>Place</button><button id="cancel-placement" ${choice ? '' : 'disabled'}>Cancel Placement</button><button id="store" ${selected?.placement && canEdit ? '' : 'disabled'}>Store Selected</button><output id="placement-reason">${type ? 'Awaiting explicit Place. Every entrance is checked for ordinary and heavy body clearance.' : 'No placement selected.'}</output></section><nav aria-label="Preparation history"><button id="undo" ${p.undoStack.length && canEdit ? '' : 'disabled'}>Undo</button><button id="redo" ${p.redoStack.length && canEdit ? '' : 'disabled'}>Redo</button><button id="export-campaign">Export Campaign</button></nav><p>Core Integrity ${coreBaseline.hp} / ${coreBaseline.hp} · Armor ${coreBaseline.armor}. Sentry: Integrity ${sentryBaseline.hp}, Armor ${sentryBaseline.armor}, ${weapon.damage} damage / ${weapon.intervalTicks / 60} s, range ${weapon.rangeGU} GU, ${weapon.targets} layers. Barricade: Integrity ${barrierBaseline.hp}, Armor ${barrierBaseline.armor}. Autonomous combat, forecasts and siege start remain Designed.</p>`;
  for (const b of document.querySelectorAll<HTMLButtonElement>('[data-owned]'))
    b.onclick = () => {
      const id = b.dataset.owned;
      if (id) {
        choice = { id };
        const a = c.assets.find((a) => a.id === id);
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
  button('export-campaign', () => {
    const url = URL.createObjectURL(
      new Blob(
        [
          JSON.stringify(
            { format: 'resonance-foundation-backup-v1', campaign: p.campaign },
            null,
            2,
          ),
        ],
        { type: 'application/json' },
      ),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = `resonance-slot-${c.slot + 1}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    status(
      'Campaign bytes offered for download. Confirm the file was stored externally. Import interface is still Designed.',
    );
  });
  updateGhost();
}
function updateGhost(): void {
  if (!view || !preparation) return;
  const chosen = choice;
  const a =
    chosen && 'id' in chosen
      ? preparation.campaign.assets.find((a) => a.id === chosen.id)
      : undefined;
  const type = choice && 'type' in choice ? choice.type : a?.type;
  view.ghost = type ? { type, x, y, rotation } : undefined;
  view.campaign = preparation.campaign;
  view.draw();
  if (type && choice) {
    try {
      applyCommand(
        preparation.campaign,
        'id' in choice
          ? { kind: 'place', id: choice.id, x, y, rotation }
          : { kind: 'buy-place', type: choice.type, x, y, rotation },
      );
      byId('placement-reason').textContent = 'Legal placement. Commit only with Place.';
    } catch (error) {
      byId('placement-reason').textContent = `Invalid placement: ${String(error)}`;
    }
  }
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
window.addEventListener('keydown', (e) => {
  if (dialog.open || (e.target as HTMLElement).matches('input,select,textarea')) return;
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
  if (document.hidden) void audio.suspend();
  else void repository?.heartbeat().catch((e) => status(`Writer check failed: ${String(e)}`));
});
await renderTitle();
if (database)
  status(
    repository?.writer
      ? 'Retained storage verified. Ready to create or load a campaign.'
      : 'Another tab owns editing. This tab is read-only; Take Over requires confirmation.',
  );
