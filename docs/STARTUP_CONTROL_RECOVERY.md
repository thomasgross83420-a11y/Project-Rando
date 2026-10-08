# Startup and control recovery — 0.2.10

The reported gray New Game button was reproduced against the earlier production
build: create a campaign, reload the page, and New Game remains disabled. The
old repository rejected every different tab ID, including a reload of its own
closed page. Existing browser checks often explicitly took over after reload,
so they exercised a workaround rather than checking ordinary reopening.

## Corrected behavior

- A new document uses a browser Web Lock to distinguish a live editing page from
  a closed one. It can reclaim a lock-managed closed-page record atomically,
  incrementing the persisted writer generation. An active tab remains read-only
  until confirmed takeover. Legacy records and browsers without Web Locks still
  use explicit confirmation, with a usable New Game path.
- New Game opens a slot chooser, editing recovery, or explicit storage recovery.
  It no longer leaves the player at a permanently disabled start control.
- Editing access appears above the current view. Losing ownership refreshes
  construction controls and pauses a battle. A displaced live world cannot
  reclaim another writer's state just because that other page later closes;
  takeover reopens durable recovery. Resume checks the stored generation first.
- Failed writer acquisition, lock rejection, storage probes and bounded open
  timeouts retain menus and recovery paths. A late database open after an error
  closes its connection. No recovery deletes browser data.
- Creation tracks whether its campaign commit succeeded. If opening subsequently
  fails, Load Campaign opens that saved campaign; creation is not offered again
  against its old empty-slot expectation. Asynchronous writer/open request
  handlers abort safely instead of leaking uncaught browser exceptions.
- Modal errors appear inside the dialog. Settings exposes the current mute
  state. Doctrine/Warden labels are associated explicitly with their controls.
  New campaigns default to the implemented Bulwark/Bastion combination; other
  designed combinations are visibly unavailable until their combat is implemented.
- The title identifies `0.2.10-startup-recovery`, so a stale page can be recognized.

The writer record has an optional `sessionLock: true` marker. It is not a
campaign schema change. A held browser lock only establishes liveness; existing
generation, revision, run and receipt checks remain authoritative in IndexedDB
transactions. Only the first check in a fresh document can automatically reclaim
a different lock-managed closed owner. An already displaced page requires
confirmation, protecting its potentially stale simulation and layout.

## References and regression scope

The unchanged blueprint §19A requires browser locking where available, explicit
active-owner takeover, transaction generation fences and checks before Resume.
[MDN LockManager.request](https://developer.mozilla.org/en-US/docs/Web/API/LockManager/request)
and the [Web Locks specification](https://www.w3.org/TR/web-locks/) were checked
2026-10-08. In particular, `steal` does not stop old callback code; persisted
transaction fences and pausing the displaced view therefore remain necessary.

Eleven new production browser regressions cover reopen/reload, active takeover,
legacy ownership, acquisition abort, failed probe, no-Web-Locks fallback,
title/wizard controls, saved-but-not-opened creation, rejected lock requests,
writer quota exceptions and displaced battle recovery. The original reload
regression failed before the fix. Existing reload checks now assert ordinary
editing recovery instead of assuming takeover is always necessary. Active-tab
takeover and stale result transaction rejection remain tested separately.

No combat coefficients, progression prices, authoritative replay version,
campaign schema or artwork is changed by these fixes. All other blueprint
development remains open; this increment fixes startup and nearby interactions.
Physical Android observations remain distinct from browser automation.

## Completed validation and delivery

Source `29837e8718f301c07eed9324b78acc323a29e8f0` passed 143 unit tests,
type/lint/scenario/build checks, changed-file formatting and all 60 production
browser checks with zero retries/skips/failures. [Local evidence](evidence/STARTUP_CONTROL_TESTS.json)
records each check. The [same public game](https://thomasgross83420-a11y.github.io/Project-Rando/)
was updated by [PR 15](https://github.com/thomasgross83420-a11y/Project-Rando/pull/15)
and successful [run 37755028365](https://github.com/thomasgross83420-a11y/Project-Rando/actions/runs/37755028365).

All 38 public files match the tested build. Fifteen selected live checks passed;
an isolated actual 0.2.9 public save survived legacy takeover, ordinary 0.2.10
reload and practice start without campaign changes. [Live evidence](evidence/STARTUP_CONTROL_LIVE.json)
binds this upgrade and the current title/layout checks to the deployment.
