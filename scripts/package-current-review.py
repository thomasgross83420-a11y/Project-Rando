"""Package the current review from existing verified screenshots and original media.

Uses installed ReportLab for documentation only; no runtime dependency is added.
Run the Gate 2 capture/package tools first, then the optional motion recorder and
ffmpeg conversion. RB_REVIEW_DIR selects the media directory.
"""
from pathlib import Path
from html import escape
import hashlib
import json
import os
import re
import shutil
import subprocess
import zipfile

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.platypus import (
    Image, PageBreak, Paragraph, SimpleDocTemplate, Spacer,
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

ROOT = Path(__file__).resolve().parents[1]
MEDIA = Path(os.environ.get('RB_REVIEW_DIR', '/workspace/shared/Resonance_Bastion_Gate2'))
DELIVERY = Path(os.environ.get('RB_DELIVERY_DIR', '/workspace/shared/downloads'))
DELIVERY.mkdir(parents=True, exist_ok=True)
PDF = MEDIA / 'Resonance_Bastion_Current_Review.pdf'
REPORT = ROOT / 'docs/review/CURRENT_REVIEW.md'
BASE = 'https://raw.githubusercontent.com/thomasgross83420-a11y/Project-Rando/6d6c8e283fa809a4622b50c358235156ab820cb3/public/assets/audio/'

for name, filename in [('Review', 'DejaVuSans.ttf'), ('ReviewBold', 'DejaVuSans-Bold.ttf')]:
    pdfmetrics.registerFont(TTFont(name, '/usr/share/fonts/truetype/dejavu/' + filename))
pdfmetrics.registerFontFamily('Review', normal='Review', bold='ReviewBold', italic='Review', boldItalic='ReviewBold')
styles = getSampleStyleSheet()
styles.add(ParagraphStyle('ReviewBody', fontName='Review', fontSize=11,
                          leading=16, spaceAfter=9, textColor=colors.HexColor('#20333f')))
styles.add(ParagraphStyle('ReviewTitle', parent=styles['ReviewBody'], fontName='ReviewBold',
                          fontSize=21, leading=27, spaceAfter=16))
styles.add(ParagraphStyle('ReviewHeading', parent=styles['ReviewBody'], fontName='ReviewBold',
                          fontSize=15, leading=20, spaceBefore=13, spaceAfter=8))
styles.add(ParagraphStyle('ReviewCaption', parent=styles['ReviewBody'], fontSize=9,
                          leading=13, spaceAfter=8))

def markup(text):
    return re.sub(r'\*\*(.*?)\*\*', r'<b>\1</b>', escape(text))

story = []
pending = []

def flush():
    if pending:
        story.append(Paragraph(markup(' '.join(pending)), styles['ReviewBody']))
        pending.clear()

for line in REPORT.read_text().splitlines():
    if not line.strip():
        flush()
    elif line.startswith('# '):
        flush()
        story.append(Paragraph(markup(line[2:]), styles['ReviewTitle']))
    elif line.startswith('## '):
        flush()
        story.append(Paragraph(markup(line[3:]), styles['ReviewHeading']))
    elif line.startswith('- ') or re.match(r'^\d+\. ', line):
        flush()
        pending.append('• ' + line[2:] if line.startswith('- ') else line)
    else:
        pending.append(line)
flush()

story.append(Paragraph('Listening links', styles['ReviewHeading']))
story.append(Paragraph('The PDF is static. Tap a link to open/download the original WAV, or use the audio folder in the ZIP. The live video has no recorded system audio.', styles['ReviewBody']))
audio = json.loads((ROOT / 'public/assets/audio/manifest.json').read_text())['tracks']
for track in audio:
    url = BASE + track['file']
    story.append(Paragraph(f'<link href="{escape(url)}" color="#00656b">{escape(track["key"])} — {track["duration"]} seconds</link>', styles['ReviewCaption']))

captures = json.loads((MEDIA / 'runtime-capture.json').read_text())['captures']
titles = {
    '01-fit-base': 'Purchased-base overview and strategic role markers',
    '02-tactical': 'Tactical view with actual combat candidates',
    '03-camera-90': 'Camera rotated 90 degrees',
    '04-camera-180': 'Camera rotated 180 degrees',
    '05-camera-270': 'Camera rotated 270 degrees',
    '06-close-hostile': 'Close view of an observed hostile',
    '07-high-contrast-reduced': 'High contrast with reduced effects',
    '08-landscape': 'Landscape tutorial interface',
    '09-landscape-200': 'Landscape with 200% interface text',
    '10-portrait-200': 'Portrait with 200% interface text',
}

def image_page(title, caption, path):
    story.append(PageBreak())
    story.append(Paragraph(markup(title), styles['ReviewHeading']))
    story.append(Paragraph(markup(caption), styles['ReviewCaption']))
    im = Image(str(path))
    factor = min(499 / im.imageWidth, 650 / im.imageHeight)
    im.drawWidth = im.imageWidth * factor
    im.drawHeight = im.imageHeight * factor
    im.hAlign = 'LEFT'
    story.append(im)

for capture in captures:
    viewport = capture['viewport']
    camera = capture['camera']
    caption = (f"Actual development runtime. Source {viewport['width']}x{viewport['height']}; "
               f"text {capture['interfaceScale']}; camera {camera['orientation']} degrees; "
               f"zoom {float(camera['zoom']):.3f}; simulation tick {capture['simulationTick']}. "
               'Candidate review; source pixels retained in the PDF and ZIP.')
    image_page(titles[capture['name']], caption, MEDIA / (capture['name'] + '.png'))

for name, title in [
    ('mobile-directions', 'Mobile candidates: all eight facing directions'),
    ('stationary-views', 'Core, Sentry and support: view/aim candidates'),
    ('friendly.rifle_squad', 'Rifle Squad: animation frame families'),
    ('enemy.runner', 'Runner: animation frame families'),
    ('enemy.raider', 'Raider: animation frame families'),
    ('warden.bulwark', 'Bulwark: animation and ability frame families'),
]:
    image_page(title, 'Actual runtime atlas contact sheet; original nearest-neighbor enlargement. This page is static; movement GIFs and a separate live-combat video are in the ZIP. Full-roster approval remains open.', MEDIA / (name + '.png'))

def footer(canvas, doc):
    canvas.setFont('Review', 8)
    canvas.setFillColor(colors.HexColor('#526b79'))
    canvas.drawString(48, 28, 'Resonance Bastion | 2026-10-07 | 0.2.0-tutorial | Awaiting User Review')
    canvas.drawRightString(A4[0] - 48, 28, str(doc.page))

SimpleDocTemplate(str(PDF), pagesize=A4, rightMargin=48, leftMargin=48,
                  topMargin=40, bottomMargin=44, title='Resonance Bastion current development review',
                  author='Project Rando development').build(story, onFirstPage=footer, onLaterPages=footer)
shutil.copyfile(REPORT, MEDIA / 'START_HERE.md')
gallery = (MEDIA / 'index.html').read_text()
gallery = gallery.replace('real production-runtime screenshots', 'actual browser-runtime screenshots')
if '<section id="current-status">' not in gallery:
    summary = ('<section id="current-status"><h2>Current development review — 2026-10-07</h2>'
               '<p>Build 0.2.0-tutorial. Construction and the autonomous Bulwark/Bastion tutorial are verified. '
               'Campaign rewards, lasting damage, repairs, progression and complete backups are next.</p>'
               '<p><a href="Resonance_Bastion_Current_Review.pdf">Read the current-state PDF</a> · '
               '<a href="START_HERE.md">Read the text report and feedback prompts</a></p>'
               '<p>Please review the new combat art/motion, readability and audio. Device model/browser are useful if known. '
               'No missing gameplay decision blocks independent campaign-persistence work.</p>'
               '<p>PDF first on mobile. Local HTML opening has not been verified on Android; '
               'individual images, GIFs, WAVs and video are the fallback. This gallery is not a playable deployment.</p></section>')
    gallery = gallery.replace('<h2>Review checklist</h2>', summary + '<h2>Review checklist</h2>')
if (MEDIA / 'tutorial-live.mp4').exists() and 'id="live-video"' not in gallery:
    video_section = ('<section id="live-video"><h2>Actual tutorial in motion</h2>'
                '<p>Production-preview recording; desktop software rendering at 1x. Video has no recorded system audio. '
                'Review the original WAV files separately. This does not certify Android performance.</p>'
                '<video controls preload="metadata" style="max-width:100%;height:auto" src="tutorial-live.mp4"></video>'
                '<p><a href="tutorial-live.mp4">Download the live-combat video</a></p></section>')
    gallery = gallery.replace('</html>', video_section + '</html>')
(MEDIA / 'index.html').write_text(gallery)
inventory = []
for path in sorted(MEDIA.rglob('*')):
    if path.is_file() and 'motion-source' not in path.parts and path.name not in {'review-inventory.json', 'tutorial-live.webm'}:
        inventory.append({'path': str(path.relative_to(MEDIA)), 'bytes': path.stat().st_size,
                          'sha256': hashlib.sha256(path.read_bytes()).hexdigest()})
(MEDIA / 'review-inventory.json').write_text(json.dumps({
    'date': '2026-10-07', 'applicationBuild': '0.2.0-tutorial',
    'gameplayCommit': '6d6c8e283fa809a4622b50c358235156ab820cb3',
    'sourceCommit': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip(),
    'status': 'Awaiting User Review', 'files': inventory,
}, indent=2))
archive = DELIVERY / 'Resonance_Bastion_Current_Review.zip'
with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED) as z:
    for path in sorted(MEDIA.rglob('*')):
        if path.is_file() and 'motion-source' not in path.parts and path.name != 'tutorial-live.webm':
            z.write(path, path.relative_to(MEDIA))
shutil.copyfile(PDF, DELIVERY / PDF.name)
shutil.copyfile(REPORT, DELIVERY / 'Resonance_Bastion_Current_Review.md')
if (MEDIA / 'tutorial-live.mp4').exists():
    shutil.copyfile(MEDIA / 'tutorial-live.mp4', DELIVERY / 'Resonance_Bastion_Tutorial.mp4')
print(json.dumps({'pdf': str(DELIVERY / PDF.name), 'zip': str(archive),
                  'files': len(inventory) + 1, 'zipBytes': archive.stat().st_size}))
