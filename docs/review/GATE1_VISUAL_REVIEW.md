# Gate 1 visual-review checkpoint

**Awaiting User Review.** Gate 1 remains in progress. Gate 2 and mass roster
production are paused. Authority: unchanged blueprint §§5, 15, 16, 18, 26; T06,
T14, T16 and T17. Candidate assets are not approved by structural tests or by
this package's existence.

## Review delivery and reproduction

The standalone review ZIP contains nine labeled contact sheets, the individual
production-runtime captures, a tablet-friendly HTML index, exact capture
metadata, known limitations and a checklist. Screenshots and the generated
package are delivered as session artifacts, not committed as disposable builds.

Use the pinned dependencies already installed for this project; no new dependency,
account, hosting service, asset generation or audio generation is needed:

1. `npm run build`
2. Start `npm run preview` in another terminal (port 4173).
3. `node scripts/capture-visual-review.mjs /absolute/output/directory`
4. `python scripts/package-visual-review.py /absolute/output/directory`

The output directory must be outside Git. The capture uses the actual static
production build at `/Project-Rando/`, Chromium with touch enabled, device scale
factor 1, primary portrait 800×1280 and landscape 1280×800 CSS pixels. World
crops and full screenshots are never resampled; native atlas frames are enlarged
by integer nearest-neighbor only. Contact sheets retain original pixels. Browser
or image-viewer fitting can still affect their apparent scale; open the original
PNG to inspect pixels.

The capture tool observes the exported production WorldView's camera/label bounds
without changing authoritative state. One clearly identified comparison adds
Rifle/Runner *static Image objects* to the real production scene using the same
atlas, projection, anchors and scale. They never enter the campaign, route
validation, entity population or save. This fixture proves how the current art
looks together; it does not prove those units are implemented. All other gameplay
captures use normal campaign controls and legal durable Sentry/Barricade placement.

## Views and honest coverage

| Contact sheet | Content |
| --- | --- |
| 01 | Primary tablet Title and Preparation, normal interface scale |
| 02 | Four camera orientations, central native-pixel crops |
| 03 | Current Fit field, tactical and close; exact runtime zoom in labels |
| 04 | Actual-scale live-renderer comparison; enlarged runtime atlas frames, terrain and Bulwark candidate |
| 05 | Selected move preview, valid/invalid footprint, route/price/capacity text, disabled inventory actions |
| 06 | 100% versus actual 200% interface setting, primary tablet |
| 07 | Landscape normal/200%; current stacked layout and scrolling |
| 08 | Actual accessibility controls, reduced effects and keyboard controls |
| 09 | Four static atlas views and explicitly missing animation-state coverage |

Every panel names viewport, UI scale, camera, exact zoom/category, implemented
presentation mode, runtime/atlas source and known temporary elements. Atlas
inspection correctly says viewport/UI N/A. Native frame sizes and foot anchors
are included. No enlarged concept art substitutes for a runtime sprite.

The current Fit control fits the full field; a distinct Fit Base preset and
approved strategic role icons are missing. Landscape renders, but the final
sidebar/details reflow is missing. High-contrast mode is not implemented. Current
200% and reduced-effects settings are real session controls; no animated effects
exist to suppress yet. There is no damage/wreck/disabled-battle art, movement or
attack sequence, world health-bar system, range overlay or visual route-path
system to photograph. Route validity/exact invalid reasons are readable in text.
Candidate contact shadows and sprite outlines are baked in the existing art.
Disabled inventory buttons mean unfinished deployment, not incapacitated bodies.

## Objective corrections

- Before correction, overview Core/Sentry/Barricade nameplates overlapped each
  other and their sprite bounds. Names now occupy clear screen space after all
  body bounds are known. A crowded caption is suppressed rather than obscuring
  art; the named DOM inventory and overlap picker remain available.
- The selection marker now has a transparent center with a contrasting outline,
  avoiding the prior solid six-pixel dot covering its ground point.
- Reproduction: at landscape 1280×800, Return to Title changed the canvas from
  1174×438 to 0×0 and raised `Framebuffer status: Incomplete Attachment`.
  Hidden-container resize now retains the last nonzero renderer dimensions;
  visible layout triggers the next resize normally. No save, camera input or
  simulation rule is changed.

No sprite, palette, pivot, source reference, atlas, native dimension, content ID,
blueprint text, progression tuning or save schema was changed. No new art style,
quality setting, gameplay state or player-facing debug control was introduced.

## User checklist

- [ ] Overall artistic direction and title/battlefield coherence.
- [ ] Pixel detail level at real gameplay scale and enlarged inspection.
- [ ] Perspective and lighting consistency in all four camera views.
- [ ] Silhouette readability for Core, Sentry, Rifle, Runner and Barricade.
- [ ] Color/contrast; distinguish friendly, hostile, structure and placement states.
- [ ] Terrain detail, boundaries, reservations and ground readability.
- [ ] Dimensionality: does the scene have believable height and depth?
- [ ] Important-object readability in the current Fit overview.
- [ ] Tablet text/button comfort at 100% and 200%, portrait and landscape.
- [ ] Any artwork obscured by labels, selection, footprint or other overlays.
- [ ] Any asset or camera view that should change before style propagation.

Review is a creative checkpoint. Report requested revisions or explicit approval
in the conversation; no checkbox, test or tool automatically grants approval.

## Remaining acceptance

T17 user/physical-tablet style proof, required terrain transitions, approved
strategic role icons, complete representative facing/state manifests and relevant
visual acceptance remain open. Navigation/wizard/inspector details, Fit Base,
final landscape reflow, durable preferences and remaining T06/T08/T14/T16
input/accessibility/recovery checks remain tracked in TASKS.md. Full device GPU,
touch, Android download/storage, TalkBack and performance checks are Needs Device
Check. Desktop touch emulation does not certify them. This package is not a
public deployment, a complete game, offline proof or final art acceptance.

The next step is user review and any requested representative-art revisions,
then dependency-ordered Gate 1 acceptance. Do not start Gate 2 from this checkpoint.

## Verified checkpoint evidence

Objective corrections: `4a50d436832b280b52fb1dfc0a8ee6990db9a583`, pushed to
`codex/resonance-foundation`. Eight unit tests, eleven browser tests, typecheck,
lint, formatting, production build, unchanged headless mechanism hash and
30-frame atlas validation passed. The final runtime capture recorded 23 images,
no application/HTTP errors, all-four-view caption/body nonoverlap, actual 200%
reflow at both tablet viewports plus 320px, keyboard focus and durable reload of
Sentry/Barricade with 600 Credits and capacity2/20. Capture timing/framing was
inspected and corrected before delivery; no source sprite was modified.

The 800×1280 review-gallery browser check loaded all PNGs, nine sheets and thirteen
checklist controls with no horizontal overflow or console/HTTP errors. Browser
file navigation is blocked by this managed environment's policy; the gallery was
checked through a local loopback static server instead. Neither result certifies
Android file handling, public hosting or the game's offline behavior.

Exact image settings and known driver warnings are recorded in
[GATE1_CAPTURE_EVIDENCE.json](GATE1_CAPTURE_EVIDENCE.json). Runtime atlas SHA256
remains `97f540bb3102c0a0e31a8d4c5c37f574c64496761c64bd922de8399a91059de3`.
The unchanged blueprint SHA256 remains
`9808229593b79b856f8f522dcffba591debe6334a3f60a61d1915cdd5e2900a6`.
No dependencies or licenses changed. Generated review artifacts are approximately
4.7MB zipped and are excluded from Git; reproducible tooling and concise evidence
are retained. See HOSTING.md for the read-only administration-403 diagnosis.
