"""Mobile tablet-target/performance report; earlier artifacts stay unchanged."""
from pathlib import Path
from html import escape
import hashlib,json,zipfile,shutil
from reportlab.platypus import SimpleDocTemplate,Paragraph,Spacer,Table,TableStyle,PageBreak
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
ROOT=Path(__file__).resolve().parents[1];review=ROOT/'docs/review';delivery=Path('/workspace/shared/downloads')
checks=json.loads((ROOT/'docs/evidence/TABLET_RENDER_TESTS.json').read_text())
rows=json.loads((ROOT/'docs/evidence/RENDER_REUSE_COMPARISON.json').read_text())['cases']
for name,file in [('Review','DejaVuSans.ttf'),('Bold','DejaVuSans-Bold.ttf')]:pdfmetrics.registerFont(TTFont(name,'/usr/share/fonts/truetype/dejavu/'+file))
body=ParagraphStyle('Body',fontName='Review',fontSize=10,leading=14,spaceAfter=10,textColor=colors.HexColor('#243946'))
head=ParagraphStyle('Heading',parent=body,fontName='Bold',fontSize=13,leading=18,spaceBefore=10,keepWithNext=True)
title=ParagraphStyle('Title',parent=head,fontSize=19,leading=25)
small=ParagraphStyle('Small',parent=body,fontSize=8,leading=11)
story=[]
def para(t,s=body):story.append(Paragraph(escape(t),s))
def table(rows,widths):
 t=Table([[Paragraph(escape(str(v)),small)for v in r]for r in rows],colWidths=widths,repeatRows=1)
 t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),colors.HexColor('#e3edf0')),('GRID',(0,0),(-1,-1),.4,colors.HexColor('#afc2ca')),('VALIGN',(0,0),(-1,-1),'TOP')]))
 story.append(t);story.append(Spacer(1,10))
