# Ordinary-run transaction contract — build 0.2.4

Authority: blueprint §§3A,19A,24F,25C–25F,26D–26F,28E. This is a tested
transaction framework and pure progression/recovery groundwork. It is not a
completed normal campaign mode, a paid combat adapter, an injury UI or Gate 3
acceptance. No ordinary launch/payout button is added. Tutorial practice still
pays zero and never writes its cloned body back.

## Capture, journal, apply, reconcile

Preflight captures an isolated validated campaign, complete logical plan and
hash, frozen coefficients/stat data, claim fence and adapter ID. It atomically
allocates a uint64 decimal sequence with the checkpoint; tick zero must wait for
transaction completion. Run identity is lineage plus sequence, never the seed.
Restart returns that exact checkpoint and sequence. Abandon advances the fence
and clears the checkpoint without applying any hypothetical partial result.

A pure versioned `RunRules` adapter must validate the compiled plan/frozen fields,
terminal body and stock, actual aggregates, reward origins and policy, then derive
all resulting campaign/reward/claim fields. The only current adapter lives in
`tests/fixtures` and awards a deliberately synthetic 37 Credits to test storage.
It is not a campaign reward or a balance example and is not loaded by the game.
The browser fixture bundle is built into ignored `.cache`, not `dist`.

Step 1 validates and journals the immutable checksummed pending result while
keeping campaign and checkpoint unchanged. A conflicting second terminal result
is rejected. Failed Step 1 leaves only the durable starting checkpoint; the exact
in-memory pending recovery bundle can be exported. It does not pretend to be a
complete slot backup or enable an unsupported import.

Step 2 validates again outside the transaction, then checks campaign/base, writer
generation, journal, recent receipts, previous snapshot, practice and claim fence
inside the same atomic write boundary. It stores the previous/current campaign,
claims and receipt, advances finalized sequence and removes active state together.
A failure after requests are queued aborts the entire transaction. No unrelated
hash, network or timer await occurs inside the live transaction.

If acknowledgment is lost after commit, read the matching durable receipt and
return committed Results without applying again. Presentation acknowledgment is a
separate fenced write; it cannot repay rewards. Starting another attempt waits
until committed Results are acknowledged. Sixteen recent receipts retain exact
recent summaries; older finalized sequences cannot pay even when their details
have left that cache. A pruned old receipt reports finalized without fabricating
an exact historical summary. A stale retained attempt at/below the watermark can
only be discarded back to Preparation. An explicit orphan-allocation recovery
can skip a missing attempt without inventing a terminal result or partial rewards.

Logical JSON is strictly parsed with the existing size/depth/prototype-key
protection, then validated and hashed. Whole supported slot transaction state is
bounded to 8 MiB. Memory session instances share the same run/receipt maps and
follow the same state validation; none reports a durable Saved guarantee.
Preparation writes and practice preflight check active ordinary runs within their
own write transactions, so concurrent starts cannot create two conflicting modes.

## Progression and prices

`src/data/progression.json` pins 99 rank costs and 100 cumulative asset thresholds.
`scripts/pin-progression.py` derives positive half-up values with Decimal at 70 and
100 digits, verifies agreement and all seven published asset references. Runtime
code reads integers; no fractional power executes during combat. Rank XP crosses
all earned ranks once, retains valid per-rank progress and saturates only optional
nonspendable post-cap XP at 2^128−1 with an explicit at-least flag.

Asset allocation combines exact 70% participation and 30% contribution fractions
before largest-remainder rounding. Catch-up is capped at 3×; eligible Endurance
participation multiplies by operational block count. ID ties are bytewise stable.
Stored/fixed/nonoperational/already-capped assets are excluded before normalization.
Zero contribution uses participation weights for both shares. Newly capped excess
is unused, not redistributed or converted; granted plus unused equals the pool.
These functions require actual eligible contributions from the future combat
adapter; they do not infer them from a kill count or award live player XP.
Health growth preserves wounds and never raises a zero-body asset from zero.
The specified health/output/range/attack-rate factors are exact rationals; the
Sentry L100/E10 discrete example matches 2652 Integrity, 85197/1024 damage,
9421/1024 range and a 38-tick interval. Support/beam cadence stays fixed, and
aura-only enhancement radius must be enabled by the content applicability tag.
The 100-level progression evidence remains hypothetical, not a player upgrade.

Exact fixed-point quotes implement individual/partial body repair, half-body
restoration, wear-adjusted sale and permanent-stock rearm. Warden base 500 applies
to restoration/repair/refund calculations; selling the last owned Warden is
rejected. Paid enhancement and paid Promotion Core investment remain separate.
Emergency refund locks and zero-base emergency origins affect quotes; no subsidy
transaction, inventory creation or emergency viability claim is implemented here.
There is no passive preparation healing, automatic charge refill or payout change.

## Boundary still to implement

Production campaign snapshots currently retain their foundation rank/XP/body
profile. Do not widen it or launch paid encounters until a migration, frozen stat
application, contribution collector, stock/injury model and complete gameplay
adapter validate together. The current slot backup rejects retained unknown run
or receipt metadata rather than omit it. Complete ordinary journal/receipt
backup/import and compatible player recovery screens must be connected before
normal runs are enabled. Namespace rollover, Endurance block entitlements, complete
records and emergency reconstruction remain dependent work.

The blueprint explicitly says accuracy grows with level and gives Sentry 90%
at Level 1 and 95% at Level 100, but §§9/25E/27A define no accuracy-growth equation.
The proposed linear +5 percentage-point rule (cap 100%, unmissable attacks unchanged)
is a question pending user input. It has not been applied to game or growth data.
No automatic level armor increase is inferred from unrelated armor perks.

## Research and verification method

Primary references checked 2026-10-07:

- [MDN IDBTransaction](https://developer.mozilla.org/en-US/docs/Web/API/IDBTransaction):
  active/inactive transaction tasks and request callbacks; completion differs from
  durable physical-media guarantees.
- [IndexedDB standard](https://w3c.github.io/IndexedDB/): atomic commit/abort,
  transaction lifecycle, and durability limitations.

Native browser faults cover preflight, pending journaling, abort after queued
wallet writes, successful commit with lost acknowledgment, reopen/reconcile,
writer takeover, competing starts/results and ordinary/practice mutual exclusion.
These are synthetic transaction fixtures, separate from the existing production
practice browser suite. No desktop run certifies Lenovo performance, native Android
sharing/file picking, TalkBack, future campaign balance or natural articulation.
