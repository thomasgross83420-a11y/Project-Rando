"""Gate1 role icons from conditionally approved original runtime silhouettes.
Nearest-neighbor cleanup, no new roster or inferred animation approval.
"""
from pathlib import Path
from PIL import Image,ImageDraw
import json,hashlib
root=Path(__file__).resolve().parents[2]
m=json.loads((root/'public/assets/foundation.json').read_text())
a=Image.open(root/'public/assets/foundation.png').convert('RGBA')
out=Image.new('RGBA',(96,32));frames=[]
for i,(key,label) in enumerate([('objective.harmonic_core','Core'),('friendly.sentry','Tower'),('friendly.standard_barricade','Barrier')]):
    f=next(f for f in m['frames'] if f['key']==key+'.view0');x,y,w,h=f['rect'];body=a.crop((x,y,x+w,y+h));body=body.crop(body.getbbox())
    size=(max(1,round(body.width*22/max(body.size))),max(1,round(body.height*22/max(body.size))))
    body=body.resize(size,Image.Resampling.NEAREST)
    icon=Image.new('RGBA',(24,24));icon.alpha_composite(body,((24-body.width)//2,23-body.height))
    # Preserve recognizable equipment and a discrete friendly chevron below it.
    d=ImageDraw.Draw(icon);d.line([(2,21),(2,23),(5,23)],fill='#b8eee0',width=1)
    out.alpha_composite(icon,(4+32*i,4))
    frames.append({'key':key,'role':label,'rect':[4+32*i,4,24,24],'native':[24,24],'source':f['key'],'status':'Gate1 strategic candidate; conditional foundation approval, full roster audit pending'})
out.save(root/'public/assets/roles.png',optimize=True)
(root/'public/assets/roles.json').write_text(json.dumps({'schema':1,'lighting':'rb-lighting-r1','source':'assets/source/generate_roles.py','padding':4,'frames':frames,'sha256':hashlib.sha256((root/'public/assets/roles.png').read_bytes()).hexdigest()},indent=2)+'\n')
print('Three 24px original silhouette role icons; nearest-neighbor; 4px gutters')
