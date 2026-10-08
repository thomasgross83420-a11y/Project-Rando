"""Original native-pixel first-pass roster, authored from geometry and joint poses.
No reference image or historical atlas is transformed. Asset-specific silhouettes,
gear, faction structures, gait contacts and independent weapon facings are drawn
at source resolution. Every atlas and frame is reproducibly inventoried.
Run after compiling src/game/catalog.ts to /tmp/rb-full-catalog.json.
"""
from pathlib import Path
from PIL import Image,ImageDraw
import json,math,hashlib
ROOT=Path(__file__).resolve().parents[3];OUT=ROOT/'public/assets/full';OUT.mkdir(parents=True,exist_ok=True)
if (OUT/'manifest.json').exists():
 for old in json.loads((OUT/'manifest.json').read_text()).get('atlases',[]):(OUT/old['file']).unlink(missing_ok=True)
CAT=json.loads(Path('/tmp/rb-full-catalog.json').read_text());manifest={'version':'rb-full-first-pass-v1','original':True,'source':'assets/source/full/generate_art.py','atlases':[],'frames':[]}
INK='#141e28';EDGE='#405060';STEEL='#71818c';LIT='#a6b4ba';GOLD='#d3a459';CYAN='#70e0e1'
factions={'Fracture':('#496b7e','#b5f3ef'),'Iron':('#68696d','#db7963'),'Hollow':('#58556d','#dc8bbb'),'Maw':('#657553','#dbb078')}
def iso(h):
 a=h*math.tau/8;return (math.cos(a)*.82+math.sin(a)*.82,(math.cos(a)-math.sin(a))*.41)
