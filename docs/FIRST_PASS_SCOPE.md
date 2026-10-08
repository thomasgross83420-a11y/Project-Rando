# Complete first-pass development

The user's current target is the complete playable blueprint, followed by their review and a separate comprehensive test and adjustment pass. A catalog, isolated kernel, or another small public preview does not satisfy that target.

The 0.3.0 first pass supplies the complete playable runtime. The earlier preview remains accessible with `?legacy=1`; its original save database stays separate. Coverage below means implemented first-pass functionality, not completion of the later exhaustive acceptance and polish pass.

Coverage checklist (unchecked means unfinished):

- [x] All 40 ordinary assets and 3 Wardens, with unique roles, individual actions, promotion profiles and signatures.
- [x] All 16 enemy roles, rank variants, faction composition and 8 phased bosses.
- [x] Construction, land expansion, routes, gates, platforms, tactics, bulk operations and 5 presets.
- [x] Deterministic campaign (40 stages), expedition, boss siege, archive, calibration, mastery, Endurance and Long Watch.
- [x] Rank/asset XP, repairs, rearming, enhancement, sequential promotion, branch choice and respec, sale and emergency recovery.
- [x] Three persistent slots, interrupted-run recovery, immutable pending results, idempotent rewards, checksummed export/import and legacy migration.
- [x] Field-first touch UI, accessible collapsible controls, results analysis, settings, audio, help and credits.
- [x] Original complete first-pass art with articulated movement/aim, readable combat warnings and original sound/music.
- [x] Essential integration checks, playable public delivery and candid first-pass limitations. Exhaustive device and balance scrutiny follows the user's review.

Implementation baselines: immutable final blueprint in `docs/blueprint/`; growth, accuracy, reward, collision and finite-stock policies already validated in the historical runtime. New implementation must preserve explicit policies or document evidence for changes. No budget or difficulty calculation reads the player's force strength.
