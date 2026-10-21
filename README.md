# Project Rando · Resonance Bastion

[Play the current game](https://thomasgross83420-a11y.github.io/Project-Rando/?build=0.4.0-player-experience) · [Read the review](https://thomasgross83420-a11y.github.io/Project-Rando/review/player-experience.html) · [Download the review](https://thomasgross83420-a11y.github.io/Project-Rando/review/player-experience.md)

The player-experience edition puts the battlefield and next action first. Create a Bastion, choose **Next siege**, review the short briefing, then **Start siege**. Units fight automatically. Drag empty ground to pan, pinch to zoom, and tap defenders to inspect them. Build previews spend nothing until Place succeeds. Army, Siege, Records and Manage open closable menus.

Current development build: **0.4.0-player-experience**, branch `codex/player-experience-overhaul`.

[Review and test limits](docs/PLAYER_EXPERIENCE_REVIEW.md) · [Blueprint corrections and research](docs/BLUEPRINT_ADDENDUM_0.4.md) · [Full first-pass scope](docs/FIRST_PASS_SCOPE.md)

The original [Final blueprint](docs/blueprint/Resonance_Bastion_Browser_Blueprint_Final.md) remains the historical specification; the linked addendum records current corrections. Earlier gate, Rifle and touch-field notes describe the retained legacy preview, available at `?legacy=1` with its separate saves.

The complete first pass includes 43 friendly types, 16 enemy roles, eight bosses, 40 campaign stages and additional modes. Automated regression coverage is distinct from natural campaign balance and physical Lenovo acceptance. The review states the actual checks and their limits.

Progress stays in this browser on this site. **Manage → Data / backups → Export backup** offers sharing or download. Keep this browser origin when returning to your saves. No account or installation is required.

`main` contains the public link and manual deployment workflow. Application development stays on its development branches; publication pins a tested source commit without merging the application stack into `main`.

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
