"""Gate1 strategic silhouette atlas bounds, gutters and hash acceptance."""
from pathlib import Path
from PIL import Image
import json,hashlib
r=Path(__file__).resolve().parents[2];m=json.loads((r/'public/assets/roles.json').read_text());im=Image.open(r/'public/assets/roles.png').convert('RGBA');assert len(m['frames'])==3
keys=set()
for f in m['frames']:
 x,y,w,h=f['rect'];assert [w,h]==[24,24];assert f['key'] not in keys;keys.add(f['key'])
 for px in range(x-4,x+w+4):
  for py in range(y-4,y+h+4):
   if not(x<=px<x+w and y<=py<y+h):assert im.getpixel((px,py))[3]==0
assert hashlib.sha256((r/'public/assets/roles.png').read_bytes()).hexdigest()==m['sha256']
print('Role atlas:3 unique native24px frames,4px transparent gutters,hash valid')
