# Material design and balance decisions

Gameplay rules and tuning remain taken directly from the authoritative blueprint.
Records include the source requirement, before/after, compatibility and evidence
under §29B.

## VIS001 — brighter Gate 1 candidates (2026-10-06)

Authority: user review requested less-dark, clearly detailed and defined assets,
better lighting and visibility; blueprint §16, T17. Prior review was not approved.
The user request authorizes this candidate revision, not final style acceptance.

Before: the prior-review atlas/background used darker metal and basalt midtones.
After: preserve matte steel/brass/teal, upper-left lighting, dark outlines and
native raster topology; lift sprite midtones with gamma0.70 and terrain with a
separate cool ramp. Background changes from #111923 to #26333c. A generated
lighting guide was inspected but its changed geometry is not used in the atlas.
No extra detail or animation completion is claimed merely from brighter colors.
Boundary/placement strokes receive a dark backing to preserve their distinction
against the brighter ground; textual validity feedback remains unchanged.

Compatibility: presentation version rb-lighting-r1. All 30 frame IDs, rectangles,
sizes, anchors, camera/state keys and atlas alpha remain identical. No collision,
selection math, economy, gameplay data, input, content/simulation/generator identity,
save schema or archived logical state changes; no migration required. Original
sources and the prior Git checkpoint permit reproducible comparison/reversal.

Evidence: validate_lighting.py checks geometry/alpha and increases in masked mean
RGB for six representatives; validate_foundation.py checks packing/palette/hash.
The complete affected browser suite and same-scale actual production captures
verify integration. Pixel brightness is not proof of comfortable tablet contrast,
Android compatibility, performance or artistic approval. Status remains
**Awaiting User Review**. Gate 2 and mass roster production remain paused.
