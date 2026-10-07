# Supported backup/recovery contract — build 0.2.3

Authority: unchanged blueprint §§19,19A,25C,26D and the user's mobile-only setup.
This implements recovery for the current foundation campaign and tutorial practice.
Ordinary paid-run journals, injury/progression receipts and their presentation are
not yet implemented; no campaign payout or whole Gate 3 completion is claimed.

## Format and validation

`resonance-bastion-backup`, envelope schema 1, canonical SHA-256 over the payload
without checksum. Selected campaigns include current ownership/layout/wallet,
previous snapshot, lineage fence, retained practice plan/army/result and monotonic
practice sequence. Global settings are optional, never applied by default.

Verify the original supplied payload before normalizing UUID case. Normalize
UUIDs across campaign/owned/checkpoint/fence references and reject alias duplicates.
All supported schema/content/version and geometry/investment checks run on an
isolated copy before writes. Future/unknown retained logical journal keys block
backup/recovery instead of silently omitting them. Unsupported campaign shapes
remain untouched. Old `resonance-foundation-backup-v1` exports are supported with
an explicit warning: no corruption checksum, checkpoint or settings included.

Input is ≤32 MiB UTF-8, nesting≤32, bounded parser nodes≤1,000,000. The parser
preserves duplicate-key evidence (including escaped aliases), rejects prototype
keys, malformed/unsafe numeric domains and unsupported collections. A supported
indispensable slot must fit 8 MiB; maximum-shaped three-slot current/previous
bundles with 1024 assets and 4096 generated fence hashes per lineage roundtrip.
Checksums detect corruption; they are not anti-cheat authentication.

## Atomic replacement and rollback

Inspect current/previous/checkpoint/sequence/fences in one consistent transaction.
Confirmation captures the full preview; inside one write transaction recheck
writer generation and all three slots' logical state. Reject changed previews,
conflicting retained practice and duplicate source/destination or campaign copies.
Hashes/derived validation finish before opening the write transaction. No unrelated
await, timer or network request runs inside it. Report Saved only on completion.

Imports replace selected wallets/ownership, never add them. Unselected slots are
preserved. An occupied destination retains its pre-import current as Previous;
an empty destination retains the incoming previous snapshot. Local revision
advances to max(local,imported)+1 and checkpoint base revision is updated without
changing the pinned plan/army identity. Sequence counters retain their maximum.

Same-lineage fences retain maximum allocated/finalized watermarks and the union
of finite claims, including both current and previous imported fence values.
Overflowing bounded claim unions fail before writing rather than dropping fences.
Fence state is outside Preparation Undo/Redo; restoring a wallet cannot reset it.
These are tested prerequisites for future paid receipts, not evidence that those
receipts already exist. Normal results will still require two-step journaling,
idempotent application, abandoned-sequence handling and body/XP invariants.

Restore Previous has a specific before/after wallet/revision preview and export
option. Earlier foundation snapshots lack stored timestamps; the UI identifies
revisions instead of inventing dates. Retained practice must be resolved first.
Deletion requires an explicit campaign/slot preview and confirmation; it preserves
other slots and global settings. Unsupported/corrupt snapshots remain retained
for compatible-version/manual recovery, not silently overwritten or deleted.

## Mobile interface and honest status

Data Management is available at Title and Preparation. Selected/all-slot exports
can download, feature-detected file-share, or expose copyable text. Prepare bytes
before the Share gesture to preserve transient activation. Read File size before
text allocation; pasted JSON follows the same UTF-8 cap and validation path.
Download/share success means bytes offered, not proof of a durable external copy.

Save Now flushes pending presentation settings, checks committed campaigns/writer
and probes retained storage. Temporary Session makes no Saved claim. Request
Persistent Storage reports the browser's actual grant/estimate with external
backup advice; no guarantee or offline-readiness claim is inferred. Imports
apply optional global settings only after the player selects that checkbox and
the same transaction commits.

Source references checked on 2026-10-07:

- [MDN IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB):
  request success differs from transaction completion; combine replacement writes;
  do not rely on unload for persistence. Browser/OS eviction remains separate.
- [MDN Blob size](https://developer.mozilla.org/en-US/docs/Web/API/Blob/size):
  file size is measured in bytes, before reading the complete text.
- [MDN SHA-256 digest](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/digest):
  canonical UTF-8 payload bytes are hashed with the supported Web Crypto API.
- [MDN Web Share](https://developer.mozilla.org/en-US/docs/Web/API/Web_Share_API):
  feature detection and a real button gesture gate file sharing.

Desktop tests cannot certify Android's native file picker/share sheet, retention,
TalkBack or Lenovo thermal/frame pacing. Those remain physical-device acceptance.
