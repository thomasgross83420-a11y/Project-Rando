# Target tablet validation

Target named by the user: Lenovo Tab M10 FHD Plus. Device optimization must
preserve the complete blueprint and visual/mechanical detail. Measurements,
rather than the product name alone, determine rendering and scheduling changes.

## Primary references checked 2026-10-08

[Lenovo's Tab M10 FHD Plus (2nd Gen) specification](https://psref.lenovo.com/syspool/Sys/PDF/Lenovo_Tablets/Tab_M10_FHD_Plus_2nd_Gen/Tab_M10_FHD_Plus_2nd_Gen_Spec.PDF)
(edition 2023-06-15) lists Helio P22T / PowerVR GE8320, 2/3/4 GB RAM variants,
a 1920×1200 panel and Android 9 or later. It names TB-X606F/X606X and a voice
variant. These are candidate family specifications, not a confirmed identification
of the user's hardware, installed OS or available memory.

[Chrome's current Android requirements](https://support.google.com/chrome/answer/95346?co=GENIE.Platform%3DAndroid&hl=en)
state Android 10 and up. This describes current Chrome installation requirements;
it does not prove that an older installed browser cannot run this game. Actual
browser version and feature support must be checked before changing the target.

Current automated production checks use desktop Chromium 151.0.7922.173,
including 412×915, 800×1280 and 1280×800 viewports and actual 200% UI scaling.
Those checks establish reflow and interaction behavior in that browser. They
cannot establish PowerVR GPU performance, Android audio lifecycle, touch latency,
available memory, TalkBack behavior or local download durability.

## Information requested from the user

Tablet model code, Android version, browser name/version. Settings → About tablet
and Chrome → Settings → About Chrome normally provide them. This resolves the
variant/runtime uncertainty without lowering the game scope. No passwords,
serial number, account information or credentials are needed.

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

Public hosting is not yet configured; see [hosting evidence](HOSTING.md).
Review PDF/ZIP downloads are available now, but are not a hosted playable game.
Local mechanics and individual asset development can continue independently.
