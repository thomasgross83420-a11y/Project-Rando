import { ENTRANCES } from '../construction/geometry';
import { authored } from './authored';
import { series, offers, closeSeries, encounterCode, readEncounterCode } from './watch';
import { practiceClone } from './practice';
import { COSMETICS, purchaseCosmetic, equipCosmetic } from './workshop';
import { batchPreview, movePreview, presetPreview, type LayoutPreview } from './layout-tools';
import { planDigest } from './director';
import './style.css';
import mechanics from './mechanics.json';
import { FRIENDLIES, ENEMIES, BOSSES, definition, type Category } from './catalog';
import {
  BUILD,
  FULL_VERSION,
  newGame,
  assertGame,
  maxHealth,
  type Asset,
  type GameState,
  type Plan,
  type Result,
  type Mode,
  type Difficulty,
  type Modifier,
} from './model';
import { FullStore, inspectFullBackup } from './store';
import { FullView } from './view';
import { FullAudio } from './audio';
import { FullBattle } from './engine';
import { compile, stageInfo, CHAPTERS, CHAPTER_RANKS, availableRecipes } from './director';
import {
  buy,
  place,
  guidedLayout,
  validateLayout,
  usage,
  limits,
  expandLand,
  LAND_OFFERS,
  upgradeWall,
} from './construction';
import {
  repair,
  repairQuote,
  rearm,
  rearmQuote,
  enhance,
  promote,
  respec,
  sell,
  storeAsset,
  saleQuote,
  acquireWarden,
  emergency,
  priceResult,
  claimResult,
  PROMOTIONS,
} from './economy';
import { friendlyStats } from './stats';
import { Database } from '../persistence/database';
import { migrateLegacy } from './migration';
import type { ProgressFence } from '../persistence/fence';
import { readBackup } from '../persistence/backup';
import { hash } from '../sim/determinism';
import thresholds from '../data/progression.json';
import { combineResults } from './results';
const escapeHTML = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
const n = (v: number | string) => Number(v).toLocaleString(undefined, { maximumFractionDigits: 0 });
const body = (v: number) => n(Math.round(v / 1024));
class FullApp {
  private root = document.querySelector<HTMLElement>('#app')!;
  private panel: HTMLElement;
  private title: HTMLElement;
  private hud: HTMLElement;
  private bar: HTMLElement;
  private toast: HTMLElement;
  private view: FullView;
  private audio = new FullAudio();
  private store: FullStore | undefined;
  private state: GameState | null = null;
  private slots: GameState[] = [];
  private writer = false;
  private temporary = false;
  private settingsOnly = false;
  private returnTitle = false;
  private practiceLab = false;
  private practiceCapacity = 120;
  private practiceTraps = 40;
  private practiceBarriers = 200;
  private practiceWarden = '';
  private practiceFlip = false;
  private practiceExclusions: string[] = [];
  private watchMastery = false;
  private busy = false;
  private selected: string | null = null;
  private section = '';
  private actions = new Map<string, () => void | Promise<void>>();
  private actionID = 0;
  private history: GameState[] = [];
  private redo: GameState[] = [];
  private battle: FullBattle | null = null;
  private paused = false;
  private speed = 1;
  private accumulator = 0;
  private lastFrame = performance.now();
  private lastHUD = 0;
  private lastEffect = 0;
  private lastEvent = '';
  private intermission = 0;
  private nextBlockPlan: Plan | null = null;
  private mode: Mode = 'Campaign';
  private difficulty: Difficulty = 'Standard';
  private recipe = 'Balanced';
  private band = 1;
  private bossID: string = BOSSES[0]!.id;
  private blocks = 3;
  private tier = 0;
  private modifiers: Modifier[] = [];
  private pressure: 'original' | 'reverse' | 'rotate' = 'original';
  private stage = 0;
  private seed = '';
  private forecast: Plan | null = null;
  private practiceRepair = true;
  private calibrationRole = 'enemy.runner';
  private calibrationCount = 10;
  private calibrationRank: 0 | 1 | 2 | 3 = 0;
  private calibrationEntrance = 0;
  private buildCategory: Category = 'tower';
  private deployment: Asset | null = null;
  private rotation = 0;
  private ghostError = '';
  private record: Result | null = null;
  private comparison: string | null = null;
  private resultsTab = 'Summary';
  private imports: unknown[] = [];
  private bulk = new Set<string>();
  private pendingRecovery: Result | null = null;
  private messageTimer: ReturnType<typeof setTimeout> | undefined;
  constructor() {
    this.root.innerHTML = `<div class="full-shell"><div id="full-field" role="application" tabindex="0" aria-label="Bastion field. Drag to pan. Pinch to zoom. Arrow keys pan, plus and minus zoom."></div><header id="full-hud"></header><div class="camera-tools" aria-label="Camera"><button data-nav="Map" aria-label="Open tactical map">Map</button><button data-system="fit" aria-label="Center base">⌖</button><button data-system="rotate" aria-label="Rotate view">↻</button></div><section id="full-panel" aria-label="Game menu" hidden></section><nav id="full-bar" aria-label="Preparation menus"></nav><section id="full-title"></section><div id="full-toast" role="status" aria-live="polite"></div></div>`;
    this.panel = this.root.querySelector('#full-panel')!;
    this.title = this.root.querySelector('#full-title')!;
    this.hud = this.root.querySelector('#full-hud')!;
    new ResizeObserver(() =>
      this.root.style.setProperty('--hud-bottom', `${this.hud.getBoundingClientRect().bottom}px`),
    ).observe(this.hud);
    this.bar = this.root.querySelector('#full-bar')!;
    this.toast = this.root.querySelector('#full-toast')!;
    this.view = new FullView(this.root.querySelector('#full-field')!);
    this.view.onTap = (p, id) => {
      if (this.deployment) {
        this.ghost(p.x, p.y);
        return;
      }
      if (id) {
        this.selected = id;
        this.view.selected = id;
        this.open('Inspect');
      }
    };
    this.view.onPlacement = (p) => this.ghost(p.x, p.y);
    this.root.addEventListener('click', (event) => {
      const map = (event.target as HTMLElement).closest<SVGElement>('[data-map]');
      if (map) {
        const r = map.getBoundingClientRect();
        this.view.jump({
          x: Math.max(0, Math.min(60, (60 * (event.clientX - r.left)) / r.width)),
          y: Math.max(0, Math.min(60, (60 * (event.clientY - r.top)) / r.height)),
        });
        return;
      }
      const b = (event.target as HTMLElement).closest<HTMLButtonElement>('button');
      if (!b) return;
      const action = b.dataset.action,
        system = b.dataset.system,
        nav = b.dataset.nav;
      if (system === 'fit') this.view.fit();
      else if (system === 'rotate') this.view.rotate();
      else if (system === 'pause') this.togglePause();
      else if (system === 'speed') {
        this.speed = this.speed === 0.5 ? 1 : this.speed === 1 ? 2 : this.speed === 2 ? 4 : 0.5;
        this.updateHUD();
      } else if (system === 'close') this.close();
      else if (nav) this.open(nav);
      else if (action) {
        this.audio.sound('ui:press');
        const f = this.actions.get(action);
        if (f) void this.run(f, b);
      }
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.close();
      if (
        e.key === ' ' &&
        this.battle &&
        !(e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement)
      ) {
        e.preventDefault();
        this.togglePause();
      }
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.battle) {
        this.paused = true;
        this.audio.pause(true);
        this.updateHUD();
        this.notify('Paused while the game is in the background');
      }
      this.lastFrame = performance.now();
    });
    window.addEventListener('pagehide', () => {
      this.paused = true;
    });
    requestAnimationFrame((t) => this.frame(t));
    void this.boot();
  }
  private button(
    label: string,
    action: () => void | Promise<void>,
    primary = false,
    disabled = false,
  ): string {
    const id = String(this.actionID++);
    this.actions.set(id, action);
    return `<button data-action="${id}" class="${primary ? 'primary' : ''}" ${disabled ? 'disabled' : ''}>${label}</button>`;
  }
  private select(
    label: string,
    options: string[],
    value: string,
    onchange: (value: string) => void,
    id: string,
  ): string {
    queueMicrotask(() => {
      const input = this.root.querySelector<HTMLSelectElement>('#' + id);
      if (input)
        input.onchange = () => {
          onchange(input.value);
        };
    });
    return `<label class="control">${label}<select id="${id}" aria-label="${escapeHTML(label)}">${options.map((v) => `<option ${v === value ? 'selected' : ''} value="${escapeHTML(v)}">${escapeHTML(v)}</option>`).join('')}</select></label>`;
  }
  private input(label: string, value: string, id: string, type = 'text', extra = ''): string {
    return `<label class="control">${label}<input id="${id}" type="${type}" value="${escapeHTML(value)}" ${extra}></label>`;
  }
  private value(id: string): string {
    return this.root.querySelector<HTMLInputElement>('#' + id)?.value ?? '';
  }
  private async run(action: () => void | Promise<void>, button?: HTMLButtonElement): Promise<void> {
    if (this.busy) {
      this.notify('Finishing the current action');
      return;
    }
    this.busy = true;
    if (button) button.disabled = true;
    try {
      if (this.state) await this.audio.enable(this.state.settings);
      await action();
    } catch (error) {
      this.notify(error instanceof Error ? error.message : String(error));
    } finally {
      this.busy = false;
      if (button?.isConnected) button.disabled = false;
    }
  }
  private notify(message: string) {
    this.toast.textContent = message;
    this.toast.classList.add('visible');
    if (this.messageTimer) clearTimeout(this.messageTimer);
    this.messageTimer = setTimeout(() => this.toast.classList.remove('visible'), 6500);
  }
  private async confirm(title: string, message: string, accept = 'Confirm'): Promise<boolean> {
    const dialog = document.createElement('dialog');
    dialog.innerHTML = `<h2>${escapeHTML(title)}</h2><p>${escapeHTML(message)}</p><div class="button-row"><button class="cancel">Cancel</button><button class="primary accept">${escapeHTML(accept)}</button></div>`;
    document.body.append(dialog);
    return new Promise((resolve) => {
      const end = (ok: boolean) => {
        dialog.close();
        dialog.remove();
        resolve(ok);
      };
      dialog.querySelector('.cancel')!.addEventListener('click', () => end(false));
      dialog.querySelector('.accept')!.addEventListener('click', () => end(true));
      dialog.addEventListener('cancel', (e) => {
        e.preventDefault();
        end(false);
      });
      dialog.showModal();
    });
  }
  private async boot() {
    try {
      this.store = await FullStore.open();
      this.writer = await this.store.takeWriter();
      this.slots = await this.store.list();
      this.imports = await this.store.legacy();
      setInterval(() => {
        void this.store?.heartbeat().catch(() => {
          this.writer = false;
          this.notify('Editing ownership changed. Return to Title to take over.');
        });
      }, 5000);
    } catch (e) {
      this.notify(`Saved storage unavailable: ${String(e)}. Temporary Session remains available.`);
    }
    await this.view.ready;
    this.showTitle();
  }
  private async save(s: GameState) {
    assertGame(s);
    if (this.temporary) {
      s.revision++;
      s.updated = Date.now();
      this.slots = [...this.slots.filter((v) => v.slot !== s.slot), structuredClone(s)];
    } else {
      if (!this.store || !this.writer)
        throw new Error(
          'Saved editing is unavailable. Take over at Title or choose Temporary Session.',
        );
      await this.store.save(s);
      this.slots = await this.store.list();
    }
  }
  private async command(work: (s: GameState) => void, undoable = true) {
    if (!this.state || this.state.active || this.state.pending || this.battle)
      throw new Error('Finish or recover the current siege first');
    const before = structuredClone(this.state),
      after = structuredClone(before);
    work(after);
    const errors = validateLayout(after);
    if (errors.length) throw new Error(errors.join('; '));
    await this.save(after);
    this.state = after;
    if (undoable) {
      this.history.push(before);
      this.history = this.history.slice(-40);
      this.redo = [];
    }
    this.view.state = after;
    this.render();
    this.audio.sound('confirm');
    this.notify(this.temporary ? 'Updated · Temporary Session' : 'Saved');
  }
  private load(s: GameState) {
    this.returnTitle = false;
    this.settingsOnly = false;
    this.state = structuredClone(s);
    this.selected = null;
    this.view.state = this.state;
    this.view.battle = null;
    this.battle = null;
    this.history = [];
    this.redo = [];
    this.band = Math.floor((s.rank - 1) / 5) + 1;
    this.stage = Math.min(39, s.stages.length);
    this.title.hidden = true;
    this.section = '';
    this.record = null;
    this.forecast = null;
    this.view.fit();
    this.render();
    void this.audio.play('preparation');
    if (s.pending) this.openRecovery();
    else if (s.active) this.openRecovery();
  }
  private showTitle() {
    this.close();
    this.title.hidden = false;
    this.title.className = 'title-overlay';
    this.actions.clear();
    if (!this.view.state) {
      const s = newGame('Resonance Bastion', 0, 'Bastion', 'warden.bulwark');
      guidedLayout(s);
      this.view.state = s;
    }
    for (const [slot, message] of this.store?.errors ?? [])
      this.notify(
        `Slot ${slot + 1} could not load: ${message}. Use Load / recover to restore its previous snapshot.`,
      );
    const latest = this.slots.slice().sort((a, b) => b.updated - a.updated)[0];
    this.title.innerHTML = `<div class="title-card"><p class="eyebrow">THE HARMONIC CORE AWAITS</p><h1>RESONANCE<br><span>BASTION</span></h1><p class="tagline">Build your stronghold. Shape the siege.</p><div class="title-actions">${latest ? this.button(`Continue · ${escapeHTML(latest.name)}`, () => this.load(latest), true) : ''}${this.button('New game', () => this.newMenu(), !latest)}${this.button('Load / recover', () => this.slotMenu())}${this.button('How to play', () => this.titlePage('How to play', this.help()))}${this.button(
      'Accessibility / settings',
      () => {
        this.returnTitle = true;
        this.settingsOnly = !this.state;
        if (!this.state) this.state = newGame('Settings', 0, 'Bastion', 'warden.bulwark');
        this.title.hidden = true;
        this.open('Settings');
      },
    )}${this.button('Credits', () => this.titlePage('Credits', this.credits()))}${this.button(
      'Data management',
      () => {
        this.returnTitle = true;
        if (latest) this.state = structuredClone(latest);
        this.title.hidden = true;
        this.open('Data');
      },
    )}${
      this.store && !this.writer
        ? this.button('Take over saved editing', async () => {
            if (await this.confirm('Take over editing', 'The other tab will become read only.')) {
              this.writer = await this.store!.takeWriter(true);
              this.showTitle();
            }
          })
        : ''
    }${
      !this.store
        ? this.button('Temporary Session', () => {
            this.temporary = true;
            this.writer = true;
            this.newMenu();
          })
        : ''
    }</div><p class="build-label">First pass · ${BUILD}${this.temporary ? ' · Temporary Session' : ''}</p></div>`;
    this.hud.innerHTML = '';
    this.bar.innerHTML = '';
    void this.audio.play('title');
  }
  private titlePage(title: string, content: string) {
    this.title.innerHTML = `<div class="title-card"><h2>${title}</h2><div class="title-copy">${content}</div>${this.button('Back', () => this.showTitle())}</div>`;
  }
  private newMenu() {
    this.title.innerHTML = `<div class="title-card"><p class="eyebrow">A NEW STRONGHOLD</p><h2>Choose your beginning</h2>${this.input('Bastion name', 'My Bastion', 'new-name', 'text', 'maxlength="64"')}${this.select('Save slot', ['1', '2', '3'], '1', () => {}, 'new-slot')}${this.select('Doctrine', ['Bastion', 'Mobile', 'Chokepoint'], 'Bastion', () => {}, 'new-doctrine')}${this.select('Starting Warden', ['Bulwark', 'Ranger', 'Conductor'], 'Bulwark', () => {}, 'new-warden')}<p class="muted">Bastion favors stable defenses. Mobile starts with Engineers. Chokepoint starts with more route pieces and traps. Every beginning includes 600 reserve Credits.</p><div class="button-row">${this.button('Back', () => this.showTitle())}${this.button(
      'Create Bastion',
      async () => {
        const slot = Number(this.value('new-slot')) - 1,
          previous = this.slots.find((s) => s.slot === slot);
        if (
          previous &&
          !(await this.confirm(
            'Replace slot?',
            `${previous.name}, Rank ${previous.rank}, will be replaced. Export a backup first if you want to keep it.`,
            'Replace',
          ))
        )
          return;
        const s = newGame(
          this.value('new-name'),
          slot,
          this.value('new-doctrine') as GameState['doctrine'],
          'warden.' + this.value('new-warden').toLowerCase(),
        );
        try {
          const prefs = JSON.parse(localStorage.getItem('rb-full-accessibility') ?? 'null');
          if (prefs) s.settings = { ...s.settings, ...prefs };
        } catch {
          /* Defaults remain usable. */
        }
        if (
          !(await this.confirm(
            'Review your beginning',
            `${s.name} · Slot ${s.slot + 1} · ${s.doctrine} · ${definition(s.warden).name}. 600 Credits, ${s.assets.map((a) => definition(a.type).name).join(', ')}. Guided preparation starts without any bonus grant.`,
            'Create',
          ))
        )
          return;
        guidedLayout(s);
        await this.save(s);
        this.load(s);
        this.notify('Your guided starting layout is ready. Drag the field to look around.');
      },
      true,
    )}</div></div>`;
  }
  private slotMenu() {
    this.title.innerHTML = `<div class="title-card"><h2>Your Bastions</h2>${[0, 1, 2]
      .map((slot) => {
        const s = this.slots.find((s) => s.slot === slot);
        return `<article class="menu-card"><h3>Slot ${slot + 1} · ${s ? escapeHTML(s.name) : 'Empty'}</h3>${
          this.store?.errors.has(slot)
            ? `<p class="error">Stored snapshot could not load.</p>${this.button(
                'Restore previous snapshot',
                async () => {
                  const prior = await this.store!.previous(slot);
                  if (!prior)
                    throw new Error(
                      'No valid previous snapshot is available. Import a backup instead.',
                    );
                  const restored = await this.store!.restore(prior);
                  this.slots = await this.store!.list();
                  this.load(restored);
                },
              )}`
            : ''
        }${s ? `<p>Rank ${s.rank} · ${s.stages.length}/40 campaign stages${s.active ? ' · Interrupted siege' : ''}${s.pending ? ' · Result awaiting recovery' : ''}</p>${this.button('Open', () => this.load(s), true)}` : ''}</article>`;
      })
      .join('')}${
      this.imports.length
        ? `<details><summary>Import an earlier preview save</summary><p>The original save stays available in the earlier preview. Progress and owned identities are copied into this version.</p>${this.imports
            .map((raw, i) =>
              this.button(`Review earlier slot ${i + 1}`, async () => {
                const db = await Database.open();
                const old = raw as { slot: number; lineage: string };
                const active = await db.read<unknown>('meta', `run.slot.${old.slot}`);
                const fence = await db.read<ProgressFence>('meta', `fence.${old.lineage}`);
                db.db.close();
                if (active)
                  throw new Error(
                    'Resolve the earlier preview’s interrupted or pending siege before copying it. Open Earlier Preview from Data management.',
                  );
                const converted = migrateLegacy(raw, fence);
                if (
                  await this.confirm(
                    'Copy earlier Bastion',
                    `${converted.name} · Rank ${converted.rank} · ${converted.assets.length} owned assets. Replace full-version slot ${converted.slot + 1}?`,
                    'Copy',
                  )
                ) {
                  await this.save(converted);
                  this.load(converted);
                }
              }),
            )
            .join('')}</details>`
        : ''
    }${this.button('Back', () => this.showTitle())}</div>`;
  }
  private close() {
    if (this.returnTitle) {
      this.returnTitle = false;
      if (this.settingsOnly) {
        this.state = null;
        this.settingsOnly = false;
      }
      this.showTitle();
      return;
    }
    if (this.state) this.view.state = this.state;
    this.section = '';
    this.panel.hidden = true;
    this.deployment = null;
    this.view.ghost = null;
    this.root.querySelector<HTMLElement>('#full-field')?.focus({ preventScroll: true });
  }
  private open(section: string) {
    if (this.section === section) {
      this.close();
      return;
    }
    if (this.battle && ['Map', 'Settings', 'Data'].includes(section)) {
      this.paused = true;
      this.audio.pause(true);
    }
    this.section = section;
    this.title.hidden = true;
    this.panel.hidden = false;
    this.renderPanel();
  }
  private render() {
    if (!this.state) return;
    this.actions.clear();
    this.view.state = this.state;
    document.documentElement.style.setProperty(
      '--game-scale',
      String(this.state.settings.uiScale / 100),
    );
    document.documentElement.classList.toggle('high-contrast', this.state.settings.highContrast);
    this.root.dataset.hudStyle = this.state.appearance.hud ?? 'default';
    this.audio.configure(this.state.settings);
    this.updateHUD();
    this.bar.innerHTML = this.battle
      ? `<button data-nav="Battle tools">Siege tools</button><button data-nav="Inspect">Inspect</button>`
      : `${['Build', 'Army', 'Siege', 'Records', 'Manage'].map((k) => `<button data-nav="${k}" ${this.section === k ? 'aria-current="page"' : ''}>${k}</button>`).join('')}`;
    if (this.section) this.renderPanel();
  }
  private updateHUD() {
    if (!this.state) return;
    const s = this.state;
    if (this.battle) {
      const b = this.battle,
        w = b.entities.find((e) => e.d.id === s.warden);
      if (!this.hud.querySelector('[data-system="pause"]'))
        this.hud.innerHTML =
          '<div><strong></strong><span class="hud-detail"></span></div><div class="hud-right"><span></span><div class="playback-buttons"><button data-system="speed">1×</button><button data-system="pause">Pause</button></div></div><div class="boss-status"></div>';
      this.hud.querySelector('strong')!.textContent = b.plan.name;
      this.hud.dataset.critical =
        b.core.hp < b.core.stats.health * 0.25 || !w?.hp ? 'true' : 'false';
      this.hud.querySelector('.hud-detail')!.textContent =
        `Core ${body(b.core.hp)}${b.core.hp < b.core.stats.health * 0.25 ? ' · Critical' : ''} · ${w ? `${definition(s.warden).name} ${body(w.hp)}` : ''}`;
      this.hud.querySelector('.hud-right span')!.textContent = this.intermission
        ? `Next block ${(this.intermission / 60).toFixed(1)}s`
        : `${Math.floor(b.tick / 3600)}:${String(Math.floor(b.tick / 60) % 60).padStart(2, '0')} combat · ${b.directorTick >= b.plan.duration * 60 ? 'Cleanup' : b.populationHeld ? 'Deployment held' : `Deploy ${Math.floor(b.directorTick / 60)}/${b.plan.duration}s`}`;
      this.hud.querySelector('[data-system="pause"]')!.textContent = this.paused
        ? 'Resume'
        : 'Pause';
      this.hud.querySelector('[data-system="speed"]')!.textContent = this.speed + '×';
      const boss = b.alive(1).find((e) => e.d.category === 'boss' && b.perceived(e));
      this.hud.querySelector('.boss-status')!.textContent = boss
        ? `${boss.d.name} · ${body(boss.hp)} / ${body(boss.stats.health)} · Phase ${boss.phase}`
        : '';
      const event = b.events[0];
      if (event && event !== this.lastEvent) {
        this.lastEvent = event;
        if (s.settings.captions) this.notify(event);
        if (/Core critical|arrived|Phase|breach|Interpos|Refrain|warn/i.test(event))
          this.audio.sound('alert:' + event, true);
      }
      return;
    }
    const next = thresholds.rankNext[s.rank - 1] ?? 0;
    this.hud.innerHTML = `<div><strong>${escapeHTML(s.name)}</strong><span class="hud-detail">Rank ${s.rank}${s.rank < 100 ? ` · ${n(s.rankXP)} / ${n(next)} XP` : ''}</span></div><div class="hud-right"><span class="wallet">◈ ${n(s.credits)} <span class="core-wallet">✦ ${n(s.cores)}</span></span><span class="save-indicator">${this.temporary ? 'Temporary' : this.writer ? 'Saved' : 'Read only'}</span></div>`;
  }
  private renderPanel() {
    this.actions.clear();
    if (!this.state && this.section !== 'Data') return;
    const s = this.state;
    this.panel.innerHTML = `<div class="panel-heading"><h2>${escapeHTML(this.section)}</h2><button data-system="close" aria-label="Close menu">×</button></div><div class="panel-content">${this.content(s)}</div>`;
  }
  private content(s: GameState | null): string {
    if (this.section === 'Data') return this.dataMenu();
    if (!s) return '';
    if (this.section === 'Map') return this.mapMenu(s);
    if (this.section === 'Workshop') return this.workshopMenu(s);
    if (this.section === 'Batch') return this.batchMenu(s);
    if (this.section === 'Group move') return this.groupMoveMenu();
    if (this.section === 'Watch') return this.watchMenu(s);
    if (this.section === 'Master gallery')
      return `<img class="ending-art" src="${import.meta.env.BASE_URL}assets/full/bastion-master.png" alt="A laurel-framed Harmonic Core with eight siege standards over the enduring fortress."><h3>Bastion Master</h3><p>All twelve mastery trials cleared. Your tactical mastery is recorded; no extra stats are granted.</p>${this.button('Return to fortress', () => this.close())}`;
    if (this.section === 'Ending') return this.endingMenu();
    if (this.section === 'Build') return this.buildMenu(s);
    if (this.section === 'Army') return this.armyMenu(s);
    if (this.section === 'Inspect') return this.inspector(s);
    if (this.section === 'Siege') return this.siegeMenu(s);
    if (this.section === 'Forecast') return this.forecastMenu(s);
    if (this.section === 'Records')
      return `${s.trials.length === 12 ? this.button('Bastion Master gallery', () => this.open('Master gallery')) : ''}${s.stages.length === 40 ? this.button('Replay campaign ending', () => this.open('Ending')) : ''}${this.recordsMenu(s)}`;
    if (this.section === 'Results') return this.resultsMenu();
    if (this.section === 'Settings') return this.settingsMenu(s);
    if (this.section === 'Battle tools') return this.battleMenu();
    if (this.section === 'Recovery') return this.recoveryMenu(s);
    if (this.section === 'Tactics') return this.tacticsMenu(s);
    if (this.section === 'Manage')
      return `<div class="menu-grid">${this.button('Core / recovery', () => this.open('Recovery'))}${this.button('Land expansions', () => this.open('Land'))}${this.button('Layout presets', () => this.open('Presets'))}${this.button('Appearance workshop', () => this.open('Workshop'))}${this.button('Settings', () => this.open('Settings'))}${this.button('Data / backups', () => this.open('Data'))}${this.button('How to play', () => this.open('Help'))}${this.button('Credits', () => this.open('Credits'))}${this.button('Return to title', () => this.showTitle())}</div>`;
    if (this.section === 'Land')
      return LAND_OFFERS.map(
        ([id, rank, cost]) =>
          `<article class="menu-card"><h3>${id}</h3><p>${s.land.includes(id) ? 'Owned' : `Rank ${rank} · ${n(cost)} Credits`}</p>${
            s.land.includes(id)
              ? ''
              : this.button(
                  'Purchase land',
                  async () => {
                    if (
                      await this.confirm('Purchase land', `${id} · ${n(cost)} Credits`, 'Purchase')
                    )
                      await this.command((c) => expandLand(c, id));
                  },
                  false,
                  s.rank < rank,
                )
          }</article>`,
      ).join('');
    if (this.section === 'Presets') return this.presetsMenu(s);
    if (this.section === 'Help') return this.help();
    if (this.section === 'Credits') return this.credits();
    return '';
  }
  private buildMenu(s: GameState): string {
    if (this.deployment) {
      const a = this.deployment,
        d = definition(a.type),
        g = this.view.ghost;
      return `<h3>Place ${d.name}</h3><p>Touch the field to position it. Drag the ghost to adjust; two fingers move the camera.</p><p class="${this.ghostError ? 'error' : 'muted'}">${escapeHTML(this.ghostError || 'Placement is valid')}</p><div class="button-row">${this.button(
        'Rotate footprint',
        () => {
          this.rotation = (this.rotation + 1) % 4;
          if (g) this.ghost(g.x, g.y);
        },
      )}${this.button(
        'Confirm placement',
        async () => {
          if (!g || !g.valid) throw new Error(this.ghostError || 'Choose a valid position');
          await this.command((c) => place(c, a.id, g.x, g.y, this.rotation));
          this.deployment = null;
          this.view.ghost = null;
          this.open('Army');
        },
        true,
        !g?.valid,
      )}${this.button('Cancel', () => {
        this.deployment = null;
        this.view.ghost = null;
        this.renderPanel();
      })}</div>`;
    }
    const used = usage(s),
      lim = limits(s);
    return `<p class="compact-stat">Capacity ${used.capacity}/${lim.capacity} · Route cells ${used.barriers}/${lim.barriers} · Traps ${used.traps}/${lim.traps}</p>${this.select(
      'Category',
      ['tower', 'mobile', 'support', 'trap', 'route', 'infrastructure'],
      this.buildCategory,
      (v) => {
        this.buildCategory = v as Category;
        this.renderPanel();
      },
      'build-category',
    )}<div class="catalog-list">${FRIENDLIES.filter((d) => d.category === this.buildCategory)
      .map((d) => {
        const owned = s.assets.filter((a) => a.type === d.id && !a.placement).length;
        return `<details class="menu-card"><summary><span>${d.name}</span><span>${d.rank > s.rank ? `Rank ${d.rank}` : `${n(d.cost)} ◈`}${owned ? ` · ${owned} stored` : ''}</span></summary><p>${escapeHTML(d.description || this.describe(d.id))}</p><p>${d.width}×${d.height} · ${d.capacity} capacity · ${n(d.health)} body · ${d.armor} armor${d.damage ? ` · ${d.damage} / ${d.interval}s · ${d.range} range` : ''}</p><div class="button-row">${
          owned
            ? this.button('Deploy stored', () => {
                const a = s.assets.find((a) => a.type === d.id && !a.placement)!;
                this.deploy(a);
              })
            : ''
        }${this.button(
          'Recruit / purchase',
          async () => {
            if (
              s.settings.confirmSpending &&
              !(await this.confirm(
                'Purchase asset',
                `${d.name} · ${n(d.cost)} Credits · starts in storage`,
                'Purchase',
              ))
            )
              return;
            let id = '';
            await this.command((c) => {
              id = buy(c, d.id).id;
            });
            this.selected = id;
            this.open('Inspect');
          },
          false,
          d.rank > s.rank,
        )}</div></details>`;
      })
      .join('')}</div><details><summary>Layout tools</summary><div class="button-row">${this.button(
      'Guided layout',
      async () => {
        if (
          await this.confirm(
            'Apply guided layout',
            'Rearranges compatible owned defenders and stores other assets. No purchases are made.',
          )
        )
          await this.command((c) => guidedLayout(c));
      },
    )}${this.button('Batch placement', () => this.open('Batch'))}${this.button('Undo', () => this.undo(), false, !this.history.length)}${this.button('Redo', () => this.undo(true), false, !this.redo.length)}</div><p class="muted">Commands save atomically. No currency is spent by moving a ghost.</p></details>`;
  }
  private describe(type: string): string {
    if (type === 'objective.harmonic_core')
      return 'The fortress objective. Repair restores Integrity; it cannot attack, move or be revived during a siege.';
    return (mechanics.roles as Record<string, string>)[type] ?? definition(type).description;
  }

  private deploy(a: Asset) {
    this.deployment = a;
    this.rotation = a.placement?.rotation ?? 0;
    this.section = 'Build';
    this.panel.hidden = false;
    const r = a.placement ?? { x: 24, y: 20 };
    this.ghost(r.x, r.y);
  }
  private ghost(x: number, y: number) {
    if (!this.deployment || !this.state) return;
    const clone = structuredClone(this.state);
    let valid = true;
    this.ghostError = '';
    try {
      place(clone, this.deployment.id, x, y, this.rotation);
    } catch (e) {
      valid = false;
      this.ghostError = e instanceof Error ? e.message : String(e);
    }
    this.view.ghost = { type: this.deployment.type, x, y, rotation: this.rotation, valid };
    if (this.section === 'Build') this.renderPanel();
  }
  private armyMenu(s: GameState): string {
    const used = usage(s),
      lim = limits(s);
    return `<p class="compact-stat">${s.assets.length} owned · ${used.capacity}/${lim.capacity} capacity</p><div class="button-row">${this.button(
      'Store selected',
      () =>
        this.bulkCommand((c) => {
          for (const a of c.assets) if (this.bulk.has(a.id)) storeAsset(c, a);
        }),
      false,
      !this.bulk.size,
    )}${this.button('Move selected', () => this.open('Group move'), false, !this.bulk.size)}${this.button(
      'Repair selected',
      async () => {
        const selected = s.assets.filter((a) => this.bulk.has(a.id)),
          cost = selected.reduce((n, a) => n + repairQuote(a), 0);
        if (
          await this.confirm(
            'Bulk repair',
            `${selected.length} assets · ${n(cost)} Credits. Wrecks return at 50% body.`,
          )
        )
          await this.bulkCommand((c) => {
            for (const a of c.assets) if (this.bulk.has(a.id)) repair(c, a);
          });
      },
      false,
      !this.bulk.size,
    )}${this.button(
      'Rearm selected',
      async () => {
        const cost = s.assets
          .filter((a) => this.bulk.has(a.id))
          .reduce((n, a) => n + rearmQuote(a), 0);
        if (await this.confirm('Bulk rearm', `${n(cost)} Credits for all selected finite traps.`))
          await this.bulkCommand((c) => {
            for (const a of c.assets) if (this.bulk.has(a.id)) rearm(c, a);
          });
      },
      false,
      !this.bulk.size,
    )}</div><div class="army-list">${s.assets
      .slice()
      .sort(
        (a, b) =>
          Number(!!b.placement) - Number(!!a.placement) ||
          definition(a.type).name.localeCompare(definition(b.type).name),
      )
      .map(
        (a) =>
          `<article class="army-row"><button class="check" aria-label="Select ${definition(a.type).name} for bulk action" data-action="${this.register(
            () => {
              if (this.bulk.has(a.id)) this.bulk.delete(a.id);
              else if (this.bulk.size < 40) this.bulk.add(a.id);
              else throw new Error('Bulk commands are limited to 40 assets');
              this.renderPanel();
            },
          )}">${this.bulk.has(a.id) ? '☑' : '□'}</button><div><strong>${definition(a.type).name}</strong><p>${a.placement ? 'Deployed' : 'Stored'} · ${body(a.hp)}/${body(maxHealth(a))}${definition(a.type).profile ? ` · L${a.level} · ${a.stars}★ E${a.enhancement}` : ''}${a.charges !== null ? ` · ${a.charges} charges` : ''}</p></div>${this.button(
            'Inspect',
            () => {
              this.selected = a.id;
              this.view.selected = a.id;
              this.open('Inspect');
            },
          )}</article>`,
      )
      .join(
        '',
      )}</div><details><summary>Wardens</summary><p>One selected Warden per siege. New Wardens unlock at Rank 20 and 50.</p>${
      BOSSES.length
        ? FRIENDLIES.filter((d) => d.category === 'warden')
            .map((d) => {
              const a = s.assets.find((a) => a.type === d.id);
              return `<article class="menu-card"><h3>${d.name}${s.warden === d.id ? ' · Selected' : ''}</h3>${
                a
                  ? this.button('Select Warden', () =>
                      this.command((c) => {
                        for (const owned of c.assets)
                          if (definition(owned.type).category === 'warden') owned.placement = null;
                        c.warden = d.id;
                        const w = c.assets.find((a) => a.type === d.id)!;
                        w.placement = { x: 29, y: 33, rotation: 0 };
                      }),
                    )
                  : this.button('Acquire Warden', async () => {
                      const count = s.assets.filter(
                          (a) => definition(a.type).category === 'warden',
                        ).length,
                        cost = count === 1 ? 2000 : 6000;
                      if (
                        await this.confirm(
                          'Acquire Warden',
                          `${d.name} · ${n(cost)} Credits`,
                          'Acquire',
                        )
                      )
                        await this.command((c) => acquireWarden(c, d.id));
                    })
              }</article>`;
            })
            .join('')
        : ''
    }</details>`;
  }
  private register(action: () => void | Promise<void>): string {
    const id = String(this.actionID++);
    this.actions.set(id, action);
    return id;
  }
  private async bulkCommand(work: (s: GameState) => void) {
    if (this.bulk.size > 40) throw new Error('Bulk command bound');
    await this.command(work);
    this.bulk.clear();
  }
  private inspector(s: GameState): string {
    if (this.selected === 'core')
      return `<h3>Harmonic Core</h3><p>${body(this.battle?.core.hp ?? s.coreHP)} / 10,000 Integrity</p><p>The fortress objective. It never attacks and cannot be moved.</p>${this.battle ? '' : this.button('Repair / recovery', () => this.open('Recovery'))}`;
    if (this.battle) {
      const e = this.battle.entities.find(
        (e) => e.owned === this.selected || String(e.id) === this.selected,
      );
      if (!e) return '<p>Touch an asset or hostile on the field.</p>';
      return `<h3>${e.d.name}</h3><p>${body(e.hp)} / ${body(e.stats.health)} ${e.d.biological ? 'Health' : 'Integrity'} · Armor ${e.stats.armor}</p><p>${e.burrow ? 'Burrowed' : e.channel ? 'Channeling' : e.retreat ? 'Retreating' : e.target ? 'Engaging detected contact' : 'Holding'} · ${e.d.layer}</p><p>Range ${(e.stats.range / 1024).toFixed(1)} · ${e.shield ? `${body(e.shield)} shield` : ''}${e.d.id === 'friendly.rotary' ? ` · Heat ${e.heat.toFixed(0)}%` : ''}</p><details><summary>Action details</summary><p>${this.describe(e.d.id)} Signature ${e.signature}: ${escapeHTML((mechanics.signatures as Record<string, string>)[e.d.id] ?? 'Fixed blueprint asset')}.  ${Object.entries(
        e.cooldowns,
      )
        .filter(([key]) =>
          [
            'interpose',
            'challenge',
            'holdfast',
            'dash',
            'mark',
            'volley',
            'refrain',
            'snare',
            'overclock',
            'area',
            'jam',
          ].includes(key),
        )
        .map(([key, t]) => `${key}: ${Math.max(0, (t - this.battle!.tick) / 60).toFixed(1)}s`)
        .join(' · ')}</p></details>`;
    }
    const a = s.assets.find((a) => a.id === this.selected);
    if (!a) return '<p>Select an asset from the field or Army.</p>';
    const d = definition(a.type),
      stats = friendlyStats(a),
      p = PROMOTIONS.find((p) => p.star === a.stars + 1),
      repairCost = repairQuote(a),
      q = saleQuote(a);
    return `<h3>${d.name}</h3><p>${this.describe(a.type)}</p>${
      d.category === 'warden' && s.rank >= 5
        ? this.select(
            'Warden doctrine preference',
            ['Core threats', 'Support', 'Elite', 'Air', 'Nearest'],
            a.doctrineRole ?? 'Core threats',
            (v) => {
              void this.run(() =>
                this.command((c) => {
                  c.assets.find((v) => v.id === a.id)!.doctrineRole = v as Asset['doctrineRole'];
                }),
              );
            },
            'warden-doctrine',
          ) +
          '<p>Rank 5 doctrine adds 5% to the preferred role’s target utility. It is separate from paid star specializations.</p>'
        : ''
    }<p class="compact-stat">${body(a.hp)}/${body(maxHealth(a))} body · Armor ${stats.armor}${d.profile ? ` · L${a.level} · ${a.stars}★ · E${a.enhancement}` : ''}</p>${d.damage ? `<p>Output ${body(stats.damage)} · ${(stats.interval / 60).toFixed(2)}s cadence · ${(stats.range / 1024).toFixed(2)} range · ${((Number(stats.accuracy.n) / Number(stats.accuracy.d)) * 100).toFixed(1)}% accuracy</p>` : ''}<div class="button-row">${this.button(a.placement ? 'Move' : 'Deploy', () => this.deploy(a))}${
      a.placement
        ? this.button('Store', () =>
            this.command((c) => {
              storeAsset(c, c.assets.find((v) => v.id === a.id)!);
            }),
          )
        : ''
    }${this.button('Tactics', () => this.open('Tactics'))}</div><details><summary>Maintenance</summary><div class="button-row">${this.button(
      `Repair · ${repairCost} ◈`,
      async () => {
        if (
          await this.confirm(
            'Repair asset',
            `${d.name}: ${repairCost} Credits. ${a.hp ? 'Restores all missing body.' : 'Restores wreck to half body.'}`,
          )
        )
          await this.command((c) => repair(c, c.assets.find((v) => v.id === a.id)!));
      },
      false,
      a.hp === maxHealth(a),
    )}${a.charges !== null ? this.button(`Rearm · ${rearmQuote(a)} ◈`, () => this.command((c) => rearm(c, c.assets.find((v) => v.id === a.id)!))) : ''}${a.type === 'friendly.standard_barricade' ? this.button('Upgrade wall · 80 ◈', () => this.command((c) => upgradeWall(c, a.id)), false, s.rank < 25) : ''}</div></details>${
      d.profile
        ? `<details><summary>Growth and specialization</summary><p>${escapeHTML((mechanics.profiles as Record<string, string>)[d.profile] ?? '')}</p><p>6★ signature: ${escapeHTML((mechanics.signatures as Record<string, string>)[d.id] ?? 'No signature for fixed assets')}</p><p>${d.profile} profile · ${n(a.xp)} / 78,498 asset XP · ${a.branch ? `Branch ${a.branch}` : 'No branch earned yet'}</p>${this.select('Promotion branch', ['A', 'B'], a.branch ?? 'A', () => {}, 'promotion-branch')}<p>${this.branchNames(d.profile)}</p><div class="button-row">${this.button(
            `Enhance to E${a.enhancement + 1} · ${n(Math.ceil(d.cost * (0.25 + 0.15 * (a.enhancement + 1))))} ◈`,
            async () => {
              if (
                await this.confirm(
                  'Enhance asset',
                  'Health and eligible output increase 3% of their level-grown baseline. Existing wounds remain.',
                )
              )
                await this.command((c) => enhance(c, c.assets.find((v) => v.id === a.id)!));
            },
            false,
            a.enhancement >= Math.floor(a.level / 10) || a.enhancement === 10,
          )}${
            p
              ? this.button(
                  `Promote ${p.star}★ · ${n(p.credit)} ◈ / ${p.cores} ✦`,
                  async () => {
                    const branch = this.value('promotion-branch') === 'B' ? 'B' : 'A';
                    if (
                      await this.confirm(
                        'Promote asset',
                        `${p.credit} Credits and ${p.cores} Cores. Requires asset level and Rank ${p.rank}.`,
                      )
                    )
                      await this.command((c) =>
                        promote(c, c.assets.find((v) => v.id === a.id)!, branch),
                      );
                  },
                  false,
                  a.level < p.rank || s.rank < p.rank,
                )
              : ''
          }${
            a.stars >= 3
              ? this.button(`Respec · ${Math.ceil(d.cost * 0.5)} ◈`, async () => {
                  if (
                    await this.confirm(
                      'Change branch',
                      `${this.branchNames(d.profile!)}. Switch to ${a.branch === 'A' ? 'B' : 'A'} for ${Math.ceil(d.cost * 0.5)} Credits.`,
                    )
                  )
                    await this.command((c) => respec(c, c.assets.find((v) => v.id === a.id)!));
                })
              : ''
          }</div></details>`
        : ''
    }<details><summary>Sell asset</summary><p>Returns ${q.credits} Credits and ${q.cores} actually paid Cores. XP and promotion Credit fees are lost.</p>${this.button(
      'Sell',
      async () => {
        if (
          await this.confirm(
            'Sell asset',
            `${d.name}: ${q.credits} Credits + ${q.cores} Cores. This removes the owned asset.`,
            'Sell',
          )
        ) {
          await this.command((c) => sell(c, c.assets.find((v) => v.id === a.id)!));
          this.selected = null;
          this.open('Army');
        }
      },
    )}</details>`;
  }
  private branchNames(profile: string): string {
    return (
      (
        {
          Precision: 'Priority Hunter / Lane Keeper',
          Suppression: 'Crowd Control / Focus Fire',
          Siege: 'Area / Punch',
          Protection: 'Guardian / Fortitude',
          Recovery: 'Reach / Triage',
          Utility: 'Coverage / Resilience',
        } as Record<string, string>
      )[profile] ?? 'A / B'
    );
  }
  private tacticsMenu(s: GameState): string {
    const a = s.assets.find((a) => a.id === this.selected);
    if (!a) return '<p>Select an owned asset first.</p>';
    const t = a.tactics;
    return `<h3>${definition(a.type).name}</h3><p>Tactics are captured at siege start. Anchor coordinates refer to the ground field, independently of the camera.</p>${this.select('Posture', ['Defensive', 'Balanced', 'Aggressive'], t.posture, () => {}, 'tactic-posture')}${this.select('Core priority', ['Low', 'Normal', 'High'], t.core, () => {}, 'tactic-core')}${this.select('Automatic abilities', ['Frequent', 'Balanced', 'Conservative', 'Emergency', 'Disabled'], t.ability, () => {}, 'tactic-ability')}${this.select('Spacing', ['Compact', 'Balanced', 'Spread'], t.spacing, () => {}, 'tactic-spacing')}${this.input('Anchor X', String(t.anchor.x), 'anchor-x', 'number', 'min="6" max="53"')}${this.input('Anchor Y', String(t.anchor.y), 'anchor-y', 'number', 'min="6" max="53"')}<details><summary>Sector and secondary anchor</summary>${this.select('Sector', ['0', '1', '2', '3', '4', '5', '6'], String(t.sector), () => {}, 'tactic-sector')}${this.input('World heading (degrees from north)', String(t.heading), 'tactic-heading', 'number', 'min="0" max="359"')}${this.input('Secondary X (blank for none)', t.secondary ? String(t.secondary.x) : '', 'secondary-x', 'number', 'min="6" max="53"')}${this.input('Secondary Y', t.secondary ? String(t.secondary.y) : '', 'secondary-y', 'number', 'min="6" max="53"')}</details><details><summary>Target priority order</summary>${t.priorities.map((v, i) => this.select(`Priority ${i + 1}`, ['Core threats', 'Support', 'Elite', 'Air', 'Nearest'], v, () => {}, 'priority-' + i)).join('')}</details>${a.type === 'friendly.controlled_gate' ? this.select('Gate policy', ['Open', 'Closed', 'Allied passage'], t.gate, () => {}, 'tactic-gate') : ''}${a.type === 'friendly.skyguard' ? this.select('Ground fallback', ['Enabled', 'Disabled'], t.groundFallback ? 'Enabled' : 'Disabled', () => {}, 'tactic-fallback') : ''}<div class="button-row">${this.button(
      'Save tactics',
      async () => {
        const next = structuredClone(t);
        next.posture = this.value('tactic-posture') as typeof t.posture;
        next.core = this.value('tactic-core') as typeof t.core;
        next.ability = this.value('tactic-ability') as typeof t.ability;
        next.spacing = this.value('tactic-spacing') as typeof t.spacing;
        next.anchor = { x: Number(this.value('anchor-x')), y: Number(this.value('anchor-y')) };
        next.sector = Number(this.value('tactic-sector'));
        next.heading = Number(this.value('tactic-heading'));
        next.secondary =
          this.value('secondary-x') && this.value('secondary-y')
            ? { x: Number(this.value('secondary-x')), y: Number(this.value('secondary-y')) }
            : null;
        next.priorities = Array.from({ length: 5 }, (_, i) =>
          this.value('priority-' + i),
        ) as typeof t.priorities;
        if (a.type === 'friendly.controlled_gate')
          next.gate = this.value('tactic-gate') as typeof t.gate;
        if (a.type === 'friendly.skyguard')
          next.groundFallback = this.value('tactic-fallback') === 'Enabled';
        await this.command((c) => {
          c.assets.find((v) => v.id === a.id)!.tactics = next;
        });
        this.open('Inspect');
      },
      true,
    )}${this.button('Back', () => this.open('Inspect'))}</div>`;
  }
  private presetsMenu(s: GameState): string {
    return `${this.input('Preset name', 'My layout', 'preset-name', 'text', 'maxlength="32"')}${this.button(
      'Save current layout',
      () =>
        this.command((c) => {
          if (c.presets.length >= 5) throw new Error('Five preset limit. Delete one first.');
          c.presets.push({
            name: this.value('preset-name').slice(0, 32) || 'Layout',
            placements: c.assets.map((a) => ({
              id: a.id,
              placement: a.placement,
              tactics: a.tactics,
            })),
          });
        }, false),
      false,
      s.presets.length >= 5,
    )}${s.presets
      .map(
        (p, i) =>
          `<article class="menu-card"><h3>${escapeHTML(p.name)}</h3><p>${p.placements.filter((a) => a.placement).length} deployed assets</p><div class="button-row">${this.button(
            'Apply',
            async () => {
              let preview: LayoutPreview;
              try {
                preview = presetPreview(s, p);
              } catch (error) {
                if (
                  !(await this.confirm(
                    'Preset needs a partial apply',
                    `${(error as Error).message}. Preview the valid owned subset?`,
                    'Preview subset',
                  ))
                )
                  return;
                preview = presetPreview(s, p, true);
              }
              await this.applyLayoutPreview(preview, `Apply ${p.name}`);
            },
          )}${this.button('Delete', () =>
            this.command((c) => {
              c.presets.splice(i, 1);
            }, false),
          )}</div></article>`,
      )
      .join('')}`;
  }
  private async undo(forward = false) {
    if (!this.state) return;
    const source = forward ? this.redo : this.history,
      target = forward ? this.history : this.redo,
      snapshot = source.at(-1);
    if (!snapshot) return;
    const next = structuredClone(snapshot);
    next.revision = this.state.revision;
    await this.save(next);
    source.pop();
    target.push(structuredClone(this.state));
    this.state = next;
    this.render();
    this.notify(forward ? 'Redo saved' : 'Undo saved');
  }
  private siegeMenu(s: GameState): string {
    const modes: Mode[] = [
      'Campaign',
      'Expedition',
      'Boss Siege',
      'Archive',
      'Calibration',
      ...(s.stages.length === 40 ? ['Mastery' as const] : []),
      ...(s.rank >= 30 ? ['Endurance' as const, 'Long Watch' as const] : []),
    ];
    const difficulties: Difficulty[] = [
      'Cadet',
      'Standard',
      'Veteran',
      ...(s.rank >= 75 ? ['Master' as const] : []),
      ...(s.rank >= 90 ? ['Cataclysm' as const] : []),
    ];
    let specifics = '';
    if (this.mode === 'Campaign')
      specifics = CHAPTERS.map(
        (title, ch) =>
          `<details ${Math.floor(this.stage / 5) === ch ? 'open' : ''}><summary>${ch + 1}. ${title} · Rank ${CHAPTER_RANKS[ch]}</summary><div class="stage-grid">${Array.from(
            { length: 5 },
            (_, i) => ch * 5 + i,
          )
            .map((stage) => {
              const info = stageInfo(stage),
                unlocked = (!stage || s.stages.includes(stage - 1)) && s.rank >= info.rank;
              return this.button(
                `${s.stages.includes(stage) ? '✓ ' : ''}Stage ${(stage % 5) + 1}${stage % 5 === 4 ? ' · Boss' : ''}${this.stage === stage ? ' ◇' : ''}`,
                () => {
                  this.stage = stage;
                  this.forecast = null;
                  this.renderPanel();
                },
                false,
                !unlocked,
              );
            })
            .join('')}</div></details>`,
      ).join('');
    else if (this.mode === 'Archive')
      specifics = s.archive.length
        ? s.archive
            .map(
              (p) =>
                `<article class="menu-card"><h3>${escapeHTML(p.name)}</h3><p>Replay with your current army. Earlier body positions and combat are not recreated.</p>${this.button(
                  'Forecast replay',
                  () => {
                    this.forecast = {
                      ...structuredClone(p),
                      mode: 'Archive',
                      originMode: p.originMode ?? p.mode,
                    };
                    this.open('Forecast');
                  },
                )}</article>`,
            )
            .join('')
        : '<p>Completed plans appear here.</p>';
    else if (this.mode === 'Calibration')
      specifics =
        this.practiceLabMenu(s) +
        `<p>Practice clones the owned army. No currencies, progression, discoveries, or persistent damage are awarded.</p>${this.select(
          'Enemy role',
          ENEMIES.filter((d) => d.rank <= s.rank).map((d) => d.name),
          definition(this.calibrationRole).name,
          (v) => {
            this.calibrationRole = ENEMIES.find((d) => d.name === v)!.id;
          },
          'cal-role',
        )}${this.input('Count', String(this.calibrationCount), 'cal-count', 'number', 'min="1" max="30"')}${this.select(
          'Variant',
          [
            'Common',
            ...(this.band >= 3 ? ['Veteran'] : []),
            ...(this.band >= 6 ? ['Elite'] : []),
            ...(this.band >= 14 ? ['Apex'] : []),
          ],
          ['Common', 'Veteran', 'Elite', 'Apex'][this.calibrationRank]!,
          (v) => {
            this.calibrationRank = ['Common', 'Veteran', 'Elite', 'Apex'].indexOf(v) as
              | 0
              | 1
              | 2
              | 3;
          },
          'cal-variant',
        )}${this.select(
          'Entrance',
          ['1', '2', '3', '4', '5', '6'],
          String(this.calibrationEntrance + 1),
          (v) => {
            this.calibrationEntrance = Number(v) - 1;
          },
          'cal-entrance',
        )}${this.select(
          'Practice body / stock',
          ['Full repaired clone', 'Current injury and stock'],
          this.practiceRepair ? 'Full repaired clone' : 'Current injury and stock',
          (v) => {
            this.practiceRepair = v === 'Full repaired clone';
          },
          'cal-body',
        )}`;
    else {
      specifics = `${this.input('Seed', this.seed || '', 'siege-seed', 'text', 'maxlength="128" placeholder="Leave blank for a new seed"')}${this.select(
        'Band',
        Array.from({ length: Math.floor((s.rank - 1) / 5) + 1 }, (_, i) => String(i + 1)),
        String(this.band),
        (v) => {
          this.seed = this.value('siege-seed');
          this.band = Number(v);
          if (!availableRecipes(s.rank, this.band).includes(this.recipe)) this.recipe = 'Balanced';
          this.renderPanel();
        },
        'siege-band',
      )}${this.select(
        'Encounter recipe',
        availableRecipes(s.rank, this.band),
        this.recipe,
        (v) => {
          this.recipe = v;
        },
        'siege-recipe',
      )}${this.select(
        'Pressure sequence',
        ['original', 'reverse', 'rotate'],
        this.pressure,
        (v) => {
          this.pressure = v as typeof this.pressure;
        },
        'siege-pressure',
      )}`;
      if (this.mode === 'Boss Siege' || this.mode === 'Mastery')
        specifics += this.select(
          'Boss',
          [
            'No boss',
            ...BOSSES.filter((d) => d.rank <= s.rank || this.mode === 'Mastery').map((d) => d.name),
          ],
          this.bossID ? definition(this.bossID).name : 'No boss',
          (v) => {
            this.bossID = BOSSES.find((d) => d.name === v)?.id ?? '';
          },
          'siege-boss',
        );
      if (this.mode === 'Endurance')
        specifics +=
          this.select(
            'Planned blocks',
            ['1', '2', '3', '4', '5', '6'],
            String(this.blocks),
            (v) => {
              this.blocks = Number(v);
            },
            'siege-blocks',
          ) +
          '<p>Each block has 300 seconds of deployment and cleanup. Levels stay frozen throughout. Signatures are used once for the whole run. A committed boundary protects completed block entitlements.</p>';
      if (this.mode === 'Long Watch')
        specifics +=
          this.select(
            'Mastery profile',
            s.stages.length === 40 ? ['Ordinary', 'Mastery'] : ['Ordinary'],
            this.watchMastery ? 'Mastery' : 'Ordinary',
            (v) => {
              this.watchMastery = v === 'Mastery';
            },
            'watch-mastery',
          ) +
          `<p>Sortie ${s.watchOrdinal}. Three deterministic offers; every third sortie is a boss encounter. Preparation and rewards occur after each sortie.</p>${s.watch ? this.button('Resume current series', () => this.open('Watch')) : ''}`;
      if (this.mode === 'Mastery')
        specifics += `<details><summary>Fixed mastery trials · ${s.trials.length}/12</summary>${Array.from(
          { length: 12 },
          (_, trial) =>
            this.button(`MT${trial + 1}${s.trials.includes(trial) ? ' ✓' : ''}`, async () => {
              this.forecast = await authored('mastery', trial, this.difficulty);
              this.open('Forecast');
            }),
        ).join(
          '',
        )}</details><p>Generated Mastery uses Band 20 and an optional boss. Fixed trial rewards are claimed once.</p>`;
      if (s.rank === 100)
        specifics += `<details><summary>Endgame modifiers</summary>${(
          ['crossfire', 'armoured', 'support', 'elite'] as Modifier[]
        )
          .map((m) =>
            this.button(`${this.modifiers.includes(m) ? '✓ ' : ''}${m}`, () => {
              if (this.modifiers.includes(m))
                this.modifiers = this.modifiers.filter((v) => v !== m);
              else if (this.modifiers.length < 2) this.modifiers.push(m);
              else throw new Error('At most two modifiers');
              this.renderPanel();
            }),
          )
          .join('')}${
          ['Mastery', 'Long Watch'].includes(this.mode)
            ? this.select(
                'Challenge tier',
                Array.from({ length: 9 }, (_, i) => String(i)),
                String(this.tier),
                (v) => {
                  this.tier = Number(v);
                },
                'siege-tier',
              )
            : ''
        }</details>`;
    }
    return `${this.select(
      'Mode',
      modes,
      this.mode,
      (v) => {
        this.mode = v as Mode;
        this.forecast = null;
        this.renderPanel();
      },
      'siege-mode',
    )}${this.select(
      'Difficulty',
      difficulties,
      this.difficulty,
      (v) => {
        this.difficulty = v as Difficulty;
        this.forecast = null;
      },
      'siege-difficulty',
    )}${specifics}${this.mode !== 'Archive' ? this.button(this.mode === 'Long Watch' ? 'Next sortie / review offers' : 'Review forecast', () => this.generate(), true) : ''}${this.button('Import encounter code', () => this.importEncounter())}`;
  }
  private async generate() {
    if (!this.state) return;
    const s = this.state;
    if (this.mode === 'Campaign') {
      const info = stageInfo(this.stage);
      if (s.rank < info.rank || (this.stage && !s.stages.includes(this.stage - 1)))
        throw new Error('Complete the previous stage and meet its rank requirement first');
    }
    if (this.mode === 'Calibration') this.calibrationCount = Number(this.value('cal-count'));
    const seed = this.value('siege-seed') || crypto.randomUUID(),
      boss: string | null =
        this.mode === 'Boss Siege' ||
        this.mode === 'Mastery' ||
        (this.mode === 'Calibration' && this.practiceLab)
          ? this.bossID || null
          : null;
    if (this.mode === 'Long Watch') {
      const next = structuredClone(s);
      if (!next.watch)
        next.watch = series(
          next,
          this.band,
          this.difficulty,
          this.modifiers,
          this.tier,
          this.watchMastery,
        );
      next.watch.parked = false;
      await offers(next);
      await this.save(next);
      this.state = next;
      this.open('Watch');
      return;
    }
    this.seed = seed;
    this.forecast =
      this.mode === 'Campaign' && this.modifiers.length === 0
        ? await authored('campaign', this.stage, this.difficulty)
        : await compile({
            mode: this.mode,
            seed,
            rank: s.rank,
            difficulty: this.difficulty,
            stage: this.stage,
            band: this.band,
            boss,
            recipe: this.recipe,
            modifiers: this.modifiers,
            tier: ['Mastery', 'Long Watch'].includes(this.mode) ? this.tier : 0,
            blocks: this.blocks,
            pressure: this.pressure,
            ...(this.mode === 'Calibration' && !this.practiceLab
              ? {
                  calibration: {
                    type: this.calibrationRole,
                    count: this.calibrationCount,
                    variant: this.calibrationRank,
                    entrance: this.calibrationEntrance,
                  },
                }
              : {}),
          });
    if (this.mode === 'Calibration') {
      this.forecast.practice = {
        capacity: this.practiceCapacity,
        traps: this.practiceTraps,
        barriers: this.practiceBarriers,
        warden: this.practiceWarden || s.warden,
        exclusions: [...this.practiceExclusions],
        flipBranches: this.practiceFlip,
        fullRepair: this.practiceRepair,
      };
      this.forecast.hash = await planDigest(this.forecast);
      practiceClone(s, this.forecast.practice, this.forecast);
    }
    this.open('Forecast');
  }
  private forecastMenu(s: GameState): string {
    const p = this.forecast;
    if (!p) return '<p>Choose a siege first.</p>';
    const shown = p.practice ? practiceClone(s, p.practice, p) : s;
    const units = shown.assets.filter((a) => a.placement && a.hp),
      warnings: string[] = [];
    if (!units.some((a) => definition(a.type).weapon !== 'none'))
      warnings.push('No operational attack assets deployed.');
    if (!units.some((a) => a.type === s.warden))
      warnings.push('Selected Warden is stored or incapacitated.');
    if (
      p.spawns.some((v) => definition(v.type).layer === 'air') &&
      !units.some((a) => definition(a.type).targets !== 'ground')
    )
      warnings.push('Airborne threats require operational air-capable defenders.');
    if (
      p.spawns.some((v) => v.type === 'enemy.veil' || v.type === 'enemy.mole') &&
      !units.some((a) => ['friendly.detection_relay', 'friendly.nullifier'].includes(a.type))
    )
      warnings.push(
        'Stealth and burrowed enemies: nearby defenders can reveal stealth; a detection relay helps expose burrowers.',
      );
    if (s.coreHP < 2560000) warnings.push('Core Integrity is below 25%. Consider repairs.');
    const used = usage(s),
      lim = limits(s);
    if (used.capacity > lim.capacity) warnings.push('Capacity is exceeded');
    const roles = [...new Set(p.spawns.map((v) => v.type))],
      threat = p.spawns.reduce((n, v) => n + v.qtp / 4, 0),
      fronts = [...new Set(p.spawns.map((v) => v.entrance))];
    return `<h3>${escapeHTML(p.name)}</h3><p>${p.faction} · ${p.difficulty} · Band ${p.band} · ${p.duration}s deployment${p.mode === 'Endurance' ? ` × ${p.blocks} blocks` : ''} + cleanup</p><p>${n(threat)} planned Threat Points · ${fronts.length} active fronts · ${p.spawns.length} deployments${p.boss ? ` · ${definition(p.boss).name} at 180s` : ''}</p><svg class="pressure-chart" viewBox="0 0 300 64" role="img" aria-label="Planned wave pressure">${p.pressure.map((v, i) => `<rect x="${(i * 300) / p.pressure.length}" y="${60 - v * 0.55}" width="${300 / p.pressure.length - 2}" height="${v * 0.55}" fill="#7bc9cf"/>`).join('')}</svg>${warnings.map((w) => `<p class="notice">${w}</p>`).join('')}<p class="muted">Combat is autonomous. Camera, pause, sound and inspection remain available. ${p.mode === 'Calibration' ? 'This practice session earns nothing and does not injure your owned force.' : `Body losses and finite stock persist. Repeat reward factor ${(Math.min(1, (p.band + 2) / (Math.floor((s.rank - 1) / 5) + 1)) * 100).toFixed(0)}%${p.stage !== null && !s.stages.includes(p.stage) ? ' (first unclaimed campaign attempt: 100%)' : ''}.`}</p><details><summary>Enemy composition and counters</summary>${roles.map((id) => `<p><strong>${definition(id).name}</strong> · ${this.enemyCounter(id)}</p>`).join('')}</details><details><summary>Seed and versions</summary><p class="break-word">${escapeHTML(p.seed)}</p><p>${FULL_VERSION} · ${p.hash.slice(0, 16)}</p><p>Composition uses declared progression and seed, independent of your wallet, body condition and force strength.</p></details><div class="button-row">${this.button('Back', () => this.open('Siege'))}${this.button('Export encounter code', () => this.shareEncounter(p))}${this.button(p.mode === 'Calibration' ? 'Start practice' : 'Start siege', () => this.startSiege(p), true)}</div>`;
  }
  private enemyCounter(id: string): string {
    const tag = id.split('.').at(-1)!;
    return (
      (
        {
          runner: 'Fast ground runner: sustained fire and open approach coverage.',
          raider: 'Mobile hunter: screening and repair.',
          bulwark: 'Front shield: flank, blast, or sustained fire.',
          lancer: 'Ranged direct fire: block sightlines and approach from a flank.',
          bombard: 'Warned area fire: move, spread, or intercept.',
          skimmer: 'Air infrastructure threat: Skyguard, Sentry, Wardens, or Drones.',
          veil: 'Stealth attacker: reveal at close range or with Detection/Nullifier.',
          mole: 'Burrower: detection and inner defenses.',
          sapper: 'Barrier specialist: repair, ranged focus, layered walls.',
          jammer: 'Support disruption: focus fire and redundant friendly.',
          mender: 'Enemy healer: target priority, Nullifier, and blast.',
          herald: 'Enemy damage aura: priority fire and separation.',
          drainer: 'Life-draining beam: break sightlines and burst damage.',
          carrier: 'Finite child releases: sustained and area fire.',
          breaker: 'Route breach: armor penetration, repair, ranged defense.',
          harvester: 'Consumes temporary corpses: deny access and ranged focus.',
        } as Record<string, string>
      )[tag] ??
      'Boss phases carry explicit warning geometry. Study exposed windows, finite summons, and the forecasted target layer.'
    );
  }
  private async startSiege(p: Plan, restart = false) {
    if (!this.state) return;
    const s = this.state;
    if (s.pending) throw new Error('Finalize the pending result first');
    if (p.requiredRank > s.rank) throw new Error('This encounter requires a higher Bastion Rank');
    if (p.stage !== null && p.stage > 0 && !s.stages.includes(p.stage - 1))
      throw new Error('Complete the preceding campaign stage first');
    const practice = (p.originMode ?? p.mode) === 'Calibration';
    const check = p.practice ? practiceClone(s, p.practice, p) : s,
      force = check.assets.filter(
        (a) => a.placement && a.hp && definition(a.type).weapon !== 'none',
      );
    for (const layer of ['air', 'ground'] as const)
      if (
        p.spawns.some((v) => definition(v.type).layer === layer) &&
        !force.some(
          (a) =>
            definition(a.type).targets === layer ||
            (definition(a.type).targets === 'both' &&
              !(layer === 'ground' && a.type === 'friendly.skyguard' && !a.tactics.groundFallback)),
        )
      )
        throw new Error(
          `No operational ${layer} damage counter. Repair or deploy a defender before starting.`,
        );
    let start = structuredClone(s);
    start.active = null;
    start.pending = null;
    start.history = [];
    start.archive = [];
    start.comparisons = [];
    start.presets = [];
    start.favorites = [];
    start.watch = null;
    if (practice && p.practice) start = practiceClone(s, p.practice, p);
    if (practice && !p.practice && this.practiceRepair) {
      start.coreHP = 10240000;
      for (const a of start.assets) {
        a.hp = maxHealth(a);
        a.charges = definition(a.type).charges;
      }
    }
    start.history = [];
    start.archive = [];
    start.comparisons = [];
    start.presets = [];
    start.favorites = [];
    start.watch = null;
    if (!practice) {
      if (restart) {
        if (!s.active) throw new Error('No interrupted checkpoint');
        start = structuredClone(s.active.start);
        p = s.active.plan;
      } else {
        if (s.active) throw new Error('Recover or abandon the active siege');
        const next = structuredClone(s);
        if (BigInt(next.sequence) === (1n << 64n) - 1n) {
          next.retired = [
            ...next.retired,
            { epoch: next.epoch, finalized: next.finalized, sequence: next.sequence },
          ].slice(-2);
          next.epoch++;
          next.sequence = '0';
          next.finalized = '0';
        }
        next.sequence = (BigInt(next.sequence) + 1n).toString();
        start.epoch = next.epoch;
        next.active = {
          id: `${s.id}:${next.epoch}:${next.sequence}`,
          sequence: next.sequence,
          epoch: next.epoch,
          plan: p,
          rootPlan: p,
          engine: null,
          start: structuredClone(start),
          completed: [],
          block: 1,
          signatures: {},
          signatureShots: {},
        };
        await this.save(next);
        this.state = next;
      }
    }
    await this.view.ensure(p.faction, p.boss, p.secondaryFaction);
    this.battle = await FullBattle.create(start, p);
    if (restart && this.state?.active?.engine) this.battle.restoreClock(this.state.active.engine);
    if (restart && this.state?.active)
      for (const e of this.battle.entities)
        if (e.owned && this.state.active.signatures[e.owned]) {
          e.signature = this.state.active.signatures[e.owned]!;
          e.signatureShots = this.state.active.signatureShots[e.owned] ?? 0;
        }
    this.view.battle = this.battle;
    this.paused = false;
    this.accumulator = 0;
    this.lastFrame = performance.now();
    this.lastEffect = 0;
    this.lastEvent = '';
    this.history = [];
    this.redo = [];
    this.close();
    this.render();
    await this.audio.play(
      p.mode === 'Endurance' ? 'endurance' : p.boss ? 'boss' : p.faction.toLowerCase(),
    );
    this.notify(
      practice ? 'Practice started · no persistent rewards' : 'Siege started · checkpoint saved',
    );
  }
  private togglePause() {
    if (!this.battle) return;
    if (document.hidden || this.view.contextLost) {
      this.notify('Resume is unavailable while the browser is hidden or restoring graphics');
      return;
    }
    this.paused = !this.paused;
    this.audio.pause(this.paused);
    this.lastFrame = performance.now();
    this.updateHUD();
    if (this.section === 'Battle tools') this.renderPanel();
  }
  private battleMenu(): string {
    if (!this.battle) return '<p>No siege is running.</p>';
    const b = this.battle;
    return `<p>${b.populationHeld ? 'Deployment held at the 120-body population/position gate; combat continues.' : b.directorTick >= b.plan.duration * 60 ? 'Cleanup: all remaining hostiles must be cleared.' : 'Deployment is proceeding on the director clock.'}</p><p>${b.alive(1).filter((e) => b.perceived(e)).length} visible contacts · Hidden contacts possible</p><div class="button-row">${this.button(this.paused ? 'Resume' : 'Pause', () => this.togglePause())}${this.button(
      `Speed ${this.speed}×`,
      () => {
        this.speed = this.speed === 0.5 ? 1 : this.speed === 1 ? 2 : this.speed === 2 ? 4 : 0.5;
        this.renderPanel();
      },
    )}${this.button('Sound / settings', () => this.open('Settings'))}${this.button(
      'Withdraw',
      async () => {
        if (
          await this.confirm(
            'Withdraw siege',
            'Finalize a defeat using the actual body losses and destroyed-threat rewards. Practice remains free.',
            'Withdraw',
          )
        ) {
          b.surrender();
          await this.finishBattle();
        }
      },
    )}</div><details><summary>Recent events</summary>${b.events
      .slice(0, 20)
      .map((v) => `<p>${escapeHTML(v)}</p>`)
      .join('')}</details>`;
  }
  private async finishBattle() {
    const battle = this.battle,
      s = this.state;
    if (!battle || !battle.outcome || !s) return;
    this.paused = true;
    const practice = (battle.plan.originMode ?? battle.plan.mode) === 'Calibration',
      active = s.active;
    let r = priceResult(
      {
        ...(active?.start ?? s),
        discoveries: [
          ...new Set([
            ...(active?.start.discoveries ?? s.discoveries),
            ...(active?.completed.flatMap((r) => r.discovered) ?? []),
          ]),
        ],
      },
      battle.result(active?.id ?? crypto.randomUUID(), active?.sequence ?? '0', practice),
    );
    if (practice) {
      this.record = r;
      this.battle = null;
      this.view.battle = null;
      this.audio.stinger(r.outcome === 'Victory');
      this.open('Results');
      this.render();
      return;
    }
    if (!active) throw new Error('Active journal is missing');
    if (
      (battle.plan.originMode ?? battle.plan.mode) === 'Endurance' &&
      r.outcome === 'Victory' &&
      battle.plan.block < battle.plan.blocks
    ) {
      const next = structuredClone(s),
        run = next.active!;
      run.completed.push(r);
      for (const e of battle.entities)
        if (e.owned) {
          run.signatures[e.owned] = e.signature === 'active' ? 'used' : e.signature;
          run.signatureShots[e.owned] = e.signatureShots;
        }
      for (const p of r.performance) {
        const a = run.start.assets.find((a) => a.id === p.id);
        if (a) {
          a.hp = p.endingHP;
          a.charges = p.endingCharges;
        }
      }
      run.start.coreHP = r.coreHP;
      run.block++;
      const frozen = run.rootPlan.following.find((p) => p.block === run.block);
      if (!frozen) throw new Error('The captured Endurance continuation is missing');
      const p = structuredClone(frozen);
      if (run.rootPlan.mode === 'Archive') {
        p.originMode = 'Endurance';
        p.mode = 'Archive';
      }
      run.engine = battle.checkpointClock();
      run.plan = p;
      await this.save(next);
      this.state = next;
      this.notify(`Block ${run.block - 1} saved. Next block begins after a short intermission.`);
      this.intermission = 180;
      this.nextBlockPlan = p;
      this.paused = false;
      this.render();
      return;
    }
    if (active.completed.length) r = combineResults([...active.completed, r]);
    this.pendingRecovery = structuredClone(r);
    await this.retryPending();
  }
  private async retryPending() {
    if (!this.state) return;
    if (!this.state.pending && this.pendingRecovery) {
      const next = structuredClone(this.state);
      next.pending = structuredClone(this.pendingRecovery);
      await this.save(next);
      this.state = next;
      this.pendingRecovery = null;
    }
    await this.finalize();
  }
  private async finalize() {
    const s = this.state;
    if (!s?.pending) return;
    const after = structuredClone(s),
      r = after.pending!;
    claimResult(after, r);
    await this.save(after);
    this.state = after;
    this.record = r;
    this.battle = null;
    this.view.battle = null;
    this.view.state = after;
    this.history = [];
    this.redo = [];
    this.audio.stinger(r.outcome === 'Victory');
    this.section =
      r.outcome === 'Victory' && r.plan.stage === 39 && !s.stages.includes(39)
        ? 'Ending'
        : 'Results';
    this.panel.hidden = false;
    this.render();
  }
  private openRecovery() {
    this.section = 'Recovery';
    this.panel.hidden = false;
    this.renderPanel();
  }
  private recoveryMenu(s: GameState): string {
    const pending = this.pendingRecovery ?? s.pending;
    if (pending)
      return `<h3>${this.pendingRecovery ? 'Result retained in memory: retry saving' : 'Result securely journaled'}</h3><p>${pending.outcome} · ${n(pending.credits)} Credits · ${n(pending.xp)} XP. Rewards will be applied once.</p>${this.button('Finalize result', () => this.retryPending(), true)}${this.button('Export recovery backup', () => this.exportData())}`;
    if (s.active)
      return `<h3>Interrupted siege</h3><p>${escapeHTML(s.active.plan.name)}${s.active.completed.length ? ` · ${s.active.completed.length} completed blocks protected` : ''}. Restart the captured ${(s.active.plan.originMode ?? s.active.plan.mode) === 'Endurance' ? 'current block' : 'siege start'}. This uses the same run identity.</p><div class="button-row">${this.button('Restart checkpoint', () => this.startSiege(s.active!.plan, true), true)}${this.button(
        'Abandon attempt',
        async () => {
          if (
            !(await this.confirm(
              'Abandon interrupted attempt',
              s.active!.completed.length
                ? 'Finalize completed Endurance block entitlements; the incomplete block earns nothing.'
                : 'No unknown partial combat is retained. This attempt earns no rewards.',
              'Abandon',
            ))
          )
            return;
          const next = structuredClone(s);
          if (next.active!.completed.length) {
            const first = combineResults(next.active!.completed);
            first.outcome = 'Defeat';
            first.sequence = next.active!.sequence;
            first.id = next.active!.id;
            next.pending = first;
            await this.save(next);
            this.state = next;
            await this.finalize();
          } else {
            next.finalized = next.sequence;
            next.active = null;
            await this.save(next);
            this.state = next;
            this.render();
          }
        },
      )}</div>`;
    const deployed = s.assets.filter((a) => a.placement),
      cost =
        Math.ceil((10240000 - s.coreHP) / 10240) +
        deployed.reduce((n, a) => n + repairQuote(a) + rearmQuote(a), 0);
    return `<h3>Core and readiness</h3><p>Core ${body(s.coreHP)} / 10,000 Integrity</p>${this.button(`Repair Core · ${n(Math.ceil((10240000 - s.coreHP) / 10240))} ◈`, () => this.command((c) => repair(c, null)), false, s.coreHP === 10240000)}<details><summary>Partial repairs</summary><div class="button-row">${[0.25, 0.5].map((f) => this.button(`${f * 100}% missing Core body`, () => this.command((c) => repair(c, null, f)))).join('')}${this.button(
      'Maximum affordable Core repair',
      () =>
        this.command((c) => {
          const missing = 10240000 - c.coreHP,
            affordable = Math.min(missing, c.credits * 10240);
          if (!affordable) throw new Error('No affordable missing Integrity');
          repair(c, null, affordable / missing);
        }),
    )}</div></details><p>Full deployed readiness costs ${n(cost)} Credits. Reserve funds are advisory; choosing a cheaper repair remains available.</p>${this.button(
      'Repair and rearm deployed force',
      async () => {
        if (
          await this.confirm(
            'Restore readiness',
            `${n(cost)} Credits. All deployed living bodies become full; wrecks return at half body and finite traps receive full permanent stock.`,
          )
        )
          await this.command((c) => {
            repair(c, null);
            for (const a of c.assets.filter((a) => a.placement)) {
              repair(c, a);
              rearm(c, a);
            }
          });
      },
    )}<details><summary>Emergency recovery</summary><p>At zero Credits, assistance raises the Core to at least 25% and restores a basic defending force to at least half body. Subsidized assets cannot be sold for a profit. A paid victory unlocks existing refund locks.</p>${this.button('Request emergency assistance', () => this.command((c) => emergency(c), false), false, s.credits > 0)}</details>`;
  }
  private recordsMenu(s: GameState): string {
    return `<details><summary>Lifetime records</summary><p>${n(s.totals.sieges)} sieges · ${n(s.totals.victories)} victories · ${n(s.totals.defeats)} defeats · ${n(s.totals.kills)} hostiles destroyed · ${n(s.totals.seconds)} combat seconds</p><p>Damage ${body(s.totals.damage)} · Healing ${body(s.totals.healing)} · Shield absorption ${body(s.totals.shield)}</p></details><details open><summary>Campaign · ${s.stages.length}/40</summary><p>${s.stages.length === 40 ? 'Campaign Complete · Mastery unlocked' : `Next stage: ${stageInfo(Math.min(39, s.stages.length)).name}`}</p><p>Mastery ${s.trials.length}/12 ${s.trials.length === 12 ? '· Bastion Master' : ''} · Discovered ${s.discoveries.length}/24 enemy roles and bosses</p></details><details><summary>Recent sieges · ${s.history.length}/100</summary>${
      s.history
        .slice(0, 30)
        .map(
          (r) =>
            `<article class="menu-card"><h3>${escapeHTML(r.plan.name)}</h3><p>${r.outcome} · ${Math.floor(r.seconds)}s · ${n(r.credits)} ◈ · ${n(r.xp)} XP</p>${this.button(
              'Review',
              () => {
                this.record = r;
                this.resultsTab = 'Summary';
                this.open('Results');
              },
            )}</article>`,
        )
        .join('') || '<p>No completed sieges yet.</p>'
    }</details><details><summary>Siege Archive · ${s.archive.length}/32</summary>${s.archive
      .map(
        (p) =>
          `<article class="menu-card"><h3>${escapeHTML(p.name)}</h3><div class="button-row">${this.button(
            'Replay forecast',
            () => {
              this.forecast = {
                ...structuredClone(p),
                mode: 'Archive',
                originMode: p.originMode ?? p.mode,
              };
              this.open('Forecast');
            },
          )}${this.button(s.favorites.includes(p.hash) ? 'Unfavorite' : 'Favorite', () =>
            this.command((c) => {
              c.favorites = c.favorites.includes(p.hash)
                ? c.favorites.filter((v) => v !== p.hash)
                : [...c.favorites, p.hash];
            }, false),
          )}${this.button('Delete plan', () =>
            this.command((c) => {
              c.archive = c.archive.filter((v) => v.hash !== p.hash);
              c.favorites = c.favorites.filter((v) => v !== p.hash);
            }, false),
          )}</div></article>`,
      )
      .join(
        '',
      )}</details><details><summary>Enemy intelligence</summary>${[...ENEMIES, ...BOSSES].map((d) => `<article class="menu-card"><h3>${s.discoveries.includes(d.id) ? d.name : 'Undiscovered contact'}</h3>${s.discoveries.includes(d.id) ? `<p>${this.enemyCounter(d.id)}</p>` : ''}</article>`).join('')}</details><details><summary>Practice comparisons · ${s.comparisons.length}/64</summary>${this.comparisonMenu(s)}</details>`;
  }
  private mapMenu(_s: GameState): string {
    const warden = this.battle?.alive(0).find((e) => e.d.category === 'warden');
    const boss = this.battle
      ?.alive(1)
      .find((e) => e.d.category === 'boss' && this.battle!.perceived(e));
    const jump = (x: number, y: number) => {
      this.view.jump({ x, y });
    };
    return `<p>North stays at the top. Tap a broad region to move the camera. Cyan marks allies; ochre marks perceived hostiles. Air contacts use diamonds.</p>${this.view.tacticalMap()}<div class="button-row">${this.button('Jump to Core', () => jump(30, 30))}${this.button('Jump to Warden', () => jump(warden ? warden.x / 1024 : 30, warden ? warden.y / 1024 : 34))}${this.button(
      boss ? 'Jump to boss' : 'Boss not located',
      () => {
        if (boss) jump(boss.x / 1024, boss.y / 1024);
      },
      false,
      !boss,
    )}${ENTRANCES.map((p, i) => this.button('Front ' + (i + 1), () => jump(p.x, p.y))).join('')}</div>${this.battle ? '<p>Map inspection pauses combat. Close the map and press Resume when ready.</p>' : ''}<details><summary>Routes and tactics</summary>${this.button(
      this.view.routesVisible ? 'Hide routes and anchors' : 'Show routes and anchors',
      () => {
        this.view.routesVisible = !this.view.routesVisible;
        this.renderPanel();
      },
    )}<p>Lines show the open routes for ordinary and heavy ground bodies. Obstructed routes require breach after Rank 25. Anchors are deployment tactics, not direct movement commands.</p></details>`;
  }
  private comparisonMenu(s: GameState): string {
    const first = s.comparisons.find((r) => r.id === this.comparison);
    return (
      s.comparisons
        .map(
          (r) =>
            `<article class="menu-card"><h3>${escapeHTML(r.plan.name)}</h3><p>${r.outcome} · Core ${body(r.coreHP)} · ${r.wrecks} wrecks · ${Math.floor(r.seconds)}s</p><details><summary>Captured conditions</summary><p>${escapeHTML(r.plan.difficulty)} · Band ${r.plan.band} · Tier ${r.plan.tier} · ${escapeHTML(r.plan.recipe)} · ${escapeHTML(r.plan.seed)}</p><p>Army ${r.armyFingerprint.slice(0, 16)} · Plan ${r.plan.hash.slice(0, 16)}</p><p>${r.plan.practice ? `Capacity ${r.plan.practice.capacity}, traps ${r.plan.practice.traps}, barriers ${r.plan.practice.barriers}; ${r.plan.practice.fullRepair ? 'fully repaired clone' : 'current injury/stock'}; ${r.plan.practice.flipBranches ? 'opposite earned branches' : 'owned branches'}` : 'Standard clone'}</p></details>${first && first.id !== r.id ? `<p>${first.plan.hash === r.plan.hash ? 'Same encounter' : 'Different encounter'} · ${first.armyFingerprint === r.armyFingerprint ? 'Same captured army' : 'Different army, layout or injury'}</p><table><tr><th>Compared with</th><th>Core</th><th>Wrecks</th><th>Seconds</th></tr><tr><td>${escapeHTML(first.plan.name)}</td><td>${body(first.coreHP)}</td><td>${first.wrecks}</td><td>${Math.floor(first.seconds)}</td></tr><tr><td>This result</td><td>${body(r.coreHP)}</td><td>${r.wrecks}</td><td>${Math.floor(r.seconds)}</td></tr></table>` : ''}<div class="button-row">${this.button(
              first?.id === r.id ? 'Selected for comparison' : 'Select for comparison',
              () => {
                this.comparison = r.id;
                this.renderPanel();
              },
            )}${this.button('Delete comparison', async () => {
              if (await this.confirm('Delete comparison', 'Remove this saved practice record?'))
                await this.command((c) => {
                  c.comparisons = c.comparisons.filter((v) => v.id !== r.id);
                }, false);
            })}</div></article>`,
        )
        .join('') || '<p>Save practice results to compare layouts.</p>'
    );
  }
  private resultsMenu(): string {
    const r = this.record;
    if (!r) return '<p>No result selected.</p>';
    let details = '';
    const tabs = [
      'Summary',
      'Rewards',
      'Friendly performance',
      'Enemy analysis',
      'Damage timeline',
      'Base heatmap',
      'Unlocks',
    ];
    if (this.resultsTab === 'Summary')
      details = `<h3>${r.practice ? 'Practice · ' : ''}${r.outcome}</h3><p>${escapeHTML(r.plan.name)} · ${Math.floor(r.seconds)} combat seconds</p><div class="result-stats"><div><strong>${body(r.coreHP)}</strong><span>Core Integrity</span></div><div><strong>${r.wrecks}</strong><span>Owned wrecks</span></div><div><strong>${n(r.credits)}</strong><span>Credits earned</span></div></div><p>${r.practice ? 'Owned body, stock, wallet and progress are unchanged.' : 'Rewards and ending body are already committed. Returning to base cannot collect them again.'}</p>${!r.practice && this.state ? `<p>Estimated deployed recovery: ${n(Math.ceil((10240000 - this.state.coreHP) / 10240) + this.state.assets.filter((a) => a.placement).reduce((sum, a) => sum + repairQuote(a) + rearmQuote(a), 0))} Credits. Net reward depends on your chosen repairs.</p>` : ''}`;
    if (this.resultsTab === 'Rewards')
      details = `<div class="result-stats"><div><strong>${n(r.credits)}</strong><span>Credits</span></div><div><strong>${n(r.xp)}</strong><span>Bastion XP</span></div><div><strong>${n(r.assetXP)}</strong><span>Asset XP pool</span></div><div><strong>${n(r.cores)}</strong><span>Promotion Cores</span></div></div><p>Unused asset XP at level caps: ${n(r.unusedAssetXP)}</p><p>${r.bonuses.map(escapeHTML).join(' · ')}</p>${r.clipped !== '0' ? `<p>Wallet limit: ${r.clipped} excess was not credited.</p>` : ''}<details><summary>Destroyed-threat origins</summary><table><thead><tr><th>Block / segment</th><th>Destroyed / planned TP</th></tr></thead><tbody>${r.buckets.map((b) => `<tr><td>${b.block} / ${b.segment}</td><td>${b.destroyedQTP / 4} / ${b.plannedQTP / 4}</td></tr>`).join('')}</tbody></table></details>`;
    if (this.resultsTab === 'Friendly performance')
      details = r.performance
        .slice()
        .sort((a, b) => b.contribution - a.contribution)
        .map(
          (p) =>
            `<details class="menu-card"><summary>${definition(p.type).name} · ${body(p.damage)} damage</summary><p>Asset XP ${n(r.allocations.find((a) => a.id === p.id)?.granted ?? '0')} · Contribution ${body(p.contribution)}</p><p>Healing ${body(p.healing)} · Shield absorption ${body(p.shield)} · Ending body ${body(p.endingHP)}${p.endingCharges !== null ? ` · ${p.endingCharges} permanent charges` : ''}</p><p>${
              Object.entries(p.reasons)
                .slice()
                .sort((a, b) => b[1] - a[1])
                .slice(0, 4)
                .map(([reason, count]) => `${reason}: ${count} observations`)
                .join(' · ') || 'No repeated blockage observed'
            }</p></details>`,
        )
        .join('');
    if (this.resultsTab === 'Enemy analysis')
      details =
        Object.entries(r.killed)
          .map(
            ([id, count]) =>
              `<article class="menu-card"><h3>${definition(id).name} · ${count} destroyed</h3><p>${this.enemyCounter(id)}</p></article>`,
          )
          .join('') || '<p>No hostile bodies were destroyed.</p>';
    if (this.resultsTab === 'Damage timeline') {
      const values = r.timeline,
        max = Math.max(1, ...values.flatMap((v) => [v.friendly, v.enemy])),
        step = Math.max(1, Math.ceil(values.length / 80));
      details = `<p>Cyan: defender body damage dealt. Ochre: hostile body damage dealt. Shield absorption is reported separately.</p><svg class="timeline-chart" viewBox="0 0 320 100" role="img" aria-label="Body damage over combat time">${values
        .filter((_, i) => i % step === 0)
        .map((v, i) => {
          const x = (i * 320) / Math.ceil(values.length / step);
          return `<line x1="${x}" x2="${x}" y1="100" y2="${100 - (v.friendly / max) * 95}" stroke="#75d5d6" stroke-width="2"/><line x1="${x + 2}" x2="${x + 2}" y1="100" y2="${100 - (v.enemy / max) * 95}" stroke="#e7a77c" stroke-width="2"/>`;
        })
        .join('')}</svg><p>0–${Math.floor(r.seconds)} seconds</p>`;
    }
    if (this.resultsTab === 'Base heatmap') {
      const max = Math.max(1, ...r.heatmap);
      details = `<p>Actual body damage locations, binned into 10×10 ground-unit regions. The center contains the Core.</p><div class="heatmap" role="img" aria-label="Six by six damage heatmap">${r.heatmap.map((v) => `<div style="background:rgba(223,144,97,${0.08 + (0.82 * v) / max})">${body(v)}</div>`).join('')}</div>`;
    }
    if (this.resultsTab === 'Unlocks')
      details = `<p>${
        r.discovered
          .map((id) => definition(id).name)
          .map(escapeHTML)
          .join(', ') || 'No newly perceived role in this run.'
      }</p>${
        this.state
          ? `<p>Current Rank ${this.state.rank} · ${this.state.stages.length}/40 campaign · ${this.state.trials.length}/12 mastery</p><p>${
              FRIENDLIES.filter((d) => d.rank <= this.state!.rank && d.rank > 1)
                .map((d) => d.name)
                .join(' · ') || 'Starter roster available'
            }</p>`
          : ''
      }`;
    return `<div class="result-tabs">${tabs
      .map((t) =>
        this.button(
          t,
          () => {
            this.resultsTab = t;
            this.renderPanel();
          },
          this.resultsTab === t,
        ),
      )
      .join('')}</div>${details}<div class="button-row">${this.button(
      'Return to base',
      () => {
        this.close();
        this.render();
        void this.audio.play('preparation');
      },
      true,
    )}${
      r.practice
        ? this.button('Save comparison', () =>
            this.command((c) => {
              if (c.comparisons.length >= 64)
                throw new Error('Delete an old comparison before saving another');
              c.comparisons.push(structuredClone(r));
            }, false),
          )
        : this.button('Retry forecast', () => {
            this.forecast = {
              ...structuredClone(r.plan),
              mode:
                r.plan.mode === 'Endurance'
                  ? 'Endurance'
                  : r.plan.stage !== null
                    ? 'Campaign'
                    : 'Archive',
              block: 1,
            };
            this.open('Forecast');
          })
    }</div>`;
  }
  private settingsMenu(s: GameState): string {
    const t = s.settings;
    return `${this.input('Master volume (%)', String(Math.round(t.master * 100)), 'set-master', 'range', 'min="0" max="100"')}${this.input('Alerts volume (%)', String(Math.round(t.alerts * 100)), 'set-alerts', 'range', 'min="0" max="100"')}${this.select('Effects', ['Full', 'Reduced'], t.reducedEffects ? 'Reduced' : 'Full', () => {}, 'set-effects')}${this.select('Contrast', ['Standard', 'High'], t.highContrast ? 'High' : 'Standard', () => {}, 'set-contrast')}${this.select('UI scale', ['100', '125', '150', '175', '200'], String(t.uiScale), () => {}, 'set-scale')}${this.select('Render quality', ['Auto', 'High', 'Low'], t.quality, () => {}, 'set-quality')}${this.select('Sound', ['Enabled', 'Muted'], t.muted ? 'Muted' : 'Enabled', () => {}, 'set-muted')}${this.input('Music volume (%)', String(Math.round(t.music * 100)), 'set-music', 'range', 'min="0" max="100"')}${this.input('Effects volume (%)', String(Math.round(t.sfx * 100)), 'set-sfx', 'range', 'min="0" max="100"')}${this.input('UI volume (%)', String(Math.round(t.ui * 100)), 'set-ui', 'range', 'min="0" max="100"')}${this.select('Event captions', ['Enabled', 'Disabled'], t.captions ? 'Enabled' : 'Disabled', () => {}, 'set-captions')}${this.select('Spending review', ['Enabled', 'Disabled'], t.confirmSpending ? 'Enabled' : 'Disabled', () => {}, 'set-spend')}<p>Reduced effects keeps the same warning geometry and timing. Sound never controls battle time.</p>${this.button(
      'Apply settings',
      async () => {
        const after = structuredClone(this.state!);
        after.settings = {
          ...t,
          reducedEffects: this.value('set-effects') === 'Reduced',
          highContrast: this.value('set-contrast') === 'High',
          uiScale: Number(this.value('set-scale')),
          quality: this.value('set-quality') as typeof t.quality,
          muted: this.value('set-muted') === 'Muted',
          master: Number(this.value('set-master')) / 100,
          alerts: Number(this.value('set-alerts')) / 100,
          music: Number(this.value('set-music')) / 100,
          sfx: Number(this.value('set-sfx')) / 100,
          ui: Number(this.value('set-ui')) / 100,
          captions: this.value('set-captions') === 'Enabled',
          confirmSpending: this.value('set-spend') === 'Enabled',
        };
        if (!this.settingsOnly) await this.save(after);
        else localStorage.setItem('rb-full-accessibility', JSON.stringify(after.settings));
        if (this.settingsOnly) {
          this.state = null;
          this.settingsOnly = false;
          this.showTitle();
        } else {
          this.state = after;
          this.render();
        }
        await this.audio.enable(after.settings);
        this.notify('Settings applied');
      },
      true,
    )}`;
  }
  private dataMenu(): string {
    const s = this.state;
    return `<p>${this.temporary ? 'Temporary Session: export before closing.' : 'Local browser storage: export backups to keep a separate copy.'}</p><div class="button-row">${
      s
        ? this.button('Save now', async () => {
            await this.save(structuredClone(s));
            this.notify(this.temporary ? 'Temporary Session updated' : 'Saved');
          })
        : ''
    }${s ? this.button('Export backup', () => this.exportData()) : ''}${this.button('Import backup', () => this.chooseImport())}${
      s && this.store
        ? this.button('Restore previous', async () => {
            if (s.active || s.pending) throw new Error('Finalize or abandon the current run first');
            const previous = await this.store!.previous(s.slot);
            if (!previous) throw new Error('No previous snapshot exists');
            if (
              await this.confirm(
                'Restore previous',
                `${previous.name} · Rank ${previous.rank} · ${n(previous.credits)} Credits. Later body, wallet and progress roll back; finalized rewards and first clears cannot be paid again.`,
                'Restore',
              )
            ) {
              const restored = await this.store!.restore(previous);
              this.load(restored);
            }
          })
        : ''
    }${this.button('Request storage persistence', async () => {
      const granted = await navigator.storage?.persist?.();
      this.notify(
        granted
          ? 'Browser granted persistent storage'
          : 'Browser did not grant persistent storage; backups remain available',
      );
    })}${
      s
        ? this.button('Delete this campaign', async () => {
            if (
              await this.confirm(
                'Delete campaign',
                `${s.name}, Rank ${s.rank}. Export first to keep it.`,
                'Delete',
              )
            ) {
              if (this.store && !this.temporary) await this.store.remove(s.slot);
              this.slots = this.slots.filter((v) => v.slot !== s.slot);
              this.state = null;
              this.view.state = null;
              this.showTitle();
            }
          })
        : ''
    }</div><details><summary>Earlier preview and compatibility</summary><p>Historical previews and original saves stay separate. Open the earlier version to resolve its pending or interrupted run before copying progress here.</p><a href="?legacy=1" class="link-button">Open earlier preview</a></details><details><summary>Backup details</summary><p>Checksummed JSON includes the owned force, wallet, claim fences, settings, plans, records and exact recovery checkpoints. Import replaces a chosen slot; it never combines wallets. Clearing browser data removes local saves.</p></details>`;
  }
  private async exportData() {
    if (!this.state) return;
    const exporting = structuredClone(this.state);
    if (this.pendingRecovery) exporting.pending = this.pendingRecovery;
    const text = this.store
      ? await this.store.export(exporting)
      : JSON.stringify(
          {
            format: 'resonance-bastion-backup',
            version: FULL_VERSION,
            campaign: exporting,
            checksum: await hash(exporting),
          },
          null,
          2,
        );
    const blob = new Blob([text], { type: 'application/json' }),
      file = new File(
        [blob],
        `Resonance-Bastion-${this.state.name.replace(/[^a-z0-9-]/gi, '-')}.json`,
        { type: 'application/json' },
      );
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: 'Resonance Bastion backup' });
        this.notify('Backup offered to your selected app');
        return;
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') return;
      }
    }
    const url = URL.createObjectURL(blob),
      a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    this.notify('Backup download offered');
  }
  private chooseImport() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      void this.run(async () => {
        if (file.size > 32 * 1024 * 1024) throw new Error('Backup exceeds 32 MiB');
        if (this.state?.active || this.state?.pending)
          throw new Error('Resolve the current active/pending run before importing');
        const text = await file.text();
        let incoming: GameState;
        try {
          incoming = await inspectFullBackup(text);
        } catch (fullError) {
          try {
            const old = await readBackup(text),
              slot = old.backup.slots[0]!;
            if ('run' in slot && slot.run)
              throw new Error('Resolve the earlier version run before migration');
            incoming = migrateLegacy(slot.campaign, slot.fence);
          } catch {
            throw fullError;
          }
        }
        if (
          await this.confirm(
            'Import backup',
            `${incoming.name}, Rank ${incoming.rank}, ${incoming.assets.length} assets. Replace slot ${incoming.slot + 1}? No wallets or inventories will be merged.`,
            'Replace',
          )
        ) {
          if (this.store && !this.temporary) incoming = await this.store.restore(incoming);
          else await this.save(incoming);
          this.load(incoming);
        }
      });
    };
    input.click();
  }
  private help(): string {
    return `<details open><summary>Your first siege</summary><p>Your guided layout uses the free starting force. Choose Siege → Campaign → Review forecast → Start siege. Combat is automatic. Survive the deployment and clear the remaining hostiles.</p></details><details><summary>Touch controls</summary><p>Drag an empty area of the field to pan. Pinch with two fingers to zoom around the midpoint. Touch an asset to inspect it. The crosshair centers the base; the curved arrow rotates the camera.</p><p>While placing, one finger moves the preview and two fingers move the camera. Confirm placement saves it. No purchases happen from touching the field.</p></details><details><summary>Build and recover</summary><p>Recruit into storage, then deploy on owned land. Check capacity, route cells, and trap limits. Store, move, repair, rearm, enhance, promote, and choose tactics through Army or the field inspector.</p><p>Injury reduces ordinary mobile weapon and support output. Wrecks stay owned. Repairing a wreck restores half body. Emergency recovery is available at zero Credits.</p></details><details><summary>Progression and replay</summary><p>Expeditions earn progression between rank-gated campaign stages. Campaign has 40 stages and eight bosses. Endurance and Long Watch unlock at Rank 30. Mastery unlocks after Campaign Complete. Rank 100 offers modifiers and challenge tiers.</p><p>Archive replays use the current army. Calibration is free and cannot earn currencies or campaign progress. Promotion requires both Bastion Rank and asset level; stars are purchased sequentially.</p></details><details><summary>Saving and interruption</summary><p>Preparation commands save before they are reported committed. Interrupted ordinary sieges restart the captured start. Endurance protects completed blocks and restarts only the current incomplete block. Results journal before a single atomic reward commit.</p><p>Export backups from Manage → Data. A second tab is read only until you explicitly take over editing. There is no offline progress.</p></details><details><summary>Keyboard access</summary><p>Tab moves between controls. Arrow keys pan the focused field. Plus/minus zoom. Space pauses a battle. Escape closes a panel. Menu drawers have internal scrolling; the field remains visible.</p></details>`;
  }
  private credits(): string {
    return `<p>Resonance Bastion is an original browser fortress-defense game developed from the final project blueprint for Thomas Gross.</p><p>Original native pixel artwork, joint poses, geometry, score and synthesized effects are authored within this repository. Source generators and manifests accompany the assets.</p><p>Phaser 3.90 (MIT), Zod (MIT), TypeScript, Vite, and the browser platform power the game.</p><p>Comprehensive balance, animation, interaction and real-device acceptance testing follows the first-pass review.</p>`;
  }
  private async applyLayoutPreview(p: LayoutPreview, title: string) {
    const details = `${p.accepted} accepted · ${p.rejected.length} rejected · ${n(p.cost)} Credits. ${p.rejected.slice(0, 6).join('; ')}`;
    if (!p.accepted) throw new Error(details);
    if (
      await this.confirm(
        title,
        details,
        p.rejected.length ? 'Apply explicit valid subset' : 'Apply all',
      )
    )
      await this.command((c) => {
        c.assets = p.state.assets;
        c.credits = p.state.credits;
      });
  }
  private batchMenu(s: GameState): string {
    const types = FRIENDLIES.filter((d) => d.category !== 'warden' && d.rank <= s.rank);
    return `<p>Arrange up to 40 owned or purchased assets in a rectangle. Preview validates every footprint, wallet, allowance and entrance. Rejects stay unpurchased.</p>${this.select(
      'Asset',
      types.map((d) => d.name),
      types[0]!.name,
      () => {},
      'batch-type',
    )}${this.input('Count', '6', 'batch-count', 'number', 'min="1" max="40"')}${this.input('Columns', '3', 'batch-cols', 'number', 'min="1" max="40"')}${this.input('Start X (GU)', '18', 'batch-x', 'number')}${this.input('Start Y (GU)', '18', 'batch-y', 'number')}${this.select('Rotation', ['0', '90', '180', '270'], '0', () => {}, 'batch-rot')}${this.button(
      'Preview rectangle',
      async () => {
        const d = types.find((d) => d.name === this.value('batch-type'))!;
        await this.applyLayoutPreview(
          batchPreview(
            s,
            d.id,
            Number(this.value('batch-count')),
            Number(this.value('batch-x')),
            Number(this.value('batch-y')),
            Number(this.value('batch-cols')),
            Number(this.value('batch-rot')) / 90,
          ),
          'Place batch',
        );
      },
      true,
    )}`;
  }
  private groupMoveMenu(): string {
    return `<p>Move ${this.bulk.size} selected owned assets together without purchases. The whole translated layout must remain valid.</p>${this.input('X offset (GU)', '1', 'move-x', 'number')}${this.input('Y offset (GU)', '0', 'move-y', 'number')}${this.button(
      'Preview group move',
      async () => {
        if (this.state)
          await this.applyLayoutPreview(
            movePreview(
              this.state,
              this.bulk,
              Number(this.value('move-x')),
              Number(this.value('move-y')),
            ),
            'Move group',
          );
      },
      true,
    )}`;
  }
  private practiceLabMenu(s: GameState): string {
    return `<details><summary>Challenge lab · free owned clone</summary>${this.select(
      'Encounter',
      ['Role exercise', 'Generated recipe / boss'],
      this.practiceLab ? 'Generated recipe / boss' : 'Role exercise',
      (v) => {
        this.practiceLab = v !== 'Role exercise';
        this.renderPanel();
      },
      'lab-mode',
    )}${this.select(
      'Capacity allowance',
      ['120', '100', '80', '60'],
      String(this.practiceCapacity),
      (v) => {
        this.practiceCapacity = Number(v);
      },
      'lab-capacity',
    )}${this.select(
      'Trap allowance',
      ['40', '20', '0'],
      String(this.practiceTraps),
      (v) => {
        this.practiceTraps = Number(v);
      },
      'lab-traps',
    )}${this.select(
      'Barrier-cell allowance',
      ['200', '100', '0'],
      String(this.practiceBarriers),
      (v) => {
        this.practiceBarriers = Number(v);
      },
      'lab-barriers',
    )}${this.select(
      'Owned Warden',
      s.assets
        .filter((a) => definition(a.type).category === 'warden')
        .map((a) => definition(a.type).name),
      definition(this.practiceWarden || s.warden).name,
      (v) => {
        this.practiceWarden = FRIENDLIES.find((d) => d.name === v)!.id;
      },
      'lab-warden',
    )}${this.select(
      'Earned branches',
      ['Current branches', 'Test opposite earned branches'],
      this.practiceFlip ? 'Test opposite earned branches' : 'Current branches',
      (v) => {
        this.practiceFlip = v !== 'Current branches';
      },
      'lab-branches',
    )}<p>Allowances are clamped to this campaign’s unlocks. Exclusions store the chosen type only in the practice clone.</p>${[
      ...new Set(s.assets.map((a) => a.type)),
    ]
      .filter((id) => !id.startsWith('warden.'))
      .map((id) =>
        this.button(
          `${this.practiceExclusions.includes(id) ? 'Excluded · ' : ''}${definition(id).name}`,
          () => {
            this.practiceExclusions = this.practiceExclusions.includes(id)
              ? this.practiceExclusions.filter((v) => v !== id)
              : [...this.practiceExclusions, id];
            this.renderPanel();
          },
        ),
      )
      .join('')}${
      this.practiceLab
        ? this.select(
            'Recipe',
            availableRecipes(s.rank, this.band),
            this.recipe,
            (v) => {
              this.recipe = v;
            },
            'lab-recipe',
          ) +
          this.select(
            'Boss',
            ['No boss', ...BOSSES.filter((d) => d.rank <= s.rank).map((d) => d.name)],
            this.bossID ? definition(this.bossID).name : 'No boss',
            (v) => {
              this.bossID = BOSSES.find((d) => d.name === v)?.id ?? '';
            },
            'lab-boss',
          )
        : ''
    }</details>`;
  }
  private watchMenu(s: GameState): string {
    const w = s.watch;
    if (!w) return this.button('Create series', () => this.generate());
    return `<p>Sortie ${s.watchOrdinal} · ${w.sorties} attempts · ${w.cleared} cleared · streak ${w.streak} · best ${w.best}. ${w.parked ? 'Parked.' : ''}</p><p>Band ${w.band} · ${w.difficulty} · tier ${w.tier} · ${w.mastery ? 'Mastery' : 'Ordinary'} profile</p>${w.offers
      .map(
        (p, i) =>
          `<article class="menu-card"><h3>${i + 1}. ${escapeHTML(p.recipe)}</h3><p>${escapeHTML(p.name)} · ${p.faction} · ${p.spawns.reduce((n, s) => n + s.qtp / 4, 0)} TP</p>${this.button(
            'Review this offer',
            () => {
              this.forecast = structuredClone(p);
              this.open('Forecast');
            },
            true,
          )}</article>`,
      )
      .join('')}${this.button(
      'Compile next offers',
      async () => {
        const c = structuredClone(s);
        await offers(c);
        await this.save(c);
        this.state = c;
        this.renderPanel();
      },
      false,
      !!w.offers.length,
    )}${this.button('Free reroll', async () => {
      const c = structuredClone(s);
      c.watch!.rerolls++;
      c.watch!.offers = [];
      await offers(c);
      await this.save(c);
      this.state = c;
      this.renderPanel();
    })}${this.button('Apply current siege preferences', async () => {
      const c = structuredClone(s);
      Object.assign(c.watch!, {
        band: this.band,
        difficulty: this.difficulty,
        modifiers: [...this.modifiers],
        tier: this.tier,
        mastery: this.watchMastery && s.stages.length === 40,
        offers: [],
      });
      await offers(c);
      await this.save(c);
      this.state = c;
      this.renderPanel();
    })}${this.button('Park series', async () => {
      await this.command((c) => {
        c.watch!.parked = true;
      }, false);
      this.close();
    })}${this.button('Close series', async () => {
      if (
        await this.confirm(
          'Close Long Watch',
          'Keep aggregate records and release the current offers?',
        )
      )
        await this.command((c) => closeSeries(c), false);
      this.open('Siege');
    })}`;
  }
  private workshopMenu(s: GameState): string {
    return `<p>Optional appearance only. Preview is free. Purchased styles equip separately and grant no combat advantage.</p>${this.button(
      'Reset appearance',
      () =>
        this.command((c) => {
          c.appearance = { ground: null, trim: null, banner: null, plaque: null, hud: null };
        }),
    )}${COSMETICS.map(
      (c) =>
        `<details class="menu-card"><summary>${c.name} · ${n(c.cost)} ◈</summary><p>${c.id} · ${c.kind} · Rank ${c.rank}${'ending' in c ? ' · Campaign Complete' : ''}</p><div class="button-row">${this.button(
          'Preview',
          () => {
            const preview = structuredClone(s);
            preview.appearance[c.kind] = c.id;
            this.view.state = preview;
            this.notify('Appearance preview. Close the panel to restore your equipped style.');
          },
        )}${
          s.cosmetics.includes(c.id)
            ? this.button('Equip', () => this.command((v) => equipCosmetic(v, c.id)))
            : this.button(
                'Purchase',
                async () => {
                  if (
                    await this.confirm(
                      'Purchase appearance',
                      `${c.name} · ${n(c.cost)} Credits`,
                      'Purchase',
                    )
                  )
                    await this.command((v) => purchaseCosmetic(v, c.id), false);
                },
                false,
                s.rank < c.rank || ('ending' in c && s.stages.length !== 40),
              )
        }</div></details>`,
    ).join('')}`;
  }
  private endingMenu(): string {
    return `<img class="ending-art" src="${import.meta.env.BASE_URL}assets/full/campaign-ending.png" alt="The eight broken siege standards surround a shining Harmonic Core above the rebuilt bastion."><h3>The Core Endures</h3><p>The final root falls silent. Across the fractured approaches, your fortress remains a beacon. Your defenders, their scars, and the stronghold you built stay yours.</p><p>Campaign Complete. Mastery trials and repeatable sieges remain available.</p>${this.button('Skip / return to fortress', () => this.close(), true)}${this.button('Credits', () => this.open('Credits'))}`;
  }
  private importEncounter() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = () => {
      const f = input.files?.[0];
      if (f && this.state)
        void this.run(async () => {
          if (f.size > 32 * 1024 * 1024) throw new Error('Encounter code exceeds 32 MiB');
          this.forecast = await readEncounterCode(await f.text(), this.state!);
          this.open('Forecast');
        });
    };
    input.click();
  }
  private async shareEncounter(p: Plan) {
    const file = new File([await encounterCode(p)], `RB-${p.hash.slice(0, 12)}.json`, {
      type: 'application/json',
    });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: p.name });
        return;
      } catch {
        /* Downloads remain available. */
      }
    }
    const url = URL.createObjectURL(file),
      a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }
  private frame(now: number) {
    const elapsed = Math.min(0.25, Math.max(0, (now - this.lastFrame) / 1000));
    this.lastFrame = now;
    if (this.view.contextLost && this.battle && !this.paused) {
      this.paused = true;
      this.audio.pause(true);
      this.notify('Paused while graphics recover. Resume when the field is restored.');
    }
    if (this.intermission && !this.paused && !this.busy) {
      this.accumulator += elapsed * this.speed;
      while (this.accumulator >= 1 / 60 && this.intermission > 0) {
        this.intermission--;
        this.accumulator -= 1 / 60;
      }
      if (!this.intermission && this.nextBlockPlan) {
        const p = this.nextBlockPlan;
        this.nextBlockPlan = null;
        void this.run(() => this.startSiege(p, true));
      }
    }
    if (this.battle && !this.paused && !this.busy && !this.battle.outcome) {
      this.accumulator += elapsed * this.speed;
      let steps = 0;
      while (this.accumulator >= 1 / 60 && steps < 60 && !this.battle.outcome) {
        this.battle.step();
        this.accumulator -= 1 / 60;
        steps++;
      }
      for (const effect of this.battle.effects)
        if (effect.id > this.lastEffect) {
          this.audio.sound(effect.kind);
          this.lastEffect = Math.max(this.lastEffect, effect.id);
        }
      if (this.battle.outcome) {
        this.paused = true;
        void this.run(async () => {
          try {
            await this.finishBattle();
          } catch (error) {
            this.section = 'Recovery';
            this.panel.hidden = false;
            this.renderPanel();
            throw error;
          }
        });
      }
    }
    if (now - this.lastHUD > 250) {
      this.updateHUD();
      this.lastHUD = now;
    }
    this.view.render();
    requestAnimationFrame((t) => this.frame(t));
  }
}
new FullApp();
