# Architecture decisions

## ADR001 — candidate stack (Gate 0, provisional until smoke checks)

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
