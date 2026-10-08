# Project-Rando
What can I say, it's just a bunch of rando I'm trying out.

## Resonance Bastion

[Open the playable preview](https://thomasgross83420-a11y.github.io/Project-Rando/).
Open in Chrome; create a campaign, then choose **Siege → Tutorial Practice → Begin
Tutorial Practice** for the free battle. Build, Forces, Upgrade, Tactics, Siege and
Records open collapsible menus. Drag the field to pan; pinch to zoom. During
placement, two fingers move the camera and Place/Cancel remain visible.
**Records → Data Management → Prepare Backup → Download Backup** exports supported
state. Saves stay in this browser on this site.

Current development build: **0.2.12-rifle-joints**, on `codex/rifle-articulation`.
The [Rifle Squad review](docs/RIFLE_ARTICULATION.md) describes authored joints,
grounded movement, independent aiming, actual-release weapon cues, consistent
placement/combat artwork, verification and remaining work. The game is still an
early slice: the full roster, campaign/modes, final environment, art/audio and
physical-device acceptance remain open. The staged Engineer kernel is not enabled.

`main` contains the public-preview link and manual deployment workflow.
[Public verification](docs/PUBLIC_PREVIEW.md) identifies the exact published source,
build and save-continuity checks. Development follows the
[unchanged authoritative blueprint](docs/blueprint/Resonance_Bastion_Browser_Blueprint_Final.md).
See [implementation status](docs/STATUS.md), [task queue](docs/TASKS.md),
[test evidence](docs/TEST_EVIDENCE.md) and [hosting evidence](docs/HOSTING.md).

Use Node >=22.12, `npm ci`, `npm run verify`, `npm run test:browser`.
`npm run dev` starts the developer shell; `npm run build` produces static `dist/`.
Assets use `/Project-Rando/` as the production base path. Build output and
dependencies are not committed.

Previous checkpoints and retained evidence:

- [Field-first touch interface](docs/TOUCH_FIELD_REVIEW.md) and
  [startup/control recovery](docs/STARTUP_CONTROL_RECOVERY.md).
- [Tablet target and rendering reuse](docs/review/TABLET_RENDER_REUSE.md),
  [Engineer finite-stock/rearm contract](docs/ENGINEER_STOCK_CONTRACT.md), and
  [tablet/Engineer PDF and ZIP](docs/review/TABLET_ENGINEER_DELIVERY.md).
- [Affordable repair](docs/AFFORDABLE_REPAIR.md),
  [support channels](docs/SUPPORT_CHANNELS.md), and
  [paid combat/result integration](docs/COMBAT_RESULT_INTEGRATION.md).
- [360° movement and recovery](docs/review/OMNIDIRECTIONAL_RECOVERY.md) with
  [mobile downloads](docs/review/MOVEMENT_RECOVERY_DELIVERY.md).
- [Thread recovery](docs/PROJECT_RECOVERY.md),
  [foundation review downloads](docs/review/CURRENT_REVIEW_DELIVERY.md), and
  [animation refinement downloads](docs/review/REFINEMENT_DELIVERY.md).
