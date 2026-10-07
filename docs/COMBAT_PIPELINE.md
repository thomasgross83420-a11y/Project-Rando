# Gate2 combat and production contract

Authority: blueprint §§3A/6/14/16/17/21/24A/24B/24H.1/26A/27; T02–T09/T14–T17. All later content remains required. See STATUS/TEST_EVIDENCE for actual completion. No mass roster production.

The authored Standard tutorial-practice fixture deploys18Runner/sixRaider,24bodies/30TP, fixed Front1; nominal90s, final85s, warning65s. It is not a generated encounter, adaptive plan or soundtrack input. Source schedule is strictly schema-validated, identity-versioned and immutable. Guided or current owned fortress clone passes complete construction validation. Only selected Bulwark/Bastion is supported at this gate. Original campaign stays unchanged.

Authoritative headless modules: fixed.ts pinned table/BigInt ties-away rounding; navigation.ts half-cell/no-corner weighted fields; spatial.ts derived stable-ID2GU broadphase; collision.ts swept circles/rounded rectangles; battle.ts phase-ordered deployment/perception/AI/movement/release/projectile/damage/death/support/triggers/outcome. Physics respects body separation and solid footprints; known obstruction/body blocking permits contact attacks. Releases require perception/range/LOS/aim/warmup. Melee is unmissable; ordinary bullets use three accuracy draws. Rifle has one body/agent/release schedule and three visual troopers; injuryQ is sampled at release. RepairNode stationary living-mechanical channel/first15tick pulse/Corehalf; Mine detected trigger then18tick fixed blast with falloff. Bulwark's Interpose/Challenge/Holdfast/LastRampart operate automatically. Core death precedes victory; one-second quiet waits for packets/hostile projectiles; no-damage capability invokes three-second inevitable defeat, and no-progress recovery remains restartable/surrenderable.

Practice persistence: one journal per slot, bounded uint64 sequence and1MiB starting record, plan/army/identity plus terminal summary. Atomic writer generation/lineage/revision fence; transaction completion precedes starting/resolving. Restart uses the same starting clone; surrender records defeat; interruption never earns progress. A corrupt/mismatched journal is preserved/exportable. Pending-result save failure offers retry/export; repeated matching write is idempotent. Temporary slots use separate memory records. Normal reward/damage receipts remain Gate3.

Rendering/DOM/audio: read-only BattleClock/camera/map/inspection/settings, no tactical edits. Pauses compose across manual/modal/background/orientation/context loss/performance/writer recovery. Supported speed.5/1/2/4 changes only tick scheduling, max12perframe without skipped mechanics. Returning from interruption is explicit checkpoint restart. Foreground interface time excludes hidden/frozen absence for caption/health-indicator deadlines. Modal dismissal restores audio only if combat is eligible; manual/background/recovery pauses remain until Resume. Core/Warden health and deployment/cleanup state, reason/target/range/support/ability inspection, bounded observed event history/captions. Hidden enemies are not inspector/map telemetry.

Native production contract is ASSETS.md plus combat manifest/source scripts. Foot anchor, collision relationship, native dimensions, camera/facing/state/ticks, trim/gutters, palette/lighting, shadow/body/effect depth, team shapes, damage/disabled overlays, reduced/static/high-contrast variants are explicit. Edit sources/rigs, rebuild, validate, inspect native sheets, inspect live tactical/strategic combat, then record user acceptance. Candidate existence is not approval. Full-dataset menu/accessibility/facing audit remains later; physical Android is Needs Device Check.

Original audio definitions/actual files are AUDIO_DEFINITIONS.md. No audio/render clock or external service imports the simulation. Native decode/mixing tests and enabled/muted real-run hashes are required evidence, separate from listening review.

## Animation audit follow-up — 2026-10-07

User requires natural, accurate, detailed and heavily scrutinized behavior per
asset; tablet optimization preserves scope. See review/ANIMATION_AUDIT.md and
DEVICE_TARGET.md. Authored timeline sampling fixes effect truncation and hit
duration; technical tests cover every frame boundary. Pixel audit exposes 427
pose/overlay mismatch cases. Generic cut-point articulation and missing
contact/phase landmarks remain quality work, not verified natural animation.
No final-art acceptance or roster propagation follows from the timeline fixes.