def art(d,h,pose,faction=None,weapon=False):
 boss=d['category']=='boss';w,H=(32,32) if weapon else (48,64) if boss else (40,48);im=Image.new('RGBA',(w,H));p=ImageDraw.Draw(im);cx=w//2;cy=H-8
 dx,dy=iso(h);frame=pose%4;moving=4<=pose<12;gait=[-2,-1,0,1,2,1,0,-1][(pose-4)%8] if moving else 0;lift=1 if (moving and pose%4==1) or pose in [2,3] else 0
 if 12<=pose<20:lift=0;cx-=round(dx*(1 if pose%4==1 else 0))
 if pose in [20,21]:cx-=round(dx*2);cy+=1
 if pose>=28:lift=1;cx+=round(dx*(pose%3-1))
 facing=1 if dx>=0 else -1;primary,accent=factions.get(faction,(STEEL,CYAN));tag=d['id'].split('.')[-1];tag={'heavy_squad':'heavy_team','combat_engineers':'engineer_team','field_medics':'medic_team','interceptor_drones':'drone_wing','aegis_walkers':'aegis'}.get(tag,tag)
 if d['category']=='warden':accent={'bulwark':GOLD,'ranger':CYAN,'conductor':'#bf97e8'}[tag]
 if d['category']=='mobile':accent={'rifle_squad':GOLD,'heavy_team':'#dc8d69','engineer_team':'#edbf67','medic_team':'#e9e6d8','drone_wing':CYAN,'aegis':'#8bc5e9'}[tag]
 if weapon:
  if d['weapon'] in ['none','melee']:return im
  pivot=(cx,cy-15-lift);length=13 if tag in ['ranger','lance_array','lancer'] else 9 if d['weapon'] in ['shell','mortar'] else 10
  recoil=[0,2,1,0][pose%4];end=(round(cx+dx*(length-recoil)),round(pivot[1]+dy*(length-recoil)))
  p.line([pivot,end],fill=INK,width=5 if d['weapon'] in ['shell','mortar'] else 3);p.line([pivot,end],fill=LIT,width=2)
  p.rectangle((cx-3,pivot[1]-2,cx+3,pivot[1]+2),fill=EDGE,outline=INK)
  p.line([pivot,(round(cx+dx*4),round(pivot[1]+dy*4))],fill=accent,width=2)
  if pose%4==1:
   p.ellipse((end[0]-2,end[1]-2,end[0]+2,end[1]+2),fill='#ffdea2');p.point((end[0]+facing*3,end[1]),fill='#fff5cd')
  return im
 if 22<=pose<28:
  collapse=pose-22;cy-=max(0,4-collapse);extent=10+collapse
  p.polygon([(cx-extent,cy),(cx-extent+3,cy-4),(cx+extent-2,cy-3),(cx+extent,cy+3),(cx-extent+2,cy+4)],fill=INK,outline=EDGE)
  p.rectangle((cx-7,cy-5-max(0,3-collapse),cx+4,cy+1),fill=primary,outline=STEEL)
  p.ellipse((cx+4,cy-5,cx+11,cy+1),fill=EDGE,outline=INK);p.point((cx+9,cy-3),fill=accent)
  p.line((cx-12,cy+2,cx-2,cy+3),fill=LIT,width=2);p.line((cx-3,cy-3,cx+3,cy-4),fill=accent,width=2)
  return im
 if d['category']=='trap':
  p.polygon([(cx-11,cy),(cx,cy-6),(cx+11,cy),(cx,cy+6)],fill=INK,outline=EDGE)
  if tag=='proximity_mine':p.ellipse((cx-6,cy-4,cx+6,cy+3),fill=STEEL,outline=INK);p.rectangle((cx-2,cy-3,cx+2,cy),fill=GOLD)
  elif tag=='incendiary_vent':
   for i in [-5,-1,3]:p.line((cx-7,cy+i,cx+7,cy+i-4),fill=LIT,width=2)
   p.rectangle((cx-7,cy-7,cx-3,cy-4),fill='#dd8164')
  elif tag=='decoy_beacon':p.rectangle((cx-2,cy-17,cx+2,cy),fill=STEEL);p.polygon([(cx,cy-22),(cx+5,cy-16),(cx,cy-10),(cx-5,cy-16)],fill=CYAN,outline=INK)
  else:
   color={'slow_field':'#75becd','arc_plate':'#d2b665','armor_shredding_charge':'#d88765','gravity_snare':'#b498d0','collapse_charge':'#df795a'}[tag]
   p.polygon([(cx-8,cy),(cx,cy-4),(cx+8,cy),(cx,cy+4)],fill=color,outline=STEEL);p.line((cx-5,cy,cx+5,cy),fill=INK,width=2)
  return im
 if d['category']=='route':
  if tag in ['low_cover','razor_field','resonance_channel','elevated_firing_platform']:
   p.polygon([(cx-14,cy-1),(cx,cy-8),(cx+14,cy-1),(cx,cy+6)],fill=EDGE,outline=STEEL)
   if tag=='razor_field':
    for x in [-8,-3,2,7]:p.polygon([(cx+x,cy-6),(cx+x+3,cy+1),(cx+x-3,cy+1)],fill=LIT,outline=INK)
   elif tag=='resonance_channel':
    for x in [-5,0,5]:p.line((cx-9+x,cy-4,cx+2+x,cy+2),fill=CYAN,width=2)
   else:p.line((cx-10,cy-1,cx,cy+4,cx+10,cy-1),fill=GOLD if tag=='elevated_firing_platform' else LIT,width=3)
  else:
   high=15 if tag=='reinforced_wall' else 11;pts=[(cx-12,cy),(cx-12,cy-high),(cx,cy-high-6),(cx+12,cy-high),(cx+12,cy),(cx,cy+6)]
   p.polygon(pts,fill=INK,outline=STEEL);p.polygon([(cx-12,cy-high),(cx,cy-high-6),(cx+12,cy-high),(cx,cy-high+6)],fill=STEEL)
   p.line((cx,cy-high+6,cx,cy+6),fill=LIT)
   if tag=='controlled_gate':p.line((cx-9,cy-7,cx+9,cy-16),fill=GOLD,width=3);p.line((cx-8,cy-11,cx+8,cy-3),fill=GOLD,width=2)
   elif tag=='anti_vehicle_obstacle':p.line((cx-11,cy-12,cx+11,cy+1),fill=LIT,width=3);p.line((cx+10,cy-13,cx-10,cy+2),fill=LIT,width=3)
   else:
    for x in [-7,7]:p.rectangle((cx+x-1,cy-10,cx+x+1,cy-3),fill=GOLD)
  return im
 if d['category'] in ['tower','support','infrastructure']:
  p.polygon([(cx-15,cy),(cx,cy-8),(cx+15,cy),(cx,cy+8)],fill=INK,outline=EDGE)
  p.polygon([(cx-11,cy-2),(cx,cy-8),(cx+11,cy-2),(cx,cy+4)],fill=STEEL,outline=LIT)
  if d['category']=='tower':
   p.rectangle((cx-6,cy-17,cx+6,cy-6),fill=EDGE,outline=INK);p.polygon([(cx-7,cy-17),(cx,cy-21),(cx+7,cy-17),(cx,cy-13)],fill=LIT)
   if tag=='rotary':
    for k in [-3,0,3]:p.line((cx+k,cy-16,cx+k,cy-7),fill=GOLD,width=1)
   elif tag in ['arc_spire','nullifier']:p.polygon([(cx,cy-32),(cx+5,cy-25),(cx,cy-18),(cx-5,cy-25)],fill=CYAN if tag=='arc_spire' else '#b497dd',outline=LIT)
   elif tag=='mortar_nest':p.ellipse((cx-7,cy-22,cx+7,cy-12),fill=INK,outline=STEEL);p.ellipse((cx-4,cy-21,cx+4,cy-15),fill=GOLD)
   elif tag=='skyguard':p.line((cx-9,cy-20,cx+9,cy-20),fill=LIT,width=3);p.rectangle((cx-9,cy-24,cx-5,cy-16),fill=EDGE,outline=CYAN);p.rectangle((cx+5,cy-24,cx+9,cy-16),fill=EDGE,outline=CYAN)
   elif tag=='lance_array':p.rectangle((cx-4,cy-29,cx+4,cy-15),fill=EDGE,outline=CYAN)
   elif tag=='breaker_cannon':p.rectangle((cx-9,cy-23,cx+9,cy-15),fill=EDGE,outline=GOLD)
  else:
   high=24 if tag in ['detection_relay','power_relay','tactical_uplink','command_node'] else 14
   p.rectangle((cx-9,cy-high,cx+9,cy-3),fill=EDGE,outline=INK);p.polygon([(cx-9,cy-high),(cx,cy-high-5),(cx+9,cy-high),(cx,cy-high+5)],fill=STEEL)
   if tag in ['medical_station','repair_node']:p.line((cx-5,cy-10,cx+5,cy-10),fill='#e8eddb' if tag=='medical_station' else GOLD,width=3);p.line((cx,cy-15,cx,cy-5),fill='#e8eddb' if tag=='medical_station' else GOLD,width=3)
   elif tag in ['detection_relay','tactical_uplink','power_relay','command_node']:p.line((cx,cy-high-4,cx,cy-high-11),fill=LIT,width=2);p.line((cx-6,cy-high-9,cx+6,cy-high-9),fill=CYAN,width=2)
   elif tag=='shield_projector':p.ellipse((cx-6,cy-24,cx+6,cy-12),outline=CYAN,width=2)
   elif tag=='ammunition_fabricator':
    for x in [-5,0,5]:p.rectangle((cx+x-1,cy-13,cx+x+1,cy-7),fill=GOLD)
   elif tag=='drone_bay':p.line((cx-7,cy-13,cx+7,cy-13),fill=CYAN,width=2);p.ellipse((cx-4,cy-10,cx+4,cy-6),fill=INK)
   else:p.rectangle((cx-5,cy-13,cx+5,cy-3),fill=INK,outline=GOLD)
   for x in [-7,7]:p.point((cx+x,cy-5),fill=CYAN)
  return im
 # Independently jointed locomotion: alternating support foot, knee and hip;
 # lean is small and weapons remain on a separately authored facing layer.
 if boss:
  if tag=='choir_dreadnought':
   for x in [-13,13]:p.rectangle((cx+x-4,cy-10,cx+x+4,cy+2),fill=INK,outline=STEEL);p.line((cx+x-3,cy-5,cx+x+3,cy-5),fill=GOLD,width=2)
   p.polygon([(cx-17,cy-14),(cx,cy-25),(cx+17,cy-14),(cx+14,cy-3),(cx,cy+3),(cx-14,cy-3)],fill=primary,outline=LIT)
  elif tag in ['gorger_titan','root_below']:
   p.ellipse((cx-17,cy-31+lift,cx+17,cy),fill=primary,outline=INK)
   for i in range(5):p.arc((cx-14,cy-30+i*5,cx+14,cy-8+i*3),0,180,fill=accent,width=2)
   for x in [-10,10]:p.line((cx+x,cy-8,cx+x+gait,cy+3),fill=STEEL,width=5)
   p.polygon([(cx-9,cy-23),(cx,cy-12),(cx+9,cy-23)],fill=INK,outline=accent)
  elif tag in ['prism_sovereign','shatterstorm']:
   p.polygon([(cx,cy-49),(cx+15,cy-22),(cx+9,cy-6),(cx,cy),(cx-9,cy-6),(cx-15,cy-22)],fill=primary,outline=LIT)
   p.line((cx,cy-47,cx,cy-2),fill=accent,width=2)
   for x,y in [(-17,-32),(17,-26),(0,-55)]:p.polygon([(cx+x,cy+y),(cx+x+4,cy+y+6),(cx+x,cy+y+11),(cx+x-4,cy+y+6)],fill=accent,outline=INK)
  else:
   p.polygon([(cx,cy-42),(cx+12,cy-20),(cx+17,cy),(cx-17,cy),(cx-12,cy-20)],fill=primary,outline=INK);p.line((cx,cy-36,cx,cy-5),fill=accent,width=2)
   for x in [-14,14]:p.line((cx+x,cy-33,cx+x+round(dx*5),cy-11),fill=LIT,width=3)
   p.polygon([(cx-9,cy-42),(cx-7,cy-52),(cx-2,cy-45),(cx+2,cy-53),(cx+8,cy-42)],fill=accent,outline=INK)
  p.rectangle((cx-5,cy-34,cx+5,cy-31),fill=INK);p.line((cx-3,cy-33,cx+3,cy-33),fill=accent)
  return im
 if tag=='drone_wing' or tag=='skimmer':
  for ox,oy in ([(-9,-6),(8,0)] if tag=='drone_wing' else [(0,0)]):
   x=cx+ox;y=cy-18+oy+lift;p.line((x-8,y,x+8,y),fill=STEEL,width=3);p.polygon([(x,y-5),(x+5,y),(x,y+5),(x-5,y)],fill=EDGE,outline=accent)
   for k in [-8,8]:p.line((x+k-3,y-3,x+k+3,y-3),fill=CYAN if pose%2 else LIT,width=1)
  return im
 if tag in ['aegis','bulwark','carrier','breaker','bombard','harvester'] and d['category']!='warden':
  p.line((cx-8,cy-6,cx-10+gait,cy+1),fill=INK,width=5);p.line((cx+8,cy-6,cx+10-gait,cy+1),fill=INK,width=5)
  p.polygon([(cx-11,cy-25+lift),(cx,cy-31+lift),(cx+11,cy-25+lift),(cx+12,cy-8),(cx,cy-1),(cx-12,cy-8)],fill=primary,outline=INK)
  p.line((cx,cy-26,cx,cy-7),fill=accent,width=3)
  if tag=='carrier':p.ellipse((cx-8,cy-22,cx+8,cy-9),fill=INK,outline=accent);p.line((cx-6,cy-13,cx+6,cy-13),fill=accent,width=2)
  if tag=='bulwark':p.polygon([(cx+facing*5,cy-29),(cx+facing*14,cy-24),(cx+facing*13,cy-8),(cx+facing*4,cy-12)],fill=EDGE,outline=accent)
  return im
 members=[(-7,3),(7,-1),(0,0)] if tag=='rifle_squad' else [(-6,2),(6,-1)] if tag in ['heavy_team','medic_team','engineer_team'] else [(0,0)]
 for n,(ox,oy) in enumerate(members):
  x=cx+ox;y=cy+oy;walk=gait if n%2==0 else -gait;torso=y-19-lift
  p.line((x-3,y-8,x-4+walk,y),fill=INK,width=3);p.line((x+3,y-8,x+4-walk,y-1),fill=INK,width=3)
  p.point((x-4+walk,y),fill=LIT);p.point((x+4-walk,y-1),fill=LIT)
  coat=tag in ['ranger','conductor','veil','jammer','mender','herald','drainer']
  if coat:p.polygon([(x-5,torso-1),(x+5,torso-1),(x+7,y-7),(x-7,y-6)],fill=primary,outline=INK)
  p.rectangle((x-5,torso,x+5,y-10),fill=primary,outline=INK);p.line((x-3,torso+2,x+3,torso+2),fill=LIT)
  p.ellipse((x-4,torso-8,x+4,torso-1),fill=EDGE,outline=INK);p.line((x+round(dx*2)-2,torso-5,x+round(dx*2)+2,torso-5),fill=accent,width=1)
  p.line((x-5,torso+3,x-6+round(dx*2),torso+9),fill=STEEL,width=2);p.line((x+5,torso+3,x+6+round(dx*2),torso+8),fill=STEEL,width=2)
  if tag=='bulwark':p.polygon([(x+8,torso),(x+12,torso+3),(x+11,y-8),(x+6,y-10)],fill=EDGE,outline=GOLD)
  if tag=='engineer_team':p.rectangle((x-8,torso+3,x-5,torso+13),fill=GOLD,outline=INK);p.line((x+6,torso+6,x+10,torso+11),fill=LIT,width=2)
  if tag=='medic_team':p.line((x-2,torso+5,x+2,torso+5),fill='#eff2df');p.line((x,torso+3,x,torso+7),fill='#eff2df')
  if tag=='conductor':p.rectangle((x-7,torso-2,x-5,y-10),fill='#a786cd');p.point((x-6,torso+2),fill=CYAN)
  if faction=='Fracture':p.polygon([(x-5,torso),(x-7,torso-4),(x-1,torso-1)],fill=accent,outline=EDGE)
  elif faction=='Iron':p.rectangle((x-6,torso+1,x-2,torso+6),fill=STEEL,outline=INK)
  elif faction=='Hollow':p.line((x-6,torso+4,x-8,y-7,x,y-4),fill=accent,width=1)
  elif faction=='Maw':
   for i in [0,3,6]:p.line((x-5,torso+2+i,x+4,torso+i),fill=accent)
 return im

