"""Original structured scores and effects, reproducible PCM16 mono WAV.
Python standard library only. Offline cosmetic synthesis never informs game RNG.
"""
from pathlib import Path
from array import array
import math,random,json,wave,hashlib
ROOT=Path(__file__).resolve().parents[3];OUT=ROOT/'public/assets/audio';OUT.mkdir(exist_ok=True,parents=True)
SR=16000;DURATION=96;BEAT=.75
progression=[[50,53,57,60],[46,50,53,57],[48,52,55,58],[45,48,52,55],[50,53,57,62],[53,57,60,64],[48,52,55,62],[45,52,55,57]]
melodies=[[74,69,72,77,76,72,69,67],[69,72,74,77,81,77,76,72],[77,76,74,69,67,69,72,74],[74,77,81,79,77,76,72,69]]
score={'schema':1,'sampleRate':SR,'seconds':DURATION,'bpm':80,'bars':32,'beatsPerBar':4,'progression':progression,'melodyPhrases':melodies,'loopFadeSeconds':1.5,'source':'generate_audio.py','purpose':'Original presentation only; no gameplay input'}
(ROOT/'assets/source/combat/score.json').write_text(json.dumps(score,indent=2)+'\n')
manifest=[]
def write(key,buf):
    mean=sum(buf)/len(buf);buf=array('f',(x-mean for x in buf));peak=max(abs(x) for x in buf);gain=.82/peak if peak else 1
    # Whole loops enter/leave zero smoothly; every SFX envelope also ends at zero.
    for i in range(len(buf)):
        fade=min(1,i/(SR*.02),(len(buf)-1-i)/(SR*.03));buf[i]*=gain*max(0,fade)
    pcm=array('h',(round(max(-1,min(1,x))*32767) for x in buf));
    import sys
    if sys.byteorder!='little':pcm.byteswap()
    path=OUT/(key+'.wav')
    with wave.open(str(path),'wb') as f:f.setnchannels(1);f.setsampwidth(2);f.setframerate(SR);f.writeframes(pcm.tobytes())
    rms=math.sqrt(sum(x*x for x in buf)/len(buf));manifest.append({'key':key,'file':path.name,'duration':len(buf)/SR,'sampleRate':SR,'channels':1,'format':'PCM16 WAV','peak':max(abs(x) for x in buf),'rms':rms,'loopJump':abs(buf[-1]-buf[0]),'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'source':'assets/source/combat/generate_audio.py','status':'Original integrated candidate; listening/device review required'})
def note(buf,start,duration,midi,amplitude,instrument):
    frequency=440*2**((midi-69)/12);begin=round(start*SR);count=min(round(duration*SR),len(buf)-begin)
    harmonics={'pad':[(1,1),(2,.18),(3,.10)],'bell':[(1,1),(2,.35),(4,.12)],'bass':[(1,1),(2,.24)],'lead':[(1,1),(2,.4),(3,.15)]}[instrument]
    table=[sum(math.sin(math.tau*i/2048*h)*weight for h,weight in harmonics) for i in range(2048)];phase=0;advance=frequency/SR*2048
    for i in range(count):
        t=i/SR;attack=.3 if instrument=='pad' else .012;release=.4 if instrument=='pad' else .10;env=min(1,t/attack,(duration-t)/release)*(.7+(.3*math.exp(-t*3)) if instrument=='bell' else 1);buf[begin+i]+=amplitude*max(0,env)*table[int(phase)%2048];phase+=advance
for cue in ['music.title','music.preparation','music.fracture']:
    buf=array('f',[0])*round(DURATION*SR);rng=random.Random(1907);combat=cue=='music.fracture'
    for bar in range(32):
        chord=progression[bar%8];start=bar*4*BEAT;phrase=melodies[(bar//8)%4];dynamic=[.7,.9,.8,1][bar//8]
        for pitch in chord:note(buf,start,4*BEAT,pitch+12,.032*dynamic,'pad')
        for beat in range(4):note(buf,start+beat*BEAT,BEAT*.85,chord[0]-12+(12 if beat==2 else 0),.12 if combat else .08,'bass')
        for step in range(8):
            pitch=phrase[(bar*3+step)%8]
            if cue=='music.preparation' and step%3!=0:continue
            note(buf,start+step*.5*BEAT,.45*BEAT,pitch,.07*dynamic if combat else .05,'lead' if combat else 'bell')
        for beat in range(4):
            if not combat and beat not in [0,2]:continue
            begin=round((start+beat*BEAT)*SR);size=round(.13*SR);phase=0
            for i in range(size):
                t=i/SR;phase+=math.tau*(65+90*math.exp(-t*40))/SR;noise=rng.uniform(-1,1);sample=.14*math.sin(phase)*math.exp(-t*24) if beat%2==0 else .08*noise*math.exp(-t*35);buf[begin+i]+=sample
    for i in range(len(buf)):
        t=i/SR;buf[i]*=min(1,t/1.5,(DURATION-t)/1.5)
    write(cue,buf)
def effect(key,seconds,base,sweep,noiseAmount,seed):
    rng=random.Random(seed);buf=array('f');phase=0;count=round(seconds*SR)
    for i in range(count):
        t=i/count;phase+=math.tau*(base*(1+sweep*(1-t)))/SR;envelope=min(1,t*50)*(1-t)**2;sample=(math.sin(phase)*.6+math.sin(phase*2.01)*.15+rng.uniform(-1,1)*noiseAmount)*envelope;buf.append(sample)
    write(key,buf)
for args in [('sfx.sentry',.12,120,-.5,.45,1),('sfx.rifle',.10,170,-.4,.60,2),('sfx.bulwark',.18,90,-.2,.50,3),('sfx.melee',.16,180,.3,.45,4),('sfx.impact',.13,310,-.7,.35,5),('sfx.mine',.65,55,1,.8,6),('sfx.repair',.4,520,.4,.05,7),('sfx.interpose',.45,210,1,.15,8),('sfx.challenge',.55,300,-.4,.25,9),('sfx.holdfast',.7,140,.5,.05,10),('alert.wave',.65,660,-.2,.05,11),('alert.core',.85,440,.25,.1,12),('ui.confirm',.10,800,-.3,0,13)]:effect(*args)
for key,pitches in [('stinger.victory',[62,65,69,74]),('stinger.defeat',[62,58,55,50])]:
    buf=array('f',[0])*round(2.4*SR)
    for i,pitch in enumerate(pitches):note(buf,i*.25,1.1,pitch,.16,'bell')
    write(key,buf)
(OUT/'manifest.json').write_text(json.dumps({'schema':1,'original':True,'source':'assets/source/combat/score.json','tracks':manifest},indent=2)+'\n')
print(json.dumps({'tracks':len(manifest),'musicSeconds':[r['duration'] for r in manifest if r['key'].startswith('music.')],'maxPeak':max(r['peak'] for r in manifest),'maxLoopJump':max(r['loopJump'] for r in manifest),'bytes':sum((OUT/r['file']).stat().st_size for r in manifest)}))
