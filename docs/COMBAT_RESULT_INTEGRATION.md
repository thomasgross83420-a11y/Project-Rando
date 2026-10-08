# Combat contribution and campaign integration

Development continuation, 2026-10-08. This increment follows the progression
balance audit; the blueprint's full roster and campaign remain the objective.

## Applied contribution

The optional combat ledger observes applied outcomes. It never changes attack
accuracy, damage, motion, targeting, cooldowns or random draw order. The legacy
simulation snapshots remain unchanged when accounting is disabled.

- Damage credit uses actual hostile body loss and shield absorption; overkill
  cannot earn credit. Released projectiles retain credit after source death.
- Repair credit is shared across providers and capped per recipient by initial
  missing body plus actual hostile body damage. Zero-body recipients cannot heal.
- Shield prevention is an ordered marginal counterfactual, after armor and
  remaining-body caps. Holdfast receives only its remaining reduction. Their
  combined credit cannot exceed the unprotected attack's possible body loss.
- Stock use is separate from body damage. Temporary charges are spent first and
  cannot become paid permanent stock. The current mine retains its body when its
  permanent charge is spent.
- Control and first-hidden-reveal kernels have exact fractional credit and caps;
  those abilities are not implemented by the current combat roster and therefore
  are rejected in this encounter's terminal adapter.

One body-point equivalent is 6,144,000 score units. This common denominator keeps
60-tick percentage slow credit exact without floating point or per-tick rounding.
The friendly participation loop does not scan retained defeated enemies.

## Saved progression and purchases

Schema 1 remains valid. An explicit pure migration to schema 2 preserves every
owned UUID, wallet, body value and deployment, increases revision once, and adds
zero investment plus initial permanent stock. Legacy practice never consumed
campaign stock. Repository guards prevent migration during a retained battle.

Schema 2 validates XP-derived levels, rank progress, bounded lifetime XP, actual
sequential enhancement investment and type-specific stock. It currently permits
earned growth for the four implemented developing combat identities. Fixed
objects have no XP; unfinished roster identities cannot receive fake development.
Promotion stays at 1 star until the actual role perks and branches are supported.

Pure preparation previews use the existing exact repair, restore, rearm,
enhancement and sale prices. Growth adds only the gained maximum body to a living
asset. Wrecks remain zero through level or enhancement changes. Restore explicitly
purchases half maximum body; repair does not substitute for Restore. These APIs
are backend work; the existing preparation interface has not enabled them yet.

## First ordinary encounter

C01S01 retains the 24-enemy, 30-TP, 90-second authored schedule. A separate
`rb-sim-v3` campaign capture freezes the actual deployed UUIDs, level/enhancement,
body and stock before battle. It cannot be supplied as an old practice or Study.
Only implemented Bulwark/Bastion combat is admitted in this increment.

Terminal results capture the bounded ledger, final body/stock, perceived enemy
IDs and destroyed quarter-TP by authored 20-second origin segment. Cosmetic
events, delayed kill times and frame grouping do not determine payment. The
adapter validates identities, score sums, participation, injury/restoration
conservation, origin totals and final captures before deriving saved progression.

A first full victory earns 255 Bastion XP (155 ordinary, 50 first-clear, two
25-XP discoveries), 200 asset XP and 1 Core. It reaches Rank 2 with 155 progress.
Repeat victories cannot reclaim first-clear or seen-role discovery. Ordinary
repeat scaling still follows the existing band/rank formula. Finalized defeats
retain actual damage and eligible partial rewards; abandoning an unfinalized
attempt returns to its checkpoint without rewards or discovery claims.

The existing two-phase result journal derives, seals, journals and atomically
commits campaign, previous snapshot, receipt and monotonic claim fence. This
increment does not yet enable paid encounters in the player interface: whole-slot
backup/recovery and UI integration must preserve the new journals first.

## Validation and boundaries

Targeted tests exercise applied repair, armor-adjusted prevention, deterministic
tracked/untracked equivalence, migration guards, investment/stock validation,
wreck upgrades, exact recovery prices, real victory/repeat/abandonment and
rechecksummed derived-field tampering. Full verification is recorded separately
after completion. No Lenovo hardware, Android browser or TalkBack certification
follows from these desktop tests.

Initial backend verification passed type checking, lint, all 113 unit tests,
the existing deterministic scenario and production build. The extra non-null
assertion warning was subsequently removed; the existing 14 lint informational
diagnostics and Phaser bundle-size warning remain. Browser recovery checks are
still required for the expanded backup path.

Cross-reference: [MDN IDBTransaction](https://developer.mozilla.org/en-US/docs/Web/API/IDBTransaction),
checked 2026-10-08, explains that transactions alternate active/inactive between
event-loop tasks and auto-commit when no outstanding requests remain. Hashing,
schema validation and rebasing must therefore complete before opening the final
write transaction; writer/base/state comparisons remain inside its request
callbacks. Transaction completion is not a guarantee against sudden power loss.

Every sequence reader now uses the same actual unsigned 64-bit maximum
18,446,744,073,709,551,615. A 20-digit regex alone did not enforce that limit.
Namespace rollover remains a separate future implementation, not an invented
larger counter.
