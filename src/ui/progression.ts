import type { Campaign, Owned } from '../persistence/campaign';
import { maximumBody } from '../persistence/campaign';
import { foundation } from '../data/foundation';
import thresholds from '../data/progression.json';
import { previewProgression, type ProgressionCommand } from '../progression/preparation';
import { previewEmergency, recoveryViable } from '../progression/emergency';
import { captureProfile, developingSlice } from '../progression/profile';
import type { CombatID } from '../data/combat';
const points = (n: number) => (n / 1024).toLocaleString(undefined, { maximumFractionDigits: 3 });
interface Actions {
  confirm(title: string, text: string, accept: () => Promise<void>): void;
  commit(after: Campaign, before: Campaign, outsideHistory?: boolean): Promise<void>;
  error(message: string): void;
  enabled: boolean;
}
export function progressionControls(
  host: HTMLElement,
  c: Campaign,
  selected: Owned | undefined,
  actions: Actions,
): void {
  host.replaceChildren();
  if (c.schema !== 2) return;
  const panel = document.createElement('section');
  panel.setAttribute('aria-label', 'Progression and recovery');
  panel.innerHTML = `<h3>Progression and Recovery</h3><p>Core ${points(c.coreHP)} / 10,000 Integrity. Repairs are purchased explicitly.</p><label>Core repair points <input id="core-repair-points" type="number" min="0" step="1" value="${Math.ceil((10000 * 1024 - c.coreHP) / 1024)}"></label>`;
  host.append(panel);
  const add = (label: string, fn: () => void, disabled = false) => {
    const b = document.createElement('button');
    b.textContent = label;
    b.disabled = disabled || !actions.enabled;
    b.onclick = () => {
      try {
        fn();
      } catch (e) {
        actions.error(String(e));
      }
    };
    panel.append(b);
    return b;
  };
  const preview = (command: ProgressionCommand) => {
    const q = previewProgression(c, command);
    const resulting =
      command.kind === 'repair-core'
        ? `Core ${points(c.coreHP)} → ${points(q.after.coreHP)} Integrity.`
        : (() => {
            const before = c.assets.find((a) => a.id === command.id),
              after = q.after.assets.find((a) => a.id === command.id);
            return before && after
              ? `${foundation[after.type].name}: body ${points(before.hp)} → ${points(after.hp)} / ${points(maximumBody(after))}; enhancement E${after.enhancement}${after.permanentCharges !== null ? `; ${after.permanentCharges} permanent charge` : ''}.${command.kind === 'enhance' && (developingSlice as readonly string[]).includes(after.type) ? profileComparison(after.type as CombatID, after.level, before.enhancement, after.enhancement) : ''}`
              : '';
          })();
    actions.confirm(
      `Purchase ${command.kind}`,
      `${q.creditsSpent.toLocaleString()} Credits. Wallet ${c.credits.toLocaleString()} → ${q.after.credits.toLocaleString()}. ${resulting} This preserves earned XP and paid investment.`,
      () => actions.commit(q.after, c),
    );
  };
  add(
    'Review Core Repair',
    () =>
      preview({
        kind: 'repair-core',
        requested:
          Number((panel.querySelector('#core-repair-points') as HTMLInputElement).value) * 1024,
      }),
    c.coreHP === 10000 * 1024,
  );
  if (selected) {
    const a = c.assets.find((a) => a.id === selected.id);
    if (!a) return;
    const max = maximumBody(a),
      detail = document.createElement('p'),
      d = foundation[a.type],
      next = thresholds.assetCumulative[a.level];
    detail.textContent = `${d.name} · ${points(a.hp)} / ${points(max)} body${a.hp === 0 ? ' · Wrecked' : ''} · ${d.developing ? `L${a.level} · ${a.level === 100 ? 'MAX' : `${a.xp.toLocaleString()} cumulative XP / ${next?.toLocaleString()} next threshold`} · E${a.enhancement} / ${Math.floor(a.level / 10)} eligible` : 'Fixed level · no XP'}${a.refundLocked ? ' · Emergency refund lock' : ''}${a.permanentCharges !== null ? ` · ${a.permanentCharges} / 1 permanent charge` : ''}`;
    panel.append(detail);
    if (a.hp === 0) add('Review Restore', () => preview({ kind: 'restore', id: a.id }));
    else {
      const label = document.createElement('label');
      label.textContent = 'Asset repair points ';
      const input = document.createElement('input');
      input.id = 'asset-repair-points';
      input.type = 'number';
      input.min = '0';
      input.step = '1';
      input.value = String(Math.ceil((max - a.hp) / 1024));
      label.append(input);
      panel.append(label);
      add(
        'Review Asset Repair',
        () => preview({ kind: 'repair', id: a.id, requested: Number(input.value) * 1024 }),
        a.hp === max,
      );
    }
    if (a.type === 'friendly.proximity_mine')
      add(
        'Review Rearm',
        () => preview({ kind: 'rearm', id: a.id, requested: 1 }),
        a.hp === 0 || a.permanentCharges === 1,
      );
    if (d.developing)
      add(
        `Review Enhancement ${a.enhancement + 1}`,
        () => preview({ kind: 'enhance', id: a.id }),
        a.enhancement >= Math.floor(a.level / 10),
      );
  }
  if (!recoveryViable(c)) {
    const description = document.createElement('p');
    description.textContent =
      'Your owned defense needs recovery. If the minimum priced recovery is affordable, it uses Credits. Otherwise Emergency Reconstruction supplies the prescribed minimums without duplicate assets. Cadet and free practice remain available.';
    panel.append(description);
    const input = document.createElement('select');
    input.id = 'emergency-conversion';
    const none = document.createElement('option');
    none.value = '';
    none.textContent = 'No ownership conversion';
    input.append(none);
    if (c.assets.length === 1024)
      for (const a of c.assets.filter((a) => foundation[a.type].category !== 'warden')) {
        const option = document.createElement('option');
        option.value = a.id;
        option.textContent = `Convert ${foundation[a.type].name} · ${a.id.slice(-6)} · lose this identity and its XP`;
        input.append(option);
      }
    if (c.assets.length === 1024) {
      const label = document.createElement('label');
      label.textContent = 'Only if the ownership cap requires it: ';
      label.append(input);
      panel.append(label);
    }
    add('Review Recovery', () => {
      const q = previewEmergency(c, input.value || undefined);
      actions.confirm(
        q.kind === 'subsidy' ? 'Emergency Reconstruction' : 'Minimum Priced Recovery',
        `${q.credits} Credits. Core → ${points(q.after.coreHP)} Integrity. ${q.subsidized.length ? `${q.subsidized.length} restored identities are refund locked until deployed in a finalized victory.` : 'Restores the least-cost viable owned defense; consider fuller Core repairs before fighting.'} ${q.stored.length} obstructing deployments will be stored, preserving ownership. ${input.value ? 'The selected identity is replaced with a basic Sentry at zero refund; its XP is lost.' : ''}`,
        () => actions.commit(q.after, c, true),
      );
    });
  }
}

