"""Original Gate2 native raster rig. Rebuild with pinned Pillow12.3.0.
Sources are inspected original references, fixed body/weapon/leg layers retain foot
anchors. Identical pixels alias one atlas rectangle; metadata keeps all timings.
"""
from pathlib import Path
from PIL import Image,ImageDraw,ImageChops,ImageOps
import json,hashlib,math
R=Path(__file__).resolve().parents[3];S=R/'assets/source/combat';O=R/'public/assets/combat';O.mkdir(exist_ok=True,parents=True)
frames=[];original={};entries=[]
def clean(im):
    im=im.convert('RGBA');alpha=im.getchannel('A').point(lambda a:255 if a>=128 else 0);im.putalpha(alpha)
    return im.crop(im.getbbox()) if im.getbbox() else (_ for _ in ()).throw(ValueError('Empty source'))
def rows(path,count,columns):
    im=Image.open(path);return [[clean(im.crop((round(c*im.width/columns),round(r*im.height/count),round((c+1)*im.width/columns),round((r+1)*im.height/count)))) for c in range(columns)] for r in range(count)]
def native(poses,w,h):
    scale=min((w-6)/max(p.width for p in poses),(h-6)/max(p.height for p in poses));out=[]
    for p in poses:
        p=p.resize((round(p.width*scale),round(p.height*scale)),Image.Resampling.NEAREST);n=Image.new('RGBA',(w,h));n.alpha_composite(p,((w-p.width)//2,h-4-p.height));out.append(n)
    return out
# Curated editable source is tracked; failed raw generations are not rebuild inputs.
if not (S/'sentry-facing.png').exists():raise FileNotFoundError('Missing required curated editable Sentry source')
def align_mobile_ground(im):
    # Remove detached crop/ground debris separated from the main body bounds.
    # A 2px fringe retains adjacent raster details; do not resize anatomy.
    points={(x,y) for y in range(im.height) for x in range(im.width) if im.getpixel((x,y))[3]}
    groups=[]
    while points:
        start=points.pop();todo=[start];group=[start]
        while todo:
            x,y=todo.pop()
            for dx in [-1,0,1]:
                for dy in [-1,0,1]:
                    point=(x+dx,y+dy)
                    if point in points:points.remove(point);todo.append(point);group.append(point)
        groups.append(group)
    if not groups:raise ValueError('No mobile silhouette')
    body=max(groups,key=len)
    left=min(x for x,y in body)-2;right=max(x for x,y in body)+2;top=min(y for x,y in body)-2;bottom=max(y for x,y in body)+2
    for group in groups:
        if not any(left<=x<=right and top<=y<=bottom for x,y in group):
            for x,y in group:im.putpixel((x,y),(0,0,0,0))
    box=im.getbbox();out=Image.new('RGBA',im.size)
    out.alpha_composite(im,(0,im.height-4-box[3]))
    return out

mobile=rows(S/'facing-reference.png',4,8)
ids=['friendly.rifle_squad','enemy.runner','enemy.raider','warden.bulwark']
for key,poses in zip(ids,mobile):
    original[key]=[align_mobile_ground(im) for im in native(poses,64 if key=='warden.bulwark' else 48,80 if key=='warden.bulwark' else 64)]
original['friendly.sentry']=native(rows(S/'sentry-facing.png',1,8)[0],128,144)
support=Image.open(S/'support-reference.png')
supportBoxes=[[[40,76,465,509],[482,117,863,512],[925,116,1292,512],[1318,80,1737,509]],[[110,608,391,796],[530,611,815,796],[959,606,1244,796],[1381,606,1669,796]]]
for key,boxes,wh in zip(['friendly.repair_node','friendly.proximity_mine'],supportBoxes,[(128,128),(64,40)]):original[key]=native([clean(support.crop(box)) for box in boxes],*wh)
f=json.loads((R/'public/assets/foundation.json').read_text());a=Image.open(R/'public/assets/foundation.png')
for key in ['objective.harmonic_core','friendly.standard_barricade']:
    original[key]=[]
    for i in range(4):
        record=next(x for x in f['frames'] if x['key']==key+'.view'+str(i));x,y,w,h=record['rect'];original[key].append(a.crop((x,y,x+w,y+h)))

def pulse(im,i):
    n=im.copy();p=n.load()
    for y in range(n.height):
        for x in range(n.width):
            r,g,b,alpha=p[x,y]
            if alpha and g>r*1.3 and b>r*1.3:p[x,y]=(r,min(255,g+[0,5,9,5][i%4]),min(255,b+[0,5,9,5][i%4]),alpha)
    return n

def rig(base,state,i,face=0):
    w,h=base.size;n=Image.new('RGBA',(w,h));ground=h-4
    if state=='idle':return pulse(base,i)
    if state=='aim':return base.copy()
    if state=='hit':
        n=base.copy();t=Image.new('RGBA',base.size,'#d9e3dd');t.putalpha(base.getchannel('A'));return Image.blend(n,t,.20 if i==0 else .06)
    if state=='incapacitated':
        # Articulated loss of stance: knees fold first, torso rolls to ground.
        if i==0:return base.copy()
        cut=round(h*.69);upper=base.crop((0,0,w,cut));box=upper.getbbox();upper=upper.crop(box);angle=[0,12,25,40,65,80][i]
        upper=upper.rotate(angle,resample=Image.Resampling.NEAREST,expand=True)
        scale=min((w-8)/upper.width,(h-8)/upper.height,1);upper=upper.resize((max(1,round(upper.width*scale)),max(1,round(upper.height*scale))),Image.Resampling.NEAREST)
        y=round(box[1]*(1-i/5)+max(0,ground-upper.height)*i/5)
        n.alpha_composite(upper,((w-upper.width)//2,y))
        legs=base.crop((0,cut,w,h));legs=legs.resize((w,max(3,round(legs.height*(1-i*.13)))),Image.Resampling.NEAREST);n.alpha_composite(legs,(0,ground-legs.height))
        if i>=3:
            grey=ImageOps.grayscale(n).convert('RGBA');grey.putalpha(n.getchannel('A'));n=Image.blend(n,grey,.5)
        return n
    if state=='move':
        cut=round(h*.70);body=base.crop((0,0,w,cut));n.alpha_composite(body,(0,-(1 if i in [1,2,5,6] else 0)))
        stride=[0,1,2,1,0,-1,-2,-1][i];mid=w//2
        dx=round(math.sin(face*math.pi/4)*stride);dy=round(-math.cos(face*math.pi/4)*stride)
        for j,(left,right) in enumerate([(0,mid),(mid,w)]):
            leg=base.crop((left,cut,right,h));n.alpha_composite(leg,(left+(dx if j==0 else -dx),cut+(dy if j==0 else -dy)-(1 if (j==0 and i in[1,2]) or(j==1 and i in[5,6]) else 0)))
        return n
    if state in ['attack','ability','channel']:
        n=base.copy();direction=-1 if i in[1,2] else 1 if i==3 else 0;top=round(h*.29);bottom=round(h*.62)
        # Separate outside arm/tool/weapon lobes from the stable central torso.
        mid=w//2;arm=base.crop((0,top,w,bottom));mask=Image.new('L',arm.size);d=ImageDraw.Draw(mask);d.rectangle((0,0,max(0,mid-w//7),arm.height),fill=255);d.rectangle((mid+w//7,0,w,arm.height),fill=255)
        alpha=ImageChops.multiply(arm.getchannel('A'),mask);arm.putalpha(alpha);erase=Image.new('RGBA',arm.size);erase.putalpha(alpha)
        n.paste((0,0,0,0),(0,top,w,bottom),mask);n.alpha_composite(arm,(direction,top+(1 if state=='ability' and i==2 else 0)))
        return pulse(n,i)
    raise ValueError('Unknown animation '+state)

def squad(body,i,state):
    out=Image.new('RGBA',(96,80));# three visual members, one combat body
    for x,y in [(25,57),(61,59),(44,75)]:out.alpha_composite(body,(x-body.width//2,y-(body.height-4)))
    return out

def add(key,im,anchor,meta):
    # Hard alpha once; atlas has transparent—not semitransparent glow—gutters.
    im.putalpha(im.getchannel('A').point(lambda a:255 if a>=128 else 0))
    bbox=im.getbbox()
    if not bbox:raise ValueError('Empty '+key)
    if bbox[0]<1 or bbox[1]<1 or bbox[2]>im.width-1 or bbox[3]>im.height-1:raise ValueError('Cropped '+key+str(bbox))
    entries.append((key,im,anchor,meta))

states={'idle':(4,6),'move':(8,10),'aim':(1,6),'attack':(6,12),'hit':(2,8),'incapacitated':(6,10),'ability':(4,12)}
for key in ids:
    for face,base in enumerate(original[key]):
        for state,(count,fps) in states.items():
            if state=='ability' and key!='warden.bulwark':continue
            for i in range(count):
                im=rig(base,state,i,face)
                # Rifle member frames render three times as one squad; do not bake redundant pixels.
                add(key+'.face'+str(face)+'.'+state+'.'+str(i),im,[im.width//2,im.height-4],{'content':key,'facing':face,'camera':'projected-facing','state':state,'frame':i,'ticks':math.floor(60/fps+.5),'source':'facing-reference.png','review':'Production candidate; combat inspection required'})
for key in ['friendly.sentry','friendly.repair_node','friendly.proximity_mine','objective.harmonic_core','friendly.standard_barricade']:
    posecount=len(original[key])
    active='attack' if key=='friendly.sentry' else 'channel' if key=='friendly.repair_node' else 'idle'
    for view,base in enumerate(original[key]):
        for state,count,fps in [('idle',4,6),(active,4,12),('hit',2,8),('wreck',1,6)]:
            if state==active=='idle' and fps==12:continue
            for i in range(count):
                if state=='wreck':
                    im=base.copy();px=im.load()
                    for y in range(im.height):
                        for x in range(im.width):
                            r,g,b,alpha=px[x,y]
                            if alpha:px[x,y]=(round(r*.52),round(g*.52),round(b*.52),alpha)
                    d=ImageDraw.Draw(im);d.line([(im.width//3,im.height//3),(im.width//2,im.height//2),(im.width//2-4,im.height-8)],fill='#111923',width=2)
                else:im=base.copy() if state=='idle' else rig(base,state,i)
                add(key+'.'+('face' if posecount==8 else 'view')+str(view)+'.'+state+'.'+str(i),im,[im.width//2,im.height-4],{'content':key,'facing':view if posecount==8 else None,'camera':'projected-facing' if posecount==8 else view,'state':state,'frame':i,'ticks':math.floor(60/fps+.5),'source':'sentry-facing.png' if posecount==8 else 'support-reference.png' if key in ['friendly.repair_node','friendly.proximity_mine'] else 'foundation.png','review':'Production candidate; conditional foundation approval is not animation approval'})
# Surface weathering is separate from geometry/health; overlay follows each real pose.
for key,poses in original.items():
    for pose,base in enumerate(poses):
        for state in ['scuffed','damaged']:
            im=Image.new('RGBA',base.size);mask=Image.new('RGBA',base.size);d=ImageDraw.Draw(mask)
            for fx,fy,length in [(.38,.45,5),(.62,.61,4),(.32,.71,3)]:
                x=round(base.width*fx);y=round(base.height*fy);length*=2 if state=='damaged' else 1
                d.line([(x,y),(x+length,y-length//2)],fill='#1b232b',width=1);d.line([(x,y+1),(x+length,y-length//2+1)],fill='#a8b0ac',width=1)
            if state=='damaged':d.line([(base.width//2,base.height//3),(base.width//2-3,base.height//2),(base.width//2+2,base.height*2//3)],fill='#111923',width=2)
            mask.putalpha(ImageChops.multiply(mask.getchannel('A'),base.getchannel('A')));im.alpha_composite(mask)
            poseid='face' if len(poses)==8 else 'view'
            add(key+'.'+poseid+str(pose)+'.'+state+'.0',im,[im.width//2,im.height-4],{'content':key,'camera':'projected-facing' if len(poses)==8 else pose,'facing':pose if len(poses)==8 else None,'state':state,'frame':0,'ticks':10,'source':'generate_combat.py','review':'Original damage overlay candidate'})
# Original stationary light breathing: native 12px emissive layer over the stable body.
for i in range(4):
    im=Image.new('RGBA',(12,12));d=ImageDraw.Draw(im);r=[2,3,4,3][i];d.polygon([(6,6-r),(6+r,6),(6,6+r),(6-r,6)],fill='#b8eee0',outline='#ebfffa')
    add('fx.emissive.'+str(i),im,[6,6],{'content':'fx.emissive','camera':'screen','state':'idle','frame':i,'ticks':10,'source':'generate_combat.py','review':'Original idle-light overlay candidate'})
# Native essential effects: transparent pixels, no simulation collision inferred.
for key,size,count in [('kinetic',16,4),('impact',20,4),('explosion',40,6),('shield',24,4)]:
    for i in range(count):
        im=Image.new('RGBA',(size,size));d=ImageDraw.Draw(im);c=size//2
        if key=='kinetic':d.line([(c-5,c+2),(c+4,c-2)],fill='#f8e6af',width=2);d.point((c+4,c-2),fill='#ffffff')
        elif key=='impact':
            for j in range(6):h=j*math.tau/6;r=3+i;d.line([(c,c),(c+round(math.cos(h)*r),c+round(math.sin(h)*r))],fill='#ffc266',width=1)
        elif key=='explosion':
            r=3+i*2;d.ellipse((c-r,c-r//2,c+r,c+r//2),outline='#ffc266',width=2);d.line([(c-r,c),(c+r,c)],fill='#f2f4f7')
        else:d.arc((3,3,size-4,size-4),45,300,fill='#b8eee0',width=2)
        add('fx.'+key+'.'+str(i),im,[c,c],{'content':'fx.'+key,'camera':'screen','state':key,'frame':i,'ticks':5,'source':'generate_combat.py','review':'Original essential effect'})
# Pack deduplicated pixel surfaces into bounded 2048px-wide shelves, heights rounded64.
unique={};canvases=[];shelves=[];usedHeights=[]
entries.sort(key=lambda e:(-(e[1].getbbox()[3]-e[1].getbbox()[1]),-(e[1].getbbox()[2]-e[1].getbbox()[0]),e[0]))
for key,full,anchor,meta in entries:
    bbox=full.getbbox();im=full.crop(bbox);identity=(im.size,hashlib.sha256(im.tobytes()).hexdigest())
    if identity in unique:record=unique[identity]
    else:
        chosen=None
        for ai,rows in enumerate(shelves):
            for row in rows:
                if row['h']>=im.height+8 and row['x']+im.width+8<=2048:chosen=(ai,row);break
            if chosen:break
        if chosen is None:
            ai=next((i for i,h in enumerate(usedHeights) if h+im.height+8<=2048),len(canvases))
            if ai==len(canvases):canvases.append(Image.new('RGBA',(2048,2048)));shelves.append([]);usedHeights.append(0)
            row={'x':0,'y':usedHeights[ai],'h':im.height+8};shelves[ai].append(row);usedHeights[ai]+=row['h'];chosen=(ai,row)
        ai,row=chosen;x=row['x']+4;y=row['y']+4;canvases[ai].alpha_composite(im,(x,y));record={'atlas':ai,'rect':[x,y,im.width,im.height]};row['x']+=im.width+8;unique[identity]=record
    frames.append({'key':key,**record,'native':list(full.size),'trim':list(bbox),'anchor':anchor,**meta})
atlases=[canvas.crop((0,0,2048,h)) for canvas,h in zip(canvases,usedHeights)]
records=[]
for i,atlas in enumerate(atlases):
    alpha=atlas.getchannel('A');rgb=atlas.convert('RGB').quantize(colors=128,method=Image.Quantize.MEDIANCUT,dither=Image.Dither.NONE).convert('RGBA');rgb.putalpha(alpha)
    # Indexed PNG encodes the exact opaque colors; normalize invisible RGB only.
    colors=sorted({px[:3] for px in rgb.get_flattened_data() if px[3]});assert len(colors)<=128
    palette=[(0,0,0)]+colors;lookup={color:j+1 for j,color in enumerate(colors)}
    encoded=Image.new('P',rgb.size);encoded.putpalette([v for color in palette for v in color]+[0]*(768-len(palette)*3));encoded.putdata([lookup[px[:3]] if px[3] else 0 for px in rgb.get_flattened_data()]);encoded.info['transparency']=bytes([0]+[255]*len(colors))
    p=O/('atlas'+str(i)+'.png');encoded.save(p,optimize=True);records.append({'file':p.name,'size':list(rgb.size),'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'bytes':p.stat().st_size})
manifest={'schema':1,'version':'rb-combat-art-v1','lighting':'rb-lighting-r1','padding':4,'sampling':'nearest','density':2,'atlases':records,'frames':frames,'review':'Production candidates, never blanket final approval','source':'assets/source/combat/generate_combat.py','sourceHashes':{p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in S.glob('*.png')}}
for stale in O.glob('atlas*.png'):
    if stale.name not in {r['file'] for r in records}:stale.unlink()
(O/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(json.dumps({'frames':len(frames),'unique':len(unique),'atlases':records,'pixels':sum(a.width*a.height for a in atlases)}))
