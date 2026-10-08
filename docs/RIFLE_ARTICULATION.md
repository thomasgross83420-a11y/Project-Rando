# Rifle Squad articulation — 0.2.12-rifle-joints

The game remains an early development slice. The interface fix made it usable;
it did not finish the roster, campaign, animation families or final visual design.
This increment develops one existing unit in detail before propagating its approach.

The Rifle Squad now uses new native 48×64 raster poses drawn from authored joints.
Steel armor, ochre trim, half-tabard, cyan visor, rifle and backpack follow the
approved Rifle design study. That study is a visual reference, never a pixel input.
The source PNGs and the old atlas are unchanged. The generator, joint landmarks,
compact runtime rig and proof sheet are retained with the source.

Each squad still has one authoritative entity, footprint, health pool and attack
schedule. Its three visible members have separate gait phases. Knees use a
two-segment reach calculation; boots have ground contacts and lifted return poses.
The 40-tick gait matches the existing quantized 2.2001953125 GU/s movement speed,
with 60% stance and 40% swing. Planted sole positions remain stationary at the
authored native keys. Held pixel frames and direction quantization remain visible;
this is not continuous foot-locking or motion capture. Actual 360° ground movement
and swept collisions remain unchanged.

Lower-body direction follows observed displacement. Upper-body direction follows
aim, using an explicit waist split rather than rotating a cut-out torso. When
blocked, gait phase stops; grounded brace poses retain the current foot placement.
Only the member assigned the real attack release recoils and shows the brief
muzzle cue. Releases advance among members; drawing or pausing cannot create
another shot. A projectile retains its release member and heading when its parent
turns. Its cosmetic trace starts at that member's authored weapon socket and ends
at an approximate body-height contact point. Accuracy, swept collision, damage
and contribution remain in the ground simulation. Precise contact sockets on
every target asset are still future individual work.

Idle, moving, brace, aim, attack, hit and six folding/fall poses have eight source
directions. Damage weathering is authored against the actual pose silhouette,
including its independent upper/lower composition. Six individual sole shadows
replace the squad's single floating shadow while alive. Reduced Effects removes
the brief muzzle cue. Placement, its legal/illegal ghost, and combat share the same
Rifle artwork and formation. Battles start framed around the deployed defenders
instead of immediately forcing strategic role icons; full-field fitting remains
available in Tools.

## Verification and references

The seven new unit cases cover stance positions over all headings and two gait
cycles, 256 aim/travel/camera combinations, crop bounds, actual release ownership,
frozen projectile cues, blocking, reduced effects, terminal poses, simulation
immutability and initial viewport fitting. Two focused browser cases exercise
actual Phaser images in preparation and combat, legal/illegal ghosts, all four
camera views, three members, six cropped parts, a single selectable identity,
repeated drawing and pixel-identical camera return.

The raster audit checks 512 upper/lower compositions for disconnected significant
components. The actual Canvas2D damage compositor checks 1,920 pose/band pairs:
zero outside-body pixels, packing mismatches or gutter failures. The new atlas is
103,431 bytes; decoded combat textures total 6,829,056 pixels, about 26.05 MiB RGBA,
an increase of about 4.88 MiB. The prototype guard is eight million pixels; this
fits the blueprint's texture allocation target, but does not measure physical
tablet GPU or frame performance.

See [raster audit](evidence/RIFLE_ART_AUDIT.json),
[runtime damage audit](evidence/POSE_DAMAGE_RUNTIME.json) and
[native proof sheet](../assets/source/combat/studies/rifle-joints-r1-proof.png).
All 150 unit tests in 32 files, deterministic scenario, type/lint/format and
production build checks pass. All 70 browser scenarios are verified with zero
automatic retries: the initial run passed 69, and four explicit follow-ups pass,
including the result-error case after making its waiting logic honor the visible
performance-pause policy. The animation review fixture was also moved outside
Core occlusion so its captured pose is directly visible. Runtime code and the
40-file production build were unchanged during those follow-ups.
See [local evidence](evidence/RIFLE_PRESENTATION_TESTS.json) and
[actual moving-fire capture](evidence/rifle-moving-fire.png).
Public-release evidence is recorded in [public verification](PUBLIC_PREVIEW.md).
The older raw idle-overlay audit still reports 389 discrepancies on remaining
source material. Those records and other units' generic articulation remain open;
passing the runtime compositor is not final natural-motion approval.

Cross-checked against the unchanged blueprint's art workflow, contact/animation,
camera and Rifle asset requirements (§16, §21, §26 and §27). References:

- [Normal gait, PM&R KnowledgeNow](https://now.aapmr.org/biomechanics-normal-gait/)
  and [clinical gait guide](https://pmc.ncbi.nlm.nih.gov/articles/PMC5318488/):
  stance/swing proportions and grounded support inform the game gait; no medical
  or anatomical certification is claimed.
- [Phaser 3.90 TextureCrop](https://docs.phaser.io/api-documentation/3.90.0/namespace/gameobjects-components-texturecrop)
  and [Frame](https://docs.phaser.io/api-documentation/3.90.0/class/textures-frame):
  frame-relative cropping, trim coordinates and stable full-frame origins.
- [MDN imageSmoothingEnabled](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/imageSmoothingEnabled):
  nearest-neighbor sampling preserves native pixel edges.

No new simulation or save version, balance equation, price, attack count or damage
parameter is introduced. Future work includes other assets' own joints, contacts,
actions and visual states; the Engineer's mobile action integration; remaining
progression/results lifecycle; the full roster and campaign; final environment,
UI and audio production; and physical-device acceptance.
