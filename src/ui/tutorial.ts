import type { AudioMixer, AudioSettings } from '../audio/mixer';
import { combat } from '../data/combat';
import type { Campaign } from '../persistence/campaign';
import { type PracticeCheckpoint, PracticeStore, practiceArmy } from '../persistence/practice';
import type { PreferencesStore } from '../persistence/preferences';
import type { CampaignRepository } from '../persistence/repository';
import { CombatRenderer } from '../render/combat';
import { WorldView } from '../render/world';
import { Battle, type BattleEvent } from '../sim/battle';
import { BattleClock } from '../sim/clock';
import { hash } from '../sim/determinism';
import { U } from '../sim/fixed';
import { InterfaceTime } from './interface-time';

const stores = new WeakMap<CampaignRepository, PracticeStore>();
export function practiceStore(repo: CampaignRepository): PracticeStore {
  let store = stores.get(repo);
  if (!store) {
    store = new PracticeStore(repo);
    stores.set(repo, store);
  }
  return store;
}
const safe = (s: string) =>
  s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
export class TutorialSession {
  readonly store: PracticeStore;
  checkpoint: PracticeCheckpoint | undefined;
  battle: Battle | undefined;
  world: WorldView | undefined;
  renderer: CombatRenderer | undefined;
  clock: BattleClock | undefined;
  raf = 0;
  disposed = false;
  busy = false;
  lastRender = 0;
  readonly interfaceTime = new InterfaceTime();
  lastHUD = -1;
  lastEventSequence = 0;
  previous = new Map<number, { x: number; y: number }>();
  private callbacks: (() => void)[] = [];
  readonly dialog: HTMLDialogElement;
  captions: { message: string; expires: number }[] = [];
  private acknowledgedCritical = false;
  terminalSaving = false;
  terminalError = false;
  constructor(
    readonly parent: HTMLElement,
    readonly campaign: Campaign,
    readonly repo: CampaignRepository,
    readonly preferences: PreferencesStore,
    readonly audio: AudioMixer,
    readonly exit: (title: boolean) => void,
  ) {
    this.store = practiceStore(repo);
    parent.innerHTML =
      '<h2>Tutorial Practice</h2><p class="notice">Disposable clone · No campaign Credits, XP, damage, claims or discoveries. Gate 2 combat slice; campaign result progression arrives in Gate 3.</p><p id="battle-status" role="status"></p><div id="battle-content"></div><dialog id="battle-dialog" aria-labelledby="battle-dialog-heading"><h2 id="battle-dialog-heading"></h2><div id="battle-dialog-body"></div><button id="battle-close">Cancel / close</button></dialog>';
    this.dialog = this.el('battle-dialog') as HTMLDialogElement;
    this.button('battle-close', () => this.dialog.close());
    this.dialog.addEventListener('close', () => {
      void preferences.save();
      void this.afterDialogClose();
    });
  }
  private async afterDialogClose(): Promise<void> {
    if (this.disposed || this.dialog.open) return;
    const clock = this.clock;
    clock?.clear('modal');
    if (!clock || !this.battle || !['Siege', 'Cleanup'].includes(this.battle.state)) return;
    if (clock.pauses.size) {
      this.status(
        `Paused: ${[...clock.pauses].join(', ')}. Use Resume; no simulation time passes.`,
      );
      return;
    }
    this.status(`${this.battle.state} active; combat remains autonomous.`);
    try {
      await this.audio.resume();
      if (this.disposed || clock !== this.clock) return;
      if (clock.pauses.size || document.hidden) {
        await this.audio.suspend();
        return;
      }
      if (this.audio.context?.state === 'running') await this.audio.music('music.fracture');
    } catch (error) {
      if (!this.disposed && clock === this.clock) {
        this.el('battle-enable-sound').hidden = false;
        this.status(
          `Audio unavailable: ${String(error)}. Captions and autonomous combat remain available.`,
        );
      }
    }
  }
  el(id: string): HTMLElement {
    const e = this.parent.querySelector<HTMLElement>(`#${id}`);
    if (!e) throw new Error(`Missing tutorial control ${id}`);
    return e;
  }
  button(id: string, fn: () => void | Promise<void>): void {
    this.el(id).onclick = () => {
      void Promise.resolve()
        .then(fn)
        .catch((e) =>
          this.status(`Action failed: ${String(e)}. Campaign and checkpoint preserved.`),
        );
    };
  }
  status(s: string): void {
    this.el('battle-status').textContent = s;
  }
  modal(title: string, html: string): void {
    if (this.dialog.open) this.dialog.close();
    this.clock?.pause('modal');
    this.el('battle-dialog-heading').textContent = title;
    this.el('battle-dialog-body').innerHTML = html;
    this.dialog.showModal();
    this.el('battle-close').focus();
  }
  async initialize(): Promise<void> {
    try {
      const current = await this.store.read(this.campaign);
      if (current) {
        this.checkpoint = current;
        this.recovery();
      } else this.forecast();
    } catch (e) {
      this.el('battle-content').innerHTML =
        '<p>Retained practice could not be validated. Its data has been preserved; no battle started.</p><button id="practice-export-raw">Export Retained Practice</button><button id="practice-return">Return Title</button>';
      this.status(String(e));
      this.button('practice-export-raw', async () =>
        this.download(
          this.repo.database
            ? await this.repo.database.read('meta', `practice.slot.${this.campaign.slot}`)
            : this.store.memory.get(this.campaign.slot),
          'practice-recovery.json',
        ),
      );
      this.button('practice-return', () => this.leave(true));
    }
  }
  forecast(): void {
    this.el('battle-content').innerHTML =
      '<h3>Forecast · Standard · Front 1</h3><p>Bounded 90-second tutorial: 18 Fracture Runners and six Raiders, 30 Threat Points. Last deployment by 85 director seconds; warning at 65 seconds. Cleanup has no time limit or artificial damage. Runners approach the Core; Raiders prefer detected nearby mobile defenders. Armor reduces kinetic damage.</p><p>Defend automatically with Bulwark, Sentry, Rifle Squad, Repair Node, Standard Barricade and Proximity Mine. Construction and all tactical commands lock after preflight. Camera, inspection, pause, speed and presentation remain available.</p><label>Starting army <select id="practice-army"><option value="guided">Guided owned-asset clone · no reserve spending</option><option value="current">Current fortress clone</option></select></label><div id="practice-preview"></div><button id="practice-begin">Begin Tutorial Practice</button><button id="practice-cancel">Return Base</button>';
    const update = () => {
      try {
        const army = practiceArmy(
          this.campaign,
          (this.el('practice-army') as HTMLSelectElement).value === 'guided',
        );
        this.el('practice-preview').innerHTML =
          '<p>Clone only; original placements, current Credit reserve and investments stay intact. Selected Warden: Bulwark. Baseline L1/1★/E0, current body health.</p><ul>' +
          army
            .map(
              (a) =>
                '<li>' +
                safe(combat[a.type].name) +
                ' · ' +
                a.x +
                ',' +
                a.y +
                ' · ' +
                a.hp / U +
                ' body</li>',
            )
            .join('') +
          '</ul>';
        (this.el('practice-begin') as HTMLButtonElement).disabled = !this.repo.writer;
      } catch (e) {
        this.el('practice-preview').textContent = String(e);
        (this.el('practice-begin') as HTMLButtonElement).disabled = true;
      }
    };
    this.el('practice-army').onchange = update;
    update();
    this.button('practice-begin', async () => {
      if (this.busy) return;
      this.busy = true;
      (this.el('practice-begin') as HTMLButtonElement).disabled = true;
      const unlock = this.audio.unlock();
      try {
        const army = practiceArmy(
          this.campaign,
          (this.el('practice-army') as HTMLSelectElement).value === 'guided',
        );
        this.status('Preflight: validating and committing the starting checkpoint…');
        this.checkpoint = await this.store.start(this.campaign, army);
        await unlock;
        await this.launch();
      } catch (e) {
        this.status(`Preflight did not start combat: ${String(e)}`);
        if (this.checkpoint) {
          this.stopRuntime();
          this.recovery();
        } else update();
      } finally {
        this.busy = false;
      }
    });
    this.button('practice-cancel', () => this.leave(false));
  }
  recovery(): void {
    const cp = this.checkpoint;
    if (!cp) return;
    if (cp.terminal) {
      this.results();
      return;
    }
    this.el('battle-content').innerHTML =
      '<h3>Interrupted Tutorial Practice</h3><p>Starting checkpoint ' +
      safe(cp.sequence) +
      ' retained. Closing or reloading cannot resume an exact mid-battle position. No offline progress or partial rewards.</p><button id="practice-restart">Restart From Checkpoint</button><button id="practice-discard">Discard Practice and Return Base</button><button id="practice-export">Export Practice Checkpoint</button>';
    (this.el('practice-restart') as HTMLButtonElement).disabled = !this.repo.writer;
    if (!this.repo.writer) {
      this.status(
        'Read Only: Return Title and explicitly Take Over Editing before restarting. Retained checkpoint is preserved.',
      );
      this.el('battle-content').insertAdjacentHTML(
        'beforeend',
        '<button id="practice-recovery-title">Return Title</button>',
      );
      this.button('practice-recovery-title', () => this.leave(true));
    }
    this.button('practice-restart', () => this.launch());
    this.button('practice-discard', () => this.confirmDiscard());
    this.button('practice-export', () => this.download(cp, 'practice-checkpoint.json'));
  }
  async launch(): Promise<void> {
    const cp = this.checkpoint;
    if (!cp || cp.terminal) throw new Error('No active checkpoint');
    if (!this.repo.writer) throw new Error('Read Only: restart requires explicit writer ownership');
    this.stopRuntime();
    this.battle = await Battle.create(cp.army, cp.plan);
    this.lastEventSequence = 0;
    this.lastHUD = -1;
    this.terminalSaving = false;
    this.terminalError = false;
    this.el('battle-content').innerHTML =
      '<div id="battle-hud" aria-label="Battle survival and state"><div><p id="core-health"></p><p id="warden-health"></p><p id="battle-time" aria-live="off"></p></div><button id="battle-pause">Pause</button></div><p id="checkpoint-label">' +
      (this.repo.temporary ? 'Temporary checkpoint · closing loses it' : 'Checkpoint Saved') +
      ' · starting sequence ' +
      safe(cp.sequence) +
      ' · no exact mid-battle resume</p><div id="battle-critical" role="alert" hidden><p id="battle-critical-text"></p><button id="battle-critical-ack">Acknowledge critical warning</button></div><section id="battle-world" aria-label="Autonomous battlefield"></section><nav aria-label="Battle observation tools"><label>Speed <select id="battle-speed"><option value="0.5">0.5×</option><option value="1" selected>1×</option><option value="2">2×</option><option value="4">4×</option></select></label><button id="battle-camera">Camera</button><button id="battle-map">Map</button><button id="battle-inspect">Inspection</button><button id="battle-mute" aria-pressed="false">Mute</button><button id="battle-enable-sound" hidden>Enable Sound</button></nav><div id="battle-captions" role="status"></div><details id="battle-inspector"><summary>Known friendly assets and detected contacts</summary><label>Inspect entity <select id="battle-entity"></select></label><div id="battle-details" aria-live="off"></div><button id="battle-jump">Jump to selected</button><button id="battle-range" aria-pressed="false">Selected Range</button></details><details><summary>Observed event history</summary><ol id="battle-history"></ol></details>';
    this.world = new WorldView(this.el('battle-world'), (s) => this.status(s), true);
    this.world.backgroundOnly = true;
    this.world.highContrast = this.preferences.value.highContrast;
    this.world.onRendererPause = () => this.clock?.pause('renderer');
    this.world.onInspect = (ids) => {
      if (ids.length === 1) this.select(Number(ids[0]));
      else if (ids.length) {
        this.modal(
          'Overlapping observed entities',
          ids
            .map((id) => {
              const e = this.battle?.get(Number(id));
              return e
                ? '<button data-actor="' +
                    id +
                    '">' +
                    safe(combat[e.type].name) +
                    ' ' +
                    id +
                    '</button>'
                : '';
            })
            .join(''),
        );
        for (const button of this.parent.querySelectorAll<HTMLButtonElement>('[data-actor]'))
          button.onclick = () => {
            this.select(Number(button.dataset.actor));
            this.dialog.close();
          };
      }
    };
    this.world.onSelect = () => this.select(0);
    this.status('Checkpoint committed; loading original raster combat assets…');
    await new Promise<void>((resolve, reject) => {
      const began = performance.now();
      const ready = () => {
        if (this.disposed) {
          reject(new Error('Session closed'));
          return;
        }
        if (this.world?.ready) {
          resolve();
          return;
        }
        if (performance.now() - began > 15000) {
          reject(new Error('Renderer/assets unavailable; checkpoint retained'));
          return;
        }
        requestAnimationFrame(ready);
      };
      ready();
    });
    if (!this.world) throw new Error('Missing renderer');
    this.renderer = new CombatRenderer(this.world);
    const battle = this.battle;
    if (!battle) throw new Error('Missing battle');
    this.renderer.motion.observe(battle.entities, battle.tick);
    this.renderer.reduced = this.preferences.value.reducedEffects;
    this.world.command('fit-base');
    this.clock = new BattleClock(
      () => {
        const b = this.battle;
        if (!b) return;
        this.previous = new Map(b.entities.map((e) => [e.id, { x: e.x, y: e.y }]));
        b.step();
        this.renderer?.motion.observe(b.entities, b.tick);
      },
      (reason) => {
        void this.audio.suspend();
        this.status(`Paused: ${reason}. Resume when ready; no simulation time passes.`);
      },
    );
    this.bindRuntime();
    this.audio.configure(this.preferences.value.audio);
    if (this.audio.context?.state === 'running') void this.audio.music('music.fracture');
    else this.el('battle-enable-sound').hidden = false;
    this.status('Autonomous siege started. No movement, firing, ability or construction commands.');
    this.loop(performance.now());
  }
  bindRuntime(): void {
    this.button('battle-pause', () => this.pauseMenu());
    this.button('battle-critical-ack', () => {
      this.acknowledgedCritical = true;
      this.el('battle-critical').hidden = true;
    });
    this.el('battle-speed').onchange = () => {
      if (this.clock)
        this.clock.speed = Number((this.el('battle-speed') as HTMLSelectElement).value) as
          | 0.5
          | 1
          | 2
          | 4;
    };
    this.button('battle-camera', () => this.cameraMenu());
    this.button('battle-map', () => this.mapMenu());
    this.button('battle-inspect', () => {
      (this.el('battle-inspector') as HTMLDetailsElement).open = !(
        this.el('battle-inspector') as HTMLDetailsElement
      ).open;
      if (this.preferences.value.uiScale === 36) this.clock?.pause('manual');
      this.el('battle-entity').focus();
    });
    this.el('battle-entity').onchange = () =>
      this.select(Number((this.el('battle-entity') as HTMLSelectElement).value));
    this.button('battle-jump', () => this.jump(this.renderer?.selected ?? 1));
    this.button('battle-range', () => {
      if (this.renderer) {
        this.renderer.range = !this.renderer.range;
        this.el('battle-range').setAttribute('aria-pressed', String(this.renderer.range));
      }
    });
    this.button('battle-mute', () => {
      const value = !this.audio.muted;
      this.preferences.change({ audio: { ...this.preferences.value.audio, muted: value } });
      this.audio.configure(this.preferences.value.audio);
      this.el('battle-mute').setAttribute('aria-pressed', String(value));
    });
    this.button('battle-enable-sound', async () => {
      if (await this.audio.unlock()) {
        this.el('battle-enable-sound').hidden = true;
        if (!this.clock?.pauses.size) void this.audio.music('music.fracture');
      } else this.status(`${this.audio.state}. Captions remain available.`);
    });
    const visible = () => {
      this.interfaceTime.interrupt();
      if (document.hidden) this.clock?.pause('background');
      else if (this.clock?.pauses.has('background'))
        this.status('Returned from background. Use Pause → Resume; no absence progress.');
    };
    document.addEventListener('visibilitychange', visible);
    this.callbacks.push(() => document.removeEventListener('visibilitychange', visible));
    const keyboard = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).matches('input,select,textarea') || this.dialog.open) return;
      if (e.key === ' ' || e.key === 'Escape') {
        e.preventDefault();
        if (e.key === ' ' && this.clock?.pauses.size) void this.resume();
        else this.pauseMenu();
      }
      const command: Record<string, string> = {
        ArrowLeft: 'left',
        ArrowRight: 'right',
        ArrowUp: 'up',
        ArrowDown: 'down',
        '+': 'in',
        '-': 'out',
      };
      if (command[e.key]) {
        e.preventDefault();
        this.world?.command(command[e.key] ?? '');
      }
    };
    window.addEventListener('keydown', keyboard);
    this.callbacks.push(() => window.removeEventListener('keydown', keyboard));
    let landscape = innerWidth > innerHeight;
    const resize = () => {
      const current = innerWidth > innerHeight;
      if (current !== landscape) {
        landscape = current;
        this.clock?.pause('orientation');
      }
      this.world?.resize();
    };
    window.addEventListener('resize', resize);
    this.callbacks.push(() => window.removeEventListener('resize', resize));
    const freeze = () => {
      this.interfaceTime.interrupt();
      this.clock?.pause('background');
    };
    document.addEventListener('freeze', freeze);
    window.addEventListener('pagehide', freeze);
    this.callbacks.push(() => {
      document.removeEventListener('freeze', freeze);
      window.removeEventListener('pagehide', freeze);
    });
  }
  loop(now: number): void {
    if (this.disposed) return;
    const b = this.battle;
    if (!b) return;
    const interfaceNow = this.interfaceTime.sample(now, !document.hidden);
    if (!this.repo.writer) this.clock?.pause('recovery');
    if (b.state === 'Siege' || b.state === 'Cleanup') this.clock?.frame(now);
    else if (b.state === 'Stalemate') this.clock?.pause('recovery');
    if (now - this.lastRender >= 1000 / 30) {
      this.lastRender = now;
      this.renderer?.draw(b, Math.min(1, this.clock?.backlog ?? 1), this.previous, interfaceNow);
      this.hud(interfaceNow);
      this.events(interfaceNow);
    }
    if ((b.state === 'Victory' || b.state === 'Defeat') && !this.terminalSaving) {
      this.terminalSaving = true;
      void this.commitResult();
    }
    if (!this.terminalSaving) this.raf = requestAnimationFrame((t) => this.loop(t));
  }
  hud(now: number): void {
    const b = this.battle;
    if (!b) return;
    this.parent.dataset.tick = String(b.tick);
    this.parent.dataset.state = this.clock?.pauses.size ? 'Paused' : b.state;
    this.el('battle-pause').textContent = this.clock?.pauses.size ? 'Paused / Resume' : 'Pause';
    this.el('battle-mute').setAttribute('aria-pressed', String(this.audio.muted));
    this.parent.dataset.audioState = this.audio.context?.state ?? 'unavailable';
    this.parent.dataset.audioDecoded = String(this.audio.decoded);
    this.parent.dataset.audioVoices = String(this.audio.voices.length);
    this.parent.dataset.audioShots = String(this.audio.voices.filter((v) => v.shot).length);
    this.el('battle-captions').textContent = this.captions
      .filter((c) => c.expires > now)
      .slice(-2)
      .map((c) => c.message)
      .join(' · ');
    const second = Math.floor(b.tick / 60);
    if (second === this.lastHUD) return;
    this.lastHUD = second;
    this.el('core-health').textContent =
      `${b.core.hp * 4 < b.core.maxHP ? '⚠ Core critical · ' : ''}Core ${Math.ceil(b.core.hp / U)} / 10000 Integrity`;
    const w = b.entities.find((e) => e.type === 'warden.bulwark');
    this.el('warden-health').textContent =
      `${w?.hp === 0 ? '× Incapacitated · ' : w && w.hp * 100 < w.maxHP * 30 ? '⚠ Low Health · ' : ''}Bulwark ${Math.ceil((w?.hp ?? 0) / U)} / 2500 Health`;
    const critical = b.core.hp * 4 < b.core.maxHP || w?.hp === 0;
    if (!critical) this.acknowledgedCritical = false;
    this.el('battle-critical').hidden = !critical || this.acknowledgedCritical;
    this.el('battle-critical-text').textContent = critical
      ? b.core.hp * 4 < b.core.maxHP
        ? 'Core critical: below 25% Integrity. Automatic defenders continue.'
        : 'Bulwark incapacitated: no further weapon or active-ability output; other defenders continue.'
      : '';
    this.el('battle-time').textContent =
      b.state +
      ` · Deployments ${b.packet}/24 · ` +
      Math.floor(second / 60) +
      ':' +
      String(second % 60).padStart(2, '0') +
      ' combat · ' +
      (b.state === 'Cleanup'
        ? `Cleanup elapsed ${Math.floor((b.tick - (b.cleanupTick ?? b.tick)) / 60)}s`
        : `${Math.max(0, 90 - Math.floor(b.director / 60))}s nominal director remaining`) +
      ' · ' +
      (this.clock?.speed ?? 1) +
      '×';
    this.refreshInspector();
  }
  events(now: number): void {
    const b = this.battle;
    if (!b) return;
    const count = b.eventSequence - this.lastEventSequence;
    if (!count) return;
    this.lastEventSequence = b.eventSequence;
    const events = b.events.slice(-Math.min(count, b.events.length));
    for (const e of events) {
      if (!e.visible) continue;
      this.sound(e);
      if (
        [
          'deployment',
          'warning',
          'mine-warning',
          'critical',
          'ability',
          'death',
          'outcome',
          'recovery',
        ].includes(e.kind) &&
        !(e.kind === 'death' && this.battle?.get(e.source)?.team === 'hostile')
      ) {
        this.captions = this.captions.filter((c) => c.message !== e.message);
        this.captions.push({ message: e.message, expires: now + 6000 });
        if (this.captions.length > 10) this.captions.shift();
      }
    }
    const active = this.captions.filter((c) => c.expires > now).slice(-2);
    this.el('battle-captions').textContent = active.map((c) => c.message).join(' · ');
    this.el('battle-history').innerHTML = b.events
      .filter((e) => e.visible)
      .slice(-200)
      .map((e) => `<li>${Math.floor(e.tick / 60)}s · ${safe(e.message)}</li>`)
      .join('');
  }
  sound(e: BattleEvent): void {
    const source = this.battle?.get(e.source);
    if (e.kind === 'shot' && source) {
      const key =
        source.type === 'friendly.sentry'
          ? 'sfx.sentry'
          : source.type === 'friendly.rifle_squad'
            ? 'sfx.rifle'
            : 'sfx.bulwark';
      void this.audio.play(key, 1, true);
    } else if (e.kind === 'melee') void this.audio.play('sfx.melee', 1);
    else if (e.kind === 'impact') void this.audio.play('sfx.impact', 2);
    else if (e.kind === 'explosion') void this.audio.play('sfx.mine', 5);
    else if (e.kind === 'repair') void this.audio.play('sfx.repair', 1);
    else if (e.kind === 'ability')
      void this.audio.play(
        e.message.startsWith('Interpose')
          ? 'sfx.interpose'
          : e.message.startsWith('Challenge')
            ? 'sfx.challenge'
            : 'sfx.holdfast',
        6,
      );
    else if (e.kind === 'critical') void this.audio.play('alert.core', 10, false, 'alerts');
    else if (e.kind === 'deployment' || e.kind === 'warning')
      void this.audio.play('alert.wave', 7, false, 'alerts');
  }
  select(id: number): void {
    if (this.renderer) this.renderer.selected = id;
    this.refreshInspector();
  }
  refreshInspector(): void {
    const b = this.battle,
      r = this.renderer;
    if (!b || !r) return;
    const selectable = b.entities.filter((e) => b.visible(e) || r.knownDeaths.has(e.id)),
      select = this.el('battle-entity') as HTMLSelectElement,
      old = String(r.selected);
    select.innerHTML =
      '<option value="0">No selection</option>' +
      selectable
        .map(
          (e) =>
            '<option value="' +
            e.id +
            '">' +
            (e.team === 'friendly' ? 'Friendly' : 'Hostile') +
            ' · ' +
            safe(combat[e.type].name) +
            ' ' +
            e.id +
            ' · ' +
            (e.hp === 0 ? safe(e.reason) : `${Math.ceil(e.hp / U)} body`) +
            '</option>',
        )
        .join('');
    select.value = old;
    const e = b.get(r.selected);
    if (!e) {
      this.el('battle-details').textContent =
        'Select a known friendly asset or currently detected hostile. Inspection never gives commands.';
      return;
    }
    if (!b.visible(e) && !r.knownDeaths.has(e.id)) {
      const memory = b.entities
        .flatMap((a) => a.memory)
        .filter((c) => c.id === e.id && b.tick - c.tick <= 120)
        .sort((a, b) => b.tick - a.tick)[0];
      this.el('battle-details').textContent =
        'Contact lost. ' +
        (memory
          ? 'Last observed at ' +
            (memory.x / U).toFixed(2) +
            ',' +
            (memory.y / U).toFixed(2) +
            ' at ' +
            (memory.tick / 60).toFixed(1) +
            ' combat seconds.'
          : 'Last-known contact expired.');
      return;
    }
    const d = combat[e.type],
      target = b.get(e.target);
    this.el('battle-details').innerHTML =
      '<h3>' +
      safe(d.name) +
      ' ' +
      e.id +
      ' · ' +
      (e.team === 'friendly' ? 'Friendly' : 'Hostile Fracture / Common') +
      '</h3><p>' +
      safe(e.state) +
      ' · ' +
      Math.ceil(e.hp / U) +
      '/' +
      e.maxHP / U +
      ' body · Armor ' +
      (b.armor(e) / U).toFixed(2) +
      ' · ' +
      (e.x / U).toFixed(2) +
      ',' +
      (e.y / U).toFixed(2) +
      '</p><p>' +
      safe(e.reason) +
      '. Target: ' +
      (target && (target.team === 'friendly' || b.visible(target))
        ? `${safe(combat[target.type].name)} ${target.id}`
        : 'None / Contact lost') +
      '.</p>' +
      `<p>Ground layer · speed ${(d.speed / U).toFixed(2)} GU/s · heading ${((e.heading * 360) / 65536).toFixed(1)}°.</p><p>Temporary front shield ${Math.ceil(e.shield.reduce((n, s) => n + s.pool, 0) / U)} points · ${e.shield.map((s) => `120° / ${(Math.max(0, s.expires - b.tick) / 60).toFixed(1)}s`).join(', ') || 'none'} · Holdfast reduction ${e.reduction}%.</p>` +
      (d.weapon
        ? '<p>Automatic ' +
          (d.weapon.speed ? 'kinetic projectile' : 'melee') +
          ' · ' +
          d.weapon.damage / U +
          ' base damage / ' +
          d.weapon.interval / 60 +
          's · ' +
          (d.weapon.range / U).toFixed(2) +
          ' GU boundary range · ' +
          (d.weapon.speed ? d.weapon.accuracy + '% accuracy · ' : 'unmissable contact · ') +
          (e.type === 'friendly.rifle_squad'
            ? 'Three visual troopers / one attack. Injury output ' +
              Math.round((0.5 + (0.5 * e.hp) / e.maxHP) * 100) +
              '%.'
            : 'No squad injury penalty.') +
          '</p>'
        : '') +
      (e.type === 'friendly.repair_node'
        ? '<p>25 Integrity/s, Core half. Living mechanical allies (including self), 5 GU and LOS. First pulse after 0.25s; no wreck revival or overheal.</p>'
        : '') +
      (e.type === 'friendly.proximity_mine'
        ? '<p>Charges ' +
          e.charges +
          '/1. Detected ground trigger 1 GU; 0.3s warning then300 explosive /1.5GU falloff. Released area survives triggering target death; mine destruction before release cancels it.</p>'
        : '') +
      (e.type === 'warden.bulwark'
        ? '<p>Automatic abilities only; no activation controls. Interpose ' +
          (Math.max(0, e.abilities[0] - b.tick) / 60).toFixed(1) +
          's: threatened ally below60%, legal intercept. Challenge ' +
          (Math.max(0, e.abilities[1] - b.tick) / 60).toFixed(1) +
          's: three close contacts or Core threat, +60 utility. Holdfast ' +
          (Math.max(0, e.abilities[2] - b.tick) / 60).toFixed(1) +
          's: two attacked allies or nearby Core below40%,20% reduction. Last Rampart: own armor follows Core injury once/second.</p>'
        : '');
  }
  jump(id: number): void {
    const e = this.battle?.get(id);
    if (!e || !this.world || !(this.battle?.visible(e) || this.renderer?.knownDeaths.has(e.id)))
      return;
    this.world.fitActive = false;
    this.world.camera.x = e.x / U;
    this.world.camera.y = e.y / U;
    this.world.draw();
  }
  cameraMenu(): void {
    this.modal(
      'Camera — observation only',
      ['fit-base', 'fit', 'recenter', 'rotate', 'in', 'out', 'left', 'right', 'up', 'down']
        .map(
          (id, i) =>
            '<button data-battle-camera="' +
            id +
            '">' +
            [
              'Fit Base',
              'Fit Field',
              'Core',
              'Rotate view',
              'Zoom in',
              'Zoom out',
              'Pan left',
              'Pan right',
              'Pan up',
              'Pan down',
            ][i] +
            '</button>',
        )
        .join(''),
    );
    for (const button of this.parent.querySelectorAll<HTMLButtonElement>('[data-battle-camera]'))
      button.onclick = () => this.world?.command(button.dataset.battleCamera ?? '');
  }
  mapMenu(): void {
    this.modal(
      'Map — detected contacts only',
      '<canvas id="battle-minimap" width="224" height="224" aria-label="Overview of Core, purchased land, six fronts and detected role clusters"></canvas><p>◇ Hostile · ∨ Friendly · □ Core · border purchased land. North is up; battlefield camera rotation does not rotate this map.</p><button id="map-core">Jump to Core</button><button id="map-warden">Jump to Bulwark</button>' +
        [1, 2, 3, 4, 5, 6].map((n) => `<button data-map-front="${n}">Front ${n}</button>`).join(''),
    );
    const canvas = this.el('battle-minimap') as HTMLCanvasElement,
      ctx = canvas.getContext('2d');
    if (ctx && this.battle) {
      ctx.fillStyle = '#26333c';
      ctx.fillRect(0, 0, 224, 224);
      ctx.strokeStyle = '#ffffff';
      ctx.strokeRect((12 / 60) * 224, (12 / 60) * 224, (36 / 60) * 224, (36 / 60) * 224);
      ctx.font = '14px system-ui';
      ctx.fillStyle = '#ffffff';
      ctx.fillText('N ↑', 4, 16);
      const fronts = [
        [3, 18],
        [3, 42],
        [18, 3],
        [42, 3],
        [57, 30],
        [30, 57],
      ];
      for (const [p, i] of fronts.map((p, i) => [p, i] as const)) {
        const x = p[0],
          y = p[1];
        if (x !== undefined && y !== undefined)
          ctx.fillText(String(i + 1), (x / 60) * 224, (y / 60) * 224);
      }
      for (const e of this.battle.entities.filter((e) => this.battle?.visible(e))) {
        const x = (e.x / U / 60) * 224,
          y = (e.y / U / 60) * 224;
        ctx.fillText(
          e.hp === 0 ? '×' : e.id === 1 ? '□' : e.team === 'friendly' ? '∨' : '◇',
          x - 4,
          y + 4,
        );
      }
    }
    this.button('map-core', () => {
      this.jump(1);
      this.dialog.close();
    });
    this.button('map-warden', () => {
      this.jump(this.battle?.entities.find((e) => e.type === 'warden.bulwark')?.id ?? 0);
      this.dialog.close();
    });
    for (const button of this.parent.querySelectorAll<HTMLButtonElement>('[data-map-front]'))
      button.onclick = () => {
        const p = [
          [3, 18],
          [3, 42],
          [18, 3],
          [42, 3],
          [57, 30],
          [30, 57],
        ][Number(button.dataset.mapFront) - 1];
        if (this.world && p && p[0] !== undefined && p[1] !== undefined) {
          this.world.fitActive = false;
          this.world.camera.x = p[0];
          this.world.camera.y = p[1];
          this.world.draw();
          this.dialog.close();
        }
      };
  }
  pauseMenu(): void {
    this.clock?.pause('manual');
    this.modal(
      'Paused — autonomous tutorial',
      '<button id="battle-resume">Resume</button><button id="battle-settings">Audio Settings</button><button id="battle-accessibility">Accessibility</button><button id="battle-restart">Restart From Checkpoint</button><button id="battle-surrender">Surrender Practice</button><button id="battle-title">Return Title</button><p>Restart discards this attempt and uses the same saved start. Returning Title retains an interruption checkpoint. Surrender finalizes practice defeat, with no campaign mutation.</p>',
    );
    this.button('battle-resume', () => this.resume());
    /*resume bindings follow*/
    this.bindPauseActions();
  }
  async resume(): Promise<void> {
    if (document.hidden || !this.world?.rendererAvailable || !this.repo.writer) {
      this.status(
        'Resume unavailable: background, renderer or writer recovery remains unresolved.',
      );
      return;
    }
    this.dialog.close();
    this.clock?.resume();
    await this.audio.resume();
    if (this.audio.context?.state === 'running') void this.audio.music('music.fracture');
    this.status('Resumed; combat remains autonomous.');
  }
  private bindPauseActions(): void {
    this.button('battle-settings', () => this.audioMenu());
    this.button('battle-accessibility', () => this.accessibilityMenu());
    this.button('battle-restart', () =>
      this.modalConfirm(
        'Restart From Checkpoint',
        'Discard current practice attempt; no partial progress is kept.',
        async () => {
          this.dialog.close();
          await this.launch();
        },
      ),
    );
    this.button('battle-surrender', () =>
      this.modalConfirm(
        'Surrender Practice',
        'Finalize this clone as defeat. The real campaign receives no damage or rewards.',
        () => {
          this.dialog.close();
          this.battle?.surrender();
        },
      ),
    );
    this.button('battle-title', () =>
      this.modalConfirm(
        'Return Title',
        'Close the live attempt. Continue will offer checkpoint restart, not exact mid-battle resume.',
        () => {
          this.dialog.close();
          this.leave(true);
        },
      ),
    );
  }
  modalConfirm(title: string, text: string, accept: () => void | Promise<void>): void {
    this.modal(
      title,
      `<p>${safe(text)}</p><button id="battle-confirm">Confirm ${safe(title)}</button>`,
    );
    this.button('battle-confirm', accept);
  }
  audioMenu(): void {
    this.modal(
      'Audio Settings',
      ['master', 'music', 'sfx', 'ui', 'alerts']
        .map(
          (c) =>
            '<label>' +
            c[0]?.toUpperCase() +
            c.slice(1) +
            ' volume <input data-audio-volume="' +
            c +
            '" type="range" min="0" max="100" value="' +
            this.preferences.value.audio[c as keyof Omit<AudioSettings, 'muted'>] +
            '"></label>',
        )
        .join('') +
        '<label><input id="settings-mute" type="checkbox" ' +
        (this.audio.muted ? 'checked' : '') +
        '> Mute all</label><p>Audio never changes combat. Important captions remain visible while muted. Current audio: ' +
        safe(this.audio.state) +
        '</p><button id="audio-enable">Enable Sound</button><button id="audio-back">Back to Pause</button>',
    );
    for (const input of this.parent.querySelectorAll<HTMLInputElement>('[data-audio-volume]'))
      input.oninput = () => {
        this.preferences.change({
          audio: {
            ...this.preferences.value.audio,
            [input.dataset.audioVolume ?? 'master']: Number(input.value),
          },
        });
        this.audio.configure(this.preferences.value.audio);
      };
    this.el('settings-mute').onchange = () => {
      this.preferences.change({
        audio: {
          ...this.preferences.value.audio,
          muted: (this.el('settings-mute') as HTMLInputElement).checked,
        },
      });
      this.audio.configure(this.preferences.value.audio);
    };
    this.button('audio-enable', async () => {
      this.status(
        (await this.audio.unlock()) ? 'Audio unlocked; resumes with the battle' : this.audio.state,
      );
      if (this.clock?.pauses.size) await this.audio.suspend();
    });
    this.button('audio-back', () => this.pauseMenu());
  }
  accessibilityMenu(): void {
    const v = this.preferences.value;
    this.modal(
      'Accessibility',
      '<label>Interface scale <select id="battle-ui-scale"><option value="18">100%</option><option value="27">150%</option><option value="36">200%</option></select></label><label><input id="battle-reduce" type="checkbox" ' +
        (v.reducedEffects ? 'checked' : '') +
        '> Reduced effects</label><label><input id="battle-contrast" type="checkbox" ' +
        (v.highContrast ? 'checked' : '') +
        '> High contrast</label><p>Unit motion and essential warnings remain. Outlines, shapes and named inspection distinguish friendly/hostile and disabled states.</p><button id="accessibility-back">Back to Pause</button>',
    );
    (this.el('battle-ui-scale') as HTMLSelectElement).value = String(v.uiScale);
    this.el('battle-ui-scale').onchange = () => {
      this.preferences.change({
        uiScale: Number((this.el('battle-ui-scale') as HTMLSelectElement).value) as 18 | 27 | 36,
      });
      this.world?.resize();
    };
    this.el('battle-reduce').onchange = () => {
      this.preferences.change({
        reducedEffects: (this.el('battle-reduce') as HTMLInputElement).checked,
      });
      if (this.renderer) this.renderer.reduced = this.preferences.value.reducedEffects;
    };
    this.el('battle-contrast').onchange = () => {
      this.preferences.change({
        highContrast: (this.el('battle-contrast') as HTMLInputElement).checked,
      });
      if (this.world) {
        this.world.highContrast = this.preferences.value.highContrast;
        this.world.draw();
      }
    };
    this.button('accessibility-back', () => this.pauseMenu());
  }
  async commitResult(): Promise<void> {
    const b = this.battle,
      cp = this.checkpoint;
    if (!b || !cp || (b.state !== 'Victory' && b.state !== 'Defeat')) return;
    this.clock?.pause('manual');
    await this.audio.suspend();
    this.status('Saving practice result; real campaign stays unchanged.');
    const result = {
      state: b.state,
      tick: b.tick,
      reason: b.reason,
      hash: await hash(b.snapshot()),
      kills: b.kills,
      tp: b.destroyedTP,
      coreHP: b.core.hp,
    };
    try {
      this.checkpoint = await this.store.terminal(this.campaign, cp, result);
      this.terminalError = false;
      this.results();
    } catch (e) {
      this.terminalError = true;
      this.parent.querySelector('#practice-result-recovery')?.remove();
      this.el('battle-content').insertAdjacentHTML(
        'beforeend',
        '<section id="practice-result-recovery"><h3>Practice Result Recovery</h3><p>Result could not be saved. Same checkpoint/result identity retained; no campaign claim was applied.</p><button id="practice-retry-result">Retry Save Practice Result</button><button id="practice-export-result">Export Pending Practice Result</button></section>',
      );
      this.status(String(e));
      this.button('practice-retry-result', () => this.commitResult());
      this.button('practice-export-result', () =>
        this.download({ checkpoint: cp, result }, 'practice-pending-result.json'),
      );
    }
  }
  results(): void {
    const cp = this.checkpoint,
      r = cp?.terminal;
    if (!cp || !r) return;
    this.stopRuntime();
    this.parent.dataset.state = r.state;
    this.parent.dataset.resultHash = r.hash;
    this.el('battle-content').innerHTML =
      '<h3>Tutorial Practice ' +
      r.state +
      '</h3><p>' +
      safe(r.reason) +
      '</p><p>' +
      r.kills +
      ' / 24 enemies destroyed · ' +
      r.tp +
      ' / 30 Threat Points · ' +
      (r.tick / 60).toFixed(2) +
      ' combat seconds · Core ' +
      Math.ceil(r.coreHP / U) +
      ' Integrity.</p><p>' +
      (this.repo.temporary
        ? 'Temporary result retained in this session'
        : 'Practice Result Saved') +
      '. Credits0 · XP0 · Promotion Cores0. Real assets, wallet, claims and placement are unchanged. This is the Gate2 analysis stub; campaign result transactions/progression remain Gate3.</p><button id="practice-again">Practice Again</button><button id="practice-finish">Discard Practice and Return Base</button><button id="practice-export-result">Export Practice Result</button>';
    this.status('Practice result retained; no campaign progression claimed.');
    void this.audio
      .resume()
      .then(() =>
        this.audio.play(
          r.state === 'Victory' ? 'stinger.victory' : 'stinger.defeat',
          10,
          false,
          'alerts',
        ),
      );
    this.button('practice-again', async () => {
      await this.store.discard(this.campaign, cp);
      this.checkpoint = undefined;
      this.forecast();
    });
    this.button('practice-finish', () => this.confirmDiscard());
    this.button('practice-export-result', () => this.download(cp, 'practice-result.json'));
  }
  confirmDiscard(): void {
    this.modalConfirm(
      'Discard Practice and Return Base',
      'Discard the changed clone and its diagnostic result. Original campaign stays intact.',
      async () => {
        if (this.checkpoint) await this.store.discard(this.campaign, this.checkpoint);
        this.dialog.close();
        this.leave(false);
      },
    );
  }
  download(value: unknown, name: string): void {
    const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }),
      url = URL.createObjectURL(blob),
      a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  stopRuntime(): void {
    cancelAnimationFrame(this.raf);
    for (const fn of this.callbacks) fn();
    this.callbacks = [];
    this.renderer?.dispose();
    this.renderer = undefined;
    this.world?.dispose();
    this.world = undefined;
    this.clock = undefined;
    this.audio.stopMusic();
  }
  leave(title: boolean): void {
    this.disposed = true;
    this.stopRuntime();
    this.parent.remove();
    this.exit(title);
  }
}
