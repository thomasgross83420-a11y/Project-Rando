# Repair-source coordination — simulation v4

This follows the completed 0.2.6 paid-combat integration. The blueprint §24B
permits two **external** repair/heal channels per recipient and permits self-care
when the source/body type is eligible. A four-Repair-Node fixture found that v3
counted a permitted self channel against the external limit. Which UUID appeared
first also determined whether self-care was allowed at all.

The v4 support phase counts only external channels in that cap. Self repair still
needs a living mechanical recipient, ordinary range/LOS, useful missing body,
the same 0.5-second commitment and quarter-second pulse. It reserves its expected
next restoration when scoring other sources; it is not a new regeneration effect
or another external slot. No source can heal a wreck, overfill body or claim more
restoration than the recipient's eligible injury.

The fixture places three healthy Nodes around one half-body Node (400/800), in
both receiver-first and receiver-last UUID order. With the authored 6.25-Integrity
pulses, v3 restores 12.5 at tick16. v4 restores 18.75 using self plus two external
channels. The third external source remains unassigned. By tick350 v4 has restored
exactly400 Integrity, releases all channels at full body, and attributes exactly
400 body-point equivalents across providers. It does not start new channels for
sub-threshold wounds, but established channels finish the final remainder.

## Compatibility and persistence

New paid and profiled-practice plans capture rb-sim-v4. Old v1/v2 legacy practice,
v3 paid plans and v3 profiled-practice plans retain their existing behavior.
Existing saves are not rewritten on load. A finalized v4 result advances its
saved simulation/build header in the same transaction as wounds, rewards and
receipt; an interrupted v3 attempt remains v3. The saved army profile has no
stat-price or free-healing changes.

A complete retained v3 guided siege matches the published 0.2.6 checkpoint,
battle snapshot and pending-result hashes exactly under the new runtime. Native
browser backup/import now tests both v3 and v4 pending results through reload,
cross-slot rebinding and exactly-once finalization. The older 0.2.6 review and
receipt study remain historical v3 evidence; audit:combat-progression explicitly
pins v3 so it cannot silently replace that evidence with a different replay.

## Verification boundary

Five focused unit tests cover receiver ordering/external cap, finish/no-overheal,
wrecked sources/recipient and the full published v3 replay/receipt identity.
The current support routine still implements Repair Node only. Engineer/Medic/Bay
movement/repair planning, injury-scaled mobile support output, rearm channels,
jamming and broader roster interactions remain their own development increments.
This correction establishes one shared limit; it does not advertise those absent
systems as finished. Full verification passes all131 unit tests in29 files, all44 browser checks,
typecheck, lint, formatting, deterministic scenario and production build.
Existing14 lint information diagnostics and build bundle/annotation warnings
remain. Source/log hashes are in SUPPORT_CHANNEL_TESTS.json.

Reproduce the four deterministic before/after fixtures with
`npm run audit:support-channels`; machine evidence is SUPPORT_CHANNELS.json.
No wall-time/FPS or physical-device performance claim follows from this audit.
