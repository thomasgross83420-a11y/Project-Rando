# Public playable preview — 2026-10-08

[Open Resonance Bastion](https://thomasgross83420-a11y.github.io/Project-Rando/)

Open in Chrome. Choose **New Game**, **Create campaign**, review and create it,
then **Siege → Tutorial Practice → Begin Tutorial Practice** for a battle. The
construction and paid C01S01 campaign loop are also available. This is the
tested development slice; the remaining roster, campaign and final animation
work are still open. The staged Engineer kernel is not enabled in this build.

Progress stays in browser storage on this origin. **Records → Data Management → Prepare
Backup → Download Backup** exports complete supported state. Keeping the same
site/browser preserves the save origin; changing device or origin requires
explicit backup/import. Actual Android download durability remains a device
check, even though browser download and import flows pass remotely.

## Current 0.2.12 Rifle articulation update

[Play build 0.2.12](https://thomasgross83420-a11y.github.io/Project-Rando/?build=0.2.12-rifle-joints).
Published source: `151c105195069ae419c36fd8f284fe40abd43275`.
[PR 19](https://github.com/thomasgross83420-a11y/Project-Rando/pull/19) changes
main's workflow source pin and README only, merged as
`681f2c134c43070fdf6ee79c122c39e6ace39a5e`.
[Run 37793975792](https://github.com/thomasgross83420-a11y/Project-Rando/actions/runs/37793975792)
passed build and deployment, completing 14:40:21 UTC. CI repeated all 150 unit
tests in 32 files, type/lint/scenario/build checks on that exact source.

The Rifle Squad now uses authored joints, grounded native gait keys, separate
travel/aim directions, individual actual-release cues, frozen weapon-socket trace
origins, per-pose damage and consistent preparation/ghost/combat artwork. Combat
starts framed around deployed defenders. Simulation, balance and save formats
are unchanged. The full game and remaining per-asset articulation are still open.

All 70 local browser scenarios are verified: initial 69 passes and four explicit
follow-ups, with zero automatic retries. The initial result-error wait stopped
at an intentional 4× performance pause. Its helper now accommodates the visible
Resume policy; both follow-up fights finished at 4× without another pause. The
review fixture was moved outside Core occlusion for a visible animation capture.
Runtime and the frozen 40-file build were unchanged in those follow-ups.

All 40 public files match the tested build over certificate-verified HTTPS, with
appropriate MIME types. All 12 selected live checks passed without retries,
skips or failures: paid victory/XP/rearm, injected result/audio failure and exact
receipt retry, construction/Undo/Redo/reload, backup/import, startup/editing,
native touch and bounded battle tools. Two of these use isolated actual Phaser
fixtures and public artwork; the other ten use the deployed application.

An isolated campaign created on the actual 0.2.11 origin before deployment
survived unchanged. Its old page stayed open; 0.2.12 required confirmed takeover,
then recovered editing automatically on reload and started practice using the
retained campaign. No campaign bytes changed. Public portrait and landscape
battle captures were inspected after assets loaded, with no page/resource errors
or horizontal overflow. Orientation changes retain the existing explicit pause.

See [Rifle development review](RIFLE_ARTICULATION.md),
[local evidence](evidence/RIFLE_PRESENTATION_TESTS.json),
[live/source/save evidence](evidence/RIFLE_PRESENTATION_LIVE.json),
[public portrait](evidence/rifle-public-battle-portrait.png) and
[public landscape](evidence/rifle-public-battle-landscape.png).
The title displays `0.2.12-rifle-joints`. Desktop Chromium native emulated touch
does not measure physical Lenovo performance or certify final natural motion.

## Previous 0.2.11 touch interface update

Published source: `23754abc513320b4d25b5bcaae23ca4a8b6315de`.
[PR 17](https://github.com/thomasgross83420-a11y/Project-Rando/pull/17) updates
main's manual workflow source pin and README only, merge
`d9b616256a836c8a3d8675c4122286b249649fab`.
[Run 37777948348](https://github.com/thomasgross83420-a11y/Project-Rando/actions/runs/37777948348)
passed build and deployment at 12:37:33 UTC. CI passed all 143 unit tests
in 31 files, type/lint/scenario/build checks. All 68 local production-browser
checks passed without retries, skips or failures.

Preparation fills the viewport with all menus collapsed initially. Build,
Forces, Upgrade, Tactics, Siege and Records open bounded, internally scrolling
drawers. Direct drag/pinch controls the camera; after a pinch the remaining
finger pans safely, including during placement. Place/Cancel stay visible.
Battle keeps health, time and Pause visible, with secondary options in Tools.
Title and result screens retain normal scrolling.

All 38 deployed files match the locally tested build exactly over verified
HTTPS with appropriate MIME types. The 24 selected live scenarios are verified with zero automatic retries.
The first invocation passed 22; its paid battle wait timed out after the
intentional performance pause at 4×. A separate follow-up accounts for that
policy using visible Resume and 2× if needed; it completed at 4× without another
pause, verifying the same paid victory, XP/rank, single rearm and retained reload. The landscape matrix exceeded its one-minute
budget during its final field measurement; it passes unchanged assertions in a
separate two-minute-budget check. Both attempts are recorded; published code
is unchanged. These scenarios cover all seven preparation panels,
320–1280 widths, 100%/200% scale, native touch, startup/editing recovery,
purchases, Undo/Redo, paid victory, backup/import and retained reload.

A separate real-public-origin test created a campaign on the actual 0.2.10
site before publication and kept that old page open. On 0.2.11, active-tab
takeover required confirmation, campaign bytes remained unchanged, the next
reload automatically recovered editing, and practice started from the retained
campaign. Live portrait/landscape field and open Build drawers were inspected.
No balance, save format, journal identity or simulation version changed.

See [interface review](TOUCH_FIELD_REVIEW.md),
[local evidence](evidence/TOUCH_FIELD_TESTS.json) and
[live/save evidence](evidence/TOUCH_FIELD_LIVE.json).
The title displays `0.2.11-touch-field`. Desktop native emulated touch does not
certify the Lenovo GPU, Android virtual keyboard, background audio or TalkBack.

## Previous 0.2.10 startup/control update

Published source: `29837e8718f301c07eed9324b78acc323a29e8f0`.
[PR 15](https://github.com/thomasgross83420-a11y/Project-Rando/pull/15) updates
the manual workflow's source pin and README only, merge
`f619a2706fd07aedcc3addced5015e1cd364f358`.
[Run 37755028365](https://github.com/thomasgross83420-a11y/Project-Rando/actions/runs/37755028365)
passed build and deployment, finishing 09:14:00 UTC. CI passed all 143 unit tests,
type/lint/scenario/build checks. All 60 local production browser checks passed
without retries, skips or failures, including 11 new startup/control cases.

All 38 deployed files match the tested build exactly over verified HTTPS.
All 15 selected live-origin checks passed with zero retries, skips or failures.
A separate actual-public-origin upgrade test created a save in 0.2.9 before
deployment, retained the old live page, then opened 0.2.10 in the same isolated
browser storage: takeover required confirmation, saved campaign bytes stayed
unchanged, the next reload automatically regained editing, and practice started
from the retained campaign. Portrait/landscape were inspected on the live update.

See [fixes and locking contract](STARTUP_CONTROL_RECOVERY.md),
[local evidence](evidence/STARTUP_CONTROL_TESTS.json),
[live/upgrade evidence](evidence/STARTUP_CONTROL_LIVE.json) and
[title after reload](evidence/startup-recovery-title.png).
The title displays `0.2.10-startup-recovery`. An older saved owner may need one
confirmed takeover; no browser data needs to be cleared. New combat combinations,
campaign content and final art remain development work. Android performance
remains separate from these desktop browser checks.

## Initial 0.2.9 publication and verification

Source: `bc7d60c4cc3eb229f6fdb3be9dce8eee0c2bebe1` (0.2.9 rendering reuse).
The installed manual-only workflow runs on main but checks out that exact source.
Its installation was [PR 12](https://github.com/thomasgross83420-a11y/Project-Rando/pull/12);
the README play link was [PR 13](https://github.com/thomasgross83420-a11y/Project-Rando/pull/13).
Neither merges the application development stack or triggers automatic publishing.

[Deployment run 37742865384](https://github.com/thomasgross83420-a11y/Project-Rando/actions/runs/37742865384)
completed successfully at 07:23:12 UTC. CI passed type checking, lint, all 134
unit tests across 30 files, the mechanism-only headless tick-grouping fixture,
and the production build. The earlier 49-check local production browser suite
is separate from CI and the six live checks below.

All 38 production files were downloaded with HTTPS certificate verification,
checked for MIME type, and SHA-256 matched against the locally tested build.
The live secure origin exposes the required UUID/BigInt/clone/hasOwn/storage/audio
APIs in desktop Chromium 151.0.7922.173. Portrait 800×1280 and landscape 1280×800
preparation layouts were inspected after textures loaded, with no page errors or
horizontal overflow.

Six selected production browser checks passed on the actual public origin:

- Paid campaign victory, saved XP/rank, one paid rearm and retained progress after refresh.
- Renderer/storage transactions, touch selection, audio unlock and capability export.
- Diagnostic reflow at 320/360/412/800/1280 widths, 200% interface scale, touch cancellation,
  keyboard focus, hash/subpath refresh and production MIME.
- Construction, free deployment, atomic purchase, Undo/Redo, export and retained reload.
- Practice pause, durable checkpoint restart, complete autonomous victory, matching
  second muted replay at another speed and clean return to unchanged campaign funds.
- Complete backup download/import, selected-slot replacement, rollback and retained reload.

The first six-check invocation passed five checks. The remaining MIME request
failed with ENETUNREACH/ECONNREFUSED because its API fixture did not inherit the
browser launch proxy. Moving the session proxy to shared `use.proxy` fixed both
routes, and that check passed when rerun alone. Automatic test retries were zero;
no game code, assertions or published build changed. The evidence records both
attempts instead of hiding the initial verification error.

[Machine-readable evidence](evidence/PUBLIC_PREVIEW_VALIDATION.json) includes
source/run bindings, all asset hashes, browser features and both test attempts.
[Portrait](evidence/public-preview-800x1280.png) and
[landscape](evidence/public-preview-1280x800.png) screenshots show the live preparation view.

## Remaining physical-device pass

These checks use desktop Chromium on the public site, not the user's Lenovo
GPU or Android Chrome. Actual touch/pinch, frame timing, audio/background
lifecycle, backup file durability and TalkBack still need tablet observations.
The identified target remains TB-X606F, Android 10, 4 GB RAM and reported
Chrome 154.0.8037.126. Existing save/replay versions and balance are unchanged
by publication.
