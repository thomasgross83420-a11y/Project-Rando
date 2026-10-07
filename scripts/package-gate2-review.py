from PIL import Image,ImageDraw,ImageFont
from pathlib import Path
import json
import os,html,zipfile
R=Path(__file__).resolve().parents[1];O=Path(os.environ.get('RB_REVIEW_DIR','/workspace/shared/Resonance_Bastion_Gate2'));O.mkdir(parents=True,exist_ok=True);m=json.load(open(R/'public/assets/combat/manifest.json'));fs={f['key']:f for f in m['frames']};atlas=[Image.open(R/'public/assets/combat'/a['file']).convert('RGBA')for a in m['atlases']];font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',16)
def frame(key):
 f=fs[key];x,y,w,h=f['rect'];b=Image.new('RGBA',f['native']);b.alpha_composite(atlas[f['atlas']].crop((x,y,x+w,y+h)),(f['trim'][0],f['trim'][1]));return b
for content in ['friendly.rifle_squad','enemy.runner','enemy.raider','warden.bulwark']:
 states=['idle','move','aim','attack','hit','incapacitated']+(['ability']if content=='warden.bulwark'else[]);sheet=Image.new('RGB',(1280,110+len(states)*240),'#26333c');d=ImageDraw.Draw(sheet);d.text((16,14),content+' | actual runtime native frames | nearest 3x | face NE | rb-lighting-r1 candidates',font=font,fill='white');d.text((16,43),'Four camera rotations use eight projected directions. Fixed foot anchor; no enlarged reference art.',font=font,fill='white')
 for row,state in enumerate(states):
  count={'idle':4,'move':8,'aim':1,'attack':6,'hit':2,'incapacitated':6,'ability':4}[state];y=90+row*240;d.text((12,y),state,font=font,fill='white')
  for i in range(count):
   im=frame(f'{content}.face1.{state}.{i}');s=2 if content=='warden.bulwark'else 3;im=im.resize((im.width*s,im.height*s),Image.Resampling.NEAREST);x=12+i*157;sheet.paste(im,(x,y+25),im);d.text((x,y+222),str(i)+' / '+str(fs[f'{content}.face1.{state}.{i}']['ticks'])+' ticks',font=font,fill='white')
 sheet.save(O/(content+'.png'))
 # actual native movement frames, enlarged nearest; presentation only
 gifs=[]
 for i in range(8):
  b=Image.new('RGBA',(256,256),'#26333c');im=frame(f'{content}.face1.move.{i}');im=im.resize((im.width*3,im.height*3),Image.Resampling.NEAREST);b.alpha_composite(im,((256-im.width)//2,256-im.height));gifs.append(b.convert('RGB'))
 gifs[0].save(O/(content+'.gif'),save_all=True,append_images=gifs[1:],duration=100,loop=0,disposal=2)
sheet=Image.new('RGB',(1640,2050),'#26333c');d=ImageDraw.Draw(sheet);d.text((12,12),'Stationary runtime candidates | nearest 2x | four camera views / Sentry screen-aim faces',font=font,fill='white')
for row,content in enumerate(['objective.harmonic_core','friendly.sentry','friendly.standard_barricade','friendly.repair_node','friendly.proximity_mine']):
 y=50+row*400;d.text((12,y),content,font=font,fill='white')
 for i in range(4):
  key=f'{content}.'+('face'+str(1+i*2)if content=='friendly.sentry'else'view'+str(i))+'.idle.0';im=frame(key);im=im.resize((im.width*2,im.height*2),Image.Resampling.NEAREST);sheet.paste(im,(12+i*405,y+25),im);d.text((12+i*405,y+370),'Camera '+str(i*90)+' degrees',font=font,fill='white')
sheet.save(O/'stationary-views.png')
print('5 sheets and4 native-frame GIFs created outside Git')

sheet=Image.new('RGB',(1600,2440),'#26333c');d=ImageDraw.Draw(sheet)
d.text((16,15),'Mobile direction audit | runtime atlas inspection | nearest 3x | native dimensions preserved',font=font,fill='white')
d.text((16,43),'Viewport/UI: not applicable | projected screen N,NE,E,SE,S,SW,W,NW | default candidate palette',font=font,fill='white')
d.text((16,70),'Idle + attack frame2; fixed foot anchors. Candidate review only; not full-roster approval.',font=font,fill='white')
for row,content in enumerate(['friendly.rifle_squad','enemy.runner','enemy.raider','warden.bulwark']):
 for stateNo,state in enumerate(['idle','attack']):
  y=110+(row*2+stateNo)*285;d.text((16,y),content+' / '+state,font=font,fill='white')
  for facing in range(8):
   im=frame(f'{content}.face{facing}.{state}.{2 if state=="attack" else 0}');im=im.resize((im.width*3,im.height*3),Image.Resampling.NEAREST);x=6+facing*199
   sheet.paste(im,(x,y+26),im);d.text((x+15,y+270),['N','NE','E','SE','S','SW','W','NW'][facing],font=font,fill='white')
sheet.save(O/'mobile-directions.png')
print('All eight directions: actual native atlas frames, no concept substitution')

# Add metadata outside unmodified screenshot pixels, then build a tablet review page.
if (O/'runtime-capture.json').exists():
    captures=json.loads((O/'runtime-capture.json').read_text())['captures']
    for c in captures:
        im=Image.open(O/(c['name']+'.png')).convert('RGB');label=Image.new('RGB',(im.width,im.height+145),'#26333c');label.paste(im,(0,145));d=ImageDraw.Draw(label)
        v=c['viewport'];camera=c['camera'];scale=c['interfaceScale']
        lines=[c['name']+' | Live runtime; native screenshot pixels',f"Viewport {v['width']}x{v['height']} | interface {scale} (18px =100%,36px =200%)",f"Camera {camera.get('orientation','?')} | zoom {camera.get('zoom','?')} | {camera.get('fit','?')}",f"High contrast {c.get('highContrast','?')} | Reduced Effects {c.get('reducedEffects','?')}","Temporary: tutorial-practice notice; unapproved animation/effect candidates"]
        for j,line in enumerate(lines):d.text((12,10+j*26),line,font=font,fill='white')
        label.save(O/(c['name']+'-labeled.png'))
    checklist=['Friendly and hostile silhouettes remain distinct at Fit Base and tactical scale.','Runner remains hostile in motion without hue alone.','Feet, shadows, perspective and aim align in all four camera rotations.','Move, aim, attack, hit and down states read clearly.','Projectiles, impacts, shields and warnings are visible without hiding bodies.','Default and high-contrast cues work against terrain.','Reduced Effects retains essential information.','Tablet interface remains comfortable at normal and200% scale.','Title, preparation and combat feel like one game.','Music and SFX fit the game; levels, loops and captions are comfortable.','Name any candidate needing correction before roster propagation.']
    cards=[]
    for c in captures:cards.append(f"<figure><figcaption>{html.escape(c['name'])}: live runtime</figcaption><a href='{c['name']}-labeled.png'><img loading='lazy' src='{c['name']}-labeled.png' alt='{html.escape(c['name'])} with actual viewport, camera and presentation metadata'></a></figure>")
    for name in ['mobile-directions','stationary-views','friendly.rifle_squad','enemy.runner','enemy.raider','warden.bulwark']:cards.append(f"<figure><figcaption>{name}: actual atlas inspection, nearest enlargement; viewport and UI not applicable</figcaption><a href='{name}.png'><img loading='lazy' src='{name}.png' alt='{name} native runtime animation contact sheet'></a></figure>")
    for name in ['friendly.rifle_squad','enemy.runner','enemy.raider','warden.bulwark']:cards.append(f"<figure><figcaption>{name}: actual eight-frame locomotion; atlas inspection, nearest3x; viewport/UI not applicable</figcaption><a href='{name}.gif'>Open the actual locomotion GIF (animation)</a></figure>")
    tracks=json.loads((R/'public/assets/audio/manifest.json').read_text())['tracks'];audioDir=O/'audio';audioDir.mkdir(exist_ok=True)
    import shutil
    for t in tracks:
        shutil.copyfile(R/'public/assets/audio'/t['file'],audioDir/t['file']);cards.append(f"<figure><figcaption>{t['key']} | original runtime PCM16,16000Hz,mono | {t['duration']}s</figcaption><audio controls preload='none' src='audio/{t['file']}'>Audio unavailable; download the WAV.</audio><p><a href='audio/{t['file']}'>Download WAV</a></p></figure>")
    page="""<!doctype html><html lang='en'><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'><title>Resonance Bastion Gate2 candidate review</title><style>body{margin:0 auto;padding:1rem;max-width:900px;background:#172831;color:#f1f5f6;font:18px/1.5 system-ui}a{color:#a4f2ed}img{display:block;max-width:100%;height:auto;image-rendering:pixelated}figure{margin:2rem 0;border:2px solid #647b88;padding:.5rem}figcaption{font-weight:bold}label{display:block;padding:.65rem}input{min-width:24px;min-height:24px}audio{max-width:100%}:focus-visible{outline:3px solid #ffc66c}</style><h1>Gate2 tutorial candidate review</h1><p>Awaiting User Review. The foundation approval remains conditional. These are real production-runtime screenshots, native atlas frames and original runtime audio, not promotional concepts.</p><p>This review package is not a playable deployment or proof of Android/offline compatibility. It changes no approval records. Screenshots retain original pixels; labels occupy added margins. Temporary tutorial notices and candidate limitations remain visible.</p><h2>Review checklist</h2>"""
    page+=''.join(f"<label><input type='checkbox'> {html.escape(item)}</label>" for item in checklist)+''.join(cards)+"</html>"
    (O/'index.html').write_text(page)
    with zipfile.ZipFile(O.parent/(O.name+'.zip'),'w',zipfile.ZIP_DEFLATED)as z:
        for path in sorted(O.rglob('*')):
            if path.is_file():z.write(path,path.relative_to(O))
    print('Native metadata labels, review page, original audio and ZIP created outside Git; Awaiting User Review')
