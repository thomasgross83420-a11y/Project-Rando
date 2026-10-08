"""Validate complete first-pass native art/audio packaging independently of rendering."""
import json,hashlib
from pathlib import Path
from PIL import Image
root=Path(__file__).resolve().parents[1];folder=root/'public/assets/full'
manifest=json.loads((folder/'manifest.json').read_text());runtime=json.loads((folder/'runtime.json').read_text())
assert manifest['original'] is True
sizes={};decoded={}
for atlas in manifest['atlases']:
 path=folder/atlas['file'];assert hashlib.sha256(path.read_bytes()).hexdigest()==atlas['sha256']
 with Image.open(path) as im:assert im.size==(atlas['width'],atlas['height']);assert im.mode=='RGBA';sizes[atlas['file']]=im.size
 decoded[atlas['group']]=decoded.get(atlas['group'],0)+atlas['width']*atlas['height']*4
keys=set()
for frame in manifest['frames']:
 assert frame['key'] not in keys;keys.add(frame['key']);x,y,w,h=frame['rect'];aw,ah=sizes[frame['file']];assert 0<=x and 0<=y and w>0 and h>0 and x+w<=aw and y+h<=ah
 assert len(frame['pivot'])==2
assert len(keys)==30848
for group,dirs in runtime['clips'].items():
 assert len(dirs) in (4,8),group
 assert all(len(poses)==(4 if group.startswith('weapons|') else 36) for poses in dirs),group
 assert all(0<=index<len(runtime['images']) for poses in dirs for index in poses)
for frame in runtime['images']:
 x,y,w,h=frame['rect'];aw,ah=sizes[frame['file']];assert x+w<=aw and y+h<=ah
music=json.loads((folder/'audio/manifest.json').read_text());assert music['original'];assert len(music['tracks'])==10
for track in music['tracks']:
 path=folder/'audio'/track['file'];assert path.read_bytes()[:4]==b'OggS';assert hashlib.sha256(path.read_bytes()).hexdigest()==track['sha256']
 assert track['duration']>0
index=json.loads((root/'public/content/full/index.json').read_text());assert len(index['files'])==260
for file,sha in index['files'].items():
 plan=json.loads((root/'public/content/full'/file).read_text());assert plan['hash']==sha and 'following' in plan
report={'semanticFrames':len(keys),'nativeImages':len(runtime['images']),'atlases':len(sizes),'decodedBytesByGroup':decoded,'musicTracks':len(music['tracks']),'audioBytes':sum((folder/'audio'/t['file']).stat().st_size for t in music['tracks']),'authoredPlans':len(index['files'])}
print(json.dumps(report,indent=2))
(root/'docs/analysis').mkdir(exist_ok=True);(root/'docs/analysis/full-content-audit.json').write_text(json.dumps(report,indent=2)+'\n')
