# Verified toolchain selection

Inspected 2026-10-06: official documentation, versioned source and published npm
artifact metadata; installed-package notices retained in public/THIRD_PARTY_NOTICES.txt.
Exact direct pins are in package.json/lockfile; transitive inventory is
DEPENDENCY_INVENTORY.json. All 51 installed packages have declared licenses.

| Dependency | Pin | License | Reason / evidence |
| --- | --- | --- | --- |
| Phaser | 3.90.0 | MIT | [versioned release](https://github.com/phaserjs/phaser/releases/tag/v3.90.0), tagged Config/ScaleManager/WebGLRenderer/CanvasRenderer source and types. Mature required raster APIs; no Phaser 4 shader assumptions. Gate 0 must prove actual behavior. |
| TypeScript | 5.9.3 | Apache-2.0 | [strict options](https://www.typescriptlang.org/tsconfig/strict.html), installed compiler/LICENSE. Strict + indexed/optional checks. |
| Vite | 7.3.7 | MIT | [Vite 7 guide](https://v7.vite.dev/guide/), npm artifact engines. Node 24.19 satisfies >=22.12. Retain this major pending demonstrated need. |
| Zod | 4.6.5 | MIT | [official schemas](https://zod.dev/), published npm artifact. Validate logical content/save domains before mutation. |
| Vitest | 4.1.11 | MIT | [official guide](https://vitest.dev/guide/), artifact peer Vite 6/7/8, engines Node 24 supported. |
| Playwright test | 1.63.0 | Apache-2.0 | [installation](https://playwright.dev/docs/intro), artifact Node >=20. Installed system Chromium 151 used in this workspace; browser/version captured in evidence. |
| Biome | 2.5.15 | MIT OR Apache-2.0 | [official quick start](https://biomejs.dev/installation/quick-start/), npm artifact. One formatting/linting tool with no runtime cost. |

No dependency requires another user account, payment, trial or runtime service.
Dependencies are bundled locally. Toolchain installation requires network; gameplay
must not. Licenses apply to tools, not automatically to generated artwork.

Environment tools: Node 24.19.0, npm 11.9.0, Chromium 151.0.7922.173, Python/Pillow,
FFmpeg 7.1.5. FFmpeg is an available processing tool, not a runtime dependency;
record exact encoder/processing commands when assets are produced. Image generation
is available through the existing session entitlement and is not represented as
open source. No extra subscription is introduced.

Platform sources: [IndexedDB transaction lifecycle](https://developer.mozilla.org/en-US/docs/Web/API/IDBTransaction),
[Chrome autoplay](https://developer.chrome.com/blog/autoplay/),
[Pointer Events](https://www.w3.org/TR/pointerevents3/),
[service workers](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers).
Service-worker scope is feasible on same-origin HTTPS Pages; readiness still needs
the eventual host and complete-cache/offline tests. No worker is advertised yet.

Source processing selected after official license inspection on 2026-10-06:
Pillow12.3.0, MIT-CMU, [tagged primary license](https://github.com/python-pillow/Pillow/blob/12.3.0/LICENSE).
Existing environment installation smoke-tested by actual atlas generation and PNG
round-trip; exact version recorded, no extra Python packages installed. License
retained in assets/source/PILLOW_LICENSE.txt and bundled notices.
Native multi-touch test uses installed Chromium151 CDP `Input.dispatchTouchEvent`;
parameter contract inspected in the [official protocol source](https://github.com/ChromeDevTools/devtools-protocol/blob/master/json/browser_protocol.json)
on the same access date. This development interface is not a gameplay dependency
or Android evidence. Image-generation model/version is not exposed by the tool;
exact source PNGs, prompts and source hashes identify the reproducible cleanup input.
