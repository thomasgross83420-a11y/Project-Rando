import { canonical } from '../sim/determinism';
import { type BackupStore, readBackup, type Backup } from '../persistence/backup';
import { validateCampaign } from '../persistence/campaign';
import { BACKUP_BYTES } from '../persistence/json';
import type { PreferencesStore } from '../persistence/preferences';
import type { CampaignRepository } from '../persistence/repository';
const escapeHTML = (s: string) =>
  s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
export class DataManagement {
  busy = false;
  constructor(
    readonly host: HTMLElement,
    readonly repo: CampaignRepository,
    readonly store: BackupStore,
    readonly preferences: PreferencesStore,
    readonly report: (s: string) => void,
    readonly changed: () => Promise<void>,
  ) {}
  private el(id: string): HTMLElement {
    const e = this.host.querySelector<HTMLElement>(`#${id}`);
    if (!e) throw new Error(`Missing recovery control ${id}`);
    return e;
  }
  private action(id: string, work: () => void | Promise<void>): void {
    this.el(id).onclick = () => {
      if (this.busy) return;
      void Promise.resolve()
        .then(work)
        .catch((e) => {
          this.message(
            `Recovery failed: ${String(e)}. Retained data preserved; review before retry.`,
          );
        });
    };
  }
  private message(s: string): void {
    this.report(s);
    const e = this.host.querySelector('#data-message');
    if (e) e.textContent = s;
  }
  async open(): Promise<void> {
    const slots = await this.repo.slots(),
      view = await this.store.inspect();
    this.host.innerHTML = `<p>Backups replace selected campaigns; they never add wallets or merge inventories. Keep a copy before changing browser, device or site. Clearing browser data can remove progress.</p><p>${this.repo.temporary ? 'Temporary Session: closing loses unexported progress.' : 'Exports contain committed campaigns, previous snapshots and retained tutorial checkpoints.'}</p><p id="data-message" role="status"></p><section aria-label="Backup slots">${slots.map((c, i) => `<section class="slot"><h3>Slot ${i + 1}</h3><p>${c instanceof Error ? 'Unsupported or corrupt; retained untouched' : c ? `${escapeHTML(c.name)} · ${c.credits} Credits · revision ${c.revision}` : 'Empty'}</p>${c && !(c instanceof Error) ? `<label><input type="checkbox" data-export-slot="${i}" checked> Include Slot ${i + 1} in backup</label><button id="restore-${i}" ${view.slots[i]?.previous === undefined || view.slots[i]?.practice !== undefined || !this.repo.writer ? 'disabled' : ''}>Restore Previous · Slot ${i + 1}</button><button id="delete-${i}" ${view.slots[i]?.practice !== undefined || !this.repo.writer ? 'disabled' : ''}>Delete Campaign · Slot ${i + 1}</button>` : ''}${view.slots[i]?.practice !== undefined ? '<p>Retained practice included in export. Resolve it before rollback or deletion.</p>' : ''}</section>`).join('')}</section><label><input id="export-preferences" type="checkbox"> Include global settings and accessibility</label><button id="prepare-backup">Prepare Backup</button><button id="save-now" ${this.repo.writer ? '' : 'disabled'}>Save Now</button><button id="storage-request" ${this.repo.temporary ? 'disabled' : ''}>Request Persistent Storage</button><p id="storage-summary">Browser storage remains local to this site. Persistence is a browser decision, not a guarantee.</p><section aria-label="Import backup"><h3>Import Backup</h3><label>Backup JSON file <input id="backup-file" type="file" accept=".json,application/json" ${this.repo.writer ? '' : 'disabled'}></label><details><summary>Paste backup text instead</summary><label>Backup JSON text <textarea id="backup-text" rows="5"></textarea></label></details><button id="review-import" ${this.repo.writer ? '' : 'disabled'}>Review Import</button></section><div id="data-review"></div><div id="data-transfer"></div>`;
    this.action('prepare-backup', async () => {
      await this.preferences.flush();
      const indices = [
        ...this.host.querySelectorAll<HTMLInputElement>('[data-export-slot]:checked'),
      ].map((e) => Number(e.dataset.exportSlot));
      const backup = await this.store.export(
        indices,
        (this.el('export-preferences') as HTMLInputElement).checked ? this.preferences.value : null,
      );
      this.offer(backup, 'resonance-bastion-backup.json');
    });
    this.action('save-now', async () => {
      await this.preferences.flush();
      await this.repo.heartbeat();
      if (!this.repo.writer) throw new Error('Read Only');
      const current = await this.repo.slots();
      if (current.some((c) => c instanceof Error))
        throw new Error('One slot needs recovery; no invalid snapshot overwritten');
      if (this.repo.database) await this.repo.database.probe();
      this.message(
        this.repo.temporary
          ? 'Current campaigns committed in memory only. Export before closing.'
          : `Saved committed campaigns checked at ${new Date().toLocaleTimeString()}. No pending preparation command.`,
      );
    });
    this.action('storage-request', async () => {
      const storage = navigator.storage;
      if (!storage?.persist) {
        this.el('storage-summary').textContent =
          'Persistent storage requests unavailable in this browser.';
        return;
      }
      const granted = await storage.persist(),
        estimate = await storage.estimate();
      this.el('storage-summary').textContent =
        `Persistent storage ${granted ? 'granted' : 'not granted'}. Estimated use ${Math.round((estimate.usage ?? 0) / 1024)} KiB of browser quota ${Math.round((estimate.quota ?? 0) / 1024 / 1024)} MiB. Advisory estimate; keep external backups.`;
    });
    this.action('review-import', async () => {
      const file = (this.el('backup-file') as HTMLInputElement).files?.[0];
      if (file && file.size > BACKUP_BYTES) throw new Error('Backup exceeds 32 MiB');
      const text = file ? await file.text() : (this.el('backup-text') as HTMLTextAreaElement).value;
      const parsed = await readBackup(text);
      await this.previewImport(parsed.backup, parsed.legacy);
    });
    for (let i = 0; i < 3; i++) {
      if (this.host.querySelector(`#restore-${i}`))
        this.action(`restore-${i}`, () => this.previewRestore(i));
      if (this.host.querySelector(`#delete-${i}`))
        this.action(`delete-${i}`, () => this.previewDelete(i));
    }
  }
  async prepare(indices: number[]): Promise<void> {
    await this.preferences.flush();
    this.offer(
      await this.store.export(indices, null),
      indices.length === 1
        ? `resonance-slot-${(indices[0] ?? 0) + 1}.json`
        : 'resonance-bastion-backup.json',
    );
    this.el('download-backup').click();
  }
  private offer(value: unknown, name: string): void {
    const text = canonical(value),
      file = new File([text], name, { type: 'application/json' });
    this.el('data-transfer').innerHTML =
      `<section><h3>Backup ready</h3><p>${file.size.toLocaleString()} bytes. Download/share offers bytes; confirm the file was saved externally.</p><button id="download-backup">Download Backup</button>${navigator.canShare?.({ files: [file] }) ? '<button id="share-backup">Share Backup</button>' : ''}<details><summary>Copyable backup text</summary><label>Prepared backup JSON <textarea id="prepared-backup" rows="5" readonly></textarea></label></details></section>`;
    (this.el('prepared-backup') as HTMLTextAreaElement).value = text;
    this.action('download-backup', () => {
      const url = URL.createObjectURL(file),
        a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      this.message('Backup bytes offered for download. Confirm the file was stored externally.');
    });
    if (this.host.querySelector('#share-backup')) {
      // Call immediately inside the gesture; hashing/file construction is done.
      this.el('share-backup').onclick = () => {
        void navigator
          .share({ files: [file], title: 'Resonance Bastion backup' })
          .then(() => this.message('Backup offered through sharing; verify its external copy.'))
          .catch((e) =>
            this.message(
              e instanceof DOMException && e.name === 'AbortError'
                ? 'Sharing cancelled. Backup remains available.'
                : `Sharing unavailable: ${String(e)}. Use Download Backup or copy the text.`,
            ),
          );
      };
    }
  }
  private async previewImport(backup: Backup, legacy: boolean): Promise<void> {
    const expected = await this.store.inspect();
    this.el('data-review').innerHTML =
      `<h3>Review Import</h3><p>${legacy ? 'Earlier foundation export has no corruption checksum and contains only its campaign; no checkpoint/settings were included.' : 'Checksum and supported campaign/checkpoint data verified.'} Selected destination wallets and ownership will be replaced. Later changes roll back; local finalized watermarks/first claims remain fenced. This does not synchronize devices.</p>${backup.slots
        .map(
          (s, i) =>
            `<section class="slot"><h4>${escapeHTML(s.campaign.name)}</h4><p>${s.campaign.credits} Credits · revision ${s.campaign.revision} · ${s.campaign.assets.length} owned assets${s.practice ? ' · retained practice included' : ''}</p><label>Destination for ${escapeHTML(s.campaign.name)} <select data-import-source="${i}"><option value="skip">Skip this campaign</option>${expected.slots
              .map((d, j) => {
                let name = 'Empty';
                try {
                  if (d.campaign !== undefined) name = validateCampaign(d.campaign).name;
                } catch {
                  return `<option value="${j}" disabled>Slot ${j + 1} · unsupported/corrupt retained data</option>`;
                }
                return `<option value="${j}" ${j === s.campaign.slot ? 'selected' : ''}>Slot ${j + 1} · ${escapeHTML(name)}</option>`;
              })
              .join('')}</select></label></section>`,
        )
        .join(
          '',
        )}<label><input id="import-preferences" type="checkbox" ${backup.preferences ? '' : 'disabled'}> Apply included global settings and accessibility</label><button id="export-before-import">Prepare Current Backup</button><button id="confirm-import">Confirm Replace Selected Slots</button>`;
    this.action('export-before-import', async () => {
      const indices = expected.slots.flatMap((s, i) => (s.campaign === undefined ? [] : [i]));
      this.offer(
        await this.store.export(indices, this.preferences.value),
        'resonance-before-import.json',
      );
    });
    this.action('confirm-import', async () => {
      const selection = [...this.host.querySelectorAll<HTMLSelectElement>('[data-import-source]')]
        .filter((e) => e.value !== 'skip')
        .map((e) => ({ source: Number(e.dataset.importSource), destination: Number(e.value) }));
      const apply = (this.el('import-preferences') as HTMLInputElement).checked;
      await this.preferences.flush();
      await this.commit(() => this.store.replace(backup, selection, expected, apply));
      if (apply && backup.preferences) this.preferences.imported(backup.preferences);
      await this.changed();
      await this.open();
      this.message(
        this.repo.temporary
          ? 'Import committed in memory. Export before closing.'
          : 'Selected campaigns replaced and Saved. Other slots preserved.',
      );
    });
  }
  private async previewRestore(index: number): Promise<void> {
    const expected = await this.store.inspect(),
      raw = expected.slots[index];
    if (!raw) throw new Error('Missing slot');
    const before = validateCampaign(raw.campaign),
      previous = validateCampaign(raw.previous);
    this.el('data-review').innerHTML =
      `<h3>Restore Previous · Slot ${index + 1}</h3><p>Replace ${escapeHTML(before.name)} (revision ${before.revision}, ${before.credits} Credits) with ${escapeHTML(previous.name)} (revision ${previous.revision}, ${previous.credits} Credits). Ownership and placement roll back; current local claim fences and sequence counters do not. Global settings remain unchanged.</p><button id="export-before-restore">Prepare Current Backup</button><button id="confirm-restore">Confirm Restore Previous</button>`;
    this.action('export-before-restore', async () =>
      this.offer(await this.store.export([index], null), 'resonance-before-restore.json'),
    );
    this.action('confirm-restore', async () => {
      await this.commit(() => this.store.restorePrevious(index, expected));
      await this.changed();
      await this.open();
      this.message(
        this.repo.temporary
          ? 'Previous snapshot restored in memory.'
          : 'Previous snapshot restored and Saved; wallet replaced without merging.',
      );
    });
  }
  private async previewDelete(index: number): Promise<void> {
    const expected = await this.store.inspect(),
      c = validateCampaign(expected.slots[index]?.campaign);
    this.el('data-review').innerHTML =
      `<h3>Delete Campaign · Slot ${index + 1}</h3><p>Delete ${escapeHTML(c.name)}, its current/previous snapshot and local campaign progress. Other slots and global accessibility settings remain. Export first if you want to recover it later.</p><button id="export-before-delete">Prepare Current Backup</button><button id="confirm-delete">Confirm Delete Campaign</button>`;
    this.action('export-before-delete', async () =>
      this.offer(await this.store.export([index], null), 'resonance-before-delete.json'),
    );
    this.action('confirm-delete', async () => {
      await this.commit(() => this.store.deleteSlot(index, expected));
      await this.changed();
      await this.open();
      this.message(
        this.repo.temporary
          ? 'Campaign deleted from this temporary session.'
          : 'Selected campaign deletion committed. Other slots preserved.',
      );
    });
  }
  private async commit(work: () => Promise<void>): Promise<void> {
    if (this.busy) throw new Error('Save already in progress');
    this.busy = true;
    const buttons = [...this.host.querySelectorAll<HTMLButtonElement>('button')];
    const states = buttons.map((b) => b.disabled);
    for (const b of buttons) b.disabled = true;
    this.message('Saving recovery change…');
    try {
      await work();
    } finally {
      this.busy = false;
      buttons.forEach((b, i) => {
        b.disabled = states[i] ?? false;
      });
    }
  }
}
