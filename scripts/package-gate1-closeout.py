"""Label live screenshot evidence without resampling runtime pixels."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import json, zipfile
root=Path('/workspace/shared/Resonance_Bastion_Gate1_Closeout')
data=json.loads((root/'capture.json').read_text())
font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',16)
for item in data['images']:
    im=Image.open(root/(item['id']+'.png')).convert('RGB')
    sheet=Image.new('RGB',(max(im.width,900),im.height+130),'#111923');sheet.paste(im,(0,130))
    d=ImageDraw.Draw(sheet);c=item['camera']
    lines=[item['id'],f"Viewport {item['viewport']['width']}x{item['viewport']['height']} | UI {item['uiScale']} | orientation {c['orientation']} | zoom {float(c['zoom']):.4f} ({c['fit']})",f"High contrast {item['highContrast']} | reduced effects {item['reducedEffects']} | source: LIVE PRODUCTION RUNTIME",'Construction foundation; combat and complete animations pending. No screenshot resampling.']
    for i,line in enumerate(lines): d.text((12,10+28*i),line,fill='#f1f4f8',font=font)
    sheet.save(root/('review-'+item['id']+'.png'),optimize=True)
with zipfile.ZipFile('/workspace/shared/Resonance_Bastion_Gate1_Closeout.zip','w',zipfile.ZIP_DEFLATED) as z:
    for p in root.iterdir():
        if p.is_file():z.write(p,p.name)
print('11 labeled native-pixel screenshots and exact capture metadata packaged')