def sheet(group,defs,faction=None,weapons=False):
 frames=[]
 for d in defs:
  dirs=8 if d['speed'] or d['category']=='boss' or weapons else 4
  poses=4 if weapons else 36
  for h in range(dirs):
   for pose in range(poses):
    im=art(d,h,pose,faction,weapons);box=im.getbbox() or (0,0,1,1);pivot=[im.width/2-box[0],im.height-8-box[1]];frames.append((d,h,pose,im.crop(box),pivot))
 atlas=None;drawx=drawy=rowheight=0;atlas_index=-1;dedup={}
 def flush():
  if atlas is None:return
  height=min(1024,2**math.ceil(math.log2(max(1,drawy+rowheight))));path=OUT/f'{group}-{atlas_index}.png';atlas.crop((0,0,1024,height)).save(path,optimize=True);manifest['atlases'].append({'file':path.name,'width':1024,'height':height,'group':group,'sha256':hashlib.sha256(path.read_bytes()).hexdigest()})
 for d,h,pose,im,pivot in frames:
  key=f'{group}|{d["id"]}|{h}|{pose}';digest=hashlib.sha256(im.tobytes()+str((im.size,pivot)).encode()).hexdigest()
  if digest in dedup:manifest['frames'].append({**dedup[digest],'key':key});continue
  w,H=im.size
  if atlas is None or drawy+H>1024:
   flush();atlas_index+=1;atlas=Image.new('RGBA',(1024,1024));drawx=drawy=rowheight=0
  if drawx+w>1024:drawx=0;drawy+=rowheight;rowheight=0
  if drawy+H>1024:
   flush();atlas_index+=1;atlas=Image.new('RGBA',(1024,1024));drawx=drawy=rowheight=0
  atlas.alpha_composite(im,(drawx,drawy));manifest['frames'].append({'key':f'{group}|{d["id"]}|{h}|{pose}','file':f'{group}-{atlas_index}.png','rect':[drawx,drawy,w,H],'pivot':pivot});dedup[digest]=manifest['frames'][-1];drawx+=w;rowheight=max(rowheight,H)
 flush()
