# Resonance Bastion — player-experience design corrections

2026-10-21 · applies to 0.4.0-player-experience

The original Final blueprint remains the historical specification. This addendum records the reviewed corrections and implementation decisions for this release. It takes precedence for the items below. The player authorized design and blueprint improvements; no new approval is required for these corrections.

## Design pillars

- Preparation is the player's tactical decision phase. Combat remains autonomous, with continuous ground movement in every direction. Camera rotation never changes combat geometry.
- The battlefield retains a real viewport above or beside menus. The next objective and a short attack briefing lead the ordinary player journey. Detailed statistics, all campaign stages and advanced modes remain available on request.
- A purchase preview has no economic effect. A successful Place command buys and deploys atomically. Cancellation and camera gestures cannot spend Credits.
- Recovery must explain an exact cost and preserve ownership. It must never create a free upgrade or pay the same battle twice.

## Controls and information

Menus have a caller-aware Back control. Native inputs and buttons own their keyboard events. One Space press on a focused Pause button must toggle once. Touch uses an eight-pixel movement threshold, one-finger pan, midpoint pinch zoom and explicit placement confirmation. Map zoom buttons and precise cell controls provide alternatives to gestures. A selected moving asset can receive a reviewed rally point through the field; precise coordinates use the same reachability check.

New-game customization, later unit unlocks, complete campaign navigation, audio settings, abilities, spacing and target policies use progressive disclosure. Essential Start, Place and Apply controls remain readily reachable. At 200% text, controls reflow and the field accounts for the actual menu-bar height.

## Direction contract

Simulation heading zero is world north and increases clockwise. Preparation headings use the same conversion as combat. Source sprite facings run counterclockwise from east; their camera-relative selection is `round((1/4 - heading/65536 - cameraView/4) * facings)` modulo facings. Four-facing static clips must span the full circle. Warning sectors use north/clockwise geometry too.

The quarter-wave heading table is lossless compression of the original 65,536 vectors. All original vectors remain a test fixture. Safe-integer distance and bearing fast paths must preserve the original integer decisions; deterministic reference checks remain mandatory.

## Movement, formations and recovery

Navigation connects the real starting point, rather than assuming its grid center is clear. It connects an exact destination from a clear route node, avoiding an exhaustive search for a nonexistent grid center within a small arrival tolerance. Cached clearance depends on body radius and obstacle geometry. Every actual step still checks physical clearance.

Bulwark formations move ahead of support toward their objective; they must not pull the support group backward forever. Menders follow at a radial distance behind the front, with legal boundary coordinates. A failed formation adjustment can fall back to advancing.

After 90 seconds without health, population or meaningful movement progress, and without an imminent scheduled event, the run enters a diagnostic pause. Movement progress requires at least 0.15 ground units toward the current goal within the two-second observation window. The player can restart the captured checkpoint or explicitly withdraw. The diagnostic never invents enemy damage, a victory, a defeat or rewards. Browser lifecycle interruptions pause presentation and simulation; no wall-clock absence is converted into combat progress.

The reviewed guided arrangement handles additional tower columns and additional squad rows. It resolves overlaps, preserves the Warden pad, uses integer anchors and places compatible high-output towers near the disclosed approach. It must fit actual command capacity and owned terrain. It never grants money or units. Manual deployments remain the player's choices.

## Mechanics and economy corrections

- Endurance's automatic boss must be eligible for the declared encounter band, even when a higher-ranked army chooses that band. Blocks 3 and 6 remain boss blocks.
- Incendiary Vent triggers only on a known ground contact inside its placed forward sector. Rotation zero faces north, then east, south and west. One cone activation applies its Burn once to each recipient; repeated cone pulses do not extend it repeatedly.
- Gravity Snare skips root-immune candidates and can select another valid contact without wasting a charge.
- Proximity Mine has one charge. Heavy Squad and Gravity Snare can affect the layers specified in their catalog. Short role descriptions must match those facts.
- Full-force restoration quotes and commits Core repair, wreck revival followed by the remaining healing, and finite stock. Individual wreck repair still restores half body at its listed revival price; full restoration includes the additional healing price.
- Practice preserves a stored selected Warden. Choosing a different owned Warden in the practice configuration may deploy that replacement on the reserved pad. The clone never silently adds the same stored Warden to the current deployed force.

No baseline damage, hit rate, health, progression threshold, purchase price or reward multiplier was adjusted to manufacture favorable test results. Balance evaluation uses legal purchases, deployment, support and declared difficulty.

## Compatibility and acceptance

Existing schema and browser database names remain unchanged. Captured plans and owned assets are retained. Interrupted runs and Archive battles execute with the current corrected runtime; they are not a promise to reproduce an old implementation's exact combat events.

An automated terminal defeat is a valid regression-test outcome, not evidence that the selected force was well balanced or that a stage was cleared. Seeded full-roster stress tests and natural-progression purchase tests must be reported separately. Physical Lenovo frame rate, touch comfort and long-term player enjoyment require actual-device and player review.

## Research and comparisons

- [Microsoft XAG 109: objective clarity](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/109): accessible current objectives and progress informed the persistent next-action card and chapter progress.
- [Nielsen Norman Group: progressive disclosure](https://www.nngroup.com/articles/progressive-disclosure/): essential choices first, specialist controls on request; applied to creation, builds, campaign, tactics and settings.
- [Game Accessibility Guidelines: interactive tutorials](https://gameaccessibilityguidelines.com/include-interactive-tutorials/): contextual practice informed the short optional Field Guide and Try it actions.
- [Google Android: touch target size](https://support.google.com/accessibility/android/answer/7101858?hl=en): informed the 48 CSS-pixel control floor and spacing checks. CSS pixels are an implementation proxy, not a physical Android dp measurement.
- [W3C: alternatives to dragging](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html): informed map zoom, precise placement and coordinate alternatives. This is not a claim of full WCAG certification.
- [Riot Games: User Interface Design](https://www.riotgames.com/en/artedu/user-interface-design): informed cohesion, legibility and access to critical information when needed.
- [Subset Games: Into the Breach Design Postmortem](https://media.gdcvault.com/gdc2019/presentations/Into%20the%20Breach%20Postmortem%20Final.pdf), especially pages 7, 27–36 and 42–46: compared limited menus, readable threats, interface-guided decisions and clear rewards. Resonance Bastion retains its autonomous, continuous-motion combat and existing resource systems.
- [web.dev: optimize long tasks](https://web.dev/articles/optimize-long-tasks): informed navigation caching, less startup parsing and yielding between fixed simulation ticks. A single long tick remains a profiling concern; splitting functions alone does not yield.
- [Riot Games: building a game's substance](https://www.riotgames.com/en/r-and-d-office/prototype-building-a-games-substance): informs the distinction between implementation checks and evidence that players enjoy the game. Technical checks cannot establish a universal fun score.