para('Resonance Bastion',title);para('Tablet target and optimization • 0.2.9 • 2026-10-08',head)
para('Your screenshots resolve the device/runtime question. Development continued with a measured rendering improvement; game scope, artwork detail, progression and continuous 360° movement remain intact. This supplements the preceding four-page development review, also included in the ZIP.')
table([['Confirmed from screenshots','Value'],['Model / Android','Lenovo TB-X606F / Android 10'],['RAM / storage','4.00 GB / 64.00 GB'],['CPU / physical panel','MediaTek Helio P22T / 1920×1200'],['Installed browser reported','Chrome 154.0.8037.126']],[190,280])
para('The browser exceeds researched Chrome version minima for BigInt, crypto.randomUUID, Object.hasOwn and structuredClone (67/92/93/98). UUID still requires a secure context. This establishes API version compatibility, not actual tablet storage, audio or GPU reliability. Desktop tests use Chromium 151; panel resolution alone does not establish browser CSS viewport or pixel ratio.')
para('One measured bottleneck corrected',head)
para('Camera, pinch, placement and resize redraws previously destroyed and recreated all terrain images, object images and text labels. They now reuse scene objects up to peak visible demand. Unused objects become hidden; active picking stays correct. Changed roles reset frame, anchor, tint, opacity, scale and depth. Scene disposal releases the retained objects.')
labels=['Portrait Base','Portrait Field','Portrait Close','Portrait Ghost','Landscape Field','Landscape Close/Ghost']
t=[['81 redraws / case','New images before → after','Median draw ms before → after']]
for label,r in zip(labels,rows,strict=True):t.append([label,f"{r['imagesBefore']:,} → {r['imagesAfter']}",f"{r['medianBeforeMs']:.1f} → {r['medianAfterMs']:.1f}"])
table(t,[155,155,160])
para('These are actual shared-renderer desktop draw-submission measurements, excluding screenshot work. They are not GPU frame times or Lenovo frame-rate results. Peak pool memory still needs physical measurement. No simulation or sprite-resolution reduction was used.',small)
story.append(PageBreak());para('Verification and playable tablet review',title)
para('The rendering is preserved exactly',head)
para('All six captured before/after PNGs match byte-for-byte, also checked independently as RGB pixels. Camera and selection bounds match. The optimized cases destroy zero objects during the 81 redraws; only two cases need one additional image as the camera discovers slightly greater demand.')
para('Repeated native-browser pan/zoom/facing/ghost cycles produce no second-cycle allocations or child-count growth. Surplus sprites stay hidden and excluded from picking. Ghost/role/text-style transitions restore identical pixels. Scene disposal removes the canvas and clears retained public collections.')
para('Full current-slice regression passes',head)
para(f"All {checks['unitTests']} unit tests in {checks['unitFiles']} files and all {checks['browserTests']} browser checks pass without retries or skips. Typecheck, lint, formatting, deterministic scenario and production build pass. The full suite covers real app touch/pinch/cancel, four views, scaling/reflow, renderer recovery, practice, paid results, backup/import and exactly-once commits. Retained v1/v2/v3 replay hashes remain exact.")
para('The evidence ZIP retains target/reference records, before/after allocation and timing observations, camera/picking state, screenshots and source/log hashes. The original device screenshots and unrelated personal/network details are not redistributed.')
para('Physical-device validation needs a playable origin',head)
para('A stable HTTPS game URL is needed to measure actual tablet GPU/frame behavior, touch latency, audio/background lifecycle, save reliability and backup download/reimport. The reviewed PDF and ZIP can be opened now, but they are not a hosted playable game. No physical performance claim is made.')
para('A concrete Free-compatible GitHub Pages preview is prepared',head)
para('The manual-only workflow pins the tested 0.2.9 source, uses official action commit pins and a standard free public-repository Ubuntu runner, retains its small static artifact for one day and has no automatic push trigger. It is prepared for approval, not installed or dispatched. Main and repository hosting remain unchanged.')
para('Publishing this development checkpoint as a public playable preview requires your approval. After publication and real HTTPS/MIME/refresh checks, the tablet pass can test 1×/2×/4×, orientation and all travel directions, pause/audio, background-return without catch-up, checkpoint restart and Android backup/reimport. Any missing Pages settings permission will be identified precisely; no paid service is needed.')
para('Independent development continues',head)
para('The next individual Engineer contract separates purchased and siege-temporary trap charges, enforces six uninterrupted seconds and eight completed additions per agent, and cancels interrupted work without free permanent stock. Full mobile repair/action priorities, state-machine integration and natural per-asset animation still require their own evidence. The wider roster/campaign and full balance remain open.')
def footer(c,d):c.setFont('Review',8);c.drawString(38,24,'Resonance Bastion • 0.2.9 • measured desktop improvement; Android checks open');c.drawRightString(A4[0]-38,24,str(d.page))
pdf=review/'Resonance_Bastion_Tablet_Optimization_Review.pdf'
SimpleDocTemplate(str(pdf),pagesize=A4,leftMargin=38,rightMargin=38,topMargin=38,bottomMargin=40).build(story,onFirstPage=footer,onLaterPages=footer)
files={pdf.name:pdf,'Resonance_Bastion_Current_Development_Review.pdf':review/'Resonance_Bastion_Current_Development_Review.pdf','TABLET_RENDER_REUSE.md':review/'TABLET_RENDER_REUSE.md'}
for n in ['TABLET_VALIDATION.md','TABLET_PREVIEW_PREPARATION.md','pages-preview.yml.example']:files['docs/'+n]=ROOT/'docs'/n
for n in ['TABLET_TARGET.json','TABLET_RENDER_TESTS.json','RENDER_REUSE_BEFORE.json','RENDER_REUSE_AFTER.json','RENDER_REUSE_COMPARISON.json']:files['evidence/'+n]=ROOT/'docs/evidence'/n
for phase in ['before','after']:
 for p in (Path('/workspace/scratch')/('render-reuse-'+phase)).glob('*.png'):files['screenshots/'+phase+'/'+p.name]=p
manifest={n:{'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}for n,p in files.items()}
archive=review/'Resonance_Bastion_Tablet_Optimization_Review.zip'
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED)as z:
 for n,p in files.items():z.write(p,n)
 z.writestr('MANIFEST.json',json.dumps(manifest,indent=2)+'\n')
with zipfile.ZipFile(archive)as z:
 assert z.testzip()is None
 for n,m in manifest.items():assert len(z.read(n))==m['bytes']and hashlib.sha256(z.read(n)).hexdigest()==m['sha256']
for p in [pdf,archive]:shutil.copyfile(p,delivery/p.name)
print(json.dumps({p.name:{'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}for p in [pdf,archive]},indent=2))