friendly=[d for d in CAT if d['category'] not in ['enemy','boss']]
sheet('friendly',friendly)
for faction in factions:sheet('enemy-'+faction,[d for d in CAT if d['category']=='enemy'],faction)
for d in CAT:
 if d['category']=='boss':sheet(d['id'],[d],['Fracture','Iron','Hollow','Maw'][[b['id'] for b in CAT if b['category']=='boss'].index(d['id'])%4])
sheet('weapons',[d for d in CAT if d['weapon'] not in ['none','melee']],weapons=True)
manifest['states']={'idle':[0,3,6],'move':[4,11,10],'aim':[12,15,12],'attack':[16,19,12],'hit':[20,21,8],'incapacitated':[22,27,10],'ability':[28,35,12]};manifest['lighting']='upper-left';manifest['nativePixelDensity']=1
(OUT/'manifest.json').write_text(json.dumps(manifest,separators=(',',':'))+'\n')
# Compact runtime bank: unique native images and integer state clips. The full
# semantic frame inventory remains the auditable production manifest above.
unique=[];lookup={};clips={}
for f in manifest['frames']:
 signature=(f['file'],tuple(f['rect']),tuple(f['pivot']))
 if signature not in lookup:lookup[signature]=len(unique);unique.append({**f,'key':f'native.{len(unique)}'})
 group,content,direction,pose=f['key'].split('|');clip=clips.setdefault(group+'|'+content,[]);direction=int(direction);pose=int(pose)
 while len(clip)<=direction:clip.append([])
 while len(clip[direction])<=pose:clip[direction].append(0)
 clip[direction][pose]=lookup[signature]
(OUT/'runtime.json').write_text(json.dumps({'version':manifest['version'],'atlases':manifest['atlases'],'images':unique,'clips':clips},separators=(',',':'))+'\n')
print(json.dumps({'atlases':len(manifest['atlases']),'frames':len(manifest['frames']),'bytes':sum(p.stat().st_size for p in OUT.glob('*.png'))}))
