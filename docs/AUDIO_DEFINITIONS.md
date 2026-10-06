# Original audio production definitions

Status: Designed; no silent key or empty file counts as audio. Gate 0 verifies
interaction-based Web Audio unlock/mute only. Gate 2 must introduce real original
music/SFX and their reproducible definitions before being marked complete.

Blueprint §§17/17A owns cue roster, arrangement, duration, mixing/voices, captions,
pause offsets, crossfades and encoding tests. Future definitions live in
`assets/source/audio/` and generated optimized runtime encodings in `public/assets/`.
Original score/synthesis must be independent of all simulation streams. No uploaded
music, runtime service, sampled external soundtrack or audio-derived gameplay.
Validate duration, loop seam, clipping, gain, decoding, voice bounds, muted-state
hash equivalence and corresponding captions in the real browser.
