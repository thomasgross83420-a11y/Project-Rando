# Gate 1 brighter-lighting review r1

**Awaiting User Review.** This responds to the user's request for less darkness,
better lighting, visible material detail and clear definition. It supplements
[the prior review checkpoint](GATE1_VISUAL_REVIEW.md), which is retained as the
baseline. No Gate 2 work or mass roster production has started.

Authority: unchanged blueprint §16/T17 and user feedback. Decision VIS001 in
DESIGN_DECISIONS.md. Presentation version rb-lighting-r1; unchanged content,
simulation, generator, economy and save-schema identities. No migration needed.

## What changed

- Brighter native sprite RGB midtones expose existing armor, metal joints and
  trim; deepest outlines/contact shadows remain dark. No topology or extra
  animation detail is fabricated.
- Basalt receives a separate lighter cool ramp; the field background and unowned
  ground tint also lighten. Steel, brass and teal identity is retained.
- Meaningful world boundaries and placement footprints receive a dark backing
  behind the existing colored outline so the brighter terrain does not wash out
  their edge. Existing textual validity reasons remain available.
- The actual title raster is rebuilt from the same lit runtime candidates.

The original generated source references are preserved. A new inspected original
lighting guide is retained with its reusable prompt, but its geometry is not used
as runtime art. Native grid, alpha silhouettes, dimensions, anchors, packing,
frame IDs, camera/state keys and gameplay rules remain unchanged.

## Review delivery and reproduction

The revised package contains 23 actual production-runtime captures, ten labeled
contact sheets, the tablet-friendly gallery, exact settings and a checklist.
Sheet 10 compares prior and revised tactical/close views at identical viewport,
UI scale, camera, zoom and native screenshot dimensions. Packaging never resamples
screenshots; runtime atlas enlargements use integer nearest-neighbor only.

1. `python assets/source/generate_foundation.py`
2. `python assets/source/validate_foundation.py`
3. `python assets/source/validate_lighting.py`
4. `npm run build`
5. Start `npm run preview` separately on port4173.
6. `node scripts/capture-visual-review.mjs /absolute/new-review-directory`
7. `python scripts/package-visual-review.py /absolute/new-review-directory /absolute/prior-review-directory`

The prior directory is optional; when provided, packaging checks comparable
settings before building sheet10. Each directory receives its own named ZIP,
so the prior review stays intact. All generated review artifacts remain outside
Git. The runtime source, original references and reproducible tools are tracked.

## Review checklist

- [ ] Is the brighter lighting comfortable and are steel/brass details clear?
- [ ] Do silhouettes stand apart from terrain at tactical and current Fit zoom?
- [ ] Are pixel detail, perspective, shadows and all four views consistent?
- [ ] Can you distinguish friendlies, enemies, structures and placement states?
- [ ] Does the scene retain height/depth without overlays obscuring the artwork?
- [ ] Are title and battlefield coherent, with readable terrain and tablet UI?
- [ ] Which representative asset/view needs revision before full-roster production?

The complete original thirteen-item checklist remains in the gallery. Reply with
approval or requested revisions in the conversation; no test approves the art.

## Evidence and remaining acceptance

See [GATE1_LIGHTING_R1_EVIDENCE.json](GATE1_LIGHTING_R1_EVIDENCE.json) and
TEST_EVIDENCE.md for commands, runtime/build identity and objective results.
Masked RGB increases and unchanged geometry do not establish artistic acceptance,
full contrast conformance or Android performance. Actual composited outline pixels
are inspected separately from raw atlas colors.

Gate 1 remains in progress: user/physical-tablet review, terrain transitions,
strategic role icons, full representative facing/state coverage, Fit Base, final
landscape reflow, exact navigation/wizard/inspector foundations, durable settings
and outstanding touch/keyboard/accessibility/recovery acceptance remain open.
Static samples are not combatants; motion, attacks, damage/wrecks, health bars,
range overlays, route lines and high-contrast mode remain unimplemented and are
explicitly identified in the package. No deployment or offline readiness is
verified. Physical Android/TalkBack/GPU/storage checks remain Needs Device Check.

The read-only Actions administration403 finding is unchanged; see HOSTING.md.
No forbidden endpoint was retried and no repository/hosting policy was changed.
The next action is user evaluation or another requested Gate 1 visual revision.
