"""Read-only native-pixel/connectivity audit; never modifies artwork."""
import hashlib
import json
import subprocess
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / 'public/assets/combat'
manifest = json.loads((ASSETS / 'manifest.json').read_text())
rig = json.loads((ASSETS / 'rifle-rig.json').read_text())
frames = {f['key']: f for f in manifest['frames']}
atlases = [Image.open(ASSETS / a['file']).convert('RGBA') for a in manifest['atlases']]


def native(key):
    f = frames[key]
    x, y, w, h = f['rect']
    im = Image.new('RGBA', tuple(f['native']))
    im.paste(atlases[f['atlas']].crop((x, y, x+w, y+h)), tuple(f['trim']))
    return im


def components(im):
    occupied = {(x, y) for y in range(im.height) for x in range(im.width)
                if im.getpixel((x, y))[3]}
    sizes = []
    while occupied:
        todo = [occupied.pop()]
        size = 0
        while todo:
            x, y = todo.pop()
            size += 1
            for dx in (-1, 0, 1):
                for dy in (-1, 0, 1):
                    p = (x+dx, y+dy)
                    if p in occupied:
                        occupied.remove(p)
                        todo.append(p)
        if size > 2:
            sizes.append(size)
    return len(sizes)


bad, maximum = [], 0
for key in rig['frameKeys']:
    bounds = native(key).getbbox()
    assert bounds and bounds[0] >= 1 and bounds[1] >= 1 and bounds[2] <= 47 and bounds[3] <= 63, key
for aim in range(8):
    upper_key = f'friendly.rifle_squad.face{aim}.attack.0'
    upper = native(upper_key)
    split = rig['frameKeys'][upper_key]['splitY']
    for travel in range(8):
        for phase in range(8):
            lower = native(f'friendly.rifle_squad.face{travel}.move.{phase}')
            # Measurement canvas only; no source pixels/files are changed.
            composition = Image.new('RGBA', upper.size)
            composition.paste(upper.crop((0, 0, 48, split)), (0, 0))
            composition.paste(lower.crop((0, split, 48, 64)), (0, split))
            count = components(composition)
            maximum = max(maximum, count)
            if count != 1:
                bad.append([aim, travel, phase, count])
previous = json.loads(subprocess.check_output([
    'git', 'show', '23754abc513320b4d25b5bcaae23ca4a8b6315de:public/assets/combat/manifest.json'
], cwd=ROOT))
non_rifle = lambda data: [f for f in data['frames'] if f['content'] != 'friendly.rifle_squad']
assert non_rifle(previous) == non_rifle(manifest), 'Other frame records changed'
original_hash = hashlib.sha256((ASSETS / 'atlas0.png').read_bytes()).hexdigest()
assert original_hash == 'f010a3d68c6ea2b244e7b9f6d5346b6506ba90c6660b7a5ff8103fa5f64e44fb'
assert not bad, bad
new = ASSETS / 'rifle-joints-r1.png'
report = {
    'date': '2026-10-08', 'rigPoses': len(rig['frameKeys']),
    'compositeAimTravelPhaseCases': 512, 'maximumSignificantComponents': maximum,
    'disconnectedCases': bad, 'otherFrameRecordsUnchanged': True,
    'originalAtlasUnchanged': True, 'originalAtlasSHA256': original_hash,
    'newAtlas': {'file': new.name, 'size': list(Image.open(new).size),
                 'sha256': hashlib.sha256(new.read_bytes()).hexdigest(), 'bytes': new.stat().st_size},
    'review': 'Raster connectivity and per-pose weathering validation, not final creative or tablet acceptance'
}
(ROOT / 'docs/evidence/RIFLE_ART_AUDIT.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps(report))
