# Tablet target and rendering reuse — 0.2.9

The user's screenshots identify Lenovo TB-X606F, Android10, 4 GB RAM,
64 GB storage, Helio P22T, 1920×1200 panel and Chrome154.0.8037.126.
No further target-identification input is needed. Only relevant device fields
are recorded; personal/network details and original screenshots are not copied.
See [target evidence](../evidence/TABLET_TARGET.json).

MDN browser-compat-data records the required BigInt/UUID/Object.hasOwn/
structuredClone APIs from Chrome67/92/93/98 respectively, with Android mirrored.
Reported154 exceeds these version minima. Secure-origin and actual storage,
audio/GPU behavior still require runtime checks. The automated browser is
desktop Chromium151; no154/Android performance certification is inferred.

## One demonstrated rendering bottleneck

`WorldView.draw` destroyed every terrain/actor/icon image and text label, then
recreated them during each camera, touch-drag, placement or resize redraw.
This was unnecessary scene allocation and text-canvas churn, not a simulation
or artwork-detail requirement. The shared preparation/background renderer now
reuses images and labels up to its peak simultaneous visible demand.

Acquisition restores texture/frame, anchor, scale, tint, alpha, position and
depth for each new role. Excess objects become hidden; picking includes only
the current active objects. Label style/text changes update only when needed,
avoiding repeated text canvas uploads. Scene destruction releases retained
objects, and the view clears references on disposal.

No authoritative simulation, animation clock, atlas, collision, progression,
price or sprite-resolution change is made. Pooling retains peak scene objects
until scene disposal rather than reclaiming them on every camera redraw;
actual-device peak memory remains a measurement item.

## Controlled before/after measurements

The harness runs the actual shared WorldView class with deployed owned assets,
native Phaser textures and four camera orientations. Six portrait/landscape,
Fit Base/Field/close and ghost cases each repeat81 redraws. Draw submission
timings exclude screenshot work and do not measure GPU frame time. Read-only
measurement contexts never write campaign saves.

| Case | Created images before → after | Median draw ms before → after | p95 ms before → after |
|---|---:|---:|---:|
|Portrait Base|261,135 → 1|12.7 → 2.1|26.1 → 4.3|
|Portrait Field|292,734 → 0|15.4 → 2.0|23.0 → 4.0|
|Portrait Close|65,286 → 0|2.4 → 0.7|6.4 → 1.5|
|Portrait Ghost|261,216 → 1|13.0 → 1.4|20.7 → 3.9|
|Landscape Field|292,653 → 0|16.8 → 1.6|29.3 → 4.4|
|Landscape Close/Ghost|59,049 → 0|2.9 → 0.7|6.0 → 1.5|

All six final PNGs match the original byte-for-byte, independently checked
with RGB pixel comparisons. Camera and hit bounds also match exactly. The
after cases destroy zero objects during the81 redraws. Occasional1 new object
reflects a slightly larger demand at another orientation, not continued growth.
Both repeated native-browser cycle tests pass: no second-cycle allocations,
no invisible object participating in picking, identical restored pixels after
ghost/role/style changes and released canvas/collections after scene disposal.

Measured records are in RENDER_REUSE_BEFORE/AFTER/COMPARISON.json. These are
desktop tooling measurements, not Lenovo frame-rate results or maximum-roster
combat acceptance. The initial measurement setup incorrectly removed the app's
async bootstrap DOM; a separate audit document corrected that harness error
before collecting the passing measurements. Typecheck also caught one unused
temporary variable during the refactor, corrected before the successful build.

## Next physical-device prerequisite

A stable playable HTTPS origin is needed for real tablet measurements. The
prepared [manual Pages preview workflow](../pages-preview.yml.example) pins
the locally tested source, standard free public-repository runner, one-day
artifact retention and the existing `/Project-Rando/` subpath. It is not installed
or dispatched; main and repository hosting settings are unchanged.
See [preview preparation](../TABLET_PREVIEW_PREPARATION.md) for the concrete
publication step and its separate authorization requirement.

Individual Engineer/mobile-support contracts and wider content can proceed
independently; physical performance is not replaced by this optimization.
