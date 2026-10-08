"""Original first-pass 8-cue score. Each cue is a distinct 32-bar phrase with
instrument/tempo/orchestration variations and explicitly smooth loop endpoints.
No game logic samples audio. Standard library, reproducible PCM16 mono."""
from pathlib import Path
from array import array
import math,random,json,wave,hashlib,subprocess
ROOT=Path(__file__).resolve().parents[3];OUT=ROOT/'public/assets/full/audio';OUT.mkdir(parents=True,exist_ok=True);SR=16000
CUES={'title':(80,0,'bell'),'preparation':(80,0,'pad'),'fracture':(96,2,'bell'),'iron':(88,-2,'brass'),'hollow':(72,1,'glass'),'maw':(84,-5,'wood'),'boss':(104,-2,'brass'),'endurance':(92,0,'wood')}
tracks=[];score=[]
def note(buf,start,duration,midi,amp,timbre):
 freq=440*2**((midi-69)/12);begin=round(start*SR);count=min(round(duration*SR),len(buf)-begin);harm={'bell':[(1,1),(2,.3),(4,.16)],'pad':[(1,1),(2,.15),(3,.08)],'brass':[(1,1),(2,.45),(3,.22),(4,.08)],'glass':[(1,1),(2.01,.22),(3.97,.10)],'wood':[(1,1),(3,.25),(5,.08)]}[timbre]
 table=[sum(math.sin(math.tau*i/4096*h)*weight for h,weight in harm) for i in range(4096)];phase=0;inc=freq/SR*4096
 for i in range(count):
  t=i/SR;env=max(0,min(1,t/(.25 if timbre=='pad' else .015),(duration-t)/.15));decay=1 if timbre=='pad' else .65+.35*math.exp(-t*5);buf[begin+i]+=amp*env*decay*table[int(phase)%4096];phase+=inc
chords=[[50,53,57,60],[46,50,53,57],[48,52,55,58],[45,48,52,55],[50,53,57,62],[53,57,60,64],[48,52,55,62],[45,52,55,57]]
for n,(cue,(bpm,transpose,timbre)) in enumerate(CUES.items()):
 beat=60/bpm;duration=32*4*beat;buf=array('f',[0])*round(duration*SR);rng=random.Random(4001+n);melody=[74,69,72,77,76,72,69,67] if cue in ['title','preparation'] else [69,72,74,77,81,79,76,72] if cue in ['fracture','endurance'] else [62,65,69,70,69,65,62,57] if cue in ['iron','boss'] else [74,77,76,72,69,67,65,69]
 bars=80 if cue in ['boss','endurance'] else 40
 duration=bars*4*beat;buf=array('f',[0])*round(duration*SR)
 for bar in range(bars):
  chord=chords[(bar+n//2)%8];start=bar*4*beat;dynamic=[.7,.88,.78,1][bar//8%4]
  for pitch in chord:note(buf,start,4*beat,pitch+12+transpose,.025*dynamic,'pad')
  for k in range(4):note(buf,start+k*beat,beat*.8,chord[0]-12+transpose+(12 if k==2 else 0),.09,'wood')
  for k in range(8):
   if cue=='preparation' and k%3:continue
   note(buf,start+k*beat*.5,beat*.4,melody[(bar*3+k)%8]+transpose,.05*dynamic,timbre)
  if cue not in ['title','preparation']:
   for k in range(4):
    begin=round((start+k*beat)*SR)
    for i in range(round(.12*SR)):
     t=i/SR;sample=(math.sin(math.tau*(55*t+.4*(1-math.exp(-t*25))))*.1 if k%2==0 else rng.uniform(-1,1)*.06)*math.exp(-t*28);buf[begin+i]+=sample
 peak=max(abs(v) for v in buf);gain=.78/peak
 pcm=array('h',(round(v*gain*min(1,i/(SR*.08),(len(buf)-1-i)/(SR*.12))*32767) for i,v in enumerate(buf)))
 path=OUT/f'music.{cue}.wav'
 with wave.open(str(path),'wb') as f:f.setnchannels(1);f.setsampwidth(2);f.setframerate(SR);f.writeframes(pcm.tobytes())
 tracks.append({'key':cue,'file':path.name,'duration':duration,'sha256':hashlib.sha256(path.read_bytes()).hexdigest()});score.append({'cue':cue,'bpm':bpm,'bars':bars,'transpose':transpose,'timbre':timbre,'melody':melody})
for cue,melody in [('victory',[62,65,69,74,77,81]),('defeat',[62,60,57,53,50,45])]:
 duration=3.4;buf=array('f',[0])*round(duration*SR)
 for i,pitch in enumerate(melody):note(buf,i*.35,1.4,pitch,.09,'brass' if cue=='victory' else 'pad')
 peak=max(abs(v) for v in buf);pcm=array('h',(round(v/max(1,peak)*.8*32767) for v in buf));path=OUT/f'stinger.{cue}.wav'
 with wave.open(str(path),'wb') as f:f.setnchannels(1);f.setsampwidth(2);f.setframerate(SR);f.writeframes(pcm.tobytes())
 tracks.append({'key':cue,'file':path.name,'duration':duration,'sha256':hashlib.sha256(path.read_bytes()).hexdigest()})
for t in tracks:
 source=OUT/t['file'];target=source.with_suffix('.ogg');subprocess.run(['ffmpeg','-y','-loglevel','error','-i',str(source),'-c:a','libopus','-b:a','40k','-vbr','on',str(target)],check=True);source.unlink();t['file']=target.name;t['sha256']=hashlib.sha256(target.read_bytes()).hexdigest()
(OUT/'manifest.json').write_text(json.dumps({'original':True,'source':'assets/source/full/generate_music.py','sampleRate':SR,'encoding':'Opus mono 40 kbps','tracks':tracks},indent=2)+'\n');(ROOT/'assets/source/full/score.json').write_text(json.dumps(score,indent=2)+'\n');print('8 original cues authored')
