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
