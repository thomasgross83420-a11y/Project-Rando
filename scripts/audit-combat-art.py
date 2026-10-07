"""Inspect native runtime art; report defects without certifying anatomy or taste.

Reads pixels only. Does not edit reference images, generated sprites or atlases.
--strict exits nonzero while pose-overlay clipping defects remain unresolved.
"""
from collections import Counter
from pathlib import Path
import argparse
import hashlib
import json
from PIL import Image

root = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--output', default=str(root / 'docs/evidence/ANIMATION_AUDIT.json'))
parser.add_argument('--strict', action='store_true')
args = parser.parse_args()
m = json.loads((root / 'public/assets/combat/manifest.json').read_text())
atlas = [Image.open(root / 'public/assets/combat' / a['file']).convert('RGBA') for a in m['atlases']]
for image, record in zip(atlas, m['atlases']):
    assert list(image.size) == record['size']
    assert hashlib.sha256((root / 'public/assets/combat' / record['file']).read_bytes()).hexdigest() == record['sha256']
lookup = {f['key']: f for f in m['frames']}
assert len(lookup) == len(m['frames'])
groups = {}
coverage = {}
cache = {}

def alpha_points(frame):
    key = (frame['atlas'], *frame['rect'], *frame['trim'][:2])
    if key not in cache:
        x, y, w, h = frame['rect']
        tx, ty = frame['trim'][:2]
        mask = atlas[frame['atlas']].crop((x, y, x + w, y + h)).getchannel('A')
        cache[key] = {(xx + tx, yy + ty) for yy in range(h) for xx in range(w) if mask.getpixel((xx, yy))}
    return cache[key]

for f in m['frames']:
    w, h = f['native']
    ax, ay = f['anchor']
    assert 0 <= ax < w and 0 <= ay < h
    assert all(0 <= x < w and 0 <= y < h for x, y in alpha_points(f))
    prefix = f['key'].rsplit('.', 1)[0]
    groups.setdefault(prefix, []).append(f)
    role = coverage.setdefault(f['content'], {'poses': set(), 'states': set(), 'frames': 0})
    role['poses'].add(f['key'].rsplit('.', 2)[0])
    role['states'].add(f['state'])
    role['frames'] += 1
for prefix, frames in groups.items():
    frames.sort(key=lambda f: f['frame'])
    assert [f['frame'] for f in frames] == list(range(len(frames)))
    assert all(type(f['ticks']) is int and f['ticks'] > 0 for f in frames)

failures = []
checked = 0
for f in m['frames']:
    if f['state'] not in {'move', 'attack', 'ability', 'hit', 'channel'}:
        continue
    prefix = f['key'].rsplit('.', 2)[0]
    for band in ['scuffed', 'damaged']:
        overlay = lookup.get(prefix + '.' + band + '.0')
        if overlay:
            checked += 1
            assert overlay['native'] == f['native'] and overlay['anchor'] == f['anchor']
            detached = alpha_points(overlay) - alpha_points(f)
            if detached:
                failures.append({'frame': f['key'], 'band': band, 'outsideBodyPixels': len(detached)})

for role in coverage.values():
    role['poses'] = sorted(role['poses'])
    role['states'] = sorted(role['states'])
report = {
    'date': '2026-10-07',
    'scope': 'Gate2 native art structural and pose-overlay audit; no creative approval',
    'atlasVersion': m['version'],
    'structuralChecks': {'result': 'passed', 'frames': len(m['frames']), 'sequences': len(groups),
                         'checks': ['atlas hashes/dimensions', 'unique IDs', 'native bounds/anchors',
                                    'dense frame order', 'positive integer timings']},
    'coverage': coverage,
    'effectDurations': {kind: sum(f['ticks'] for f in groups['fx.' + kind]) for kind in ['impact', 'explosion', 'shield']},
    'damageOverlayAlignment': {
        'result': 'failed' if failures else 'passed', 'poseBandPairsChecked': checked,
        'mismatchedPairs': len(failures),
        'worstOutsidePixels': max((f['outsideBodyPixels'] for f in failures), default=0),
        'affectedContent': dict(sorted(Counter(f['frame'].rsplit('.', 3)[0] for f in failures).items())),
        'samples': sorted(failures, key=lambda f: (-f['outsideBodyPixels'], f['frame'], f['band']))[:20],
        'meaning': 'Damage overlays authored on idle silhouettes extend beyond some animated poses; correct attachment/clipping before final acceptance.',
    },
    'manualReviewRequired': [
        'Anatomy, articulated joints, armor/equipment continuity and natural stride/contact',
        'Per-facing muzzle/tool/contact sockets and authoritative action/anticipation/recovery alignment',
        'Cast-to-release continuity, support channel phase and terminal pose quality',
        'All supported zoom/rotations, team identity and reduced/high-contrast behavior in actual combat',
        'Physical Lenovo Tab M10 FHD Plus motion/input/performance and listening',
    ],
    'acceptance': 'Current candidates remain Awaiting User Review. Structural passes are not natural-motion certification.',
}
path = Path(args.output)
path.parent.mkdir(parents=True, exist_ok=True)
path.write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps({'structuralFrames': len(m['frames']), 'sequences': len(groups),
                  'overlayPairs': checked, 'overlayFailures': len(failures), 'output': str(path)}))
if args.strict and failures:
    raise SystemExit(1)
