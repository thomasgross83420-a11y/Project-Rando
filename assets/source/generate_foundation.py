"""Original Gate 1 native raster cleanup and composition. Rebuild: python assets/source/generate_foundation.py.
Pillow 12.3.0 MIT-CMU; no external artwork. Original generated references supply
static candidate crops; lighting-r1 reference guides RGB changes only.
Nearest-neighbor only. Anchors and atlas margins are machine-validated.
"""
from PIL import Image, ImageDraw
from pathlib import Path
import json, hashlib
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'public/assets'; OUT.mkdir(parents=True,exist_ok=True)
P={'ink':'#0d1721','shadow':'#17232e','dark':'#25343e','stone':'#384954','face':'#53636a','light':'#89968f','edge':'#d4d5bd','gold':'#b18a52','goldlight':'#e1bf7b','teal':'#40baa8','cyan':'#b8eee0','rust':'#765548'}
LIGHTING=json.loads((ROOT/'assets/source/lighting-r1.json').read_text())
frames=[]; images=[]
def polygon(d,points,color):d.polygon(points,fill=P.get(color,color))
def box(d,cx,cy,w,h,z):
    pts=[(cx,cy-h),(cx+w,cy),(cx,cy+h),(cx-w,cy)]
    polygon(d,[(cx-w,cy),(cx,cy+h),(cx,cy+h-z),(cx-w,cy-z)],'dark')
    polygon(d,[(cx,cy+h),(cx+w,cy),(cx+w,cy-z),(cx,cy+h-z)],'stone')
    top=[(x,y-z)for x,y in pts];polygon(d,top,'face');d.line(top+[top[0]],fill=P['light'],width=1)
    d.line([(cx-w,cy-z),(cx-w,cy),(cx,cy+h),(cx+w,cy),(cx+w,cy-z)],fill=P['ink'],width=2)
    for x in range(cx-w+4,cx,8):d.point((x,cy-z+(x-(cx-w))//2),fill=P['edge'])
def soldier(d,x,y,view,bulwark=False,runner=False):
    if runner:
        for dx in [-13,-7,8,14]:
            d.line([(x,y-23),(x+dx,y-13),(x+dx*2//3,y)],fill=P['ink'],width=4)
            d.line([(x,y-23),(x+dx,y-13),(x+dx*2//3,y)],fill=P['face'],width=2)
        polygon(d,[(x-9,y-30),(x-3,y-44),(x+4,y-28),(x+1,y-14)],'teal')
        polygon(d,[(x-3,y-44),(x+1,y-14),(x+4,y-28)],'cyan')
        polygon(d,[(x+5,y-23),(x+15,y-36),(x+12,y-17),(x+4,y-12)],'teal')
        d.line([(x-3,y-43),(x-8,y-30),(x-1,y-21)],fill=P['cyan']);return
    wide=7 if bulwark else 5
    for dx in [-wide//2,wide//2+2]:
        d.rectangle((x+dx-2,y-14,x+dx+2,y-3),fill=P['dark'],outline=P['ink'])
        d.rectangle((x+dx-3,y-4,x+dx+3,y),fill=P['stone'],outline=P['ink']);d.line([(x+dx-2,y-3),(x+dx+2,y-3)],fill=P['gold'])
    polygon(d,[(x-wide-2,y-29),(x+wide+2,y-29),(x+wide,y-13),(x,y-10),(x-wide,y-13)],'ink')
    polygon(d,[(x-wide,y-28),(x+wide,y-28),(x+wide-1,y-15),(x,y-12),(x-wide+1,y-15)],'stone')
    d.rectangle((x-2,y-26,x+2,y-14),fill=P['gold']);d.line([(x-1,y-25),(x-1,y-17)],fill=P['goldlight'])
    d.ellipse((x-wide-1,y-38,x+wide+1,y-27),fill=P['ink']);d.ellipse((x-wide,y-38,x+wide,y-28),fill=P['face'])
    direction=[1,-1,-1,1][view];d.rectangle((x+(0 if direction>0 else -4),y-33,x+(4 if direction>0 else 0),y-31),fill=P['teal'])
    d.line([(x-wide,y-28),(x-wide-3,y-23),(x-4,y-20)],fill=P['light'],width=3)
    d.line([(x+wide,y-28),(x+wide+3,y-21),(x+4,y-19)],fill=P['face'],width=3)
    d.line([(x-3,y-23),(x+direction*15,y-17)],fill=P['ink'],width=4);d.line([(x-3,y-24),(x+direction*15,y-18)],fill=P['light'],width=2)
    if bulwark:
        polygon(d,[(x+7,y-30),(x+18,y-25),(x+18,y-8),(x+12,y-3),(x+7,y-9)],'ink')
        polygon(d,[(x+8,y-28),(x+16,y-24),(x+16,y-9),(x+12,y-5),(x+8,y-10)],'stone');d.line([(x+12,y-26),(x+12,y-9)],fill=P['goldlight'],width=2)
def frame(key,w,h,anchor,draw,view=0,state='idle'):
    im=Image.new('RGBA',(w,h));d=ImageDraw.Draw(im)
    original_palette=P.copy()
    if key.startswith('terrain.'):P.update(LIGHTING['terrain'])
    draw(d,view);P.update(original_palette);images.append(im)
    frames.append({'key':key,'native':[w,h],'anchor':list(anchor),'cameraView':view,'state':state,'source':'assets/source/generate_foundation.py','review':'Candidate — visual approval pending'})
def tile(d,v):
    polygon(d,[(32,0),(63,16),(32,31),(0,16)],'dark');polygon(d,[(32,2),(60,16),(32,29),(3,16)],'stone')
    for x,y in [(25+v%3,9),(40-v%3,17),(16,18+v%2),(32,23),(48,13)]:d.line([(x,y),(x+5,y+2)],fill=P['face']);d.point((x+2,y),fill=P['shadow'])
    d.line([(5,17),(30,29)],fill=P['ink']);d.line([(34,3),(59,15)],fill=P['face'])
for v in range(6):frame('terrain.basalt' if v==0 else f'terrain.basalt.variant{v}',64,32,(32,16),lambda d,cam,variant=v:tile(d,variant),0)
def core(d,v):
    box(d,96,152,84,42,8);box(d,96,137,68,34,16);box(d,96,119,46,23,20)
    for cx,cy in [(46,128),(96,153),(146,128),(96,103)]:
        box(d,cx,cy,14,7,38);d.rectangle((cx-2,cy-44,cx+2,cy-37),fill=P['goldlight']);d.line([(cx-6,cy-27),(cx-6,cy-19)],fill=P['teal'],width=2)
    # Reactor is non-animated presentation only.
    polygon(d,[(96,51),(112,89),(104,113),(88,113),(80,89)],'ink')
    polygon(d,[(96,54),(108,90),(101,109),(90,109),(83,90)],'teal');polygon(d,[(96,54),(98,107),(90,109),(83,90)],'cyan')
    for cy in [142,146,150]:d.line([(72,cy),(96,cy+12),(120,cy)],fill=P['gold'])
    for cx,cy in [(59,142),(132,141)]:d.line([(cx,cy-12),(cx,cy-5)],fill=P['teal'],width=2)
    d.line([(96,50),(96,113)],fill=P['edge'])
for v in range(4):frame(f'objective.harmonic_core.view{v}',192,192,(96,152),core,v)
def sentry(d,v):
    box(d,64,113,48,24,8);box(d,64,102,30,15,12);d.ellipse((43,72,84,104),fill=P['ink']);d.ellipse((47,72,81,99),fill=P['gold']);d.ellipse((50,74,77,95),fill=P['dark'])
    box(d,64,85,24,12,30)
    for x in [43,79]:d.rectangle((x,48,x+6,83),fill=P['ink']);d.rectangle((x+1,49,x+4,80),fill=P['gold']);d.point((x+2,54),fill=P['edge'])
    directions=[(-27,13),(-27,-13),(27,-13),(27,13)];dx,dy=directions[v]
    d.line([(64,57),(64+dx,57+dy)],fill=P['ink'],width=11);d.line([(64,55),(64+dx,55+dy)],fill=P['light'],width=7);d.line([(64,59),(64+dx,59+dy)],fill=P['dark'],width=3)
    d.ellipse((61+dx,53+dy,67+dx,60+dy),fill=P['ink']);d.point((64+dx,56+dy),fill=P['teal']);d.line([(63,85),(63,94)],fill=P['teal'],width=2)
    for x in [35,88]:d.rectangle((x,103,x+4,110),fill=P['gold']);d.point((x+1,104),fill=P['edge'])
for v in range(4):frame(f'friendly.sentry.view{v}',128,144,(64,113),sentry,v)
def barrier(d,v):
    box(d,32,46,29,14,4)
    box(d,32,43,24,6,26)
    for x in [13,31,49]:
        d.line([(x,22),(x,44)],fill=P['ink'],width=5);d.line([(x-1,22),(x-1,42)],fill=P['gold'],width=2)
    d.line([(17,28),(26,32),(26,38),(17,34)],fill=P['shadow']);d.point((14,24),fill=P['edge']);d.line([(43,32),(43,36)],fill=P['teal'])
for v in range(4):frame(f'friendly.standard_barricade.view{v}',64,64,(32,46),barrier,v)
for v in range(4):
    frame(f'friendly.rifle_squad.view{v}',96,80,(48,66),lambda d,v:(soldier(d,31,55,v),soldier(d,63,55,v),soldier(d,48,70,v)),v)
    frame(f'enemy.runner.view{v}',48,64,(24,54),lambda d,v:soldier(d,24,54,v,runner=True),v)
    frame(f'warden.bulwark.view{v}',64,80,(32,68),lambda d,v:soldier(d,30,68,v,bulwark=True),v)
# Inspectable native-size cleanup of original generated candidates. No dither,
# no blurred interpolation, no palette inheritance from external artwork.
def native_candidate(crop, size):
    mask=crop.getchannel('A').point(lambda a:255 if a>=128 else 0)
    crop.putalpha(mask);bounds=mask.getbbox()
    if not bounds:raise ValueError('Empty generated candidate')
    crop=crop.crop(bounds);scale=min((size[0]-4)/crop.width,(size[1]-4)/crop.height)
    reduced=crop.resize((max(1,round(crop.width*scale)),max(1,round(crop.height*scale))),Image.Resampling.NEAREST)
    alpha=reduced.getchannel('A');reduced=reduced.convert('RGB').quantize(colors=40,dither=Image.Dither.NONE).convert('RGBA');reduced.putalpha(alpha)
    result=Image.new('RGBA',size);result.alpha_composite(reduced,((size[0]-reduced.width)//2,size[1]-reduced.height-2));return result
camera=Image.open(ROOT/'assets/source/camera-reference.png').convert('RGBA')
for row,(prefix,size) in enumerate([('objective.harmonic_core',(192,192)),('friendly.sentry',(128,144)),('friendly.standard_barricade',(64,64))]):
    for view in range(4):
        crop=camera.crop((round(view*camera.width/4),[0,423,742][row],round((view+1)*camera.width/4),[411,728,1040][row]))
        index=next(i for i,f in enumerate(frames) if f['key']==f'{prefix}.view{view}')
        images[index]=native_candidate(crop,size);frames[index]['source']='assets/source/camera-reference.png + generate_foundation.py';frames[index]['review']='Native-size cleaned candidate; camera/anatomy approval pending'
reference=Image.open(ROOT/'assets/source/foundation-reference.png').convert('RGBA')
for key,bounds,size in [('enemy.runner.view0',(786,571,1093,967),(48,64)),('warden.bulwark.view0',(1090,556,1425,973),(64,80))]:
    index=next(i for i,f in enumerate(frames) if f['key']==key);images[index]=native_candidate(reference.crop(bounds),size);frames[index]['source']='foundation-reference.png + generate_foundation.py';frames[index]['review']='Native proof only; remaining facing/animation production Designed'
rifle=Image.new('RGBA',(96,80))
for bounds,(x,y) in zip([(36,585,285,938),(282,613,512,951),(515,648,767,961)],[(0,0),(48,0),(24,16)]):rifle.alpha_composite(native_candidate(reference.crop(bounds),(48,64)),(x,y))
index=next(i for i,f in enumerate(frames) if f['key']=='friendly.rifle_squad.view0');images[index]=rifle;frames[index]['source']='foundation-reference.png; three individual 48x64 bodies';frames[index]['review']='Native proof only; per-body facing/animation production Designed'
# Apply the approved *request*, not inferred visual approval: a pixel-preserving
# ambient-light ramp informed by lighting-reference-r1.png. Keep geometry and alpha
# exactly; darkest outlines/contact shadows retain their original separation.
channel_ramp=[round(255*((c/255)**LIGHTING['spriteChannelGamma'])) for c in range(256)]
for i,f in enumerate(frames):
    if f['key'].startswith('terrain.'):continue
    original=images[i];lit=original.copy()
    lit.putdata([(*([channel_ramp[c] for c in rgb] if a and max(rgb)>LIGHTING['preserveDarkPixelMaximum'] else rgb),a)
                 for *rgb,a in original.get_flattened_data()])
    assert lit.getchannel('A').tobytes()==original.getchannel('A').tobytes()
    images[i]=lit
    f['lighting']=LIGHTING['id']
# Shelf atlas: four pixels transparent separation, no alpha at outer border.
atlas=Image.new('RGBA',(1024,1024));x=y=4;row=0
for im,f in zip(images,frames):
    if x+im.width+4>1024:x=4;y+=row+8;row=0
    if y+im.height+4>1024:raise ValueError('Atlas exceeds bounds')
    atlas.alpha_composite(im,(x,y));f['rect']=[x,y,im.width,im.height];x+=im.width+8;row=max(row,im.height)
alpha=atlas.getchannel('A');atlas=atlas.convert('RGB').quantize(colors=128,dither=Image.Dither.NONE).convert('RGBA');atlas.putalpha(alpha)
atlas.save(OUT/'foundation.png',optimize=True)
manifest={'schema':1,'lighting':LIGHTING,'atlas':'foundation.png','atlasSize':[1024,1024],'padding':4,'sourcePixelsPerScreenPixel':2,'palette':P,'frames':frames,'provenance':'Original image generation plus controlled native-size cleanup; deterministic authored terrain. All candidates pending user approval.','sha256':hashlib.sha256((OUT/'foundation.png').read_bytes()).hexdigest()}
(OUT/'foundation.json').write_text(json.dumps(manifest,indent=2)+'\n')
proof=Image.new('RGBA',(512,320),LIGHTING['runtimeBackground'])
for key,(x,y) in zip(['terrain.basalt','objective.harmonic_core.view0','friendly.sentry.view0','friendly.standard_barricade.view0','friendly.rifle_squad.view0','enemy.runner.view0','warden.bulwark.view0'],[(16,260),(5,2),(190,15),(350,85),(190,185),(315,195),(390,190)]):
    index=next(i for i,f in enumerate(frames) if f['key']==key);proof.alpha_composite(images[index],(x,y))
proof.resize((1024,640),Image.Resampling.NEAREST).save(OUT/'style-proof-close.png',optimize=True)
proof.resize((256,160),Image.Resampling.NEAREST).save(OUT/'style-proof-default.png',optimize=True)
# Structural tests cannot establish visual approval.
assert atlas.size==(1024,1024) and all(f['native']==f['rect'][2:] for f in frames)
assert all(0<=f['anchor'][0]<f['native'][0] and 0<=f['anchor'][1]<f['native'][1] for f in frames)
print(f'{len(frames)} original candidate frames; atlas {(OUT/"foundation.png").stat().st_size} bytes; anchors/padding validated')

# Original editable title composition: far ruins, basalt midground, fortress and foreground wall.
title=Image.new('RGBA',(640,360),LIGHTING['runtimeBackground']);td=ImageDraw.Draw(title)
for x,y in [(65,60),(555,75),(470,25),(158,28)]:
    td.rectangle((x,y,x+15,y+30),fill=P['shadow']);td.rectangle((x-4,y+29,x+22,y+34),fill=P['dark'])
for gy in range(-6,12):
    for gx in range(-9,10):
        px=320+(gx-gy)*32;py=160+(gx+gy)*16
        if -64<px<640 and 20<py<360:title.alpha_composite(images[0],(px-32,py-16))
for key,(x,y) in [('objective.harmonic_core.view0',(210,80)),('friendly.sentry.view0',(100,170)),('friendly.sentry.view1',(415,155)),('friendly.standard_barricade.view0',(160,278)),('friendly.standard_barricade.view0',(192,294)),('friendly.standard_barricade.view0',(224,310))]:
    index=next(i for i,f in enumerate(frames) if f['key']==key);title.alpha_composite(images[index],(x,y))
title.save(OUT/'title-foundation.png',optimize=True)

index=next(i for i,f in enumerate(frames) if f['key']=='objective.harmonic_core.view0')
images[index].resize((32,32),Image.Resampling.NEAREST).save(OUT/'icon.png',optimize=True)
