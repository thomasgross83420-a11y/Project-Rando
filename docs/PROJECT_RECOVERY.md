# Project recovery — 2026-10-07

Development can resume from repository evidence. The previous conversation is
archived and unavailable to this session; this record does not reconstruct its
messages or invent decisions that were not saved. The user is working entirely
from mobile and should not need a PC, editor, or pasted development commands.

## Where the work is

- Canonical repository: [Project-Rando](https://github.com/thomasgross83420-a11y/Project-Rando).
- `main`: `f4cb0e89296c2855356d54650c62e2f77167cabf`, the initial README only.
- Recovered development branch: [`codex/resonance-foundation`](https://github.com/thomasgross83420-a11y/Project-Rando/tree/codex/resonance-foundation).
- Recovered game checkpoint: [`6d6c8e283fa809a4622b50c358235156ab820cb3`](https://github.com/thomasgross83420-a11y/Project-Rando/commit/6d6c8e283fa809a4622b50c358235156ab820cb3),
  “Build verified autonomous tutorial with durable practice checkpoints and original combat presentation,”
  dated 2026-10-07 00:29:21 UTC.
- Recovery work branch: `codex/project-recovery`, based on that checkpoint.
  The recovery change adds documentation; gameplay and the blueprint remain unchanged.
- The connected GitHub searches returned no pull requests or issues for this
  repository during inspection. All fetched branches and their commit history
  were inspected; there is no later fetched game checkpoint.

The saved project consistently calls the game **Resonance Bastion**. The new
conversation's “residents bastion” is treated as a reference to this project,
subject to any correction from the user.

## Evidence that survived

| Evidence | Location / purpose |
| --- | --- |
| Full authoritative blueprint | [Resonance_Bastion_Browser_Blueprint_Final.md](blueprint/Resonance_Bastion_Browser_Blueprint_Final.md) |
| Implementation and remaining scope | [STATUS.md](STATUS.md), [TASKS.md](TASKS.md), [IMPLEMENTATION_MAP.json](IMPLEMENTATION_MAP.json) |
| Last development handoff | [MILESTONE_REPORT.md](MILESTONE_REPORT.md) |
| Prior executed checks | [TEST_EVIDENCE.md](TEST_EVIDENCE.md), [Gate 2 evidence](evidence/GATE2.json) |
| Preserved decisions and approvals | [DECISIONS.md](DECISIONS.md), [DESIGN_DECISIONS.md](DESIGN_DECISIONS.md), [conditional foundation approval](review/USER_VISUAL_APPROVAL.md) |
| Original visual references and editable generators | `assets/source/`, including camera, foundation, lighting and combat reference PNGs and Python generators |
| Original audio definitions and synthesis | `assets/source/combat/score.json`, `generate_audio.py`, [AUDIO_DEFINITIONS.md](AUDIO_DEFINITIONS.md) |
| Bundled game assets and provenance | `public/assets/`, [ASSETS.md](ASSETS.md), [COMBAT_PIPELINE.md](COMBAT_PIPELINE.md) |
| Hosting observations | [HOSTING.md](HOSTING.md); historical observations, not a current deployment check |

Blueprint SHA-256 was checked again and matches the saved Gate 2 evidence:
`9808229593b79b856f8f522dcffba591debe6334a3f60a61d1915cdd5e2900a6`.

No separate uploaded files were present in this session's `library-files`,
`shared/downloads`, or initial scratch directories. The recovered tracked tree
contains no ZIP, PDF or DOCX uploads. The blueprint and reference images above
are available because they were committed; this is not evidence that every
attachment from the archived conversation has been recovered. New attachments
can supplement the record without replacing the authoritative blueprint or
retroactively asserting approval.

## Recovered state

| Area | Evidence-backed state |
| --- | --- |
| Gate 0 | Existing browser/storage/renderer/input and deterministic foundations |
| Gate 1 | Three campaign slots, atomic construction, owned assets and capacities, placement/routes, camera, history and durable accessibility preferences; prior closeout recorded at `f3ee415` and `f2000cc` |
| Gate 2 | Autonomous Bulwark/Bastion tutorial practice with Sentry, Rifle, Repair Node, Barricade, Mine, Runner and Raider; 24 enemies / 30 TP, pause/speeds, inspection, audio, checkpoint restart and zero-reward results stub |
| Gate 3 | Ordinary campaign receipts/rewards, persistent damage/recovery, XP/progression and complete backup/import are still required |
| Gates 4–8 | Other Warden/doctrine combinations, full roster, bosses/modes, complete presentation/accessibility and release remain their dependent stages |

Tutorial Practice clones the owned army and leaves the real campaign's wallet
and fortress unchanged. Its export is a practice checkpoint, not a complete
campaign backup. Existing campaign schemas still constrain asset XP to zero,
levels/rank to one and Promotion Cores to zero; campaign progression has not
already been implemented under another name.

The saved Gate 1 approval covers the specified visual foundation only. New
combat animations/effects/audio remain Awaiting User Review. This recovery does
not broaden that approval. Physical Android performance, TalkBack and actual
speaker/headphone output remain Needs Device Check.

## Fresh verification

Tested checkpoint: `6d6c8e283fa809a4622b50c358235156ab820cb3`.
Environment: Node 24.19.0, npm 11.9.0, Chromium 151.0.7922.173,
Pillow 12.3.0. Dependencies were installed from the unchanged lockfile with
`npm ci`.

- `npm run verify`: passed strict types, lint, 29 tests in 8 files, the
  3600-tick Gate 0 deterministic scenario, and production build.
- `npm run format:check`: passed.
- Foundation, lighting, role and combat Python validators: passed; 1,246
  combat frame keys, 800 unique rectangles, 4,987,904 loaded texture pixels,
  and 18 original audio files validated.
- `npm run test:browser`: all 19 production-subpath tests passed in 4.1 minutes,
  including tutorial checkpoint restart, enabled/muted result equivalence,
  failed-result retry and competing-tab protection.
- `npx vite build --ssr scripts/tutorial-headless.ts --outDir .cache/headless`
  followed by `node scripts/tutorial-headless.mjs`: all five execution groupings
  won at tick 6,150, with 24 kills / 30 TP and the same canonical hash as the
  prior Gate 2 evidence:
  `8961c7817d3d73989a00c3e377387e6dde1ebeee16d219d5c397afc2be7839c7`.
- `node scripts/capture-gate2.mjs`, `node scripts/check-audio.mjs`,
  `python3 scripts/package-gate2-review.py` and
  `node scripts/check-gate2-review.mjs`: recreated ten live development-runtime
  views, original animation sheets/GIFs and a review ZIP. All 18 audio files
  decoded/unlocked; the local HTTP gallery loaded 16 images and 18 audio controls
  with working keyboard input, no horizontal overflow and no application errors.
  Four driver ReadPixels performance warnings occurred during capture.

The recreated review files are in `/workspace/shared/Resonance_Bastion_Gate2/`
and `/workspace/shared/Resonance_Bastion_Gate2.zip` for this session; the tracked
generators and original assets can recreate them in another workspace. They
are review artifacts, not a public playable deployment or a recovered original
attachment. The development server also served the imported manifests correctly;
its public-asset import messages were server warnings, not failed loads. No code
change was needed.

Existing nonfatal notices remain: 12 lint style information notices, two upstream
Zod annotation warnings and the large Phaser build chunk warning. These checks
are desktop evidence, not physical Android certification.

## Continue from here

1. Preserve this recovered game checkpoint and its approval boundaries. Obtain
   any feedback on current combat candidates before propagating them across the
   roster; retained reports do not substitute for new user review.
2. Begin Gate 3 with the ordinary-campaign run identity, bounded receipt/fence
   storage and atomic result transaction. Keep nonrewarding Tutorial Practice
   separate. Verify failure/retry and competing-writer behavior before exposing
   reward-bearing play.
3. Add persistent damage, repairs/restoration, exact rewards and XP/progression
   through the same transaction. Follow blueprint §§19/19A, 21 Gate 3, 25C–H,
   26D/E and 28E; preserve explicit save-version migration and old validated data.
4. Complete bounded campaign backup/export/import and rollback-safe Restore
   Previous. Prove repeated result/import/recovery cannot duplicate currency,
   XP or first-clear claims; test an indispensable backup roundtrip within 32 MiB.
5. Provide mobile-accessible review/play delivery when hosting is requested.
   A local preview is not a public playable URL. No public deployment or offline
   readiness is established by this recovery.

This is a continuity checkpoint, not completion of Gate 3. Future sessions should
read this record, the current status/task queue and the blueprint before making
changes; append actual implementation and test evidence as each slice passes.
