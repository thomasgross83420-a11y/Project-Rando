"""Verify the Gate 1 lighting revision preserves the reviewed runtime geometry.
Uses the immutable prior review checkpoint, not a reconstructed mockup.
"""
from pathlib import Path
from PIL import Image
from io import BytesIO
import hashlib, json, subprocess

root = Path(__file__).resolve().parents[2]
baseline = 'c2e4b17f2b3af71489598a04d2b707ba29b796fd'
def before(path):
    return subprocess.check_output(['git', 'show', f'{baseline}:{path}'], cwd=root)

old = json.loads(before('public/assets/foundation.json'))
new = json.loads((root/'public/assets/foundation.json').read_bytes())
old_atlas = Image.open(BytesIO(before('public/assets/foundation.png'))).convert('RGBA')
new_atlas = Image.open(root/'public/assets/foundation.png').convert('RGBA')
assert old_atlas.size == new_atlas.size == (1024, 1024)
assert old_atlas.getchannel('A').tobytes() == new_atlas.getchannel('A').tobytes(), 'Alpha/silhouette changed'
fields = ('key', 'rect', 'native', 'anchor', 'cameraView', 'state')
assert [[f[k] for k in fields] for f in old['frames']] == [[f[k] for k in fields] for f in new['frames']], 'Frame identity/geometry changed'
assert len(new['frames']) == 30
assert new['lighting']['id'] == 'rb-lighting-r1'
measurements = []
for key in ('objective.harmonic_core.view0', 'friendly.sentry.view0', 'friendly.rifle_squad.view0', 'enemy.runner.view0', 'friendly.standard_barricade.view0', 'terrain.basalt'):
    f = next(f for f in new['frames'] if f['key'] == key)
    x, y, w, h = f['rect']
    def mean_rgb(im):
        pixels = [p for p in im.crop((x,y,x+w,y+h)).get_flattened_data() if p[3] > 0]
        return [round(sum(p[c] for p in pixels)/len(pixels), 2) for c in range(3)]
    a, b = mean_rgb(old_atlas), mean_rgb(new_atlas)
    assert all(after > prior for prior, after in zip(a,b)), f'{key} did not brighten'
    measurements.append({'key': key, 'beforeMeanRGB': a, 'afterMeanRGB': b})
print(json.dumps({'baseline': baseline, 'lighting': new['lighting']['id'], 'frames': 30,
    'geometryAndAlphaUnchanged': True, 'atlasSHA256': new['sha256'],
    'referenceSHA256': hashlib.sha256((root/'assets/source/lighting-reference-r1.png').read_bytes()).hexdigest(),
    'measurements': measurements,
    'limits': 'Pixel preservation and brightness measurements are not user approval, contrast certification or Android performance evidence.'}, indent=2))
