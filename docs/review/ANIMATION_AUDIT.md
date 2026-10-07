# Animation quality audit — 2026-10-07

Authority: user instruction for detailed, well-structured, natural and accurate
animation mechanics, scrutinized across each asset's relevant behaviors;
blueprint §§16,21,24,27. Device/scope constraints: [DEVICE_TARGET.md](../DEVICE_TARGET.md).
Application build: 0.2.1-animation-audit. No final art approval is inferred.

This is the historical audit. The [0.2.2 follow-up](ANIMATION_REFINEMENT.md)
corrects runtime overlay attachment and action continuity; raw source mismatches
remain documented. Current `npm run audit:art` reports those raw findings and
strictly verifies the compositor actually used in the game.

## Findings and corrections

| Finding | State and evidence |
| --- | --- |
| Effects used four ticks/frame while the atlas specifies five, with a shared 20-tick cutoff; the explosion's sixth frame could never appear | **Fixed.** Renderer samples authored frame durations; impact/shield last 20 ticks, explosion lasts 30 ticks and reaches frame 5. Reduced effects preserve the same lifetime. Tests exercise every boundary and expiry. |
| Hit reactions ended after 15 ticks while their authored two 8-tick frames total 16 | **Fixed.** Actor state window and frame selection follow the authored timeline; the final hit frame remains visible at age 15. |
| Separate effect types could share the same renderer object key | **Fixed defensively.** Effect keys include event kind as well as tick/source/target. |
| Animation durations/counts duplicated in the renderer instead of coming from the atlas | **Fixed.** Timelines compile once and sampling uses authoritative simulation ticks, independent of render frame rate/audio. Terminal poses clamp instead of looping; missing/gapped timings fail clearly. |
| Damage overlays are authored against idle silhouettes and do not follow every animated pose | **Open defect.** Pixel comparison finds 427 mismatched pose/band pairs of 1,280 checked, up to 11 pixels outside a body's alpha silhouette. [Machine-readable audit](../evidence/ANIMATION_AUDIT.json). Source/renderer attachment needs correction before final acceptance. |
| Current rig slices bodies/arms/legs at broad image fractions and scales/rotates upper-body sections for downed poses | **Open quality work.** This produces candidate movement but is not proof of anatomically correct joints, equipment articulation or natural falls. Replace generic assumptions with explicit per-asset authored parts/contact landmarks; inspect all directions and states. |
| Frames have timing metadata but no complete per-facing muzzle/tool/contact sockets or authoritative contact/recovery markers | **Open quality work.** Weapon strike/release and support/ability causality must receive explicit landmarks. In particular, review ability cast-to-release continuity and support channel phase; state availability alone does not prove correct contact timing. |

The last three items prevent final natural-motion certification and roster
propagation. They do not invalidate the previously verified tutorial simulation.
No source art, gameplay tuning, simulation/content version or save schema was
changed by the timing correction. The existing downloadable review is the
0.2.0-tutorial snapshot; it is not silently replaced with a claim of finished
0.2.1 art. Updated art/motion review follows actual corrective authoring.

## Per-asset acceptance matrix

| Current asset | Relevant checks before acceptance |
| --- | --- |
| Harmonic Core | Four asymmetric views; stable base/pivot; machinery/light behavior; damage bands; hit/wreck; no invented locomotion/attack |
| Sentry | Eight aim poses mapped through four cameras; barrel/pedestal alignment; braced recoil and muzzle/release contact; damage/hit/wreck |
| Rifle Squad | Three consistent visual troopers/one combat entity; equipment/hand continuity; eight-direction stride and planted contacts; firing-member/muzzle causality; injury/damage/hit/downed; no triple damage manufactured by visuals |
| Repair Node | Four views; eligible living mechanical recipient; authored tool/beam endpoints; first 15-tick pulse and ongoing channel; cancellation/hit/wreck; no visual healing of a dead recipient |
| Barricade | Four views; static collision relationship; damage bands/hit/wreck; selection and depth remain faithful |
| Mine | Four views; armed/trigger/detonation causality; 18-tick trigger telegraph; explosion frame completion; charge/damage/wreck readability as implemented |
| Bulwark | Eight directions; armor/weapon/joints/stride; attack; separate Interpose cast/dash/shield, Challenge and Holdfast cues; release/cancellation/recipient accuracy; hit/downed/terminal pose |
| Runner | Source-faithful limb count/articulation and ground contacts; eight directions; contact-attack anticipation/strike/recovery; hit/destruction; hostile identity independent of hue |
| Raider | Source-faithful body/equipment and weight transfer; eight directions; melee reach/contact timing; hit/destruction; hostile silhouette |

