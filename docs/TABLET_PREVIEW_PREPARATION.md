# Prepared playable tablet preview

The target device is now identified. Real touch/GPU/audio/background and backup
measurements require opening the game on that tablet, on a stable secure origin.
Review PDF/ZIP downloads are not executable public game hosting.

Candidate delivery remains the user's public, Free-compatible Project-Rando
GitHub Pages site. The prepared manual-only workflow in
[pages-preview.yml.example](pages-preview.yml.example) checks out the locally
tested0.2.9 source commit rather than main's original README. Its exact source
SHA is present in that file. It runs `npm ci` and `npm run verify`, then uploads
only static dist and deploys with pinned official actions, a standard Ubuntu
runner, 15-minute job limits, one-day artifact retention and no automatic
push/PR trigger. No custom domain, paid runner, cache, LFS or new service is used.

## Authorized publication — 2026-10-08

The user approved publishing this development checkpoint. The reviewed workflow
is now installed on `main` by [PR 12](https://github.com/thomasgross83420-a11y/Project-Rando/pull/12),
merged as `cf738b2e381d68a652d8aa7ae681e0e48f1324c9`. That merge adds only
`.github/workflows/tablet-preview.yml`; it does not merge the development stack.
GitHub reports the workflow active (ID `378139552`).

The authorized `POST /repos/thomasgross83420-a11y/Project-Rando/pages` with
`build_type=workflow` returned HTTP 403, `Resource not accessible by integration`.
The integration can install the workflow but cannot enable Pages. The remaining
owner action is [repository Pages settings](https://github.com/thomasgross83420-a11y/Project-Rando/settings/pages)
→ Build and deployment → Source → GitHub Actions. This is a configuration
prerequisite, not a new publication-approval request. Workflow dispatch and live
verification follow once that setting is confirmed.

The pinned `actions/configure-pages` action documents that automatic enablement
requires a token other than `GITHUB_TOKEN`, with the relevant administrative and
Pages permissions. Its default `enablement: false` is retained; no credential is
requested and the forbidden Pages creation operation is not retried.

The previously forbidden Actions-administration endpoint is not retried.
Its403 does not establish an account-plan limitation or whether Actions is
enabled. Actual workflow dispatch/settings may need their own permissions;
do not claim successful publication until the deployment completes and its
real HTTPS URL, MIME, subpath refresh and save-origin behavior are checked.

Expected path after successful publication: `/Project-Rando/`. No playable URL
is currently certified. Origin changes cannot silently move existing saves;
use complete checksummed backup/import when moving between origins.

## First tablet pass after publication

Open the verified URL in the reported Chrome154. Check portrait/landscape,
camera/pinch and touch cancellation; play the known practice fixture at1×,
then2×/4× with the existing overload pause; compare motion/contact/readability.
Test pause/audio, background-return with no absence progress, interrupted
checkpoint restart and Android backup download/reimport. Capture actual runtime
and resource timing separately from player observations. Never report a desktop
throttle as the tablet GPU or count these checks passed before observations.

The public preview is an explicitly labeled development slice, not approval
of all assets, finished balance, TalkBack, offline play or full release.
