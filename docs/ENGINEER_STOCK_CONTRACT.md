# Engineer finite-stock contract

Authority: unchanged blueprint §§24C/27C. This is an isolated, tested kernel
for the next mobile actor; Engineers are not enabled or animated by this commit.
Application build/simulation remain0.2.9/rb-sim-v4. The kernel is not imported
by the game entry; current production assets and replay behavior stay unchanged.

## Defined behavior

Finite stock distinguishes its initial cap, purchased permanent charges and
siege-only temporary charges. Initial cap is1–8; both counts are nonnegative
integers with their sum at most that cap. Trigger spends temporary first, then
permanent. A depleted finite trap remains depleted; zero is not silently replaced
with a free charge. Rechargeables are outside this finite-stock contract.
At Results only actual remaining permanent stock can be stored; temporary stock
cannot become purchased stock or grant a refund. No campaign/body/XP/currency
write is performed by this kernel.

An Engineer is one actor/owned identity with two visual members: one rearm
channel and eight completed additions per siege for the whole actor, not eight
per visual member. One trap has one Engineer reservation. A source cannot rearm
itself or reserve two recipients. Other Engineers have their own eight-addition
limit. Full stock and exhausted source allowance cannot start another channel.

An accepted channel at tickT completes atT+360: six full seconds at60 ticks/sec.
No immediate/free first addition, no level-based timer/count improvement.
Every tick must be observed consecutively. A paused renderer or4× scheduler may
group authoritative ticks but cannot skip eligibility observations. The caller
advances after damage and death resolution; completion therefore cannot restore
a trap destroyed on the completion tick. New stock is eligible for subsequent
trap-trigger phases, not an already completed trigger phase earlier that tick.

Movement, invalid range/LOS, source/target death, incoming damage, unsafe nearby
hostiles, being under attack or a higher-priority action cancels the uninterrupted
channel. Missing observations also release it. Cancellation discards partial time
without spending a completed addition; a restarted channel needs another full
360 ticks. An externally filled trap releases the obsolete reservation.

Advancement stages and validates the whole observed batch before updating its
cursor, reservations or completed counts. An invalid cap/observation cannot
partly commit one Engineer's completed rearm while failing another. Retry of the
same tick works after correcting the invalid observation; repeated committed
ticks are rejected. Observation callbacks must only read the world; scheduling
and applying returned temporary-stock completions belong to the caller's fixed
simulation phase.

## Verified cases

Nine unit cases cover all finite caps1–8 and all starting permanent-stock
counts, temporary-first consumption, exact tick359/360 boundary, single completion,
one-source/one-trap reservations, all nine interruption/preemption flags at the
completion boundary, full/missing recipients, restart timing, source allowance,
safe-integer domains and whole-batch rejection/retry. Purchased stock never
increases in the combined cap/trigger/rearm sequences, including unused temporary
charges at end. Input stock is never mutated.

See [ENGINEER_STOCK_TESTS.json](evidence/ENGINEER_STOCK_TESTS.json) for final source,
test/log and production-output comparisons.

## Integration still required

The mobile actor must supply actual grounded movement/range/LOS, alive/damage and
perception/safety observations; this kernel does not invent a spatial AI query.
It must implement retreat → valid signature → urgent repair → safe rearm →
fallback weapon/anchor priority and mutual exclusion between repair/rearm/fire.
Repair targets are living mechanical bodies, Core at half output; the Engineer
is biological and cannot repair itself. Ordinary repair starts at20 missing and
may finish the smaller remainder, sharing the two-external-channel cap. Source
injuryQ applies to repair and fallback fire, sampled at their documented output
boundaries; rearm time/count stays fixed. Promotions/signature/LOS-grace behavior
is separate from this one-star base contract.

At half health, the base35 I/s repair becomes26.25 I/s before growth, Core13.125;
the base15 fallback release becomes11.25 before mitigation. Movement2 GU/s,
armor5 and radius0.35 remain fixed. Separate frozen actor profiles, temporary
stock accounting, contribution, canonical snapshots/checkpoints and a new
simulation version are required before enabling this actor. Do not add fields
to old retained snapshots or reinterpret their permanent stock.

Two-member original anatomy/contact/socket artwork, 360° movement with facing
independent of path, move/fire/repair blending and natural interrupted-channel
poses need individual runtime evidence. Completing this kernel does not certify
the whole Engineer, Mobile doctrine, wider campaign or physical tablet.
