# Test evidence

No gate is certified by this file until its measured entries are recorded.

2026-10-06 repository inspection: clean main, initial f4cb0e8, one README, no project
configuration or applicable AGENTS.md. Node 24.19.0/npm 11.9.0/Chromium
151.0.7922.173 and ffmpeg 7.1.5 are available. Python has Pillow/NumPy/SciPy.
GitHub API: public, has_pages=false; Pages GET 404; Actions permissions GET 403
Resource not accessible by integration. User plan field unavailable; compatibility
is evaluated under the user's stated GitHub Free constraint and public visibility.

Blueprint read in full before planning/editing. SHA-256:
9808229593b79b856f8f522dcffba591debe6334a3f60a61d1915cdd5e2900a6.

## Gate 0 — passed automated environment smoke, 2026-10-06

Commands: npm install --ignore-scripts --no-fund --no-audit; npm run format;
npm run typecheck; npm run lint; npm run test; npm run test:scenario;
npm run build; npm run test:browser; npm run traceability.
3 unit tests and 4 production-browser tests passed in Chromium 151.0.7922.173.
Headless 3600-tick fixture matched group sizes 1/2/4/8/12 with SHA-256
90a7d118d4df7eb3e8808e78d7ffa875ddd970ab4961287daf1a719426936169.
This is a mechanism fixture, not implemented combat determinism.

Browser inspected: subpath shell; centered touch at rotated/zoomed view; retained
transaction completion; abort error and injected failed-open fallback; user-gesture
audio unlock and mute; actual WEBGL_lose_context loss/restoration; download; refresh;
four specified viewports plus 320-wide DOM at 200% text; keyboard focus; cancellation;
JS/CSS MIME. Console page errors: none in first integrated fixture.
Initial 200% reflow failed on long heading; wrapping fix reran and passed.
Native Node type-stripping rejected parameter properties in the headless fixture;
explicit fields fixed it. Desktop screenshot inspected; not physical Android.
Production JS 1,217,433 bytes / 336,200 gzip, CSS ~1.24k. No game art/audio yet.
Offline remains unadvertised. Hosting blocker is administration settings access;
public visibility is compatible with Free Pages. Prepared manual-only workflow
uses official action commit pins/licenses verified through GitHub refs/license APIs.