function profileComparison(type: CombatID, level: number, from: number, to: number): string {
  const a = captureProfile(type, level, from),
    b = captureProfile(type, level, to);
  const parts: string[] = [];
  if (a.definition.weapon && b.definition.weapon) {
    const x = a.definition.weapon,
      y = b.definition.weapon;
    parts.push(
      `Full-body damage per release ${points(x.damage)} → ${points(y.damage)}; raw output/sec ${points((x.damage * 60) / x.interval)} → ${points((y.damage * 60) / y.interval)} before squad injury, accuracy, armor and travel; weapon range ${points(x.range)} → ${points(y.range)} GU; interval ${(y.interval / 60).toFixed(3)} s.`,
    );
    if (b.accuracy)
      parts.push(
        `Accuracy ${((100 * b.accuracy.numerator) / b.accuracy.denominator).toFixed(4)}% (accuracy grows with earned level).`,
      );
  }
  if (a.repair && b.repair)
    parts.push(
      `Repair ${points(a.repair.perPulse * 4)} → ${points(b.repair.perPulse * 4)} Integrity/sec; Core ${points(b.repair.corePerPulse * 4)}/sec; support range ${points(a.repair.range)} → ${points(b.repair.range)} GU.`,
    );
  if (b.interposePool)
    parts.push(`Interpose shield pool ${points(a.interposePool)} → ${points(b.interposePool)}.`);
  return ` ${parts.join(' ')}`;
}
