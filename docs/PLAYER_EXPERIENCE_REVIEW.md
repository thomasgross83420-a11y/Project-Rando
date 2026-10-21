# Resonance Bastion · 0.4.0 player-experience review

2026-10-21

[Play directly](https://thomasgross83420-a11y.github.io/Project-Rando/?build=0.4.0-player-experience)

This release replaces the overloaded first-pass journey with a clearer preparation and battle flow, and corrects movement, warning geometry, formation and recovery defects found during testing. It retains the complete roster, campaign and additional modes. Courtyard paving, reserved-pad details and owned-land markings give the field a clearer visual identity without adding obstacles.

## What the player sees

- A visible next objective and one action to reach the next relevant siege. A rank gate points to XP-bearing expeditions.
- A short briefing: attack direction, deployment duration, main threats and a useful preparation tip. Start is prominent. The full stage index, enemy detail and wave data are expandable.
- A battlefield with its own unobscured viewport above or beside the menu. Center frames the defenders. Drag, pinch, rotate and map zoom are available without leaving the field.
- Illustrated build cards with short role descriptions. Preview, cancel and adjust freely; a successful Place spends once. Precise cells and nudges remain available.
- Army filters for deployed, stored and damaged assets. Bulk selection is optional. Health bars, named overlap choices and caller-aware Back reduce navigation friction.
- A short optional Field Guide. Tactics start with posture and a touch-based, reviewed rally point; deeper policies are expandable.
- Exact full-force restoration costs, including both wreck revival and the remaining healing. Individual half-body revival remains a cheaper separate choice.
- Clearer battle health percentages and wave progress, explicit pauses, safe interruption handling, and restart/withdraw recovery for a stalled siege.
- Backup download/import checks caught and corrected a stale menu after restoration. Loading now clears the previous menu, placement preview and selection before presenting the restored field.

## Engineering corrections

Movement remains continuous through 360 degrees. Body and weapon frames now map world headings correctly through all four camera views. Static four-facing clips cover the full circle. Attack warning geometry uses the same north/clockwise direction convention as combat.

Navigation now uses the actual starting body position and connects to an exact destination between grid centers. Geometry caches and cached route overlays eliminate repeated work. Bulwark/Mender formations advance instead of mutually drifting away. Stalled cleanup pauses after the specified diagnostic interval and offers recovery; it cannot manufacture a win.

Endurance chooses its boss from the declared band. Vent triggers respect the placed forward sector and apply one Burn per activation. Snares skip immune targets without wasting a charge. Practice respects a stored selected Warden.

The guided arrangement handles extra towers and squads, checks actual capacity and resolves overlaps. It places compatible high-output towers toward the disclosed approach. It changes no wallet or ownership and is applied only through a reviewed preparation action.

## Balance evidence

The tutorial is covered for all three doctrines and all three Wardens. Early progression audits use the free starting inventories, earned funds, actual injuries, repair prices and legal purchases on Standard. They do not inject levels or money.

Bastion and Chokepoint cleared the first boss after adding firepower. A single generic purchase plan did not work equally well for Mobile. From its earned Rank 7 checkpoint, Mobile cleared the same boss with either four additional Sentries (1,000 Credits, 73% Core remaining) or Rotary, two Sentries and a Repair Node (1,350 Credits, full Core remaining). Both left a substantial reserve. Another tested Heavy/repair configuration lost. Placement, support and capacity matter; a larger purchase is not automatically a better defense.

These are verified early-game paths. They do not establish the balance or enjoyment of every natural 40-stage campaign, difficulty, promotion branch and endgame army combination. Baseline stats, prices, thresholds and reward multipliers were not changed to force favorable results.

## Review rubric

Scores below are provisional design-review judgments on a ten-point scale. Eight means coherent core behavior with relevant checks and bounded known limits. Ten would require much stronger repeated player and device evidence. Scores are not a certification or a measured fun rating.

| Area | Before | Current assessment | Basis |
| --- | ---: | ---: | --- |
| Next objective and learning | 4 | 8 | Next action, short briefing, optional contextual practice |
| Menu hierarchy and reading load | 3 | 8 | Specialist information is expandable; primary actions are clear |
| Touch navigation and purchase safety | 5 | 8 | Gestures, map alternatives, reviewed rally points, atomic placement |
| Movement and warning consistency | 5 | 8 | Direction mapping, real-start routing, exact-goal routing, formation regressions |
| Recovery and transaction clarity | 6 | 8 | Exact restoration, stalled-siege recovery, single reward claims |
| Early progression | 5 | 8 | Multiple legal first-chapter paths; continued need to choose a suitable defense |
| Whole-campaign balance | — | Not yet established | Broad simulation coverage is not a natural campaign playthrough |
| Physical Lenovo performance and comfort | — | Not yet established | Requires the actual tablet; desktop throttling is an approximation |
| Visual presentation and asset consistency | 6 | 7 | More readable framing, an authored courtyard and corrected facings; the simple pixel assets still need a dedicated refinement and player review |

I am not marking every aspect 8/10 by assumption. This is a substantial tested upgrade, with remaining detailed asset acceptance, long-term balance and physical-device acceptance stated explicitly.

## Validation

The [release test evidence](evidence/player-experience-release.json) and [browser case record](evidence/player-experience-browser.json) summarize the checks. The broad combat sweep runs 63 cases: all 40 campaign plans, 12 fixed Mastery trials, late Expedition, Calibration, Boss Siege, Long Watch, Archive and all six Endurance block plans. Every case terminated and rejected a duplicate reward claim. The seeded full-roster fixture recorded 12 victories and 51 defeats. A complete rerun with the final collision implementation matched all 63 recorded outputs, excluding elapsed machine timing. Those defeats are valid terminal outcomes in a regression test; they are not successful campaign clears. Endurance blocks were tested as separate captured plans, not a six-block natural attrition playthrough.

Unit integration also exercises all 64 enemy-role/variant combinations and the eight bosses' phase and descendant transitions. Collision optimizations are checked against a frozen original BigInt reference, including exact contact fractions and corner behavior. All 65,536 original heading vectors are compared exactly. A seeded collision stress battle produced an identical final state fingerprint with approximately 3.6× lower elapsed simulation time in the shared execution environment.

All 189 unit/integration tests pass. Browser verification covers 90 distinct cases: 20 current-game checks and 70 retained-preview compatibility checks. The initial complete run passed 85/88; three test-harness failures were corrected and rerun successfully. An additional backup check found the stale-menu defect; after its correction, the final current-game run passed all 20 without retries or skips. The scenario fingerprint remains unchanged, and typecheck, lint and production build pass; lint retains existing warnings and informational findings.

The browser checks cover phone and tablet portrait/landscape layouts, 48-pixel controls, 200% text, high contrast, native touch panning and pinch, camera orientations, placement cancellation and double confirmation, Back, keyboard pause, save reload, pending rewards, practice isolation, interruption and stalled cleanup. Storage-failure injection specifically targets campaign commits so that an unrelated lease heartbeat cannot preempt the tested write. The long four-view and six-layout legacy checks retain their assertions with explicit 60-second time budgets.

Two rendered stress runs each exceeded ten minutes with no page errors. Their frame times were poor under the combination of 24 Apex Carriers, requested 4× battle speed, 4× CPU throttling, software graphics and concurrent verification. The optimized run's frame times were not better in this confounded comparison. The separate identical-state simulation profile establishes the collision improvement; these browser runs do not establish a rendering speedup or acceptable tablet frame rate. JS heap measurements exclude graphics and decoded audio memory.

A separate quiet ordinary-play observation recorded 29 combat seconds over approximately 30 wall seconds at 1× speed, both without throttling and with 4× CPU throttling. Median browser rAF intervals were approximately 33 ms and 50 ms respectively, with approximately 67 ms at the 95th percentile. These observations used Chromium’s SwiftShader software renderer, confirmed through its GPU diagnostics. They demonstrate simulation pacing in those samples, not an acceptable physical-device frame rate or input-latency result.

Reproduction commands include `npm run verify`, `npm run test:browser`, `npm run audit:game`, `npm run audit:boss-choices` and `npm run audit:collision`. The boss-choice command uses a checked-in synthetic earned checkpoint; it omits only historical result/archive logs.

## Saves and direct access

Use the same public link and Chrome profile as before. Existing full-version saves retain the same database and schema. Earlier preview saves stay separate and remain explicitly importable. Corrected current mechanics apply to restarted captures and Archive battles; the old runtime's exact combat sequence is not promised.

Backups: **Manage → Data / backups → Export backup**.

## What still needs the player's tablet

The remaining required input is an on-tablet review of touch comfort, legibility, motion, sound balance and pacing. Physical median frame rate, 95th-percentile frame time, input latency, orientation recovery and memory stability cannot be certified from this remote environment. No PC is needed to play or export the review.

## References

The [blueprint addendum](BLUEPRINT_ADDENDUM_0.4.md) links the primary research and explains how it affected the design: Microsoft objective clarity, NNGroup progressive disclosure, Android touch targets, W3C gesture alternatives, contextual tutorials, Riot's UI/design guidance, Subset Games' Into the Breach postmortem and web.dev performance guidance.
