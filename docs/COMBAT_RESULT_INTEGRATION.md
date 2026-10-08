# Combat contribution and campaign integration

Development continuation, 2026-10-08, application 0.2.6. This increment follows
[the progression balance audit](PROGRESSION_BALANCE.md). The unchanged blueprint's
full roster and campaign remain the objective; this is the first persistent
Bulwark/Bastion C01S01 slice, not a completed campaign.

## Applied contribution

The optional ledger observes applied outcomes without changing targeting, damage,
motion, cooldowns or random draw order. Untracked legacy snapshots stay unchanged.

- Damage credit uses actual hostile body loss and shield absorption, capped by
  what remains. Released projectiles retain source credit after owner death.
- Restoration credit is shared across providers and limited to initial missing
  body plus actual hostile body damage. Healing never revives zero-body wrecks.
- Shield prevention uses ordered counterfactual body damage after armor and
  remaining-body caps; Holdfast earns only the remaining reduction. Their total
  cannot exceed the unprotected attack's possible body loss.
- Permanent mine stock is separate from body. Temporary stock spends first and
  cannot become permanent paid stock. A spent mine retains its body.
- Exact capped slow/root and first-hidden-reveal accounting kernels exist, but
  these abilities are absent from this combat slice. Its terminal adapter rejects
  invented control/reveal contribution.

A body-point equivalent is 6,144,000 score units, retaining 60-tick percentage
slow credit exactly. Living participation scans friendly actors, not all retained
hostile corpses. The 70/30 contribution/participation XP allocation retains exact
fractions and reports unused XP.

## Player flow and saved progression

Preparation offers Campaign Siege C01S01. A legacy campaign first shows explicit
progression migration: schema 2 preserves owned UUIDs, money, wounds and placement,
adds zero XP/investment and initial permanent stock, and increases revision once.
Legacy practice never spent campaign stock. Schema 1 saves and old practice
checkpoints remain valid; migration is blocked during retained attempts/results.

A separate rb-sim-v3 capture freezes deployed UUIDs, actual body, earned levels,
purchased enhancements and permanent stock before loading combat. Empty starter
layouts offer a confirmed, free placement of existing owned units. Custom layouts
are preserved. Defenders still traverse and fight through continuous 360° headings;
rendered facings do not restrict movement.

Only four current developing types receive earned growth: Sentry, Rifle Squad,
Repair Node and Bulwark. Fixed objects receive no XP. Unsupported roster identities
receive no invented progression. Stars remain 1 until their actual perks and
branches exist. The grown inspector/range overlay and purchase preview show actual
current statistics rather than a global baseline shared across all instances.

Core repair, asset repair, Restore, permanent mine Rearm and level-gated Enhancement
are explicit quoted purchases. Confirmation reports the exact price and resulting
body, wallet, enhancement and stock; Enhancement also previews weapon/support
statistics. Growth preserves absolute missing body on living units. Wreck upgrades
stay at zero; Restore buys half maximum body. Rearming an empty living mine costs
19 Credits and changes stock without repairing its body. Sale price kernels exist;
Sale and promotion are not enabled in the preparation interface.

Schema 2 validates XP-derived levels, rank progress, bounded lifetime XP, sequential
paid enhancement investment, stock and emergency refund flags. Legacy version keys
remain pinned for old saves; separate progression keys identify the new schemas.

## Encounter, reward and recovery budget

C01S01 retains its authored 24 enemies, 30 TP and 90-second director schedule, then
unlimited Cleanup. Standard uses 0.35-second enemy decisions. Cadet uses 0.5-second
decisions and 80% ordinary rewards; its authored tutorial packet schedule is not
silently scaled down. Forecast lists Warden-survival and Core-at-least-75% optional
objectives. Each earns 10% ordinary victory Bastion XP, capped at two; they do not
increase Credits or asset XP.

The tested Standard first victory earns 286 Bastion XP: 155 ordinary becomes 186
with both objectives, plus 50 first-clear and two 25-XP discoveries. Rank becomes
2 with 186 progress. The asset pool is 200 XP and the Core reward is 1. A repeat
with both objectives at the tested starting rank earns 186 Bastion XP; first-clear
and discovery cannot be reclaimed. The existing band/start-rank repeat policy still
applies. Defeat saves actual wounds/stock and eligible partial rewards; abandoning
an unfinished attempt returns to the captured beginning without rewards/claims.

