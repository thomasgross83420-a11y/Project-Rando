"""Build a review document from measured motion and unchanged browser screenshots.

Matplotlib draws a new scientific plot; ReportLab documents the checkpoint.
Neither edits game/source artwork or adds a runtime dependency.
"""
from pathlib import Path
from html import escape
import hashlib
import json
import os
import shutil
import zipfile
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Image, PageBreak, Spacer
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
ROOT=Path(__file__).resolve().parents[1]
OUT=Path(os.environ.get('RB_RECOVERY_REVIEW_DIR','/workspace/shared/Resonance_Bastion_Recovery'))
REVIEW=ROOT/'docs/review'
DELIVERY=Path(os.environ.get('RB_DELIVERY_DIR','/workspace/shared/downloads'))
OUT.mkdir(parents=True,exist_ok=True);DELIVERY.mkdir(parents=True,exist_ok=True)
report=json.loads((ROOT/'docs/evidence/MOVEMENT_360.json').read_text())
fig,axes=plt.subplots(2,2,figsize=(9,9),layout='constrained')
labels=['Rifle Squad','Bulwark','Fracture Runner','Raider']
for ax,asset,label in zip(axes.flat,report['assets'],labels):
    points=asset['samples']
    for p in points: ax.plot([0,p['xGU']],[0,-p['yGU']],color='#257d8b',linewidth=.55,alpha=.7)
    ax.scatter([p['xGU'] for p in points],[-p['yGU'] for p in points],s=12,color='#b07530',zorder=3)
    ax.set_title(f"{label} • {asset['nominalSpeedGU']:.3g} GU/s")
    ax.set_aspect('equal');ax.set_xlim(-3.3,3.3);ax.set_ylim(-3.3,3.3)
    ax.set_xlabel('World +X (GU)');ax.set_ylabel('World −Y (GU)');ax.grid(alpha=.18)
fig.suptitle('Actual 1-second displacement at 48 intermediate angles per body\nIsolated production solver; no eight-way travel restriction',fontsize=14)
fig.savefig(OUT/'movement-360.png',dpi=150)
fig.savefig(OUT/'movement-360.svg')
plt.close(fig)
for name,font in [('Review','DejaVuSans.ttf'),('ReviewBold','DejaVuSans-Bold.ttf')]:pdfmetrics.registerFont(TTFont(name,'/usr/share/fonts/truetype/dejavu/'+font))
pdfmetrics.registerFontFamily('Review',normal='Review',bold='ReviewBold',italic='Review',boldItalic='ReviewBold')
styles=getSampleStyleSheet()
styles.add(ParagraphStyle('RBBody',fontName='Review',fontSize=10,leading=14,spaceAfter=8,textColor=colors.HexColor('#20333f')))
styles.add(ParagraphStyle('RBTitle',parent=styles['RBBody'],fontName='ReviewBold',fontSize=19,leading=25,spaceAfter=14))
styles.add(ParagraphStyle('RBHeading',parent=styles['RBBody'],fontName='ReviewBold',fontSize=14,leading=19,spaceBefore=10,spaceAfter=8))
story=[];pending=[]
def flush():
    if pending:story.append(Paragraph(escape(' '.join(pending)),styles['RBBody']));pending.clear()
for line in (REVIEW/'OMNIDIRECTIONAL_RECOVERY.md').read_text().splitlines():
    if not line.strip():flush()
    elif line.startswith('# '):flush();story.append(Paragraph(escape(line[2:]),styles['RBTitle']))
    elif line.startswith('## '):flush();story.append(Paragraph(escape(line[3:]),styles['RBHeading']))
    else:pending.append(line)
flush()
def image_page(title,caption,path,width=470):
    story.append(PageBreak());story.append(Paragraph(title,styles['RBTitle']));story.append(Paragraph(caption,styles['RBBody']))
    w,h=ImageReader(str(path)).getSize();scale=min(width/w,620/h)
    story.append(Image(str(path),width=w*scale,height=h*scale))
image_page('Full-angle movement measurements','Each ray is an actual production-solver displacement, not a drawn estimate. Native authoritative heading precision remains independent of eight presentation facings. This does not certify anatomy or foot contacts.',OUT/'movement-360.png')
image_page('Data Management — actual UI','Current production preview on an 800×1280 touch viewport. These are visible dialog portions; scroll reveals the remaining controls. Desktop Chromium evidence, not an Android file-picker or performance certification.',OUT/'data-management.png')
image_page('Import preview — actual UI','The player chooses destination slots and whether to apply settings. Confirmation replaces selected campaign state. The visible campaign is a UI-created disposable review example, not your player progress.',OUT/'import-preview.png')
image_page('Restore Previous — actual UI','A concrete wallet/revision comparison and export option precede rollback. Claims and sequence watermarks remain outside restorable snapshots. No rollback was applied during this screenshot capture.',OUT/'restore-preview.png')
def footer(c,doc):
    c.setFont('Review',8);c.setFillColor(colors.HexColor('#57717d'));c.drawString(38,24,'Resonance Bastion • build 0.2.3 • physical-device verification pending');c.drawRightString(A4[0]-38,24,str(doc.page))
pdf=REVIEW/'Resonance_Bastion_Movement_Recovery_Review.pdf'
SimpleDocTemplate(str(pdf),pagesize=A4,rightMargin=38,leftMargin=38,topMargin=38,bottomMargin=40).build(story,onFirstPage=footer,onLaterPages=footer)
files={pdf.name:pdf,'OMNIDIRECTIONAL_RECOVERY.md':REVIEW/'OMNIDIRECTIONAL_RECOVERY.md','RECOVERY_CONTRACT.md':ROOT/'docs/RECOVERY_CONTRACT.md','ECONOMY_POLICY.md':ROOT/'docs/ECONOMY_POLICY.md'}
for name in ['MOVEMENT_360.json','ECONOMY_ARITHMETIC.json']:files['evidence/'+name]=ROOT/'docs/evidence'/name
for name in ['movement-360.png','movement-360.svg','data-management.png','backup-ready.png','import-preview.png','restore-preview.png','capture.json']:files['review/'+name]=OUT/name
manifest={name:{'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}for name,p in files.items()}
zpath=REVIEW/'Resonance_Bastion_Movement_Recovery_Review.zip'
with zipfile.ZipFile(zpath,'w',zipfile.ZIP_DEFLATED)as z:
    for name,p in files.items():z.write(p,name)
    z.writestr('MANIFEST.json',json.dumps(manifest,indent=2)+'\n')
with zipfile.ZipFile(zpath)as z:
    assert z.testzip()is None
    for name,m in manifest.items():assert hashlib.sha256(z.read(name)).hexdigest()==m['sha256']
for p in [pdf,zpath]:shutil.copyfile(p,DELIVERY/p.name)
print(json.dumps({p.name:{'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}for p in [pdf,zpath]},indent=2))
