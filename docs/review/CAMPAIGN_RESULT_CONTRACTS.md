# Resonance Bastion — campaign result contracts

2026-10-07 · build 0.2.4-campaign-result-contracts.
This increment develops the reliable campaign-result foundation, then its
progression and recovery arithmetic. Full 360° travel and the approved visual
direction are retained. The original blueprint and existing combat art are unchanged.

## What is now implemented and tested

The ordinary-run transaction framework captures a checkpoint and allocated run ID,
restarts the same attempt, and abandons it without partial rewards. Terminal
results are immutable. They are journaled before a separate atomic commit applies
the validated campaign, claims and receipt. Retrying a committed result reads its
receipt without paying again, including after a lost acknowledgment and reopen.
Recent receipt details are bounded; their removal cannot make old sequences payable.
Preparation and tutorial starts cannot race an active ordinary attempt.

A deliberately synthetic browser adapter tests these boundaries using a 37-Credit
fixture. It is test tooling, not a campaign encounter or actual reward calculation.
The production gameplay adapter still needs real body, permanent/temporary stock,
contributions, progression and compiled reward metadata. No normal paid launch
button is exposed and tutorial practice still awards zero rewards or persistent injury.

## Progression and recovery details

The rank and cumulative asset XP tables are pinned as integer content. Independent
70/100-digit Decimal derivations agree, including all published asset XP references.
Exact 70% participation plus 30% contribution allocation preserves the whole pool,
uses deterministic ID ties, caps catch-up, excludes ineligible/capped participants
and reports newly capped excess as unused XP. Multi-rank advancement and zero-body
level-up behavior have explicit boundary checks.

Specified growth matches the Sentry Level 100 / Enhancement 10 reference:
2652 maximum Integrity, 85197/1024 damage, 9421/1024 GU range and a 38-tick
weapon interval. Support and beam cadence stay fixed. Health growth preserves
existing wounds, and zero body remains zero. Enhancements remain explicit purchases.

Exact recovery quotes cover individual/partial repair, restoration, wear-adjusted
sale and permanent-charge rearm. The Warden's base cost of 500 is applied where
specified, and selling the last owned Warden is rejected. Refund locks and paid
Promotion Core deposits stay separate from body damage and Credit investment.
These are arithmetic kernels; their player commands and emergency reconstruction
have not been presented as complete features.

## Verification

Strict types, lint, deterministic headless checks and production build passed.
All 87 unit tests passed across 18 files. The stable full browser run passed
34/34 in 3.8 minutes, including eight native ordinary-run transaction fixtures.
An earlier launch overlapped a rebuild and received one 404; the complete stable
rerun passed without skips or retries.

The growth/conservation audit records 100 level samples and 512 deterministic
wide-integer allocation/permutation cases. These validate arithmetic rather than
whole-game win rates or the future contribution collector. The unchanged playable
slice remains construction plus autonomous Bulwark/Bastion tutorial practice.

## Blueprint clarification needed

The blueprint gives Sentry accuracy as 90% at Level 1 and 95% at Level 100, and
says ordinary weapons gain accuracy with level. It supplies no accuracy-growth
formula. The proposed rule is a linear +5 percentage points over Levels 1–100 for
accuracy-based weapons, capped at 100%; inherently unmissable attacks stay unchanged.
That proposal awaits your input and has not been applied.

Next engineering dependencies are the versioned campaign-profile migration, real
contribution/body/stock capture, production result adapter and complete run/receipt
backup-import plus recovery screens. Endurance, emergency reconstruction, full
records, per-asset contact/animation work and the remaining roster remain open.
Physical Lenovo performance, native Android sharing and TalkBack still require
actual device checks. No public playable deployment is claimed.
