# Device target and optimization scope

User instruction, 2026-10-07: **Lenovo Tab M10 FHD Plus** is the intended tablet.
The user wants the complete intended game, optimized well; the tablet must not
be used as an assumed reason to reduce the game's scope or detail. Exact model
generation, RAM, Android version and browser are not yet recorded. Do not infer
those specifications from the product name or claim hardware testing occurred.

Preserve the blueprint's roster, mechanics, modes and visual goals. Profile the
implementation and reduce wasted work: cache derived data, batch static scenery,
reuse transient objects, bound cosmetic effects, manage texture/audio lifetime
and avoid unnecessary allocations or repeated queries. Graphics options can
change presentation under the existing blueprint; they must not quietly remove
combatants, change damage/AI, skip simulation ticks or alter a live encounter.
Use any explicit plan/population profile only under the blueprint's stated
rules, never as a hidden device adaptation.

The existing baseline remains a 60Hz authoritative simulation with a 30FPS
mobile render target and optional 60FPS. Physical-device acceptance is measured:
normal battle median 30FPS, 95th-percentile frame <50ms, input <150ms and 10-minute
stress without sustained growth/crash, plus all supported speeds, orientation,
background/discard, audio, storage/recovery and accessibility. These are targets
from blueprint §20, not achieved Lenovo measurements. Desktop automation is
layout/behavior evidence and cannot establish the tablet's GPU/thermal capacity.

Optimize visible cost before considering any change to encounter design. Inspect
CPU simulation/navigation, render submission and allocations separately. Review
long-lived scenes and scene transitions, not only one successful short recording.
Preserve the approved native pixel-art detail and gameplay outcomes while making
performance work; record before/after timings on the actual device when available.

No additional gameplay-rule clarification is required. Browser/OS details are
useful later for reproducible device measurements, not a blocker for engineering.
