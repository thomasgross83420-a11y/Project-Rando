# Asset manifest and provenance

Authoritative requirements: blueprint §16, §27F, T17. Runtime manifest:
`public/assets/foundation.json`; source: `assets/source/generate_foundation.py`.
Rebuild with Python and Pillow 12.3.0: `python assets/source/generate_foundation.py`.
No network, account or payment is needed to rerun cleanup, atlas or title composition.

Original image-generation candidate sources: `foundation-reference.png` (six-design
proof), `camera-reference.png` (four-view Core/Sentry/Barricade). Generated using this
session's image capability, inspected before processing. These are original
candidates, not an externally licensed asset pack. Reusable prompts are in
ASSET_PROMPTS.md. Editable deterministic source and exact source PNGs are retained.
The earlier simple raster proof was rejected during internal visual inspection;
its algorithm is retained for terrain and explicit under-development body views,
not reported as approved production art.

Pipeline: inspected row/cell crops; alpha threshold 128; object bounding-box trim;
nearest-neighbor downsample within native frame with 2px safe margins; individual
40-color undithered quantization; common 128-color atlas; 4px minimum transparent
padding; 1024×1024 PNG; nearest-neighbor browser display; source density 2:1.
Each frame stores content key, native bounds, foot anchor, camera view, idle state,
source and review status. Contact shadows never change collision. Native mobile
proof includes three distinct 48×64 Rifle bodies in a composite demonstration.
Core is a 192×192 visual fragment inside its separate authoritative 4×4 collision.

Structural validation checks dimensions, frame packing, anchor bounds and atlas
hash. Visual inspection rejected a crop containing the preceding row's fragment;
explicit inspected row boundaries fixed it. Rebuild/inspect both default and close
proofs after any crop or palette change. Static camera candidates have four views;
mobile nonzero views remain procedural development aids. Eight mobile directions,
idle/move/aim/attack/hit/ability/down animations, damage/wreck variants, all portraits
and final role icons remain Designed. Do not infer their completion from an idle
frame or proof composite. User tablet style review is pending; no mass production
or final-art approval is claimed.

Title composition: original 640×360 raster layered ruins/terrain/fortress/walls,
rebuilt from the same source definitions; candidate status. Frame manifest and
source image hashes identify exact candidates. Optimized runtime assets are ordinary
Git tracked PNG/JSON. No LFS, caches or browser recordings are required.

## Gate 1 lighting candidate r1

User feedback requested less darkness, better lighting and visible material detail.
`assets/source/lighting-r1.json` is the single presentation-ramp definition:
sprite RGB gamma0.70, darkest pixels (maximum channel <=32) preserved, a separate
cool basalt ramp, lighter background and unowned-ground tint. The native pixel
grid, alpha silhouettes, pivots, sizes, frame packing and content IDs are retained.
The manifest's `palette` retains the original authored color definitions; its
`lighting` block defines the applied ramps, and the actual 128-color atlas is the
authority for final encoded pixels. The image-generation edit
`lighting-reference-r1.png` is original lighting guidance,
not runtime sprite geometry: its edge/layout differences were inspected and
rejected for direct adoption. The original source images remain available.

`python assets/source/validate_lighting.py` compares the runtime atlas against
the immutable prior-review commit and checks all 30 frame identities/geometry,
exact atlas alpha and increased representative mean RGB. These are objective
pipeline checks, not user style approval or accessibility contrast certification.
Actual runtime four-view/zoom/tablet captures accompany the revised review.
Lighting ID: `rb-lighting-r1`. Status: **Awaiting User Review**. No new roster,
animation, audio, save rule or combat mechanic was introduced.

## Gate 1 role presentation and scoped approval

The user conditionally approved the rb-lighting-r1 visual foundation, detailed in review/USER_VISUAL_APPROVAL.md. Manifest review status records foundation approval only, never full frame/animation acceptance. Original alpha/native geometry remain unchanged.

`assets/source/generate_roles.py` derives three 24×24 screen-space strategic icons from the actual Core, Sentry and Barricade silhouettes, using nearest-neighbor reduction and a friendly corner chevron. `roles.png` is 96×32 with four-pixel transparent gutters; roles.json stores source keys, native bounds and hash. `validate_roles.py` checks count, unique keys, native dimensions, bounds, padding and hash. No external asset/dependency/license is added. Full roster icon audit remains Gate 7. No Rifle/Runner diagnostic alternate view is propagated as finished art.
