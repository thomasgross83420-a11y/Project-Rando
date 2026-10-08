import { z } from 'zod';
import { TutorialSession } from './tutorial';
import {
  RunJournalStore,
  type RunCheckpoint,
  type PendingResult,
  type RunReceipt,
} from '../persistence/run-journal';
import { campaignTutorialRules, captureCampaignTerminal } from '../progression/campaign-result';
import { campaignTutorialPlan, freezeCampaign } from '../sim/campaign-start';
import { Battle } from '../sim/battle';
import { validateCampaign, type Campaign } from '../persistence/campaign';
import { guidedPositions } from '../persistence/practice';
import { foundation } from '../data/foundation';
import { runStateKey } from '../persistence/run-keys';
const safe = (s: string) =>
  s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
const amount = z.string().regex(/^(0|[1-9][0-9]{0,38})$/);
const summarySchema = z.object({
  credits: amount,
  creditedCredits: amount,
  uncreditedCredits: amount,
  bastionXP: amount,
  promotionCores: amount,
  creditedCores: amount,
  uncreditedCores: amount,
  assetXPPool: amount,
  grantedAssetXP: amount,
  unusedAssetXP: amount,
  previousRank: z.number().int(),
  rank: z.number().int(),
  rankProgress: z.number().int(),
  creditsBefore: z.number().int(),
  creditsAfter: z.number().int(),
  coreHP: z.number().int(),
  allocations: z.array(
    z.object({
      id: z.uuid(),
      granted: amount,
      xp: z.number().int(),
      level: z.number().int(),
      previousXP: z.number().int(),
      previousLevel: z.number().int(),
    }),
  ),
  firstClear: z.boolean(),
  discovered: z.array(z.string()),
  objectives: z.array(z.string()),
  recovery: z
    .object({
      credits: z.number().int().nonnegative(),
      startingCredits: z.number().int().nonnegative(),
      coreCredits: z.number().int().nonnegative(),
      grossLessFullRecovery: z.string().regex(/^-?(0|[1-9][0-9]*)$/),
      walletAfterFullRecovery: z.string().regex(/^-?(0|[1-9][0-9]*)$/),
      assets: z.array(z.object({ id: z.uuid(), credits: z.number().int().nonnegative() })),
    })
    .optional(),
});
export class CampaignSession extends TutorialSession {
  protected override get paidEncounter() {
    return true;
  }
  readonly journal = new RunJournalStore(this.repo, campaignTutorialRules);
  private activeCampaign: Campaign = this.campaign;
  private run: RunCheckpoint | undefined;
  private pending: PendingResult | undefined;
  private receipt: RunReceipt | undefined;
  override async initialize(): Promise<void> {
    const heading = this.parent.querySelector('h2'),
      notice = this.parent.querySelector('.notice');
    if (heading) heading.textContent = 'Campaign · C01S01';
    if (notice)
      notice.textContent =
        'Persistent army · Earned progression · Actual wounds and permanent trap stock carry back to your fortress.';
    try {
      this.receipt = await this.journal.unpresented(this.activeCampaign.slot);
      if (this.receipt) {
        this.results();
        return;
      }
      const state = await this.journal.read(this.activeCampaign);
      if (state) {
        this.run = state.checkpoint;
        this.pending = state.pending ?? undefined;
        this.recovery();
      } else this.forecast();
    } catch (e) {
      this.el('battle-content').innerHTML =
        '<h3>Campaign Recovery</h3><p>The retained attempt is preserved. A finalized older attempt can be discarded without paying it again.</p><button id="campaign-stale">Discard Finalized Older Attempt</button><button id="campaign-raw">Export Retained Attempt</button><button id="campaign-title">Return Title</button>';
      this.status(String(e));
      this.button('campaign-stale', async () => {
        await this.journal.discardStale(this.activeCampaign);
        this.forecast();
      });
      this.button('campaign-raw', async () =>
        this.download(
          this.repo.database
            ? await this.repo.database.read('meta', runStateKey(this.activeCampaign.slot))
            : this.journal.memory.get(this.activeCampaign.slot),
          'campaign-recovery.json',
        ),
      );
      this.button('campaign-title', () => this.leave(true));
    }
  }
  override forecast(): void {
    const c = this.activeCampaign;
    this.el('battle-content').innerHTML =
      '<h3>Forecast · C01S01 · Front 1</h3><p>18 Runners and six Raiders · 30 Threat Points · 90 director seconds, then unlimited Cleanup. Defenders fight autonomously in all directions.</p><p>Uses your deployed army, current health, earned levels, purchased enhancements and permanent trap charges. Victory or surrender commits actual damage and rewards. An interrupted attempt can restart from its saved beginning or return to preparation without partial rewards.</p><p>Optional objectives: Warden survives; Core ends at least 75%. Each earns 10% ordinary victory Bastion XP; no extra Credits or asset XP.</p><label>Difficulty <select id="campaign-difficulty"><option value="Standard">Standard</option><option value="Cadet">Cadet · slower enemy decisions, 80% ordinary rewards</option></select></label><div id="campaign-preview"></div>' +
      (!c.assets.some((a) => a.placement)
        ? '<button id="campaign-formation">Apply Suggested Tutorial Formation</button>'
        : '') +
      '<button id="campaign-begin">Begin Campaign Siege</button><button id="campaign-cancel">Return Base</button>';
    try {
      if (c.schema !== 2) throw new Error('Enable progression from preparation before starting');
      const f = freezeCampaign(c);
      this.el('campaign-preview').innerHTML =
        '<ul>' +
        f.army
          .map(
            (a) =>
              `<li>${safe(foundation[a.type as keyof typeof foundation].name)} · L${a.level} / E${a.enhancement} · ${(a.hp / 1024).toFixed(2)} body${a.type === 'friendly.proximity_mine' ? ` · ${a.permanentStock} charge` : ''}</li>`,
          )
          .join('') +
        '</ul>';
      (this.el('campaign-begin') as HTMLButtonElement).disabled = !this.repo.writer;
    } catch (e) {
      this.el('campaign-preview').textContent = String(e);
      (this.el('campaign-begin') as HTMLButtonElement).disabled = true;
    }
    this.button('campaign-cancel', () => this.leave(false));
    if (this.parent.querySelector('#campaign-formation'))
      this.button('campaign-formation', () =>
        this.modalConfirm(
          'Apply Suggested Tutorial Formation',
          'Deploy the existing owned starter units in the suggested formation. No purchase or wallet deduction.',
          async () => {
            const before = this.activeCampaign,
              next = structuredClone(before),
              used = new Set<string>();
            if (next.assets.some((a) => a.placement))
              throw new Error('Existing deployment changed; reload before arranging');
            for (const [type, x, y] of guidedPositions) {
              const a = next.assets
                .filter((a) => a.type === type && !used.has(a.id))
                .sort((a, b) => (a.id < b.id ? -1 : 1))[0];
              if (!a) throw new Error('Required owned asset missing');
              a.placement = { x, y, rotation: 0 };
              used.add(a.id);
            }
            next.revision++;
            const valid = validateCampaign(next);
            await this.repo.commit(valid, before);
            this.activeCampaign = valid;
            this.dialog.close();
            this.forecast();
          },
        ),
      );
    this.button('campaign-begin', async () => {
      if (this.busy) return;
      this.busy = true;
      (this.el('campaign-begin') as HTMLButtonElement).disabled = true;
      const audio = this.audio.unlock();
      try {
        if (this.activeCampaign.schema !== 2) throw new Error('Progression required');
        this.run = await this.journal.start(
          this.activeCampaign,
          campaignTutorialPlan(
            (this.el('campaign-difficulty') as HTMLSelectElement).value as 'Cadet' | 'Standard',
          ),
          freezeCampaign(this.activeCampaign),
        );
        await audio;
        await this.launch();
      } catch (e) {
        this.status(`Preflight stopped: ${String(e)}. Checkpoint preserved.`);
        if (this.run) this.recovery();
        else this.forecast();
      } finally {
        this.busy = false;
      }
    });
  }
  override recovery(): void {
    const cp = this.run;
    if (!cp) return;
    this.stopRuntime();
    const terminal =
      this.pending || this.battle?.state === 'Victory' || this.battle?.state === 'Defeat';
    this.el('battle-content').innerHTML = terminal
      ? '<h3>Pending Campaign Results</h3><p>Exact terminal result retained; rewards have not been applied. Retry the same result.</p><button id="campaign-finalize">Commit Pending Results</button>'
      : '<h3>Interrupted Campaign Siege</h3><p>Restart the saved beginning. Closing the browser does not simulate offline progress or resume mid-battle.</p><button id="campaign-restart">Restart From Checkpoint</button><button id="campaign-abandon">Return to Preparation Without Partial Rewards</button>';
    this.el('battle-content').insertAdjacentHTML(
      'beforeend',
      '<button id="campaign-export">Export Attempt Recovery</button><button id="campaign-title">Return Title</button>',
    );
    if (terminal) this.button('campaign-finalize', () => this.commitResult());
    else {
      this.button('campaign-restart', () => this.launch());
      this.button('campaign-abandon', () => this.confirmDiscard());
    }
    this.button('campaign-title', () => this.leave(true));
    this.button('campaign-export', async () =>
      this.download(
        this.pending ? JSON.parse(await this.journal.exportPending(cp, this.pending)) : cp,
        'campaign-attempt-recovery.json',
      ),
    );
  }
  override async launch(): Promise<void> {
    if (!this.repo.writer)
      throw new Error('Read Only: Return Title and Take Over Editing before restarting');
    if (!this.run || this.pending) throw new Error('No restartable campaign attempt');
    const cp = await this.journal.restart(this.activeCampaign);
    await this.launchRuntime(await Battle.createCampaign(cp.plan, cp.frozen), cp.runID.sequence);
  }
  override async commitResult(): Promise<void> {
    if (!this.run || this.busy) return;
    this.busy = true;
    this.clock?.pause('manual');
    try {
      // An audio-device error must not prevent durable terminal accounting.
      await this.audio.suspend().catch(() => undefined);
      if (!this.pending) {
        if (!this.battle) throw new Error('Missing terminal battle');
        this.pending = await this.journal.buildPending(
          this.run,
          captureCampaignTerminal(this.battle),
        );
      }
      const existing = await this.journal.unpresented(this.activeCampaign.slot);
      if (!existing) await this.journal.journal(this.run, this.pending);
      const result = await this.journal.finalize(this.run, this.pending);
      if (result.status !== 'committed')
        throw new Error('Attempt already finalized; return through campaign recovery');
      this.receipt = result.receipt;
      this.terminalError = false;
      this.results();
    } catch (e) {
      this.terminalError = true;
      this.status(
        `Result commit failed: ${String(e)}. Exact pending result preserved; no partial payment.`,
      );
      this.recovery();
    } finally {
      this.busy = false;
    }
  }
  override results(): void {
    const receipt = this.receipt;
    if (!receipt) return;
    const r = summarySchema.parse(receipt.rewards);
    this.stopRuntime();
    this.parent.dataset.state = receipt.outcome;
    this.el('battle-content').innerHTML =
      `<h3>Campaign ${receipt.outcome}</h3><p>${this.repo.temporary ? 'Committed in Temporary Session · export before closing' : 'Campaign Results Saved'}</p><p>Credits +${r.creditedCredits} · Bastion XP +${r.bastionXP} · Promotion Cores +${r.creditedCores}</p><p>Rank ${r.previousRank} → ${r.rank} · ${r.rankProgress} progress. Asset XP ${r.grantedAssetXP} / ${r.assetXPPool}; ${r.unusedAssetXP} unused. Core ${(r.coreHP / 1024).toFixed(2)} Integrity.</p>${r.firstClear ? '<p>First C01S01 victory claimed once.</p>' : ''}<p>${r.discovered.length ? `New discoveries: ${r.discovered.map((id) => safe(({ 'enemy.runner': 'Runner', 'enemy.raider': 'Raider' } as Record<string, string>)[id] ?? id)).join(', ')}` : 'No new discovery claims.'}</p><ul>${r.allocations.map((a) => `<li>${safe(foundation[this.activeCampaign.assets.find((o) => o.id === a.id)?.type as keyof typeof foundation]?.name ?? a.id)} · +${a.granted} XP · L${a.previousLevel} → L${a.level}</li>`).join('')}</ul><p>Wounds and permanent charge use were saved. Level gains preserve missing health; wrecks remain wrecks. Repair, Restore and Rearm are separate preparation purchases.</p>${r.uncreditedCredits !== '0' || r.uncreditedCores !== '0' ? `<p>Wallet limits: ${r.uncreditedCredits} Credits and ${r.uncreditedCores} Cores could not be credited.</p>` : ''}<button id="campaign-finish">Return Base</button><button id="campaign-receipt">Export Committed Receipt</button><button id="campaign-results-title">Return Title</button>`;
    const details = document.createElement('section');
    details.setAttribute('aria-label', 'Objectives and recovery budget');
    const objectiveLabels: Record<string, string> = {
      'objective.warden_survives': 'Warden survives',
      'objective.core_75': 'Core at least 75%',
    };
    details.innerHTML = `<p>Objectives earned: ${r.objectives.length ? r.objectives.map((id) => safe(objectiveLabels[id] ?? id)).join('; ') : 'none'}.</p>`;
    if (r.recovery) {
      const q = r.recovery;
      details.insertAdjacentHTML(
        'beforeend',
        `<p>Optional full recovery budget: ${q.credits} Credits, including ${q.coreCredits} Core repair. This restores and fully repairs the deployed army and rearms its permanent stock. Starting wounds and spent stock already required ${q.startingCredits} Credits.</p><p>Reward less that full recovery budget: ${safe(q.grossLessFullRecovery)} Credits. Wallet after that budget: ${safe(q.walletAfterFullRecovery)}${BigInt(q.walletAfterFullRecovery) < 0n ? ' (shortfall)' : ''}. No recovery purchase has been made.</p><ul>${q.assets
          .filter((a) => a.credits > 0)
          .map(
            (a) =>
              `<li>${safe(foundation[this.activeCampaign.assets.find((o) => o.id === a.id)?.type as keyof typeof foundation]?.name ?? a.id)} · ${a.credits} Credits for full recovery</li>`,
          )
          .join('')}</ul>`,
      );
    }
    this.el('campaign-finish').before(details);
    this.status('Result committed once. Returning to preparation acknowledges this summary.');
    this.button('campaign-results-title', () => this.leave(true));
    this.button('campaign-receipt', () => this.download(receipt, 'campaign-result-receipt.json'));
    this.button('campaign-finish', async () => {
      await this.journal.acknowledge(this.activeCampaign.slot, receipt.runID);
      this.leave(false);
    });
  }
  override confirmDiscard(): void {
    this.modalConfirm(
      'Return to Preparation',
      'Abandon this unfinished attempt. Restore its saved starting state; no partial rewards or discovery claims.',
      async () => {
        await this.journal.abandon(this.activeCampaign);
        this.dialog.close();
        this.leave(false);
      },
    );
  }
}
