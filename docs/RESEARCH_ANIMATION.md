# Animation and firing-route research — 2026-10-07

Primary references were read and cross-referenced with the actual implementation;
they informed specific choices, rather than being treated as proof of quality.

- [Phaser textures](https://docs.phaser.io/phaser/concepts/textures): Canvas textures
  and frame registration support a shared, precomputed overlay atlas. The game
  uploads the completed atlas once, rather than updating a texture per unit/frame.
- [Phaser masks](https://docs.phaser.io/api-documentation/3.90.0/namespace/gameobjects-components-mask):
  renderer-specific masking constraints informed baking the pose/body intersection
  before upload instead of attaching a per-unit bitmap-mask dependency.
- [MDN Canvas compositing](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/globalCompositeOperation):
  destination-in intersects transformed damage material with the posed body's
  alpha. Independent pixel checks verify the resulting atlas, anchors and gutters.
- [Disney Animation process](https://www.disneyanimation.com/process/animation/):
  timing, anticipation, staging and follow-through inform the acceptance matrix.
  Correct frame timing alone does not establish believable anatomy or weight.
- [Archived Blender stride documentation](https://archive.blender.org/wiki/2015/index.php/Doc%3A2.4/Manual/Animation/Techs/Armatures/Stride/):
  distance/cycle relationships and planted-foot concepts informed presentation-only
  gait progress from actual displacement. This is a conceptual reference, not a
  recommendation to use an old Blender version or proof of planted contacts.
- [Blender motion paths](https://docs.blender.org/manual/en/latest/animation/motion_paths.html):
  trajectory inspection informed measuring actual enemy routes before changing
  the guided Mine placement. The runtime does not depend on Blender.

Local authority remains the unchanged blueprint, especially §§16,21,24,27. Its
kinetic projectile radius of 0.05 GU was compared with collision sweeps: an
unobstructed zero-width ray can still clip cover with a finite-size projectile.
A reproducible corner fixture established the defect; v2 firing routes require
projectile clearance and finish alignment inside the selected firing cell.

No research reference certifies the generic source rig, whole-game balance,
physical-tablet frame pacing or accessibility. These remain measured acceptance
work. Numeric weapon/HP/speed/economy tuning was not changed.
