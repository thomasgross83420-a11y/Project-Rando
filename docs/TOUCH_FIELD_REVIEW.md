# Field-first touch interface — 0.2.11-touch-field

The preparation page previously placed the field above a long document of camera,
construction, inventory, progression and siege controls. Portrait play required
scrolling away from the map. The landscape sidebars consumed much of its width.

Preparation now occupies the available dynamic viewport. The field fills the
space between a compact resource bar and six labeled, horizontally scrollable
48-pixel-minimum menu buttons: Build, Forces, Upgrade, Tactics, Siege and Records.
Every menu starts closed. Touching the current menu again, Close menu, or Escape
closes it. Menus scroll internally. Escape closes the menu without cancelling an active
placement; Cancel Placement ends that placement. Portrait drawers use the lower 45% of the
field; landscape drawers occupy the right side, keeping the larger field visible.
Picking an owned asset or a purchase closes the drawer and exposes explicit
Place/Cancel actions. Coordinates, nudges, footprint rotation, storage and named
camera jump are inside Precise placement and options. Purchases still require a
legal, explicitly confirmed Place, and preserve the same persistence guards.
Rebuilding placement UI removes the old history control IDs before binding the
new Undo/Redo/Export controls, preventing inert buttons after a transaction.
Global save/preference feedback stays visible during battle; the full status is
also retained inside Tools.

Camera interaction is direct: drag to pan, pinch around the gesture midpoint to
zoom, tap to inspect. Build mode uses one finger for the ghost; two fingers control
the camera. Lifting one finger after a pinch now continues panning. That remaining
finger cannot move the ghost or select/purchase accidentally. A fresh one-finger
gesture is required to move the ghost again. Optional camera buttons and entrance
navigation remain in Tools → Camera alternatives. Touch-action suppression stays
on the canvas; DOM menus and browser zoom retain their normal behavior.
Secondary text has a 16-pixel minimum. Supporting Android
browsers resize the content viewport for the virtual keyboard via the viewport
meta setting; the desktop checks also exercise a reduced editing viewport.

Battle uses the same field-first arrangement. Core/Warden health, time/state and
Pause remain visible. Tools opens a collapsible menu containing Map and
Inspection; direct field taps also open entity inspection. Speed, audio, camera
alternatives, checkpoint details and observed event
history are folded away by default. Direct entity inspection opens a bounded
sheet. The existing 200% inspection/manual-pause policy, modal pauses, orientation,
background, renderer and writer-loss pauses remain explicit Resume conditions.
Critical warnings remain over the field. Forecast army lists start collapsed.
Results and recovery views scroll within their own screen, and title navigation
restores ordinary page scrolling, including after backup import.

This is an interface increment for the existing playable slice. Configurable
Tactics and the rest of the blueprint's combat roster remain in development;
the menu says so. No balance, campaign format, journal identity or simulation
version changes are included.

## Requirements and references

Cross-checked against the immutable final blueprint's preparation UI, gesture,
selection-sheet, minimap, pause and compact-HUD requirements (lines 392–461), and
its acceptance scenarios (line 1201). The old three-column layout browser test
now checks the intended larger field and collapsible drawers rather than requiring
the superseded always-visible sidebars.

- [MDN Pointer Events](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events):
  pointer capture, independent contacts and cancellation handling.
- [MDN touch-action](https://developer.mozilla.org/en-US/docs/Web/CSS/touch-action):
  canvas-only gesture handling, normal DOM scrolling and zoom elsewhere.
- [MDN viewport lengths](https://developer.mozilla.org/en-US/docs/Web/CSS/length#relative_length_units_based_on_viewport):
  dynamic viewport sizing with a `100vh` fallback and safe-area padding.
- [MDN viewport meta](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/meta/name/viewport):
  `interactive-widget=resizes-content` requests layout reflow when a supported
  browser opens the virtual keyboard; actual Android IME behavior remains a device check.
- [MDN details](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/details):
  native accessible disclosure for secondary options.

All 68 production-browser checks pass without retries, skips or failures,
including native touch gestures, all collapsible panels at 100%/200%, placement,
Undo/Redo, purchases, complete battles, backups and recovery. All 143 unit tests
in 31 files, deterministic scenario, type/lint and production build checks pass.
See [local evidence](evidence/TOUCH_FIELD_TESTS.json),
[portrait](evidence/touch-field-portrait.png),
[landscape](evidence/touch-field-landscape.png) and
[small-screen battle at 200%](evidence/touch-field-battle-200.png).
Publication and actual public-origin checks are recorded in
[public preview verification](PUBLIC_PREVIEW.md). Desktop Chromium with native emulated touch is
not a measurement of the Lenovo tablet's GPU performance or Android browser chrome.

## Public update

[Play the updated game](https://thomasgross83420-a11y.github.io/Project-Rando/?build=0.2.11-touch-field).
The existing origin and save formats are retained. The title build label is
`0.2.11-touch-field`. Open Siege → Tutorial Practice for the free battle.
Records contains Data Management and backups.

All 38 public files match the tested build; 24 public scenarios are verified.
The initial live invocation passed 22 and the two follow-ups pass: the landscape
matrix with a larger time budget and paid victory at 4× after the first wait hit
a performance pause. Initial results are retained in
[live evidence](evidence/TOUCH_FIELD_LIVE.json). A real public 0.2.10 save survived
publication unchanged and started practice.
[Public portrait](evidence/touch-public-portrait.png),
[landscape](evidence/touch-public-landscape.png), and open Build menus in
[portrait](evidence/touch-public-build-portrait.png) and
[landscape](evidence/touch-public-build-landscape.png) were visually inspected.
