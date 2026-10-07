# Resonance Bastion — full-angle movement and recovery checkpoint

2026-10-07 · build 0.2.3-omnidirectional-recovery · simulation remains rb-sim-v2.
Your approval of the previous look and Rifle study is recorded. Full 360° travel
is now an explicit invariant for every moving asset. The blueprint is unchanged.

## Movement is independent of sprite directions

All 65,536 pinned headings roundtrip with zero angular-index error. Rifle and
Bulwark actually return to fractional anchors at 48 intermediate directions each;
all four currently implemented mobile body types pass 48 production-solver
angles, including uniform-speed checks. Four camera views preserve positions
and all eight drawn facings. Moving diagonally does not grant a speed bonus.

Eight sprite directions describe presentation, not eight allowed travel routes.
Navigation can still obey obstacles, body clearance and autonomous tactical
rules while movement uses arbitrary directions. Static structures retain their
preparation rotations and do not acquire locomotion. Future mobile types must
pass the same checks plus their own special mechanics.

These checks do not certify natural foot plants or every authored limb/socket.
Per-asset joints, equipment/contact consistency, moving-and-firing blends and
falls remain refinement work under the approved design direction.

## Backup and recovery now work for the playable slice

Data Management supports selected/all-slot checksummed exports, file/pasted-text
imports with destination previews, Restore Previous, confirmed campaign deletion,
Save Now and a feature-detected persistent-storage request. Download/share and
copyable-text routes are offered. Global accessibility/settings are optional on
export and require an explicit checkbox to apply on import.

Exports include ownership, placement, wallet, previous snapshot, retained
practice checkpoint/result, pinned versions and monotonic sequences/fences.
Imports replace selected campaigns rather than adding money or merging armies.
Writer takeover, changed previews, conflicting practice, corrupt/duplicate JSON,
unsupported state and failed writes are rejected with retained data preserved.
Old foundation exports are supported with a clear missing-checksum/checkpoint
warning. Current snapshots have no historical timestamp; revisions identify
rollback targets accurately.

Detailed contract/research: docs/RECOVERY_CONTRACT.md. Unsupported future logical
journals block export/recovery rather than being silently left out. The complete
future paid-result schema still needs its own journal/receipt implementation.

## Reward groundwork has been cross-checked

An exact rational kernel matches all six blueprint arithmetic reference rows.
The audit exercises 97,200 synthetic reward cases and 28,800 rate comparisons;
actual tutorial destruction origins are also captured independently. Products
such as 1.265 and fractional resampled pressures remain exact through final
rounding. No economy coefficient changed.

This does not enable campaign rewards or certify balance. Practice remains
Credits 0, XP 0, Cores 0. Normal results/injuries/progression will be connected only
after their atomic journal and claim boundary passes. See docs/ECONOMY_POLICY.md
and docs/evidence/ECONOMY_ARITHMETIC.json for method and limits.

## Verification and next work

Strict types/lint/build and 67 unit tests passed, including the original retained
v1 exact replay. All 26 distinct browser scenarios have been verified: the extended run passed 25
with one test-selector timeout; correcting the locator and rerunning all seven
recovery cases passed. No application change was needed for that timeout.
Detailed run outcomes are recorded in docs/TEST_EVIDENCE.md.

The canonical v2 tutorial remains Victory at 6,879 ticks, 24 kills, 30 TP, Core 10,000;
SHA-256: 1fc32c1de93483123a91b0b018aa0f90a36e508c406acc27b14f2990016ba8b6.
Existing art/animation and the approved 0.2.2 video are not relabeled as new footage.

Next coherent engineering work: ordinary campaign checkpoints, immutable pending
results and exactly-once receipts, then persistent body/stock changes, XP/claims
and explicit recovery commands. Continue per-asset articulation scrutiny alongside
those mechanics. No new gameplay/design question is blocking that engineering.

Lenovo physical performance and Android file/share/storage/accessibility behavior
remain unmeasured. Browser/OS details and later actual tablet checks will help
reproduce those conditions; desktop evidence is kept separate. No public playable
origin, whole-game completion or physical-device certification is claimed.
