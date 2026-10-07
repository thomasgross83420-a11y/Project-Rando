# Non-negotiable invariants

See blueprint §§1–6, 19–20, 24–29 and T01–T20.

- Simulation owns mechanics; renderer, gestures, audio, animation and wall-clock absence cannot alter results.
- Combat is autonomous. Preparation-only tactical mutations are rejected after preflight.
- No music-derived mechanics, uploaded music, extra currencies, online services, accounts or monetization.
- Stable IDs and pinned versions join data/saves/assets/tests; missing definitions fail validation.
- Finite entity, projectile, ownership, plan and history bounds remain enforced.
- Durable transactions complete before Saved/success. Results and claims are idempotent.
- No silent repair, resurrection, reward inflation, hidden scaling or inventory manufacture.
- Touch, keyboard, semantic lists and non-drag alternatives preserve essential access.
- Every source category remains in the implementation map; early milestones preserve full scope.

- Moving assets traverse at arbitrary angles through the full 360°; sprite-facing sampling and camera projection cannot quantize travel into eight allowed directions.
