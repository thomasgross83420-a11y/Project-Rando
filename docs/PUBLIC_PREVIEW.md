# Public playable preview — 2026-10-08

[Open Resonance Bastion](https://thomasgross83420-a11y.github.io/Project-Rando/)

Open in Chrome. Choose **New Game**, **Create campaign**, review and create it,
then **Tutorial Practice → Begin Tutorial Practice** for a battle. The
construction and paid C01S01 campaign loop are also available. This is the
tested development slice; the remaining roster, campaign and final animation
work are still open. The staged Engineer kernel is not enabled in this build.

Progress stays in browser storage on this origin. **Data Management → Prepare
Backup → Download Backup** exports complete supported state. Keeping the same
site/browser preserves the save origin; changing device or origin requires
explicit backup/import. Actual Android download durability remains a device
check, even though browser download and import flows pass remotely.

## Published source and verification

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
