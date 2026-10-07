# Current review delivery — 2026-10-07

User-requested review files are preserved on `codex/project-recovery` so they
remain available from mobile even if this conversation is archived.

- [Download/read the PDF](https://raw.githubusercontent.com/thomasgross83420-a11y/Project-Rando/codex/project-recovery/docs/review/Resonance_Bastion_Current_Review.pdf)
  — 19 pages, approximately 3 MB; status, next step, feedback prompts, ten
  actual runtime screenshots, six atlas sheets and eighteen audio links.
- [Download the complete ZIP](https://raw.githubusercontent.com/thomasgross83420-a11y/Project-Rando/codex/project-recovery/docs/review/Resonance_Bastion_Current_Review.zip)
  — approximately 21 MB; PDF/text report, gallery, screenshots, animation sheets,
  four movement GIFs, eighteen original WAV files, 51-second live-combat MP4,
  raw capture metadata and a file/checksum inventory.
- [Read the report as text](CURRENT_REVIEW.md).

The PDF is static; the ZIP supplies motion and audio. The video records the
actual production-preview flow and approximately 45 seconds of 1x tutorial
combat, including Runner and Raider deployment, without injected combat state.
Its H.264 MP4 is 800x1280 and has no recorded system audio; WAVs are separate.
Source WebM and disposable recording intermediates remain outside Git.
Android local-HTML opening is unverified; PDF and individual media are the fallback.
No public playable deployment is claimed by downloadable review files.

The gameplay checkpoint is still `6d6c8e2`, application `0.2.0-tutorial`;
packaging started from recovery/reference checkpoint `18868fa`. This delivery
adds review artifacts and reproducible tooling, not Gate 3 gameplay or new
creative approval. Independent campaign-persistence work is dependency-ready;
new combat candidates remain Awaiting User Review before roster propagation.

## Reproduction and checks

Reuse the verified Gate 2 capture directory, or recreate it with the tracked
Gate 2 capture, audio and package tools. With production preview running on4173,
`node scripts/capture-review-motion.mjs` records the live WebM/metadata. Playwright's
pinned FFmpeg helper is required (`npx playwright install ffmpeg`). Convert the
WebM with system FFmpeg H.264/yuv420p/faststart, then run
`python3 scripts/package-current-review.py`. `RB_REVIEW_DIR` and `RB_DELIVERY_DIR`
select input/output directories; defaults use `/workspace/shared`. ReportLab4.4.9
(installed package metadata: BSD license) creates the PDF; this is documentation
tooling, not a browser/runtime dependency. No npm dependency or lockfile changed.

Actual checks: new capture script format/lint and Python syntax pass; the live
capture has41samples through tick2697 and no application errors. PDF parsing
reports19pages/16embedded images/18links; first and final pages were rendered
and inspected. ZIP CRC and every inventoried size/SHA256 pass, including all18
original audio hashes and four GIFs. The local gallery still loads16images/18audio
controls, keyboard input and both layouts with no overflow/application errors.
MP4 codec/dimensions/duration were inspected and an actual frame was reviewed.
The existing29unit/19production-browser game checks from this session remain
the gameplay evidence; they were not repeated for document/media packaging.

PDF SHA-256: `2a2646145e7a9d94085d6926d10ae3423b77edf2e920818f4c5c1fa395ee9df6`.
ZIP SHA-256: `fd2b57bc1ca353914a01ea6e8e29de809ba5e0f8034b1529c80f9999077e9159`.

Physical Android performance/touch/storage/OS interruptions/TalkBack, subjective
audio/style approval, full-roster completeness, deployment and offline readiness
remain separate acceptance work. No additional gameplay rule clarification is
needed to begin the receipt/persistence slice already specified by the blueprint.

Latest follow-up: [build0.2.2 refinement PDF/video/ZIP](REFINEMENT_DELIVERY.md). This earlier full package remains the0.2.0 snapshot.
