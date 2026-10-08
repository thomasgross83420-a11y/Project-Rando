from pathlib import Path
from PIL import Image
import json,hashlib,wave,math
R=Path(__file__).resolve().parents[3];m=json.loads((R/'public/assets/combat/manifest.json').read_text());atlases=[]
for a in m['atlases']:
 p=R/'public/assets/combat'/a['file'];assert hashlib.sha256(p.read_bytes()).hexdigest()==a['sha256'];im=Image.open(p).convert('RGBA');assert list(im.size)==a['size'];assert max(im.size)<=2048;atlases.append(im)
assert sum(a.width*a.height for a in atlases)+1048576+288*32<=8000000
keys=set();rectangles={}
for f in m['frames']:
 assert f['key'] not in keys;keys.add(f['key']);a=f['atlas'];x,y,w,h=f['rect'];im=atlases[a];assert 4<=x and 4<=y and x+w+4<=im.width and y+h+4<=im.height
 assert f['anchor'][0]<f['native'][0] and f['anchor'][1]<f['native'][1];assert f['ticks']>0
 if (a,x,y,w,h)not in rectangles:
  for xx in range(x-4,x+w+4):
   for yy in range(y-4,y+h+4):
    if not(x<=xx<x+w and y<=yy<y+h):assert im.getpixel((xx,yy))[3]==0
  rectangles[(a,x,y,w,h)]=True
for content in ['friendly.rifle_squad','enemy.runner','enemy.raider','warden.bulwark']:
 for facing in range(8):
  idle=next(f for f in m['frames'] if f['key']==content+'.face'+str(facing)+'.idle.0')
  if content!='friendly.rifle_squad':assert idle['trim'][3]==idle['anchor'][1], 'Idle silhouette must meet its fixed ground anchor'
  else:assert idle['anchor']==[24,51] and idle['native']==[48,64], 'Rifle uses an authored ground-center anchor, not the lowest of two depth-separated soles'
  for state,count in [('idle',4),('move',8),('aim',1),('attack',6),('hit',2),('incapacitated',6)]:
   assert len([f for f in m['frames']if f['content']==content and f['facing']==facing and f['state']==state])==count
au=json.loads((R/'public/assets/audio/manifest.json').read_text())
for record in au['tracks']:
 p=R/'public/assets/audio'/record['file'];assert hashlib.sha256(p.read_bytes()).hexdigest()==record['sha256']
 with wave.open(str(p),'rb') as w:assert w.getframerate()==16000 and w.getsampwidth()==2 and w.getnchannels()==1;assert abs(w.getnframes()/16000-record['duration'])<.001
 assert 0<record['peak']<.9 and record['loopJump']==0 and record['rms']>0
 assert not record['key'].startswith('music.') or record['duration']>=90
print(json.dumps({'frames':len(keys),'uniqueRects':len(rectangles),'loadedTexturePixels':sum(a.width*a.height for a in atlases)+1048576+288*32,'audio':len(au['tracks']),'music':[r['duration'] for r in au['tracks'] if r['key'].startswith('music.')],'guttersAnchorsDirectionsTimingsHashes':'pass'}))
