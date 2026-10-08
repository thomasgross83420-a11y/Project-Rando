# Progression engineering decision — 0.2.5

The user authorized an audit of existing work and evidence-based correction of
unclear or unbalanced blueprint rules on 2026-10-07. This decision resolves the
missing accuracy equation and connects specified growth to immutable, per-asset
combat studies. It does not declare the full game balanced or enable paid runs.
The original blueprint remains byte-for-byte retained; this record supplies the
engineering clarification rather than silently rewriting recovered evidence.

## Accuracy and the size of progression

Policy `accuracy.half-miss-v1` uses exact fractions:

`A(L) = A0 + (1 − A0) × (L − 1) / 198`.

At level 100 the baseline miss chance is halved. This preserves level-one
weapon identities, keeps role ordering at every level, avoids automatic perfect
accuracy for an ordinary imperfect weapon, and matches the blueprint's Sentry
90% → 95% reference. Accuracy-1 attacks remain accuracy 1. Examples:
80% → 90%, 85% → 92.5%, 90% → 95%, 95% → 97.5%, 100% → 100%.
No enhancement, injury or star level invents another accuracy multiplier.
Explicit accuracy buffs add percentage points after growth and cap at 100%.

The previously suggested flat five-point curve gave a 95% weapon perfect
accuracy while an 80% weapon improved only to 85%. The selected common
miss-fraction rule gives less accurate weapons more improvement without making
them indistinguishable. Linear interpolation supplies a simple inspectable
first curve; the endpoint follows the recovered Sentry reference. These are
design constraints and an initial engineering decision, not numbers established
by an external article or final player acceptance.

The Sentry reference is a five-percentage-point gain, not six. Taken alone it
raises roll-success-weighted output by 5.56% and halves raw misses. In combination
with the specified per-shot and firing-rate growth, level 100 / purchased E10
raises theoretical roll-weighted DPS from 45 to approximately 124.8003 (2.773×).
Integrity rises from 1200 to 2652 (2.21×); range from 8 to 9.2002 GU. Level-only
output and purchased enhancement output are reported separately. Stars/perks
supply additional role changes and are excluded from this calculation.

These values justify retaining a reliable starting Sentry while fixing the
missing progression rule. Lowering its starting accuracy merely to make the
percentage-point difference larger would weaken new-player reliability without
combat evidence requiring that change. Full progression also includes capacity,
new roles, layouts, land, specializations and signatures. Their acquisition and
usefulness must be tested at their own implementation milestones.

## What was engineered

- Exact rational probabilities compare against the uniform uint32 roll without
  integer-percent rounding. Sub-percent gains survive at each level. The
  simulation still consumes exactly three draws per released projectile.
- `captureProfile` captures separate frozen definitions for Sentry, Rifle,
  Repair Node and Bulwark, rather than mutating a shared global type. Body,
  ordinary output/range/interval, repair output/range and Interpose shield output
  use their documented growth owners. Armor, movement, footprint, perception,
  fixed cooldowns and channel cadence retain their documented values. The rest
  of the roster is explicitly unsupported, not fabricated or certified.
- Existing wounds remain the same absolute missing body amount when maximum
  body grows. The existing zero-body progression rule remains zero. Studies
  start from the fixture's baseline body; enhancements shown are assumed paid.
- Enemy bands use §13 health/damage/armor growth only. No difficulty multiplier
  or player-wallet/stat scaling is quietly applied to enemies.
- Sequential purchase quotes use checked wide integers. Enhancement cost is
  `ceil(baseCost × (5 + 3k) / 20)` for the next tier. For base 100 / tier 2,
  floating evaluation would incorrectly charge 56 instead of 55. Warden's
  calculation base is explicitly 500. Promotion requires both account rank and
  asset level and its previous tier. Sentry E1–10 totals 2690 Credits; all
  promotion tiers total 82000 Credits / 82 Cores.
- A zero-request body-repair preview now returns zero restored/zero cost for a
  living asset. It still cannot resurrect a wreck or accept negative requests.
  This corrects quote consistency without enabling a payment command.
- `Battle.createStudy` captures validated input identity, unique UUID profiles,
  seed, band and accuracy-growth ablation. Its snapshot is explicitly marked
  `development-balance-study`. Diagnostics distinguish the accuracy decision
  from first physical contact with the intended enemy, another enemy, friendly
  cover, expiry or an unresolved flight. Contact does not imply positive damage;
  actual capped body loss is collected separately from native impact events.

## Measured comparisons and their boundary

