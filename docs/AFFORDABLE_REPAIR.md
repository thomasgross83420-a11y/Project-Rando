# Repair choices — 0.2.8

An injured defense may have enough Credits for useful partial recovery but not
for a full repair. Preparation now offers Full missing body, +25% maximum,
+50% maximum, Exact whole points and a separately reviewed maximum-affordable
repair. Percentage choices refer to maximum body, capped at the actual injury;
they do not repeatedly take a percentage of the remaining wound.

All choices use the existing blueprint repair prices. The affordable quote
finds the largest payable amount in 1/1024-point units using bounded BigInt
binary search over the exact ordinary quote. It never rounds display text back
into a payment request, changes prices, spends automatically or reserves funds.
The player reviews the resulting body and wallet, then explicitly confirms.
Cancel, invalid requests, insufficient funds and stale writes preserve the save.
Double confirmation cannot purchase twice. Read-only controls stay disabled.

Core and each selected living asset have independent choices. A wreck still
requires Restore; partial repair cannot bypass that cost or revive it. Full-body
and zero-affordable buttons are disabled. Earned XP, enhancement investment,
ownership, placements and permanent stock are preserved.

## Measured examples

- Core at 9,000/10,000 with 7 Credits: full repair is rejected without mutation;
  the affordable preview restores exactly 70 Integrity for 7 Credits. Cancel
  keeps the original save; confirm commits Core 9,070 and wallet 0 exactly once.
- Sentry at 600/1,200: +25% restores 300 for 16 Credits; then Exact 10 costs 1;
  +50% is capped at the final 290 missing points and costs 16. Total 33 Credits.
  One full 600-point purchase costs 32: the blueprint rounds each individual
  transaction upward. Splitting repairs may cost more; no hidden discount is
  introduced to hide that difference.
- Sentry at 1,000/1,200 with 3 Credits: the exact affordable amount is
  58,982/1,024 points (displayed as 57.6). The stored body becomes 1,082,982
  fixed-point units. One quantum more costs 4 Credits, so using rounded display
  values would overcharge. Persistence uses the authoritative exact amount.

## Verification and scope

The full mechanics checkpoint passes 134 unit tests in 30 files and 47 browser
checks. A subsequent confirmation-heading wording correction passes the affected
9 browser checks against a fresh production build; no simulation or price changes
followed the full suite. Typecheck, lint, formatting, deterministic scenario and
production build passed. Source/checkpoint/log hashes are in
[AFFORDABLE_REPAIR_TESTS.json](evidence/AFFORDABLE_REPAIR_TESTS.json).

The native UI cases include cancel, unaffordable rejection, exact fractional
persistence, capped presets and double-click commit. Unit cases test maximality
(one further quantum must exceed the wallet), no input mutation, Core/Warden/
barrier/trap prices, zero wallet, invalid inputs and safe-integer extremes.

Application build 0.2.8 retains rb-sim-v4 for new attempts and old v1/v2/v3
replay contracts. It changes no save schema, reward policy, accuracy policy or
progression thresholds. Desktop viewport emulation is not physical Android
performance evidence. Full campaign pacing and the wider roster remain open.