Results show allocations, level changes, unused XP, rank changes, discoveries,
objectives and wallet-cap excess. An optional full-recovery budget uses the same
Restore/Repair/Rearm kernels as preparation, after earned level changes. It includes
only the deployed army plus Core. Starting recovery cost is shown separately to
avoid attributing pre-existing wounds to this battle. Reward-minus-budget and
wallet-after-budget may be negative and are clearly advisory: no recovery purchase
or automatic deduction occurs.

The terminal adapter checks identities, actual contribution, participation,
restoration/injury conservation, permanent stock, admitted packet prefix, kills,
quarter-TP origin segments and victory quiet before deriving the result. Reward
origins follow authored spawn segments rather than kill timing or render frames.
It rejects practice/Study terminals. The current hostile roster is melee-only;
adding hostile ranged weapons requires widening and testing the projectile proof.

## Emergency reconstruction and free practice

When Core/selected Warden/owned damaging defense is not viable, Review Recovery
first calculates the least-cost priced recovery. If affordable it spends Credits;
otherwise the starter-slice emergency operation raises Core to at least 25% and
eligible owned Warden/basic weapons to at least half current maximum body, reusing
UUIDs, growth and investments. It never lowers healthy assets. Missing basics are
created only when needed and ownership space permits. Obstructing deployments may
be stored without deleting ownership. The 1024-asset conversion path requires an
explicit selected non-Warden identity and warns of lost identity/XP.

Subsidized identities have refund locks. Finalized victory clears locks only for
deployed identities; emergency-created bodies keep zero base refund permanently.
Recovery is outside Undo and cannot be tapped again once the defense is viable.
The zero-Credit, zero-Core, all-wreck guided Bulwark/Bastion army wins the authored
Cadet tutorial after reconstruction without paid repairs. Other Wardens/doctrines,
all nine required emergency fixtures and emergency-sale tombstones remain open.
The current API rejects selling an active locked emergency identity.

Schema-2 free practice uses a separately captured full-body/full-stock clone with
the actual owned levels and enhancements. Original wounds, wrecks, stock, wallet,
XP and discovery remain untouched. Old v1/v2 practice replay keeps its own rules.

## Atomic results, interruption and backup

Before combat loads, the complete starting checkpoint is durable. Interrupted
attempts restart from that beginning; there is no mid-battle/offline simulation.
The two-phase journal derives and seals a terminal result, then atomically commits
campaign, previous snapshot, receipt and monotonic claims while clearing the active
run. Failed writes preserve the exact pending result for retry. Audio failure does
not prevent accounting. Preparation and practice remain blocked until the saved
result has been acknowledged; returning to Title keeps that summary recoverable.

Whole-slot backups include active checkpoints, pending results and receipts.
Importing into another slot rebinds only slot/base revision and recomputes dependent
seals before the transaction; captured army/terminal/reward meaning stays unchanged.
Newer local fences prevent older backups from paying again. Restore/Delete/Replace
respect retained paid attempts and unpresented summaries. Native abort tests cover
checkpoint import and receipt commit; they verify full rollback and exact retry.
Metadata keys are shared by backup and run persistence, avoiding receipt omission.

All sequence readers enforce unsigned 64-bit maximum 18,446,744,073,709,551,615;
a 20-digit regex alone was insufficient. Namespace rollover remains future work.

Cross-reference: [MDN IDBTransaction](https://developer.mozilla.org/en-US/docs/Web/API/IDBTransaction),
checked 2026-10-08. Transactions alternate active/inactive between event-loop tasks
and auto-commit with no outstanding requests. Hashing, schema validation and rebasing
finish before final writes; writer/base/state comparisons remain inside transaction
callbacks. Completion is not proof against sudden OS/device power loss.

Full verification passed all 126 unit tests (28 files), all 43 browser checks,
type checking, lint, formatting, deterministic scenario and production build.
Eight actual terminal receipts compare guided/repeat, injured biological and
mechanical assets, Repair Node present/stored, emergency and zero-kill surrender.
Counts and hashes are recorded in TEST_EVIDENCE.md and COMBAT_PROGRESSION_TESTS.json.
A follow-up four-Node audit found self-repair incorrectly consuming one of the
two external slots in v3; its versioned correction is the next mechanics increment. Desktop checks do not
certify Lenovo hardware performance, Android sharing or TalkBack behavior. Full
roster, animation contact authoring, earned promotions, later encounters, bosses,
all doctrines, modes and release acceptance remain development work.

Audio failure cross-reference: [MDN suspend](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/suspend) and [MDN resume](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/resume), checked 2026-10-08. Their Promises can reject for a closed context; gameplay must handle audio-device errors separately from persistence.
