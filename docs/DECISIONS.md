# Architecture decisions

## ADR001 — selected stack (Gate 0 smoke checks passed)

Phaser 3.90.0 presentation, TypeScript 5.9.3, Vite 7.3.7, Zod schemas, Vitest,
Playwright and Biome. Rendering uses versioned Phaser 3 source/types; current Phaser
4 documentation is not an API contract for this version. Custom headless simulation
and native IndexedDB/Web Audio avoid coupling combat to engine physics or sound.
Four-angle raster projection is application math. Hash routes avoid static-host
refresh rewrites. No runtime CDN or additional account. Pin exact tested packages.

## ADR002 — repository and hosting

Canonical checkout: Project-Rando, based on clean main f4cb0e8. Work branch
codex/resonance-foundation preserves main and original README. Public repository
meets GitHub Free Pages visibility requirement. Pages absent; administration access
to Actions permissions is denied by the connected integration. Prepare manual-only
deployment template without assuming settings or publishing. No Git LFS.

## ADR003 — evidence and compatibility

Initial schema/content/simulation/generator versions are explicitly recorded in
versions.json. No prior player saves exist in the inspected repository. Blueprint
remains byte-identical. Traceability source IDs identify immutable source blocks;
status updates are independent. Real Android and aesthetic approval remain separate
from automated desktop evidence.

## ADR004 — preparation storage boundary

Validated owned snapshots, previous snapshots and writer generation/revision fence
commit in one IndexedDB transaction. A command updates displayed ownership/wallet
and history only after transaction completion. Undo/Redo stores exact snapshots as
new revisions, never a resale/refund. Continue targets last successfully opened
slot, independently of ordinary command writes. Temporary Session requires an
explicit choice and uses the same validation; storage failure in a retained session
does not convert it. Foundation saves use schema1 with pinned content/simulation/
generator/economy identity, baseline-only level/investment domains. Gate2/3 extensions
require isolated validated migrations before supporting previous foundation saves.

## ADR005 — original raster candidate pipeline

Image generation develops original reference/camera views. Inspected crops, hard
alpha, nearest-neighbor native sizing, bounded undithered palettes and transparent
atlas gutters are reproducible with Pillow12.3.0. Hand-coded simple objects were
rejected as final art. Static candidates are integrated under a visible development
label; unapproved mobile views/animation are not represented as completed gameplay.
User tablet proof review precedes mass asset production under blueprint§16.

## ADR006 — safe checkpoint publication

Normal Git authenticated push returned HTTP401. The connected GitHub Git Database
API could publish the exact local blob/tree/commit identities to the work branch.
The publisher verifies every object hash, parent and expected remote branch before
a non-force reference update; it never modifies main. Recheck remote after each
checkpoint. No token or local credential configuration is tracked.

Gate 1 review: only demonstrated presentation defects are corrected (overview
caption/body overlap, opaque point marker, hidden-container zero-size WebGL
attachments). The production renderer retains its last valid dimensions while
hidden. Captions are presentation-only and never affect spatial validation.
No content/simulation/generator/economy/save-schema version or design baseline
changes. Art remains Candidate / Awaiting User Review. Camera/label instrumentation
and clearly named static Rifle/Runner comparison objects exist only in the
external browser capture tool, not a shipped game control or saved entity.

## ADR007 — independently versioned presentation lighting

User feedback requests brighter, clearer Gate 1 art. A presentation-only
`rb-lighting-r1` manifest/config defines reproducible RGB ramp changes and renderer
background/tint; simulation/save/version identities are unchanged. Geometry and
alpha are compared to the immutable prior review commit. Generated lighting
guidance is retained but not substituted for runtime sprites. See VIS001 in
DESIGN_DECISIONS.md and review/GATE1_LIGHTING_R1.md. User approval remains pending.

## ADR008 — Gate 1 strategic and preparation closeout

