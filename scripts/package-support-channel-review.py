from pathlib import Path
from html import escape
import json,hashlib,zipfile,shutil
from reportlab.platypus import SimpleDocTemplate,Paragraph,Spacer,Table,TableStyle
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
ROOT=Path(__file__).resolve().parents[1];review=ROOT/'docs/review';delivery=Path('/workspace/shared/downloads')
evidence=json.loads((ROOT/'docs/evidence/SUPPORT_CHANNEL_TESTS.json').read_text())
for name,file in [('Review','DejaVuSans.ttf'),('Bold','DejaVuSans-Bold.ttf')]:pdfmetrics.registerFont(TTFont(name,'/usr/share/fonts/truetype/dejavu/'+file))
body=ParagraphStyle('Body',fontName='Review',fontSize=10,leading=14,spaceAfter=10,textColor=colors.HexColor('#243946'))
head=ParagraphStyle('Heading',parent=body,fontName='Bold',fontSize=13,leading=18,spaceBefore=10,keepWithNext=True)
title=ParagraphStyle('Title',parent=head,fontSize=19,leading=25)
story=[]
def para(text,style=body):story.append(Paragraph(escape(text),style))
para('Resonance Bastion',title);para('Support-channel review • 0.2.7 • 2026-10-08',head)
para('Development continued beyond the paid-combat review. A focused four-Repair-Node test exposed a discrepancy between the shared channel limit and self-repair. The correction is implemented and verified; no new user decision was required.')
para('Correcting one individual interaction',head)
para('The blueprint allows two external repair sources per recipient and permits eligible self-repair. The older implementation counted self-repair against the external cap, and could block it entirely when that identity was processed last. The new simulation counts external sources separately, without allowing an extra external source or a second outgoing channel from one Node.')
t=Table([[Paragraph(escape(v),body) for v in row] for row in [['Half-body Node, three neighboring Nodes','v3','v4'],['External sources plus eligible self','Two sources total','Two external + self'],['Actual first pulse-cycle repair','12.5 Integrity','18.75 Integrity']]],colWidths=[250,110,110]);t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),colors.HexColor('#e3edf0')),('GRID',(0,0),(-1,-1),.4,colors.HexColor('#afc2ca')),('VALIGN',(0,0),(-1,-1),'TOP')]));story.append(t);story.append(Spacer(1,10))
para('Each Node still has one channel at 25 Integrity/sec, pulsing every 0.25 seconds. Both recipient ordering cases work. The final wound remainder can be finished without overheal; restoration contribution equals the actual eligible 400-point injury. Destroyed sources and zero-body recipients cannot heal.')
para('Older attempts retain their exact behavior',head)
para('New plans capture rb-sim-v4. Retained v1/v2 practice and v3 paid/practice attempts keep their previous rules. The published whole v3 battle, checkpoint and pending-result hashes match exactly. A finalized v4 result advances the save header atomically with rewards and wounds; loading an old save does not rewrite it.')
para('Verification',head)
para(f"All {evidence['unitTests']} unit tests in {evidence['unitFiles']} files and {evidence['browserTests']} browser checks pass, plus typecheck, lint, formatting, deterministic scenario and production build. Native backup/import verifies both v3 and v4 results through reload, cross-slot rebinding and single-payment finalization. Four deterministic before/after records and source/log hashes are in the ZIP.")
para('Current scope and continuing work',head)
para('The first Bulwark/Bastion paid C01S01 loop and explicit progression/recovery remain playable development work. Engineer/Medic moving channels, injury-scaled support, trap rearm, wider roster and full pacing remain separate increments. Affordable partial-repair previews are the next small recovery improvement. Physical Lenovo/Android performance and full-roster acceptance remain open.')
pdf=review/'Resonance_Bastion_Support_Channel_Review.pdf'
def footer(c,d):c.setFont('Review',8);c.drawString(38,24,'Resonance Bastion • 0.2.7 • supplement to the paid-combat review');c.drawRightString(A4[0]-38,24,str(d.page))
SimpleDocTemplate(str(pdf),pagesize=A4,leftMargin=38,rightMargin=38,topMargin=38,bottomMargin=40).build(story,onFirstPage=footer,onLaterPages=footer)
files={pdf.name:pdf,'Resonance_Bastion_Combat_Progression_Review.pdf':review/'Resonance_Bastion_Combat_Progression_Review.pdf','SUPPORT_CHANNELS.md':ROOT/'docs/SUPPORT_CHANNELS.md','evidence/SUPPORT_CHANNELS.json':ROOT/'docs/evidence/SUPPORT_CHANNELS.json','evidence/SUPPORT_CHANNEL_TESTS.json':ROOT/'docs/evidence/SUPPORT_CHANNEL_TESTS.json'}
manifest={name:{'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}for name,p in files.items()}
zpath=review/'Resonance_Bastion_Support_Channel_Review.zip'
with zipfile.ZipFile(zpath,'w',zipfile.ZIP_DEFLATED)as z:
 for name,p in files.items():z.write(p,name)
 z.writestr('MANIFEST.json',json.dumps(manifest,indent=2)+'\n')
with zipfile.ZipFile(zpath)as z:
 assert z.testzip()is None
 for name,m in manifest.items():assert hashlib.sha256(z.read(name)).hexdigest()==m['sha256']
for p in [pdf,zpath]:shutil.copyfile(p,delivery/p.name)
print(json.dumps({p.name:{'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}for p in [pdf,zpath]},indent=2))
