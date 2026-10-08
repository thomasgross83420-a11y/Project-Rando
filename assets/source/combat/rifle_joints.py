"""Original native Rifle artwork, authored from joints rather than image slices.

The approved rifle-keyposes-r2.png is a design reference, never a pixel input.
Coordinates are ground GU plus height, projected at the game's two-source-pixel
density. This draws NEW raster surfaces; it does not transform reference PNGs.
"""
from pathlib import Path
from PIL import Image, ImageDraw
import hashlib
import json
import math

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / 'public/assets/combat'
SOURCE = Path(__file__).parent
PALETTE = {
    'outline': '#111923', 'deep': '#222a30', 'dark': '#374148',
    'steel': '#58646b', 'light': '#89928b', 'shine': '#bbc3ae',
    'goldDark': '#645136', 'gold': '#ad8446', 'goldLight': '#e1ba71',
    'cloth': '#776046', 'clothLight': '#b28e53',
    'cyanDark': '#24545c', 'cyan': '#66c3ca', 'cyanLight': '#bdeded',
    'edge': '#9eaa9a', 'steelMid': '#68767b', 'steelShadow': '#434d53',
    'goldShade': '#896536', 'leather': '#473b2c', 'leatherEdge': '#867058',
}
CYCLE = 40
SPEED = 2253/1024
STANCE = .6


def ground(face, forward, side):
    angle = (face - 1) * math.pi / 4
    fx, fy = math.sin(angle), -math.cos(angle)
    rx, ry = -fy, fx
    return forward * fx + side * rx, forward * fy + side * ry


def screen(face, forward, side, height):
    x, y = ground(face, forward, side)
    return 24 + 32 * (x - y), 51 + 16 * (x + y) - 48 * height


def foot(phase):
    """60% loaded stance, 40% lifted return; no sine-wave ground sliding.

    During stance, foot velocity relative to the pelvis is exactly -SPEED.
    At the twelve-Hz native keys the projected sole stays in world position.
    Runtime frames are quantized; this is not motion-capture certification.
    """
    p = phase % 1
    half = SPEED * CYCLE / 60 * STANCE / 2
    if p < STANCE:
        return half - 2 * half * p / STANCE, 0., True
    t = (p - STANCE) / (1 - STANCE)
    # Smooth endpoints, small toe clearance, no floating planted foot.
    return -half + 2 * half * (t*t*(3 - 2*t)), .085 * math.sin(math.pi*t), False


def knee(hip, ankle, length=15/48):
    dx, dz = ankle[0] - hip[0], ankle[1] - hip[1]
    dist = math.hypot(dx, dz)
    if not 0 < dist <= 2 * length:
        raise ValueError('Unreachable authored leg')
    bend = math.sqrt(max(0, length*length - dist*dist/4))
    return (hip[0] + ankle[0])/2 - dz/dist*bend, (hip[1] + ankle[1])/2 + dx/dist*bend


