# Target tablet validation

Target confirmed from the user's four screenshots: Lenovo Tab M10 FHD Plus,
model TB-X606F, Android 10, 4.00 GB RAM, 64.00 GB storage, MediaTek Helio P22T
and 1920×1200 panel. Chrome reports 154.0.8037.126 on Android 10. Device optimization must
preserve the complete blueprint and visual/mechanical detail. Measurements,
rather than the product name alone, determine rendering and scheduling changes.

## Primary references checked 2026-10-08

[Lenovo's Tab M10 FHD Plus (2nd Gen) specification](https://psref.lenovo.com/syspool/Sys/PDF/Lenovo_Tablets/Tab_M10_FHD_Plus_2nd_Gen/Tab_M10_FHD_Plus_2nd_Gen_Spec.PDF)
(edition 2023-06-15) lists Helio P22T / PowerVR GE8320, 2/3/4 GB RAM variants,
a 1920×1200 panel and Android 9 or later. It names TB-X606F/X606X and a voice
variant. The screenshots identify the 4 GB TB-X606F; they do not measure currently
available memory or GPU performance.

[Chrome's current Android requirements](https://support.google.com/chrome/answer/95346?co=GENIE.Platform%3DAndroid&hl=en)
state Android 10 and up. This describes current Chrome installation requirements;
it does not prove that an older installed browser cannot run this game. Actual
browser version and feature support must be checked before changing the target.

Current automated production checks use desktop Chromium 151.0.7922.173,
including 412×915, 800×1280 and 1280×800 viewports and actual 200% UI scaling.
Those checks establish reflow and interaction behavior in that browser. They
cannot establish PowerVR GPU performance, Android audio lifecycle, touch latency,
available memory, TalkBack behavior or local download durability.

## Target identification completed

The supplied screenshots resolve model, installed Android/browser and RAM variant.
No further target-identification input is needed. Screenshots are not committed:
the first contains unrelated personal/network details. Only relevant hardware and
runtime fields are recorded. Browser viewport/DPR, free memory and GPU timing
remain measurement questions; panel resolution does not establish CSS viewport.

MDN browser-compat-data checked 2026-10-08 records Chrome support for BigInt from
67, crypto.randomUUID from92, Object.hasOwn from93 and structuredClone from98;
Chrome Android entries mirror those records. The reported154 browser exceeds
these version minima. crypto.randomUUID still requires a secure context, and
API version support is not proof of actual storage/GPU/audio reliability.
Actual automated runs remain Chromium151, not154 or Android.

## Next measured pass

1. Identify the actual browser target, then compare its required runtime features:
   ES2022 bundle/BigInt, structuredClone, Object.hasOwn, secure-context
   crypto.randomUUID, IndexedDB, WebGL and Web Audio. Keep device support claims
   separate from desktop emulation and HTTPS-origin requirements.
2. Measure simulation and rendering separately at 1×/2×/4×; compare identical
   captured battles, actor counts and camera/zoom states. Record median and high
   percentile frame/update time, long tasks and active resource counts. A faster
   machine's timing is a tooling baseline, never tablet acceptance.
3. On a playable stable HTTPS origin, verify touch/pinch/cancel, orientation,
   readable world labels, 200% UI, all travel directions, audio pause/resume,
   background/foreground, interrupted results, reload and writer takeover.
4. Export, reopen and reimport a backup on Android; compare campaign, wounds,
   wallet, receipts and replay binding. Verify accessibility separately with
   actual TalkBack rather than inferring it from DOM labels.
5. Profile a demonstrated bottleneck before optimizing. Preserve authoritative
   fixed-step combat, replay hashes and natural motion. Presentation work may be
   scheduled/batched without changing progression, actor behavior or content scope.

The [public playable preview](https://thomasgross83420-a11y.github.io/Project-Rando/)
is configured and deployed; see [live-origin verification](PUBLIC_PREVIEW.md).
Review PDF/ZIP downloads remain separate review artifacts.
Local mechanics and individual asset development can continue independently.
