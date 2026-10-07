"""Original silhouette icons: Gate1 foundation and Gate2 coherent slice only."""
from pathlib import Path
from PIL import Image,ImageDraw
import json,hashlib
root=Path(__file__).resolve().parents[2]
m=json.loads((root/'public/assets/foundation.json').read_text());a=Image.open(root/'public/assets/foundation.png').convert('RGBA')
c=json.loads((root/'public/assets/combat/manifest.json').read_text());atlases=[Image.open(root/'public/assets/combat'/r['file']).convert('RGBA') for r in c['atlases']]
def body(key,source):
 if source=='foundation':f=next(f for f in m['frames'] if f['key']==key+'.view0');im=a
 else:
  f=next(f for f in c['frames'] if f['content']==key and f['state']=='idle' and f['frame']==0);im=atlases[f['atlas']]
 x,y,w,h=f['rect'];p=im.crop((x,y,x+w,y+h));return p.crop(p.getbbox()),f['key']
items=[('objective.harmonic_core','Core','foundation'),('friendly.sentry','Tower','foundation'),('friendly.standard_barricade','Barrier','foundation'),('friendly.rifle_squad','Mobile','combat'),('warden.bulwark','Warden','combat'),('friendly.repair_node','Support','combat'),('friendly.proximity_mine','Trap','combat'),('enemy.runner','Hostile Runner','combat'),('enemy.raider','Hostile Raider','combat')]
out=Image.new('RGBA',(32*len(items),32));frames=[]
for i,(key,label,source) in enumerate(items):
 p,frame=body(key,source);size=(max(1,round(p.width*22/max(p.size))),max(1,round(p.height*22/max(p.size))));p=p.resize(size,Image.Resampling.NEAREST)
 icon=Image.new('RGBA',(24,24));icon.alpha_composite(p,((24-p.width)//2,23-p.height));d=ImageDraw.Draw(icon)
 if key.startswith('enemy.'):d.polygon([(20,16),(23,20),(20,23),(17,20)],fill='#111923',outline='#ffc266');d.line([(19,19),(21,21)],fill='#ffffff');d.line([(21,19),(19,21)],fill='#ffffff')
 else:d.line([(1,20),(3,23),(5,20)],fill='#b8eee0',width=1)
 out.alpha_composite(icon,(4+32*i,4));frames.append({'key':key,'role':label,'rect':[4+32*i,4,24,24],'native':[24,24],'source':frame,'status':'Conditional foundation / Gate2 production candidate; full roster audit pending'})
out.save(root/'public/assets/roles.png',optimize=True)
(root/'public/assets/roles.json').write_text(json.dumps({'schema':1,'lighting':'rb-lighting-r1','source':'assets/source/generate_roles.py','padding':4,'frames':frames,'sha256':hashlib.sha256((root/'public/assets/roles.png').read_bytes()).hexdigest()},indent=2)+'\n')
print('Nine actual silhouette roles; hostile diamond/cross versus friendly chevron; no hue-only identity')