def draw_pose(face, state, frame):
    im = Image.new('RGBA', (48, 64))
    d = ImageDraw.Draw(im)
    joints = {}
    sockets = {}
    contacts = []
    marks = []
    p = frame / 8 if state in ('move', 'brace') else 0
    bob = .008 * math.cos(p * math.tau * 2) if state == 'move' else 0
    hip_height = 19/48 + bob
    recoil = [0, .024, .016, .008, .003, 0][frame] if state == 'attack' else 0
    hit = -.025 if state == 'hit' and frame == 0 else 0
    fall = [0, .20, .40, .60, .80, 1.][frame] if state == 'incapacitated' else 0
    hip_height *= 1 - fall * .78

    def pt(name, f, s, h):
        # An explicit folding/forward fall, not a rotated/scaled torso bitmap.
        if state == 'incapacitated':
            f -= fall * max(0, h - hip_height) * .75
            h = hip_height + (h - hip_height) * (1 - fall)
        xy = screen(face, f, s, h)
        joints[name] = [round(xy[0], 3), round(xy[1], 3)]
        return tuple(round(v) for v in xy)

    def segment(a, b, width, material='steel'):
        d.line([a, b], fill=PALETTE['outline'], width=width+2)
        d.line([a, b], fill=PALETTE['dark'], width=width)
        d.line([(a[0]-1, a[1]-1), (b[0]-1, b[1]-1)], fill=PALETTE[material], width=max(1, width-2))

    def plate(center, w, h, material='steel', trim=True):
        x, y = center
        shape = [(x-w//2,y-h//2+1),(x+w//2-1,y-h//2),(x+w//2,y+h//2-2),(x+1,y+h//2),(x-w//2,y+h//2-1)]
        d.polygon(shape, fill=PALETTE[material], outline=PALETTE['outline'])
        d.line([shape[0], shape[1]], fill=PALETTE['light'], width=1)
        if trim:
            d.line([shape[0], (shape[0][0],y+1)], fill=PALETTE['goldLight'], width=1)
        marks.append((x,y))

    # Draw far leg first; projected lateral depth decides ordering in every view.
    legs = []
    for side, offset in [(-.075, 0), (.075, .5)]:
        f, lift, planted = foot(p + offset) if state in ('move', 'brace') else (.08 if side < 0 else -.08, 0., True)
        if state == 'brace': lift, planted = 0., True
        if fall:
            f = (.08 if side < 0 else -.08) + fall * (.18 if side < 0 else -.12)
            lift, planted = 0., True
        kf, kh = knee((0, hip_height), (f, lift))
        hip = pt('hip.'+str(side), 0, side, hip_height)
        kne = pt('knee.'+str(side), kf, side, kh)
        ankle = pt('ankle.'+str(side), f, side, lift)
        toe = pt('toe.'+str(side), f+.01, side, lift)
        contacts.append({'side':side,'forwardGU':round(f,6),'heightGU':round(lift,6),'planted':planted,'sole':[ankle[0],ankle[1]],'kneeGU':[kf,kh]})
        legs.append((screen(face, 0, side, 0)[1], hip, kne, ankle, toe))
    for _, hip, kne, ankle, toe in sorted(legs):
        segment(hip, kne, 7)
        segment(kne, ankle, 3)
        # Individually tapered greaves: broad calf armor, narrow boot joint.
        vx,vy=ankle[0]-kne[0],ankle[1]-kne[1]
        length=max(1,math.hypot(vx,vy))
        nx,ny=-vy/length,vx/length
        upper=(kne[0]+vx*.2,kne[1]+vy*.2)
        lower=(kne[0]+vx*.83,kne[1]+vy*.83)
        shell=[(round(upper[0]+nx*3),round(upper[1]+ny*3)),(round(upper[0]-nx*3),round(upper[1]-ny*3)),(round(lower[0]-nx),round(lower[1]-ny)),(round(lower[0]+nx),round(lower[1]+ny))]
        d.polygon(shell,fill=PALETTE['steel'],outline=PALETTE['outline'])
        d.line([shell[0],shell[3]],fill=PALETTE['light'],width=1)
        d.line([shell[1],shell[2]],fill=PALETTE['goldShade'],width=1)
        plate(kne, 6, 5)
        # Flat loaded soles; heel and toe retain the same ground plane.
        d.line([ankle, toe], fill=PALETTE['outline'], width=5)
        d.line([(ankle[0],ankle[1]-1),(toe[0],toe[1]-1)], fill=PALETTE['gold'], width=3)
        d.point((ankle[0],ankle[1]-2), fill=PALETTE['shine'])

    pelvis = pt('pelvis', hit, 0, hip_height)
    chest = pt('sternum', hit-recoil, 0, hip_height+.28)
    head = pt('head', hit-recoil, 0, hip_height+.50)
    # Backpack, steel armor and ochre half-tabard retain the approved identity.
    pack = pt('pack', -.11+hit, 0, hip_height+.27)
    plate(pack, 12, 15, 'dark', False)
    d.line([(pack[0]-4,pack[1]-4),(pack[0]+3,pack[1]-4)], fill=PALETTE['gold'], width=1)
    # Project an authored cuirass instead of pasting the same front rectangle
    # into all eight headings. Far, side, front and sloped roof planes differ.
    box={}
    for ftag,f in [('back',-.10),('front',.10)]:
        for stag,side in [('left',-.14),('right',.14)]:
            for ztag,z in [('low',.07),('high',.32)]:
                box[ftag,stag,ztag]=pt('armor.'+'.'.join([ftag,stag,ztag]),f+hit-recoil,side,hip_height+z)
    side_planes=[]
    for a,b,color in [('back','left','steelShadow'),('back','right','dark'),('front','left','steelMid'),('front','right','steel')]:
        if a=='front':
            vertices=[box['front','left','high'],box['front','right','high'],box['front','right','low'],box['front','left','low']]
        else:
            vertices=[box['back',b,'high'],box['front',b,'high'],box['front',b,'low'],box['back',b,'low']]
        side_planes.append((sum(v[1] for v in vertices),vertices,color))
    for _,vertices,color in sorted(side_planes):
        d.polygon(vertices,fill=PALETTE[color],outline=PALETTE['outline'])
    roof=[box['back','left','high'],box['back','right','high'],box['front','right','high'],box['front','left','high']]
    d.polygon(roof,fill=PALETTE['light'],outline=PALETTE['outline'])
    front_trim=[box['front','left','high'],box['front','left','low'],box['front','right','low']]
    d.line(front_trim,fill=PALETTE['gold'],width=1)
    d.point((chest[0]-2,chest[1]),fill=PALETTE['shine'])
    marks.append(chest)
    plate(pelvis, 14, 5, 'goldDark', False)
    tabard = [pt('cloth.0', .025, -.06, hip_height),pt('cloth.1', .025, .06, hip_height),pt('cloth.2', .04, .055, hip_height-.16),pt('cloth.3', .04, -.055, hip_height-.16)]
    d.polygon(tabard, fill=PALETTE['cloth'], outline=PALETTE['goldDark'])
    d.line([tabard[0],tabard[3],tabard[2]],fill=PALETTE['clothLight'],width=1)
    hx, hy = head
    d.ellipse((hx-6,hy-6,hx+5,hy+5),fill=PALETTE['steel'],outline=PALETTE['outline'],width=1)
    d.arc((hx-5,hy-5,hx+4,hy+4),185,280,fill=PALETTE['shine'],width=1)
    d.arc((hx-4,hy-4,hx+4,hy+4),180,340,fill=PALETTE['gold'],width=1)
    visor = pt('visor', .09+hit-recoil, 0, hip_height+.48)
    if face in (2,3,4,5,6):
        d.line([(visor[0]-1,visor[1]-1),(visor[0]+1,visor[1]+2)],fill=PALETTE['cyanDark'],width=3)
        d.line([(visor[0],visor[1]-1),(visor[0],visor[1]+1)],fill=PALETTE['cyanLight'],width=1)
    else:
        d.point((hx+1,hy+2),fill=PALETTE['goldLight'])

    # Weapon stock is seated into the shoulder. Both grips are persistent sockets.
    weapon_height = hip_height+.28
    stock = pt('stock', -.035+hit-recoil, .04, weapon_height)
    muzzle = pt('muzzle', .40+hit-recoil, .04, weapon_height)
    trigger = pt('grip.trigger', .09+hit-recoil, .04, weapon_height-.025)
    fore = pt('grip.fore', .265+hit-recoil, .04, weapon_height-.025)
    for side, grip, forearm in [(-.14,fore,.18),(.14,trigger,-.02)]:
        shoulder = pt('shoulder.'+str(side), hit-recoil,side,hip_height+.30)
        elbow = pt('elbow.'+str(side),forearm+hit-recoil,side,hip_height+.17)
        segment(shoulder,elbow,5)
        segment(elbow,grip,4)
        plate(shoulder,7,7)
        plate(elbow,5,5)
    segment(stock,muzzle,4,'dark')
    rail = pt('rail', .17+hit-recoil,.04,weapon_height+.025)
    d.line([stock,rail],fill=PALETTE['gold'],width=1)
    d.line([rail,muzzle],fill=PALETTE['cyanDark'],width=1)
    d.point(muzzle,fill=PALETTE['cyanLight'])
    for grip in (trigger,fore):
        d.ellipse((grip[0]-1,grip[1]-1,grip[0]+1,grip[1]+1),fill=PALETTE['dark'],outline=PALETTE['outline'])
    sockets['muzzle'] = list(muzzle)
    sockets['triggerGrip'] = list(trigger)
    sockets['foreGrip'] = list(fore)
    if state == 'hit':
        # Material highlights react; silhouette and joint topology do not change.
        d.point((chest[0]-3,chest[1]-2),fill=PALETTE['shine'])
    damage = {}
    for band in ('scuffed','damaged'):
        layer = Image.new('RGBA',im.size)
        ld = ImageDraw.Draw(layer)
        for x,y in marks:
            ld.line([(x-1,y),(x+1,y-1)],fill=PALETTE['deep'],width=1)
            if band == 'damaged':ld.point((x,y+1),fill=PALETTE['goldDark'])
        # Pixel-bound weathering drawn for THIS pose, never an idle-pose transform.
        from PIL import ImageChops
        layer.putalpha(ImageChops.multiply(layer.getchannel('A'),im.getchannel('A')))
        damage[band] = layer
    bbox=im.getbbox()
    if not bbox or bbox[0]<1 or bbox[1]<1 or bbox[2]>47 or bbox[3]>63:
        raise ValueError('Native silhouette clipped '+str((face,state,frame,bbox)))
    return im, {'joints':joints,'sockets':sockets,'contacts':contacts,'bobPixels':round(-48*bob,3),'splitY':34}, damage


def generate():
    manifest_path = OUT/'manifest.json'
    manifest = json.loads(manifest_path.read_text())
    # Idempotent replacement: protect all other sprites and original atlas bytes.
    frames = [f for f in manifest['frames'] if f['content'] != 'friendly.rifle_squad']
    atlases = [a for a in manifest['atlases'] if a['file'] != 'rifle-joints-r1.png']
    atlas_id = len(atlases)
    entries = []
    rigs = {}
    overlays = {}
    for face in range(8):
        for state,count,ticks in [('idle',4,10),('move',8,5),('brace',8,5),('aim',1,6),('attack',6,5),('hit',2,8),('incapacitated',6,6)]:
            for frame in range(count):
                image, rig, damage = draw_pose(face,state,frame)
                key=f'friendly.rifle_squad.face{face}.{state}.{frame}'
                rigs[key]=rig
                entries.append((key,image,state,face,frame,ticks))
                if state not in ('incapacitated',):
                    for band, overlay in damage.items():
                        if overlay.getbbox():entries.append((key+'.'+band,overlay,band,face,frame,ticks))
        # Existing public damageSource API needs the two stable band identities.
        for band in ('scuffed','damaged'):
            image,_,damage=draw_pose(face,'idle',0)
            entries.append((f'friendly.rifle_squad.face{face}.{band}.0',damage[band],band,face,0,10))
    width=1024
    atlas=Image.new('RGBA',(width,2048))
    unique={}
    x=y=row=0
    for key,image,state,face,frame,ticks in entries:
        box=image.getbbox()
        if not box:raise ValueError('Empty new frame')
        trimmed=image.crop(box)
        identity=(trimmed.size,hashlib.sha256(trimmed.tobytes()).hexdigest())
        if identity not in unique:
            if x+trimmed.width+8>width:x=0;y+=row;row=0
            if y+trimmed.height+8>2048:raise ValueError('Rifle atlas budget exceeded')
            atlas.alpha_composite(trimmed,(x+4,y+4))
            unique[identity]=[x+4,y+4,trimmed.width,trimmed.height]
            x+=trimmed.width+8
            row=max(row,trimmed.height+8)
        record={'key':key,'atlas':atlas_id,'rect':unique[identity],'native':[48,64],'trim':list(box),'anchor':[24,51],'content':'friendly.rifle_squad','facing':face,'camera':'projected-facing','state':state,'frame':frame,'ticks':ticks,'source':'rifle_joints.py','review':'Authored joint/contact candidate; runtime checked separately'}
        if key.endswith(('.scuffed','.damaged')):overlays[key]=record
        else:frames.append(record)
    atlas=atlas.crop((0,0,width,y+row))
    path=OUT/'rifle-joints-r1.png'
    atlas.save(path,optimize=True)
    atlases.append({'file':path.name,'size':list(atlas.size),'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'bytes':path.stat().st_size})
    manifest.update({'version':'rb-combat-art-v2-rifle','atlases':atlases,'frames':frames})
    manifest_path.write_text(json.dumps(manifest,indent=2)+'\n')
    source_rig={'schema':1,'id':'rifle-joints-r1','density':2,'cycleTicks':CYCLE,'stanceFraction':STANCE,'speedGUPerSecond':SPEED,'frameKeys':rigs,'damageFrames':overlays}
    (SOURCE/'rifle-landmarks.json').write_text(json.dumps(source_rig,indent=2)+'\n')
    runtime_rig={**source_rig,'frameKeys':{k:{'sockets':{'muzzle':v['sockets']['muzzle']},'splitY':v['splitY'],'bobPixels':v['bobPixels'],'soles':[{'x':c['sole'][0],'y':round(c['sole'][1]+48*c['heightGU'],3),'planted':c['planted']} for c in v['contacts']]} for k,v in rigs.items()}}
    (OUT/'rifle-rig.json').write_text(json.dumps(runtime_rig,separators=(',',':'))+'\n')
    # New drawn proof, not edits of the approved source study.
    proof=Image.new('RGB',(8*48*3,7*64*3),'#26343e')
    for face in range(8):
        for row,(state,frame) in enumerate([('idle',0),('move',0),('move',2),('move',4),('move',6),('attack',1),('incapacitated',5)]):
            image,_,_=draw_pose(face,state,frame)
            image=image.resize((144,192),Image.Resampling.NEAREST)
            proof.paste(image,(face*144,row*192),image)
    proof.save(SOURCE/'studies/rifle-joints-r1-proof.png')
    print(json.dumps({'newAtlas':atlases[-1],'rigs':len(rigs),'newFrames':len(entries),'protectedAtlas0':atlases[0]['sha256']}))


if __name__=='__main__':generate()