`npm run audit:progression-balance` writes
[evidence/PROGRESSION_BALANCE.json](evidence/PROGRESSION_BALANCE.json).
The unchanged authored 24-body / 30TP schedule is used across levels
1/10/25/50/75/100, with and without the allowed purchased enhancement tiers.
Four paired accuracy seeds provide sensitivity checks. Additional comparisons
use a reduced Rifle/Bulwark network, band-20 opponents, band-1 opponents, and
turn off accuracy growth while retaining all other grown fields.

The studies capture terminal time/outcome, capped damage by role, actual repair,
end body and quoted body recovery. A consumed Mine is excluded from body-wreck
pricing; rearm is a separate stock expense. The Core quote uses its own body
price. Min/median/max are small-sample descriptions, not confidence intervals.
The level/band pairing is a diagnostic grid; it does not imply that rank and
asset level advance together in the player game.

This tutorial schedule cannot validate ordinary late-game balance: real budgets,
new threats, ranged units, bosses, map/doctrine changes, promotion perks and
actual XP contributions are missing from that fixture. Four seeds cannot certify
fun or defeat frequency. Body-recovery quotes alone cannot establish the
blueprint's 10–35% recovery/gross income target. XP thresholds, reward coefficients
and promotion prices are retained pending those relevant measurements rather
than changed using tutorial completion times as campaign pacing evidence.

## Compatibility and next implementation boundary

The playable tutorial keeps its old integer-percent baseline and pinned v1/v2
streams/replay hashes. The exact roll helper gives the identical old threshold.
The level-one study's authoritative snapshot, after removing its clearly marked
captured study input, matches the existing v2 tutorial exactly. Study diagnostics
are not future-driving state, checkpoints or campaign receipts. The study capture
module loads only when requested; ordinary play does not load the profile-study
chunk or its fixture input schema.

A production grown-stat run must capture policy and per-UUID stats into its
versioned logical plan before start, widen the validated campaign profile, and
implement matching injury/stock/contribution/reward handling plus complete
run/receipt backup-import. It cannot read a mutable level mid-battle or reuse an
old plan hash for a different profile. No old save is migrated, wallet rewritten,
paid upgrade granted or practice reward invented by this increment.

Next: actual contribution/body/stock capture, the versioned campaign profile,
production result adapter and complete ordinary-run recovery; then real encounter
pacing and all-role comparisons. Continue per-asset contact/anatomy refinement
and 360° movement invariants. No additional user input is required for this work.
Physical Lenovo performance and final feel remain device/playtest acceptance.

## Research used to choose the method

Primary sources checked 2026-10-07:

- [Factorio, Friday Facts #169](https://www.factorio.com/blog/post/fff-169):
  developer-described comparisons at successive research/enemy-evolution stages
  and an explicit concern for survivable early defense. This informed paired
  progression/opponent checkpoints; no Factorio values were copied.
- [Factorio, Friday Facts #304](https://www.factorio.com/blog/post/fff-304):
  an upgrade cadence bug made an advertised shooting-speed bonus ineffective;
  the developers adjusted balance after fixing the actual delivered behavior.
  This informed checking discrete releases and physical contacts rather than
  balancing from nominal spreadsheet DPS alone.
- [GDC, Brian Davis, Balancing Your Game: A Formula-Driven Approach](https://gdcvault.com/play/1023865/Balancing-Your-Game-A-Formula):
  the published session overview describes formula-based balance questions.
  Only that overview was consulted; no claim of viewing its full presentation.

These references support the measurement approach. They do not establish this
specific game's curves, device performance, final pacing or player enjoyment.

## Results of this increment

All 68 runs across 17 configurations reached Victory. This confirms a forgiving
teaching fixture across this grid, not a target campaign defeat frequency.
There were 9538 projectile releases: 978 successful accuracy rolls resolved
without contacting the intended target, and 140 failed rolls still contacted it.
Every release resolved by the terminal observation; no in-flight samples were
quietly counted as misses.

Against band-20 bodies, the reduced Rifle/Bulwark setup's median terminal time
fell from 115.29 seconds at L1/E0 to 98.38 at L100/E10; quoted body recovery fell
from 383.5 to 66.5 Credits. With the same L100/E10 fields but accuracy growth
switched off, medians were 100.32 seconds and 74 Credits. That is a controlled
accuracy comparison; the much larger total improvement includes other growth.

The guided full-network L100/E10 comparison showed nearly identical median
times (98.58 seconds with growth, 98.59 without) and body recovery 12 versus 11
Credits. Individual seeds can change target/release order and later damage; a
higher accuracy parameter does not promise lower injury in every tactical trace.
The reduced-network comparison cannot be substituted for this counterexample.
Fixed late deployments also limit how far a stronger army can reduce total time.
Broader threats and longer encounters are required before calling any curve final.

The aggregate median uses the arithmetic mean of the two central observations
for these four-run samples. Initial lower-order aggregation was corrected from
retained per-run records without changing any simulation result or hash.
