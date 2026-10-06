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
