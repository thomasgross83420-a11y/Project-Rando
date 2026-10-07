# Exact reward arithmetic groundwork — not live payouts

Build 0.2.3 implements the unchanged `economy.duration_wave_v1` formulas from
blueprint §§12,13,25D–25H. The kernel has no wallet writes, claim consumption,
player progression or connection to Tutorial Practice rewards. Practice pays 0.

Use integer quarter-TP and exact reduced BigInt rationals through one final
Credit floor/XP half-up round. Credit-only origin duration/pressure and band/tier
risk do not leak into XP or Promotion Cores. Repeat q captures run-start unlock
band and first-campaign-attempt status, including a failed first attempt. Apply
objective/Expedition percentages together before rounding, then integer first
clear/discovery additions. Defeat has no completion grant; finalized discovery
can still apply. Wallet credit clips only remaining safe-integer headroom and
explicitly reports uncredited overflow; no arbitrary economic payout cap.

Origins are unique block/segment buckets bounded by duration/compiled allocation;
destroyed quarter-TP cannot exceed planned partitions. Each Endurance block gets
its own final floor; no aggregate floor across completed blocks, promised future
blocks, real kill time or wall-clock multiplier. Future receipts must authenticate
terminal allocations and first claims through the authoritative journal, rather
than trusting a caller-supplied outcome or additions.

Two cross-reference details are retained exactly: selected 11/10 and 23/20 modifier
premiums multiply to 253/200 (1.265), not rounded to 1.27; resampled pressures can be
fractional. The blueprint specifies resampling but not its interpolation method.
Implementation choice: endpoint-preserving piecewise-linear interpolation of the
pinned 15-point curve using rational indices. Five samples are 0.35, 0.475, 0.80, 0.90,
0.55. This is recorded compiler groundwork, not a silent change to any existing
practice plan or already-paid receipt; neither currently contains paid origins.

`npm run audit:economy` checks 97,200 synthetic arithmetic cases plus 28,800 tier
monotonicity comparisons over 20 bands, 5 difficulties, 6 durations, 3 pressure
orders, 9 tiers and current/late unlocked-band contexts. It matches all six exact
§25H budget-reference rows. Those assumed destroyed budgets are not actual wins.
It also measures the actual tutorial's 24 destruction allocations by original
packet ID and nominal deployment segment, matching the unchanged canonical hash.
The hypothetical ordinary-policy comparison is explicitly separated from its
actual zero-reward practice outcome.

The six formal unit tests cover reference totals, origin conservation, duplicate
rejection, unplayed-duration protection, defeat/zero-kill rules, Credit-only
factors, combined percentages, exact modifier multiplication, repeat status,
overflow and resampling. No coefficient was retuned.

Still required: paid-run preflight/journaling/idempotent receipts, persistent
body/stock injury, contribution/catch-up allocation and levels, first-claim
application, recovery/emergency rules, full economy-analysis dimensions and
recorded 100-seed gameplay balance at eligible bands. The current arithmetic
sweep does not establish whole-game balance or satisfy that larger acceptance
matrix. Never label hypothetical policy outputs as awarded campaign currency.
