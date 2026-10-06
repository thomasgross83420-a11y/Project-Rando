import './style.css';
import { AudioMixer } from './audio/mixer';
import { Database } from './persistence/database';
import { WorldView } from './render/world';
const app = document.querySelector<HTMLElement>('#app');
if (!app) throw new Error('Application root missing');
app.innerHTML = `<header><p class="eyebrow">RESONANCE BASTION · DEVELOPMENT</p><h1>Fortress foundations</h1><p>Gate 0 compatibility experiment. Construction and combat are not yet available.</p></header><p id="status" role="status">Checking browser…</p><section id="world" aria-label="World renderer"></section><nav aria-label="Camera controls">${[
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
  )}</nav><section aria-label="Audio"><button id="enable">Enable sound</button><button id="mute" aria-pressed="false">Mute</button><output id="audio">Audio awaiting interaction</output></section><section aria-label="Storage"><button id="probe">Test save transaction</button><output id="storage">Checking storage…</output><button id="export">Export capability report</button></section>`;
const status = (message: string): void => {
  const el = document.querySelector('#status');
  if (el) el.textContent = message;
};
const parent = document.querySelector<HTMLElement>('#world');
if (!parent) throw new Error('World parent missing');
const view = new WorldView(parent, status),
  audio = new AudioMixer();
let database: Database | undefined;
const output = (id: string, value: string): void => {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
};
try {
  database = await Database.open();
  await database.probe();
  output('storage', 'Storage transaction committed');
} catch (error) {
  output('storage', `Temporary Session available: ${String(error)}`);
}
for (const button of document.querySelectorAll<HTMLButtonElement>('[data-camera]'))
  button.addEventListener('click', () => view.command(button.dataset.camera ?? ''));
document
  .querySelector('#enable')
  ?.addEventListener('click', async () =>
    output(
      'audio',
      (await audio.unlock())
        ? 'Audio unlocked; no music in Gate 0'
        : 'Audio unavailable; captions remain available',
    ),
  );
document.querySelector('#mute')?.addEventListener('click', (e) => {
  audio.setMuted(!audio.muted);
  (e.currentTarget as HTMLButtonElement).setAttribute('aria-pressed', String(audio.muted));
});
document.querySelector('#probe')?.addEventListener('click', async () => {
  try {
    if (!database) throw new Error('No retained storage');
    await database.probe();
    output('storage', 'Storage transaction committed');
  } catch (error) {
    output('storage', `Save Failed: ${String(error)}`);
  }
});
document.querySelector('#export')?.addEventListener('click', () => {
  const url = URL.createObjectURL(
    new Blob(
      [
        JSON.stringify(
          {
            renderer: view.ready,
            storage: Boolean(database),
            audio: audio.context?.state ?? 'not started',
            published: false,
            offlineReady: false,
          },
          null,
          2,
        ),
      ],
      { type: 'application/json' },
    ),
  );
  const a = document.createElement('a');
  a.href = url;
  a.download = 'resonance-capabilities.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    void audio.suspend();
    status('Background pause. No absent-time progress.');
  } else status('Returned. Use Enable sound to resume audio.');
});
window.addEventListener('keydown', (e) => {
  if ((e.target as HTMLElement).matches('input,select,textarea')) return;
  const key: Record<string, string> = {
    ArrowLeft: 'left',
    ArrowRight: 'right',
    ArrowUp: 'up',
    ArrowDown: 'down',
    '+': 'in',
    '-': 'out',
  };
  const command = key[e.key];
  if (command) {
    e.preventDefault();
    view.command(command);
  }
});
status('Renderer experiment ready');
