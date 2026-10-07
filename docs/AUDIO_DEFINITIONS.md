# Original audio production definitions

Authority: blueprint §§17/17A/21; T17. Implemented initial Gate2 subset, not the complete soundtrack.

Rebuild: `python assets/source/combat/generate_audio.py`. Editable original score: `assets/source/combat/score.json`; synthesis, envelopes, instruments and deterministic cosmetic noise seeds are in the generator. Python standard library only; no external samples, uploaded music, runtime service or gameplay RNG.

Three original96-second/32-bar80-BPM cues: Title, Preparation and Fracture. Eight-chord progression, four melody phrases, pad/bass/bell/lead layers, bounded percussion and section dynamics. Gate7 retains the complete eight-cue roster, arrangement/encoding/listening audit. Thirteen usable SFX/UI/alert files plus two result stingers complete18 files. All are PCM16 mono16000-Hz WAV; runtime manifest stores exact hashes, duration, source, peak/RMS and loop boundary metrics. Source total9,531,672 bytes; music loads lazily, two simultaneous music sources with1.5-second crossfades. Decoded buffers remain bounded by the manifest; stale music buffers evict when unused. No silent placeholders count as implemented.

Native WebAudio context unlocks on NewGame/Continue/Begin/EnableSound gestures; failure leaves gameplay/captions usable. Master/Music/SFX/UI/Alerts default70/35/65/50/75, each0–100. Mute sets master gain0 and never enters simulation. Dynamics compressor limits mix peaks;24 SFX/eight shot caps; identical shots80ms real-time minimum; critical alerts outrank gunshots. Context suspension preserves music offset; resume uses normal1× playback at every combat speed. Captions/history carry important alerts.

Offline validation: all18 hashes/PCM formats, nonzero RMS, peak<0.9, zero endpoint discontinuity and96-second loops pass. Native Chromium fixture `scripts/check-audio.mjs` decoded18/18, gesture unlock, suspended time, gain0.40, muted gain0, loop96s/rate1,24/8 voice caps passed. Production tutorial also exercises actual audio. Two real tutorial runs with enabled and muted music produce identical terminal hashes. No subjective listening or physical Android output quality is claimed from these technical checks; both remain required review.

Official primary sources inspected2026-10-06: https://www.w3.org/TR/webaudio/ (full-file decodeAudioData, context state and source timing); https://docs.python.org/3/library/wave.html (uncompressed PCM writer). Both HTTP200; actual APIs were smoke-tested in the pinned environment. API documentation does not prove this game's sound quality or device reliability.
