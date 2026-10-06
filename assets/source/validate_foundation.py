"""Structural validation, not visual approval. Run from any working directory."""
from PIL import Image
from pathlib import Path
import json,hashlib
root=Path(__file__).resolve().parents[2]
m=json.loads((root/'public/assets/foundation.json').read_text())
path=root/'public/assets/foundation.png'
im=Image.open(path);a=im.getchannel('A')
assert len(set(f['key']for f in m['frames']))==len(m['frames'])
for f in m['frames']:
    assert f['cameraView'] in range(4)
    x,y,w,h=f['rect'];assert x>=4 and y>=4 and x+w+4<=im.width and y+h+4<=im.height
    assert [w,h]==f['native'] and 0<=f['anchor'][0]<w and 0<=f['anchor'][1]<h
    for box in [(x-4,y-4,x,y+h+4),(x+w,y-4,x+w+4,y+h+4),(x,y-4,x+w,y),(x,y+h,x+w,y+h+4)]:assert a.crop(box).getbbox()is None,(f['key'],box)
assert len(set(im.convert('RGB').get_flattened_data()))<=128
assert hashlib.sha256(path.read_bytes()).hexdigest()==m['sha256']
print(f"Atlas: {len(m['frames'])} frames; all gutters transparent; anchors/palette/hash valid")
