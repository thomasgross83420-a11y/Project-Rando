# Player-experience edition · public delivery

2026-10-21

[Play directly](https://thomasgross83420-a11y.github.io/Project-Rando/?build=0.4.0-player-experience) · [Review and download](https://thomasgross83420-a11y.github.io/Project-Rando/review/player-experience.html)

Published source: [`b284d3c2a7858545b18d28eff6e55cbacf0bd086`](https://github.com/thomasgross83420-a11y/Project-Rando/tree/b284d3c2a7858545b18d28eff6e55cbacf0bd086).
Development stays in [draft PR23](https://github.com/thomasgross83420-a11y/Project-Rando/pull/23). [Publishing PR24](https://github.com/thomasgross83420-a11y/Project-Rando/pull/24) changed only main's README and manual workflow source pin, merged as `ff1be13374afd035e769ee010c1882c49d042b92`. The application stack was not merged into main.

[Manual workflow39526598789](https://github.com/thomasgross83420-a11y/Project-Rando/actions/runs/39526598789) completed successfully, including `npm run verify` and Pages deployment. Local and CI validation cover 189 unit/integration checks, typecheck, lint, deterministic scenario and production build. The separate browser record covers 90 distinct cases, including a clean final20/20 current-game run. The final63-case combat rerun matched all prior recorded outputs except machine elapsed timing.

All348 built static files fetched from the actual public origin match the local build byte-for-byte by SHA256. See [published file evidence](evidence/published-files-0.4.json).

A fresh private browser context followed the public review's Play link, created a real starter campaign and cleared the first siege without injected state. Victory committed Rank2,186/255XP,935Credits and1Core. Two exported backups separated by reload/Continue retained identical assets, wallet and claim receipts; finalized sequence remained1. Landscape reflow passed and no page/HTTP errors occurred. See [live game evidence](evidence/public-game-0.4.json).

This record does not certify physical Lenovo performance, long-term natural campaign balance or complete visual polish. The deployed review states those limits and the provisional ratings. This later repository delivery record does not change the pinned application build.