Fit Base fits purchased [12,48)² land with native-height headroom, four rotations and the ordinary 0.35 minimum zoom. Fit Field fits the whole 60² staging field and has the declared lower-fit exception. The default is Fit Base. No ordinary sprites are enlarged to solve strategic readability: 24px original silhouette badges retain screen size, group overlapping assets and open named selection. Core-containing groups anchor on Core. Detailed sprites remain at native density/zoom; precise selection uses actual alpha rather than transparent frame margins.

Route overlays show actual deterministic clearance witnesses for the selected 0.45/0.75 GU profile against the proposed layout. They complement the exact authoritative placement explanation; neither overlay nor camera changes legality. Reservations use patterns/outlines, selection hollow crosshair and valid/invalid placement check/cross. Landscape preparation reflows a single control set to left tools, middle field and right details, including at 200%.

Global schema1 presentation preferences live in IndexedDB meta/preferences.v1, independent of campaign Undo/Redo and replacement. Changes apply immediately, debounce 250ms and report Saved only on completion. Failure retains current presentation with explicit retry. Invalid stored preferences are preserved until an explicit change. No campaign schema or economy policy is changed. Conditional rb-lighting-r1 approval supersedes the pending-foundation review status in ADR005/007; all exclusions remain in USER_VISUAL_APPROVAL.md.

## ADR009 — Gate2 practice transaction boundary

Authority §§3A/21/26A: Gate2 explicitly requires a results stub and durable checkpoint. The first coherent slice is a disposable Bulwark/Bastion practice clone using actual owned assets/current body health. Guided placement changes only the clone, spends nothing and validates capacity/land/reservations/routes. It never changes selected Warden/doctrine or claims campaign progression. Starting sequence/identity, authored plan and army commit atomically behind writer generation plus campaign lineage/revision before tick0. One unresolved practice record per slot blocks ordinary campaign edits. Terminal summary is idempotent by sequence/identity/hash; abort offers retry/export. Restart is the same start/seed, while confirmed surrender records defeat. Temporary memory uses three independent bounded slot records/counters. Normal progression/receipt transactions remain Gate3.

## ADR010 — deterministic tutorial combat and presentation boundary

Fixed1024 units, signed movement carries,60-Hz tick order and BigInt mitigation/sweeps. Offline-generated65536-direction table replaces runtime trigonometry in simulation. A derived2GU spatial grid gives stable-ID broadphase candidates without replacing exact swept collision; it is not saved or hashed. Fresh friendly perception gates contact movement and impact telemetry after sight is lost. Half-cell weighted reverse navigation is synchronous; legal direct positioning avoids redundant fields, with shared Core/breach fields and bounded cache. Standard decisions15/21 ticks and perception15 ticks are staggered by stable IDs. UUID-sorted starting identities are input; released projectiles survive owner death, unreleased casts cancel. Render/audio/camera/captions/speed preferences are absent from state hashes. Core/Warden threshold latches and cleanup onset are simulation state. Cosmetic animation/effects/UI consume those facts. Named FitBase enables role badges even at fitting zoom just above0.65; numeric zoom limits/categories are unchanged. Inactive preparation renderers are disposed to avoid duplicate resident atlases. A separate foreground interface clock excludes hidden/frozen absence from captions/health-indicator deadlines; it never enters simulation. Native Camera-modal dismissal was tested failing with audio left suspended; closing now resumes audio only when no remaining pause/new dialog/session change prohibits it, with current status text.

## ADR011 — reusable original candidates and native audio

Only the Gate2 slice receives new original image references. Curated sources plus deterministic native rig/trim/pivot/gutters/atlas packing retain editable sources, prompt and provenance. Malformed Sentry cells and uneven support row crops were rejected/corrected before integration; failed raw generations are outside Git. Indexed PNG preserves opaque colors, normalizes invisible RGB and reduces transfer without changing texture dimensions. Stationary structural idle aliases use a separate original four-frame light overlay. Damage uses authored scratch clusters, not random dithering. Candidate status never inherits blanket approval. Full roster production is deferred. Original PCM/synthesis uses no new library/account; native decode/pause/mix/mute checks establish initial audio. Physical GPU/audio/listen tests remain separate.
