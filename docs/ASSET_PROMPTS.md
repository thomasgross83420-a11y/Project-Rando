# Reusable original visual-development prompts

These are development inputs, never runtime generation. Blueprint §16 remains the
style authority. Prompts produced candidates; inspector/processing/user review
are required before approval.

## Six-design reference

Original Resonance Bastion late-16-bit/early-32-bit rich raster pixels. Basalt,
worn matte steel, brass/ochre trim, restrained cyan/teal emitters. Upper-left light,
selective outlines, 2:1 isometric ground, entire isolated objects, no typography,
no franchise references, no missing limbs or merged geometry. Transparent 3×2
sheet: crystal Harmonic Core with four buttresses; compact single-barrel Sentry;
one armored Standard Barricade; three individual Rifle troopers; articulated
crystalline Runner; Bulwark with broad shield and arm carbine. Match native proof
bounds after cleanup: Core fragment192², tower128×144, barrier64², individual
Rifle/Runner48×64, Bulwark64×80. Reference stored in foundation-reference.png.

## Four-camera candidate

Edit the original six-design reference; retain its materials, silhouettes and
upper-left screen lighting. Transparent 4-column/3-row sheet with aligned entire
objects and generous gaps. Row1 same Core four quarter-turn cameras0/90/180/270;
row2 same Sentry with one world-east barrel projecting down-right/down-left/up-left/
up-right; row3 same one-cell Barricade four views. 2:1 orthographic ground, no glow
outside body, no labels or background. Opaque body, transparent surrounding pixels.
Reference stored in camera-reference.png. Generated grid is not trusted: inspected
row boundaries are encoded in the reproducible processor.

Future animation must use an approved stable body rig rather than independent
uncontrolled frame generations. Preserve anatomy, foot pivot and equipment.

## Gate 1 brighter-lighting revision r1

Reusable edit prompt for `camera-reference.png`: Keep the same 4-column,
3-row Core/Sentry/Barricade grid, camera views, complete silhouettes and materials.
Make the existing late-16-bit/early-32-bit raster pixel art noticeably less dark:
lighter slate/silver metal midtones, brighter warm brass, strong upper-left light
and ambient fill on shadowed faces. Reveal existing joints, stairs, barrel rings
and armor planes with crisp pixel clusters. Preserve dark selective outlines,
contact shadows, perspective and equipment. No blur, smoothing, bloom, typography,
new objects, new roster or background. Use transparent surroundings.

The inspected original edit is retained as `lighting-reference-r1.png`, SHA256
`b967003a0bc6eb1c3f0d96efeebf032042170c1b65ff420bfd093a527678d4db`.
It is guidance, not a finished atlas: small generated edge/layout differences
were not imported into runtime geometry. `lighting-r1.json` plus the reproducible
processor instead applies controlled RGB lighting to the existing native sprites.
This preserves exact alpha/anchors and exposes existing detail. Foundation is conditionally approved as recorded in review/USER_VISUAL_APPROVAL.md; this prompt never approves all new animation/roster candidates.

## Gate2 eight-facing production-candidate reference recipe

Retain rb-lighting-r1 bright science-fantasy raster language, steel/bronze/slate and cyan accents, upper-left light, crisp clusters, selective dark outline and transparent surroundings. Four rows/eight columns, whole aligned figures with generous margins; screen N/NE/E/SE/S/SW/W/NW. Row1 one light armored Rifle trooper with one rifle (three members compose one runtime squad); row2 jointed hostile crystalline Runner insect, preserve cyan crystalline body and angular legs; row3 Fracture Raider with heavy melee arm/equipment; row4 Bulwark with broad shield and arm carbine. Same equipment/proportions/foot placement in every direction. No typography, smooth concept painting, baked ground or missing limbs. Retained source facing-reference.png is inspected original output; native cleanup/rig, not the prompt alone, is the reproducible asset.

Sentry facing recipe: single-barrel bronze/steel Sentry, square symmetric ground plinth, all eight screen gun bearings, transparent isolated cells, unchanged bright upper-left light/detail. Inspect the generated grid; select only correct whole poses. Curated sentry-facing.png retains eight accepted processing inputs; failed raw rows are not runtime assets or a claimed32-view final set.

RepairNode/Mine recipe: transparent two-row/four-camera sheet, bright bronze/steel stationary wrench/repair machine and small low disc ProximityMine. Four quarter-turn 2:1 camera views, whole bodies/feet, no text/glow/background. Uneven generated rows are explicitly bounded by inspected crop boxes in generate_combat.py, never blindly sliced as a uniform runtime atlas.

These are reusable production recipes. Exact generated source bytes/hashes and controlled scripts identify the actual reproducible input; further art acceptance must use native atlas and real combat. Model/version is unavailable, and no deterministic regeneration of imagegen output is promised.

## 2026-10-07 Rifle keypose research

A four-key contact/down/passing/up guide was generated from the existing Rifle
reference, preserved unchanged, and remains outside runtime atlases. See
[source provenance](../assets/source/combat/studies/provenance.md). It still needs
aligned eight-frame/eight-direction authoring, equipment and contact scrutiny,
and actual combat review. The earlier repeated-pose study was rejected.
