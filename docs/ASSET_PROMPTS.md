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
This preserves exact alpha/anchors and exposes existing detail. Candidate status
remains Awaiting User Review; this prompt is not approval to propagate the style.
