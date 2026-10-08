# Resonance Bastion — complete first-pass review

Build: **0.3.0-first-pass**. This is the complete playable first pass assembled from the repository and authoritative final blueprint. It replaces the small rifle/tutorial preview as the default game. The separate comprehensive testing, balance adjustment and presentation polish pass follows your review.

**Play directly:** https://thomasgross83420-a11y.github.io/Project-Rando/?build=0.3.0-first-pass

## What is implemented

- Forty ordinary friendly asset types, three Wardens, their individual actions, progression profiles, specializations and once-per-siege signatures.
- Sixteen enemy roles, four rank variants, four faction identities, eight bosses with two phase transitions and finite descendants.
- Forty campaign stages; Expedition, Boss Siege, Calibration, Siege Archive, twelve Mastery trials, one-to-six-block Endurance and continuing Long Watch series.
- Owned-force construction, land expansion, gates, barriers, mounting platforms, automatic tactics, storage, grouped movement, batch placement and five layout presets.
- Rank and asset XP, finite stock, repair, rearming, enhancement, sequential promotion, branch choice/respec, refund previews and emergency recovery.
- Three save slots, previous-snapshot recovery, captured encounter plans, interrupted-siege restart, Endurance block checkpoints, pending-result recovery, single reward commits and checksummed backup import/export. Earlier preview saves are copied explicitly; their original database remains available.
- Field-first touch interface with internal-scroll drawers, drag pan, pinch zoom, camera rotation, tactical map, role inspectors, forecasts, performance reports, charts, practice comparisons, accessibility settings, cosmetics, ending and Master gallery.
- Original native pixel assets, separate body/weapon direction, articulated movement and action poses, ground/air height, attack warnings, original score, stingers and synthesized sound effects.

## Starting and reviewing

Choose **New game**, choose a doctrine/Warden, and confirm the starting inventory. The guided layout uses only your free assets and retains the 600-Credit reserve. Choose **Siege → Review forecast → Start siege**. Combat is autonomous; you manage preparation and tactics between sieges.

Drag empty field space to pan, pinch to zoom, and touch an asset to inspect it. Menus collapse with their close button. **Map** lets you pan to a broad region or jump to a named front. Pause and speed remain accessible during combat. Settings and map inspection pause combat; resume explicitly afterward.

The complete roster and later modes unlock through progression. Calibration uses your owned army without rewards or persistent losses. It does not grant unearned assets. Ending, Mastery and cosmetic content have their declared unlock requirements.

## Development checks and their limits

Release checks passed: 165 unit tests, a deterministic scenario check, seven current-runtime browser checks at phone and tablet viewport sizes, compilation, formatting and content audits. These cover campaign plan legality, starter viability, bounded combat, mode integration, recovery and browser navigation. Automated smoke checks exercise every enemy variant and all eight bosses' two phase transitions. Asset audits cover all 30,848 semantic frames, 1,461 packed native images, 14 atlases, ten audio tracks and 260 authored campaign/mastery plans.

The largest simultaneous sprite-bank combination is approximately **4 MiB decoded**; this excludes terrain, display buffers and browser overhead. Compressed music and stingers total **7,289,247 bytes**. These are packaging measurements, not measurements of your Lenovo tablet's frame rate, memory use or input latency.

The first-pass art, animation, music and tuning are reviewable production work. They have not yet passed the comprehensive quality and balance scrutiny requested for the next pass. Long-run campaign pacing, maxed progression, every individual ability interaction, sustained tablet performance and subjective animation quality still need that scrutiny. No physical Lenovo test is claimed.

## Save and access details

The live link opens the game directly in Chrome. First load and uncached resources require internet; offline readiness is not advertised. Progress lives in the browser on this device. **Manage → Data / backups → Export** offers a backup through Android sharing or download. Moving devices/browsers requires importing that backup.

The earlier preview is accessible from Data management for resolving old interrupted runs before migration. Up to 100 recent detailed results are retained; older details can be pruned sooner to keep backups bounded. Progress, claim fences, lifetime XP and lifetime combat aggregates are retained. Practice comparisons can be deleted individually. Saved plans are capped at 32; favorite plans receive retention priority.

## Input needed

No design decision is currently waiting on you. After viewing this first pass, describe anything that feels wrong, missing, confusing or visually unfinished. The next pass will combine that feedback with systematic mechanic, balance, animation, interface and tablet-performance checks.
