"""Document specified growth arithmetic and result transaction evidence.
Creates a new scientific plot and vector document; does not edit game art.
"""
from pathlib import Path
from html import escape
import hashlib,json,shutil,zipfile
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import SimpleDocTemplate,Paragraph,Image,PageBreak,Spacer,Table,TableStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
ROOT=Path(__file__).resolve().parents[1]
REVIEW=ROOT/'docs/review'
OUT=Path('/workspace/shared/Resonance_Bastion_Result_Contracts')
DELIVERY=Path('/workspace/shared/downloads')
OUT.mkdir(parents=True,exist_ok=True);DELIVERY.mkdir(parents=True,exist_ok=True)
report=json.loads((ROOT/'docs/evidence/PROGRESSION_CONTRACTS.json').read_text())
g=report['growth']
fig,ax=plt.subplots(figsize=(8.5,5.2),layout='constrained')
x=[r['level']for r in g]
ax.plot(x,[r['maximumIntegrity']for r in g],label='Maximum Integrity',color='#197b8b',linewidth=2)
ax.plot(x,[r['woundedIntegrity']for r in g],label='Living body with 100 points missing',color='#ac751e',linewidth=2)
ax.plot(x,[0]*100,label='Zero body stays zero',color='#a34452',linestyle='--')
ax.set_xlabel('Asset Level');ax.set_ylabel('Sentry body Integrity (points)');ax.set_ylim(-80,2850);ax.set_xlim(1,100)
ax.grid(alpha=.18);ax.legend(loc='upper left',fontsize=9)
ax.set_title('Specified Sentry growth preserves injury\nAssumes explicit purchase of each allowed enhancement; not live progression',fontsize=12)
fig.savefig(OUT/'specified-growth.png',dpi=150);fig.savefig(OUT/'specified-growth.svg');plt.close(fig)
for name,font in [('Review','DejaVuSans.ttf'),('ReviewBold','DejaVuSans-Bold.ttf')]:pdfmetrics.registerFont(TTFont(name,'/usr/share/fonts/truetype/dejavu/'+font))
body=ParagraphStyle('Body',fontName='Review',fontSize=10,leading=14,spaceAfter=8,textColor=colors.HexColor('#243946'))
title=ParagraphStyle('Title',parent=body,fontName='ReviewBold',fontSize=18,leading=24,spaceAfter=12)
heading=ParagraphStyle('Heading',parent=body,fontName='ReviewBold',fontSize=13,leading=18,spaceBefore=10,keepWithNext=True)
story=[];pending=[]
def flush():
 if pending:story.append(Paragraph(escape(' '.join(pending)),body));pending.clear()
for line in (REVIEW/'CAMPAIGN_RESULT_CONTRACTS.md').read_text().splitlines():
 if not line.strip():flush()
 elif line.startswith('# '):flush();story.append(Paragraph(escape(line[2:]),title))
 elif line.startswith('## '):flush();story.append(Paragraph(escape(line[3:]),heading))
 else:pending.append(line)
flush()
story.append(PageBreak());story.append(Paragraph('Specified growth, preserved wounds',title))
story.append(Paragraph('The plot uses the exact tested growth kernel. Upgrades shown are assumed purchases, not automatic or free grants. A living injury remains 100 points below the new maximum; XP cannot revive zero body. Existing player combat has not been changed.',body))
story.append(Image(str(OUT/'specified-growth.png'),width=470,height=288))
story.append(Spacer(1,12));story.append(Paragraph('Sentry Level 100 / Enhancement 10 reference',heading))
rows=[['Field','Verified value'],['Maximum Integrity','2652'],['Per-shot damage','85197 / 1024 = 83.2001953125'],['Weapon interval','38 ticks = 0.633333… seconds'],['Range','9421 / 1024 = 9.2001953125 GU'],['Accuracy','95% reference; growth equation awaits clarification']]
table=Table([[Paragraph(escape(v),body)for v in row]for row in rows],colWidths=[150,320])
table.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),colors.HexColor('#e3edf0')),('GRID',(0,0),(-1,-1),.4,colors.HexColor('#afc2ca')),('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),7),('RIGHTPADDING',(0,0),(-1,-1),7)]));story.append(table)
def footer(c,doc):
 c.setFont('Review',8);c.setFillColor(colors.HexColor('#57717d'));c.drawString(38,24,'Resonance Bastion • 0.2.4 • staged contracts; tablet checks pending');c.drawRightString(A4[0]-38,24,str(doc.page))
pdf=REVIEW/'Resonance_Bastion_Result_Contracts_Review.pdf'
SimpleDocTemplate(str(pdf),pagesize=A4,leftMargin=38,rightMargin=38,topMargin=38,bottomMargin=40).build(story,onFirstPage=footer,onLaterPages=footer)
files={pdf.name:pdf,'CAMPAIGN_RESULT_CONTRACTS.md':REVIEW/'CAMPAIGN_RESULT_CONTRACTS.md','RUN_RESULT_CONTRACT.md':ROOT/'docs/RUN_RESULT_CONTRACT.md','evidence/PROGRESSION_CONTRACTS.json':ROOT/'docs/evidence/PROGRESSION_CONTRACTS.json','evidence/RESULT_CONTRACT_TESTS.json':ROOT/'docs/evidence/RESULT_CONTRACT_TESTS.json','data/progression.json':ROOT/'src/data/progression.json','tools/pin-progression.py':ROOT/'scripts/pin-progression.py','review/specified-growth.png':OUT/'specified-growth.png','review/specified-growth.svg':OUT/'specified-growth.svg'}
manifest={name:{'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}for name,p in files.items()}
zpath=REVIEW/'Resonance_Bastion_Result_Contracts_Review.zip'
with zipfile.ZipFile(zpath,'w',zipfile.ZIP_DEFLATED)as z:
 for name,p in files.items():z.write(p,name)
 z.writestr('MANIFEST.json',json.dumps(manifest,indent=2)+'\n')
with zipfile.ZipFile(zpath)as z:
 assert z.testzip()is None
 for name,m in manifest.items():assert len(z.read(name))==m['bytes']and hashlib.sha256(z.read(name)).hexdigest()==m['sha256']
for p in [pdf,zpath]:shutil.copyfile(p,DELIVERY/p.name)
print(json.dumps({p.name:{'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}for p in [pdf,zpath]},indent=2))
