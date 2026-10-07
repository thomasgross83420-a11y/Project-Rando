# Resonance Bastion — animation and interaction refinement

2026-10-07 · build 0.2.2-animation-refinement · simulation rb-sim-v2.
This is the current development checkpoint. The earlier full review remains the
0.2.0 snapshot. The blueprint and full intended game scope are preserved.

## What changed

Damage marks now follow the current body pose, including stride/action offsets,
and remain within its alpha silhouette. A shared precomputed atlas avoids
per-unit, per-frame compositing. All 1,792 actual body/band pairs passed pixel,
anchor, gutter and packed-image checks. Original source images were not edited;
the raw idle-overlay audit still reports its historical 427 mismatches.

Walking cadence follows actual distance travelled, slowing or freezing when
motion is slowed or blocked. Dash does not advance walking phase. Ability
cast-to-release frames continue instead of restarting; dash poses clamp and
Repair Node channel animation no longer resets at every healing pulse. These
fixes improve continuity; they do not certify anatomically correct foot plants.

Ranged units previously could stop within weapon range behind an obstruction,
clip a cover corner with a finite-size projectile, or repeatedly cancel warmup
because an expired stuck watchdog never re-armed. New v2 firing routes require
clearance for the blueprint's 0.05 GU kinetic radius, finish alignment inside the
chosen firing cell and re-arm the watchdog. Independent blocked-Core and corner
fixtures verify engagement. Perception still uses its own sight rules.

The guided practice Mine moved from (22,30) to (18,24), based on measured enemy
trajectories and a controlled placement comparison. It now triggers and causes
actual damage in the canonical tutorial; the 18-tick warning remains intact.
This changes only new disposable guided clones, not the player's fortress or a
stored checkpoint. No weapon damage, armor, HP, speed, price or economy values
were tuned.

## Compatibility and verification

New practice uses rb-sim-v2. Retained v1 checkpoints keep their stored plan and
army, and replay the original exact 6,150-tick result/hash. Saved results and
campaign versions are not silently rewritten. Practice still awards no real
currency/XP and causes no persistent campaign injury.

Strict types, lint, production build and 46 unit tests passed. The full 19-test
production-browser suite passed after the renderer/AI changes. The tutorial
browser cases were rerun after the guided Mine placement. Checks include native
checkpoint deletion/reload, saved retry paths, context loss, pause/speed,
reflow/input and equal enabled/muted combat outcomes. The canonical simulation
matches across tick groupings 1/2/4/8/12 with 24 kills and 30 TP.

Current canonical result: Victory, 6,879 ticks (114.65 combat seconds), Core
10,000; snapshot SHA-256:
1fc32c1de93483123a91b0b018aa0f90a36e508c406acc27b14f2990016ba8b6.

Legacy v1 SHA-256:
8961c7817d3d73989a00c3e377387e6dde1ebeee16d219d5c397afc2be7839c7.
These hashes describe the fixed UUID fixture, not every player's owned-asset IDs.

The overlay atlas is 2,048×274 with 414 unique rectangles. All loaded texture
pixels total 5,549,056 within the existing 6,000,000 budget. The recorded atlas
build took about 0.79 seconds on this desktop environment; it is not an Android
load-time or frame-rate measurement.

## Measured tutorial comparisons

Twelve deterministic cases were measured with a fixed schedule and authored
UUIDs: baseline, former Mine position, role omissions, half-health conditions,
Bulwark alone and an unarmed diagnostic. Eleven reach Victory; the unarmed
fixture reaches the intended Inevitable Defeat rule while its Core is still alive.
These are mechanism/sensitivity comparisons, not whole-game balance approval.

The healthy baseline needs no repair. Removing Sentries exercises 593.76 actual
healing; half-health Sentries exercise 600. The new Mine causes 100 actual body
loss in baseline; its former position causes zero. Actual loss is capped by the
recipient's remaining HP, rather than reporting theoretical blast damage.

Moving the Mine does not guarantee a shorter battle: the former placement
finishes in 109.52 seconds versus 114.65 now. Different kills and obstructions
change later targeting/action/random-consumption order. Role removal can also
renumber runtime IDs and alter tie-breaks. Do not infer an isolated DPS ranking
or nerf a support unit from these single-layout outcomes. Before-v1 versus v2
also changes the version-seeded accuracy stream; independent geometry tests,
rather than those aggregate totals alone, establish the route fixes.

Machine evidence: docs/evidence/POSE_DAMAGE_RUNTIME.json,
TUTORIAL_BALANCE.json and TUTORIAL_BALANCE_BEFORE.json. Research and primary
references: docs/RESEARCH_ANIMATION.md.

## What still needs work

The existing broad source-rig slices remain candidate art. Explicit per-asset
joints, eight-direction ground contacts, weapon/tool sockets, moving-and-firing
blends, accurate falls and consistent equipment still need authored refinement.
Silhouette clipping can prevent detached damage pixels; it cannot prove that
underlying limbs, gear or downed poses are correct. The per-asset acceptance
matrix in ANIMATION_AUDIT.md remains applicable.

The new four-key Rifle study is a source guide only, generated from the retained
Rifle reference. It has a magenta backdrop and is not loaded into the game. The
first repeated-pose attempt was rejected. The new guide still needs consistent
native alignment, eight distinct phases/directions and contact/equipment checks
before it can become a runtime animation. No mass roster production or final
visual acceptance is claimed.

The video records actual production UI at 1×, 800×1280, for roughly 45 seconds
of combat, including the Mine interaction. It contains no captured system audio
and is not a full-battle proof. Desktop Chromium cannot establish Lenovo tablet
frame pacing, heat/memory behavior, TalkBack or touch responsiveness.

## Next development and useful input

Continue per-asset articulation/contact authoring and focused live scrutiny,
then the Gate3 persistent campaign loop: atomic results/rewards/injuries,
repair/restoration/progression and backup recovery. Preserve practice isolation
and all later blueprint content. No new gameplay decision is blocking engineering.

Useful user feedback is visual: whether the live motion and Rifle keypose design
match the intended look, and any visible sliding, gear drift or unreadable effect
on the tablet. Exact Android/browser version and RAM help reproduce later device
measurements. A static PDF/video review alone cannot certify physical performance.
