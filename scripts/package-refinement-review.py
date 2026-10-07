"""Package existing verified images/video unchanged into a mobile review.

ReportLab is document-only tooling, not a game dependency. This does not edit art.
Run audit:art, audit:balance and capture-review-motion.mjs before packaging.
Convert the recorded WebM to MP4 with ffmpeg; no system audio is captured.
"""
from pathlib import Path
from html import escape
import hashlib
import json
import os
import shutil
import subprocess
import zipfile

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.platypus import Image, PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

ROOT = Path(__file__).resolve().parents[1]
MEDIA = Path(os.environ.get('RB_ANIMATION_REVIEW_DIR', '/workspace/shared/Resonance_Bastion_Animation'))
DELIVERY = Path(os.environ.get('RB_DELIVERY_DIR', '/workspace/shared/downloads'))
REVIEW = ROOT / 'docs/review'
PDF = REVIEW / 'Resonance_Bastion_Refinement_Review.pdf'
ZIP = REVIEW / 'Resonance_Bastion_Refinement_Review.zip'
probe = json.loads(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration:stream=codec_name,width,height','-of','json',str(MEDIA/'tutorial-live.mp4')]))
assert float(probe['format']['duration']) >= 45
assert any(s.get('codec_name') == 'h264' and s.get('width') == 800 and s.get('height') == 1280 for s in probe['streams'])
BASE = 'https://raw.githubusercontent.com/thomasgross83420-a11y/Project-Rando/codex/animation-refinement/docs/review/'
for name, font in [('Review', 'DejaVuSans.ttf'), ('ReviewBold', 'DejaVuSans-Bold.ttf')]:
    pdfmetrics.registerFont(TTFont(name, '/usr/share/fonts/truetype/dejavu/' + font))
pdfmetrics.registerFontFamily('Review', normal='Review', bold='ReviewBold', italic='Review', boldItalic='ReviewBold')
styles = getSampleStyleSheet()
styles.add(ParagraphStyle('RBBody', fontName='Review', fontSize=10, leading=14, spaceAfter=7, textColor=colors.HexColor('#20333f'), splitLongWords=True))
styles.add(ParagraphStyle('RBTitle', parent=styles['RBBody'], fontName='ReviewBold', fontSize=19, leading=25, spaceAfter=14))
styles.add(ParagraphStyle('RBHeading', parent=styles['RBBody'], fontName='ReviewBold', fontSize=14, leading=19, spaceBefore=10, spaceAfter=8))
styles.add(ParagraphStyle('RBCaption', parent=styles['RBBody'], fontSize=8, leading=11))
story = []
pending = []
def flush():
    if pending:
        story.append(Paragraph(escape(' '.join(pending)), styles['RBBody']))
        pending.clear()
for line in (REVIEW / 'ANIMATION_REFINEMENT.md').read_text().splitlines():
    if not line.strip():
        flush()
    elif line.startswith('# '):
        flush(); story.append(Paragraph(escape(line[2:]), styles['RBTitle']))
    elif line.startswith('## '):
        flush(); story.append(Paragraph(escape(line[3:]), styles['RBHeading']))
    else:
        pending.append(line)
flush()
story.append(Paragraph(f'<link href="{BASE}Resonance_Bastion_Refinement_Motion.mp4" color="#00656b">Open/download the actual 1× motion video</link>', styles['RBBody']))
story.append(PageBreak())
story.append(Paragraph('Controlled tutorial comparisons', styles['RBTitle']))
report = json.loads((ROOT / 'docs/evidence/TUTORIAL_BALANCE.json').read_text())
rows = [['Case', 'Outcome', 'Seconds', 'Core HP', 'Repair', 'Mine loss']]
for r in report['results']:
    rows.append([r['id'], r['outcome'], f"{r['combatSeconds']:.2f}", f"{r['coreRemaining']:.2f}", f"{r['actualRepair']:.2f}", str(r['damageByRole'].get('friendly.proximity_mine', 0))])
table = Table(rows, colWidths=[150, 57, 51, 66, 55, 57], repeatRows=1)
table.setStyle(TableStyle([('FONTNAME',(0,0),(-1,-1),'Review'),('FONTSIZE',(0,0),(-1,-1),7),('BACKGROUND',(0,0),(-1,0),colors.HexColor('#d4e8ea')),('ROWBACKGROUNDS',(0,1),(-1,-1),[colors.white,colors.HexColor('#eff4f5')]),('TOPPADDING',(0,0),(-1,-1),8),('BOTTOMPADDING',(0,0),(-1,-1),8)]))
story.append(table)
story.append(Spacer(1,12))
story.append(Paragraph('Actual capped damage/healing, not theoretical DPS. Fixed Bulwark/Bastion schedule and layout; role removal changes later targeting, runtime tie-breaks and random consumption. Do not infer whole-game balance or isolated role rankings. The unarmed diagnostic ends under Inevitable Defeat, not Core destruction.', styles['RBBody']))
story.append(PageBreak())
story.append(Paragraph('Pose attachment inspection', styles['RBTitle']))
story.append(Paragraph('Left: original idle damage marks. Right: current pose attachment. Native pixels enlarged by the read-only browser checker; bodies and source PNGs unchanged. This validates overlay geometry, not final anatomy.', styles['RBBody']))
from reportlab.lib.utils import ImageReader
comparison = MEDIA / 'pose-attachment-comparison.png'
w,h = ImageReader(str(comparison)).getSize()
story.append(Image(str(comparison),width=435,height=435*h/w))
story.append(PageBreak())
story.append(Paragraph('Rifle keypose source guide — not in game', styles['RBTitle']))
story.append(Paragraph('Four conceptual keys: contact/down/passing/up. Magenta backdrop is source-study presentation. Not transparent native sprites, a finished eight-phase cycle, eight directions or approval of anatomy/equipment. Review this design before detailed runtime authoring.', styles['RBBody']))
guide = ROOT / 'assets/source/combat/studies/rifle-keyposes-r2.png'
w,h = ImageReader(str(guide)).getSize()
story.append(Image(str(guide),width=480,height=480*h/w))
story.append(Spacer(1,12))
story.append(Paragraph('Useful feedback: does this design and weight match the intended Rifle, and what looks wrong in the live motion? Exact Android/browser version and RAM will help physical-device measurement. Engineering is not blocked by a new gameplay-rule question.', styles['RBBody']))
def footer(canvas, doc):
    canvas.setFont('Review',8); canvas.setFillColor(colors.HexColor('#57717d'))
    canvas.drawString(38,24,'Resonance Bastion • build 0.2.2 • desktop evidence, tablet measurement pending')
    canvas.drawRightString(A4[0]-38,24,str(doc.page))
SimpleDocTemplate(str(PDF),pagesize=A4,rightMargin=38,leftMargin=38,topMargin=38,bottomMargin=40).build(story,onFirstPage=footer,onLaterPages=footer)
shutil.copyfile(MEDIA / 'tutorial-live.mp4', REVIEW / 'Resonance_Bastion_Refinement_Motion.mp4')
files = {
    'Resonance_Bastion_Refinement_Review.pdf': PDF,
    'ANIMATION_REFINEMENT.md': REVIEW / 'ANIMATION_REFINEMENT.md',
    'tutorial-live.mp4': MEDIA / 'tutorial-live.mp4',
    'motion-capture.json': MEDIA / 'motion-capture.json',
    'pose-attachment-comparison.png': comparison,
    'rifle-keyposes-r2.png': guide,
    'rifle-source-provenance.md': guide.parent / 'provenance.md',
    'RESEARCH_ANIMATION.md': ROOT / 'docs/RESEARCH_ANIMATION.md',
    'DEVICE_TARGET.md': ROOT / 'docs/DEVICE_TARGET.md',
}
for name in ['POSE_DAMAGE_RUNTIME.json','TUTORIAL_BALANCE.json','TUTORIAL_BALANCE_BEFORE.json']:
    files['evidence/'+name] = ROOT / 'docs/evidence' / name
manifest = {name: {'bytes': p.stat().st_size, 'sha256': hashlib.sha256(p.read_bytes()).hexdigest()} for name,p in files.items()}
with zipfile.ZipFile(ZIP,'w',zipfile.ZIP_DEFLATED) as z:
    for name,p in files.items(): z.write(p,name)
    z.writestr('MANIFEST.json',json.dumps(manifest,indent=2)+'\n')
with zipfile.ZipFile(ZIP) as z:
    assert z.testzip() is None
    for name, m in manifest.items(): assert hashlib.sha256(z.read(name)).hexdigest() == m['sha256']
DELIVERY.mkdir(parents=True,exist_ok=True)
for p in [PDF,ZIP,REVIEW/'Resonance_Bastion_Refinement_Motion.mp4']:
    shutil.copyfile(p,DELIVERY/p.name)
print(json.dumps({p.name: {'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in [PDF,ZIP,REVIEW/'Resonance_Bastion_Refinement_Motion.mp4']},indent=2))
