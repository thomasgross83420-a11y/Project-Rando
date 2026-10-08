"""Current mobile report/evidence bundle; preserves earlier review artifacts."""
from pathlib import Path
from html import escape
import hashlib, json, shutil, zipfile
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, Image
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

ROOT = Path(__file__).resolve().parents[1]
REVIEW = ROOT / 'docs/review'
DELIVERY = Path('/workspace/shared/downloads')
DELIVERY.mkdir(parents=True, exist_ok=True)
evidence = json.loads((ROOT/'docs/evidence/AFFORDABLE_REPAIR_TESTS.json').read_text())
for name, file in [('Review','DejaVuSans.ttf'),('Bold','DejaVuSans-Bold.ttf')]:
    pdfmetrics.registerFont(TTFont(name,'/usr/share/fonts/truetype/dejavu/'+file))
body = ParagraphStyle('Body',fontName='Review',fontSize=10,leading=14,spaceAfter=9,textColor=colors.HexColor('#243946'))
head = ParagraphStyle('Heading',parent=body,fontName='Bold',fontSize=13,leading=18,spaceBefore=9,keepWithNext=True)
title = ParagraphStyle('Title',parent=head,fontSize=19,leading=25)
small = ParagraphStyle('Small',parent=body,fontSize=8,leading=11)
story = []
def para(text, style=body): story.append(Paragraph(escape(text),style))
def table(rows,widths):
    t=Table([[Paragraph(escape(str(v)),small) for v in row] for row in rows],colWidths=widths,repeatRows=1)
    t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),colors.HexColor('#e3edf0')),('GRID',(0,0),(-1,-1),.4,colors.HexColor('#afc2ca')),('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),7),('RIGHTPADDING',(0,0),(-1,-1),7)]))
    story.append(t);story.append(Spacer(1,9))

para('Resonance Bastion',title)
para('Current development review • 0.2.8 • 2026-10-08',head)
para('Development continued through three individually tested increments: the first paid campaign loop, corrected repair-channel coordination, and explicit affordable recovery choices. The recovered blueprint remains intact. Full 360° world travel is retained independently of the eight artwork facings.')
para('Where the game stands',head)
para('The Bulwark/Bastion C01S01 development slice now fights with the owned army, captures actual wounds and mine stock, and commits earned currency, account progression and per-asset XP. Preparation offers repair, wreck restoration, mine rearm and eligible paid enhancements. The wider roster, later campaign and final presentation remain development work.')
para('Meaningful progression',head)
para('The starting Sentry remains reliable at 90% accuracy. Its exact level curve halves baseline misses by level 100 (95% accuracy); accuracy is one part of progression. Combining earned levels and purchased E10 raises theoretical roll-weighted output from 45 to about 124.8003 per second (2.773×), and maximum body from 1,200 to 2,652 (2.21×). These figures exclude projectile obstruction, armor, injury and promotion perks; they are not guaranteed battlefield damage.')
para('A full Standard first victory with both optional objectives earns 286 Bastion XP: 155 ordinary becomes 186 with objective bonuses, plus 50 first-clear and two 25-XP discoveries. It reaches Rank 2 with 186 progress. The asset-XP pool is 200 and the Core reward is 1. Repeat victories cannot reclaim first-time bonuses. Stored assets earn no combat XP.')
para('Ownership and recovery remain explicit',head)
para('Free practice uses a disposable full-body/full-stock clone of the owned grown profiles. It grants no campaign rewards or saved repairs. In a real siege, persistent injury and used permanent stock remain after combat. Recovery budgets are advice, not automatic charges. Wrecks require Restore; enhancement cannot revive them.')
para('Save safety',head)
para('A captured starting checkpoint survives interruption. Pending results retain the exact terminal meaning for retry. Wallet, bodies, receipt and claim fence commit together; an uncertain acknowledgment cannot pay twice. Complete backup/import retains attempts and receipts, including cross-slot rebinding. Active attempts and unacknowledged results cannot be overwritten by preparation.')

story.append(PageBreak())
para('Evidence-based recovery and support',title)
para('Eight actual paid-result comparisons',head)
para('These retained measurements use fixed identities and the published v3 teaching encounter. v4 changes support-channel coordination; older attempts keep v3. The values below are observations of those exact captured cases, not predictions for every layout or whole-campaign balance.')
measurements=json.loads((ROOT/'docs/evidence/COMBAT_PROGRESSION.json').read_text())
labels={'guided-standard-two-paid-clears':'Guided Standard','owned-repair-stored-standard':'Node stored','rifle-starts-half-body-standard':'Rifle at half body','sentry-starts-half-body-with-repair':'Half-body Sentries / Node','sentry-starts-half-body-without-repair':'Half-body Sentries / no Node','zero-wallet-all-wreck-emergency-cadet':'Zero-cash emergency / Cadet','immediate-surrender-standard':'Immediate surrender'}
rows=[['Captured case','Result / seconds','Credits earned','Full recovery']]
for r in measurements['records']:
    q=r['rewards'];label=labels[r['case']]+(f" / clear {r['iteration']}" if 'two-paid' in r['case'] else '')
    rows.append([label,f"{r['outcome']} / {r['combatSeconds']:.2f}",q['creditedCredits'],q['recovery']['credits']])
table(rows,[205,105,80,80])
para('Starting injuries are separately accounted for. The catastrophic zero-wallet, zero-Core, all-wreck starter defense wins the authored Cadet recovery fight without paid repairs after deliberate emergency reconstruction. Owned identity, XP and investment survive. This does not prove recovery for every Warden/doctrine or justify retuning later-game prices from a teaching fixture.')
para('Repair channels corrected as an individual interaction',head)
para('A four-Node comparison exposed self-repair consuming an external channel, sometimes blocking self-repair entirely depending on identity order. New rb-sim-v4 plans allow self-repair plus at most two external sources. Each Node still has only one outgoing channel. No third external source is admitted.')
para('With a half-body Node and three neighboring Nodes, the first pulse cycle restores 18.75 Integrity in v4 versus 12.5 in v3. Both recipient ordering cases pass. Exactly 400 points of actual injury are repaired and credited before channels release, with no overheal or wreck revival. Published whole-v3 battle/checkpoint/pending hashes remain exact; v1/v2 practice replay hashes remain pinned.')
para('Full pacing remains open',head)
para('The authored slice lacks hostile ranged, air, stealth and boss threats. Generated budgets, competent layout comparisons, wider seed sets, acquisition/promotion timing and long-term recovery/income targets require the remaining content. No enemy scaling to player wallet or artificial price increase was added to cancel progression.')

story.append(PageBreak())
para('Useful partial repairs',title)
para('An injured army should not force the player to guess an affordable repair amount. Core and selected living assets now offer Full missing body, +25% maximum, +50% maximum, Exact whole points and a separately reviewed maximum-affordable repair. Presets are capped at the actual wound; percentage choices refer to maximum body.')
para('Quotes use unchanged blueprint prices and exact 1/1,024-point amounts. Review shows the resulting wallet and body; confirm explicitly purchases. Cancel, insufficient funds and stale writes preserve the save. Double confirmation purchases once. Read-only controls stay disabled, and wrecks still require Restore.')
table([['Native UI example','Actual result'],['Core 9,000/10,000; wallet 7','Full repair rejected; affordable +70 for 7 Credits'],['Sentry 1,000/1,200; wallet 3','+58,982 fixed units for 3 Credits; one more unit costs 4'],['Sentry 600/1,200; quarter, exact 10, then half','300 + 10 + capped 290 repaired; total 33 Credits']],[230,240])
para('Splitting a purchase can cost more because each transaction rounds its price upward. The final example costs 33 versus 32 Credits for one full 600-point purchase. The interface preserves that published price rule instead of concealing it with a discount. Fractional display values never feed back into authoritative purchases.')
para('Actual confirmation screens',head)
screens=[]
for name in ['affordable-core-repair-quote.png','affordable-asset-repair-quote.png']:
    p=ROOT/'test-results'/name
    if not p.exists():raise FileNotFoundError(p)
    im=Image(str(p));im.drawHeight=im.imageHeight*220/im.imageWidth;im.drawWidth=220;screens.append(im)
story.append(Table([screens],colWidths=[235,235],style=TableStyle([('VALIGN',(0,0),(-1,-1),'TOP')])))
story.append(Spacer(1,9))
para('The captured screen review also corrected confirmation headings from internal command words to player-readable actions such as Repair Core and Repair Asset. These are real production-preview captures with deterministic test campaigns, not illustrations.',small)

story.append(PageBreak())
para('Validation and the next input',title)
para('Current checks',head)
para(f"All {evidence['unitTests']} unit tests in {evidence['unitFiles']} files and all {evidence['browserTests']} production-browser checks pass without retries or skips. Typecheck, lint, formatting, deterministic scenario and production build pass. After the confirmation-heading correction, the fresh build passes all nine affected UI checks; simulation and prices were unchanged after the full suite.")
para('Coverage includes actual native IndexedDB result commits, failed-write retry, lost acknowledgment, stale writer takeover, backup/import, practice isolation, emergency recovery, exact progression and maximal affordable repair. The review ZIP preserves source/log hashes, captured receipts and channel comparisons. Existing upstream build/style notices remain; physical-device performance has not been certified.')
para('Your tablet remains the optimization target',head)
para('Lenovo lists multiple memory/Android variants within the Tab M10 FHD Plus family. Its second-generation specification names Helio P22T / PowerVR GE8320, 2/3/4 GB RAM and a 1920×1200 panel. These are candidate family specifications; your actual model and installed browser are not yet confirmed. Current desktop checks use Chromium 151, including tablet portrait/landscape and actual 200% UI scaling.')
para('Input needed for the next targeted tablet pass',head)
para('Please provide the model code (for example TB-X606F), Android version and browser name/version. Android/model are normally under Settings → About tablet; Chrome version is under Chrome → Settings → About Chrome. This identifies the runtime to compare and profile. It does not reduce game scope or require any credentials.')
para('Next measurements',head)
para('Confirm runtime features, then measure simulation and rendering separately at 1×/2×/4× against identical battles. Actual Android checks must cover GPU/frame timing, touch/orientation, audio/background lifecycle, backup download/reimport and TalkBack. Desktop emulation cannot substitute for these. A playable stable HTTPS origin is still needed for physical game validation; the review downloads themselves are not a hosted game.')
para('Remaining individual development',head)
para('The next small asset contract is Engineer: shared repair limits, injury-scaled output, move/fire/repair exclusion and interrupted trap rearm before its production state machine and artwork. Other Warden/doctrine combinations, all remaining assets and bosses, later encounters/modes, promotion/sale/emergency tombstones and complete results analysis remain open. Per-asset natural articulation, facing-specific contacts and sockets remain required. The full recovered blueprint is still the scope.')
para('References checked 2026-10-08: official Lenovo PSREF tablet specification; Google Chrome Android requirements; MDN IndexedDB transaction and AudioContext lifecycle references. Full links and limits of each comparison appear in the enclosed development documents.',small)

def footer(c,d):
    c.setFont('Review',8);c.setFillColor(colors.HexColor('#57717d'))
    c.drawString(38,24,'Resonance Bastion • 0.2.8 • current slice; full blueprint retained')
    c.drawRightString(A4[0]-38,24,str(d.page))
pdf=REVIEW/'Resonance_Bastion_Current_Development_Review.pdf'
SimpleDocTemplate(str(pdf),pagesize=A4,leftMargin=38,rightMargin=38,topMargin=38,bottomMargin=40).build(story,onFirstPage=footer,onLaterPages=footer)
files={pdf.name:pdf}
for name in ['STATUS.md','TASKS.md','AFFORDABLE_REPAIR.md','TABLET_VALIDATION.md','COMBAT_RESULT_INTEGRATION.md','SUPPORT_CHANNELS.md','PROGRESSION_BALANCE.md','HOSTING.md']:
    files['docs/'+name]=ROOT/'docs'/name
for name in ['AFFORDABLE_REPAIR_TESTS.json','COMBAT_PROGRESSION.json','COMBAT_PROGRESSION_TESTS.json','SUPPORT_CHANNELS.json','SUPPORT_CHANNEL_TESTS.json']:
    files['evidence/'+name]=ROOT/'docs/evidence'/name
files['blueprint/Resonance_Bastion_Browser_Blueprint_Final.md']=ROOT/'docs/blueprint/Resonance_Bastion_Browser_Blueprint_Final.md'
for name in ['affordable-core-repair-quote.png','affordable-asset-repair-quote.png','campaign-victory-summary.png','progression-800-18.png','progression-1280-36.png']:
    p=ROOT/'test-results'/name
    if p.exists():files['screenshots/'+name]=p
manifest={name:{'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}for name,p in files.items()}
archive=REVIEW/'Resonance_Bastion_Current_Development_Review.zip'
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED)as z:
    for name,p in files.items():z.write(p,name)
    z.writestr('MANIFEST.json',json.dumps(manifest,indent=2)+'\n')
with zipfile.ZipFile(archive)as z:
    assert z.testzip()is None
    for name,m in manifest.items():assert len(z.read(name))==m['bytes']and hashlib.sha256(z.read(name)).hexdigest()==m['sha256']
for p in [pdf,archive]:shutil.copyfile(p,DELIVERY/p.name)
print(json.dumps({p.name:{'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}for p in [pdf,archive]},indent=2))