All rows also require: stable native dimensions/pivots, feet/shadows/body depth,
camera remapping, alpha/gutters/seams, clear idle/move/aim/action/hit/terminal
transitions, no floaty damage marks, correct state priority, pause/speed behavior,
zoom/readability, reduced/high-contrast variants and actual battle inspection.
An irrelevant capability is explicitly not applicable; do not fabricate a generic
animation to tick a checklist box. Apply the same discipline to each later asset.

## Test and authoring discipline

Technical checks cover all 1,246 current frame IDs across 401 timelines, all exact
frame boundaries and terminal/loop behavior; principal facings in every camera;
static-view mapping; death priority; support/Warden cues; reduced-effects motion;
and sampling that cannot mutate authoritative state. The pixel audit checks
atlas hashes/dimensions, unique IDs, native bounds/anchors, dense frame ordering,
positive durations and pose/overlay geometry. `npm run audit:art` uses `--strict` and reports failure while
the overlay defects remain; never report the overall quality audit as passed.

Authoring must additionally inspect silhouettes/anatomy/equipment, joint bends,
stride/foot plants, bracing/recoil, tool/contact locations, action timing and
consistent perspective/lighting. Use retained original sources and approved
visual language. Changes to source images use the blueprint's image-editing
workflow; broad independent frame generation must not introduce character drift.
Raster reconstruction must preserve actual authored topology, not mask anatomical
errors with blur or arbitrary scaling. Contact markers explain presentation;
damage remains authoritative and never waits for animation.

Run these checks on the affected assets and actual playable combat after each
correction, including action interruption/death, camera rotation, all speeds,
reduced effects, damaged moving/attacking units and save/restart. Record actual
results and failing conditions. Expand to the roster only when the production
contract is demonstrated; frame counts or one attractive idle image do not
establish natural, detailed motion. Physical tablet evidence remains separate.

## Measured verification for this change

- `npm run verify`: passed strict types, lint, 38 unit tests in nine files,
  deterministic Gate0 scenario and production build. Existing 12 informational
  lint notices and upstream build warnings remain; they are not device measurements.
- `npm run test:browser -- tests/browser/gate2.spec.ts tests/browser/gate2-accessibility.spec.ts`:
  four passed in 1.8 minutes. Actual victories with audio enabled/muted have the
  same result hash; checkpoint restart, result-save abort/retry, writer takeover,
  injected background pause and retained keyboard audio settings pass.
- The first browser attempt passed three of four. Its final reload happened
  before asynchronous discard finished because it checked balance text in a
  hidden account panel. The corrected test waits for visible preparation,
  verifies the practice journal is absent in native IndexedDB, then reloads.
  The application already waits for transaction completion; no storage fix was
  needed. An immediate reload before acknowledgement can retain practice.
- `npm run format:check`, focused Biome check, Python syntax and `git diff --check`:
  passed. Focused Biome checks found import ordering in the new unit fixture and
  modified browser test; these were corrected and the checks passed.
- `npm run audit:art`: **failed, exit 1**. Structural checks pass for 1,246 frames
  and 401 sequences, but 427 of 1,280 pose/band pairs have overlay pixels outside
  the animated body, worst case 11 pixels. This is an open quality gate, not a
  passing overall animation audit.

The prior full 19-browser baseline remains separate evidence; only the four
affected combat regressions were rerun for this change. No physical Lenovo,
Android/TalkBack, subjective natural-motion or listening acceptance is implied.

## Next development and information needed

Refine pose-attached damage marks, then author explicit asset parts and
joint/contact landmarks instead of broad slice assumptions. Align weapon/tool
release, ability phases and terminal transitions with the authoritative action;
inspect every relevant direction/state in live combat and produce a new motion
review before roster expansion. Campaign progression remains in the queue.

No additional gameplay clarification is needed now. Exact tablet model/generation,
Android and browser versions will help reproduce physical measurements later;
their absence does not block this engineering work. The existing
[current-state PDF](Resonance_Bastion_Current_Review.pdf) and ZIP show the earlier
0.2.0 candidates, while this file records the subsequent corrections and gaps.
