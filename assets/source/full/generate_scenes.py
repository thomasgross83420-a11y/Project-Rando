"""Original ending and mastery raster illustrations, entirely drawn from geometry."""
from PIL import Image,ImageDraw
from pathlib import Path
import math
root=Path(__file__).resolve().parents[3]/'public/assets/full'
for name,master in [('campaign-ending',False),('bastion-master',True)]:
 im=Image.new('RGB',(640,360),'#111923');p=ImageDraw.Draw(im)
 for y in range(220):p.line((0,y,640,y),fill=(17+y//15,25+y//20,35+y//18))
 for i in range(65):x=(i*109+17)%640;y=(i*47+13)%160;p.rectangle((x,y,x+1,y+1),fill='#728393')
 # Distant broken basalt ridges, foreground field and layered fortress foundations.
 for offset,color in [(0,'#293843'),(40,'#1e2c36')]:p.polygon([(0,215+offset),(0,188+offset),(48,142+offset),(99,195+offset),(148,166+offset),(191,209+offset),(278,175+offset),(355,195+offset),(421,149+offset),(468,183+offset),(570,142+offset),(640,184+offset),(640,360),(0,360)],fill=color)
 p.polygon([(82,252),(316,141),(552,252),(317,357)],fill='#40505c',outline='#73818b')
 for d in range(0,190,19):p.line((108+d,247-d//2,342+d,354-d//2),fill='#33434e');p.line((317-d,152+d//2,538-d,259+d//2),fill='#4c5c67')
 for i in range(8):
  angle=i*math.tau/8;x=round(318+180*math.cos(angle));y=round(254+79*math.sin(angle));p.polygon([(x-13,y+2),(x-13,y-17),(x,y-24),(x+13,y-17),(x+13,y+2),(x,y+9)],fill='#52616b',outline='#91a0a8');p.line((x,y-21,x,y-46),fill='#78848b',width=2)
  color=['#79d7d6','#d78964','#b996d5','#b4bd80'][i%4];p.polygon([(x+2,y-45),(x+16,y-39),(x+9,y-33),(x+2,y-35)],fill=color)
  if not master:p.line((x+2,y-43,x+9,y-39),fill='#26333c',width=2)
 p.ellipse((229,231,411,305),fill='#192832',outline='#7b9aa2',width=3);p.ellipse((246,230,394,289),outline='#d3a459',width=2)
 p.polygon([(276,267),(268,219),(287,197),(320,185),(352,202),(371,226),(365,267),(320,288)],fill='#506672',outline='#8aa6af');p.polygon([(320,186),(352,202),(371,226),(320,247)],fill='#708691');p.polygon([(320,186),(287,197),(268,219),(320,247)],fill='#3f5562');p.line((320,247,320,286),fill='#a7b6bb',width=2)
 p.polygon([(320,91),(346,159),(330,215),(307,215),(294,159)],fill='#76d7cb',outline='#c5f5e8');p.polygon([(320,91),(320,212),(294,159)],fill='#408c9a');p.line((320,98,320,208),fill='#e5fff7',width=2)
 for i in range(10):x=260+i*13;p.line((x,301,x,309),fill='#9bb2b7')
 if master:
  for side in [-1,1]:
   for i in range(8):x=320+side*(75+i*6);y=194+i*10;p.polygon([(x,y),(x+side*15,y-9),(x+side*19,y),(x+side*4,y+5)],fill='#d3a459',outline='#ffdaa0')
 im.save(root/(name+'.png'),optimize=True)
