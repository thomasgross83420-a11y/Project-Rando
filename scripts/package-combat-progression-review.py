"""Mobile-readable review and checksummed evidence bundle; no game-art edits."""
from pathlib import Path
from html import escape
import hashlib, json, shutil, zipfile
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
ROOT = Path(__file__).resolve().parents[1]
REVIEW = ROOT / 'docs/review'
DELIVERY = Path('/workspace/shared/downloads'); DELIVERY.mkdir(parents=True, exist_ok=True)
measurements = json.loads((ROOT / 'docs/evidence/COMBAT_PROGRESSION.json').read_text())
verification = json.loads((ROOT / 'docs/evidence/COMBAT_PROGRESSION_TESTS.json').read_text())
for name, file in [('Review', 'DejaVuSans.ttf'), ('Bold', 'DejaVuSans-Bold.ttf')]:
    pdfmetrics.registerFont(TTFont(name, '/usr/share/fonts/truetype/dejavu/' + file))
body = ParagraphStyle('Body', fontName='Review', fontSize=10, leading=14, spaceAfter=9, textColor=colors.HexColor('#243946'))
head = ParagraphStyle('Heading', parent=body, fontName='Bold', fontSize=13, leading=18, spaceBefore=10, keepWithNext=True)
title = ParagraphStyle('Title', parent=head, fontSize=19, leading=25)
small = ParagraphStyle('Small', parent=body, fontSize=8, leading=11)
story = []
def para(text, style=body): story.append(Paragraph(escape(text), style))
def table(rows, widths):
    t = Table([[Paragraph(escape(str(v)), small) for v in row] for row in rows], colWidths=widths, repeatRows=1)
    t.setStyle(TableStyle([('BACKGROUND', (0,0), (-1,0), colors.HexColor('#e3edf0')), ('GRID',(0,0),(-1,-1),.4,colors.HexColor('#afc2ca')), ('VALIGN',(0,0),(-1,-1),'TOP'), ('LEFTPADDING',(0,0),(-1,-1),7), ('RIGHTPADDING',(0,0),(-1,-1),7)]))
    story.append(t); story.append(Spacer(1,9))
para('Resonance Bastion', title)
para('Combat and progression review • 0.2.6 • 2026-10-08', head)
para('The first real campaign siege now uses the owned army and saves actual rewards, levels, wounds and permanent mine stock. Preparation supports quoted recovery and earned enhancements. This is the Bulwark/Bastion C01S01 slice; the full blueprint and complete roster remain the project scope.')
para('What you can do in this checkpoint', head)
para('Open an existing campaign, choose Campaign Siege C01S01 and review the explicit progression migration. It preserves your identities, wallet, wounds and layout. An empty starter base can accept the suggested formation using only already-owned assets. Select Standard or Cadet and launch; defenders act autonomously with continuous 360° travel.')
para('Results now save real progression', head)
para('A full Standard first victory with both optional objectives earns 286 Bastion XP: 155 ordinary becomes 186 with the objective bonus, then 50 first-clear and two 25-XP discoveries are added. It reaches Rank 2 with 186 progress. The asset-XP pool is 200 and the Core reward is 1. Repeat battles cannot reclaim those first-time bonuses.')
para('Asset XP combines actual useful contribution with living participation. Stored assets earn nothing. Damage is capped at applied loss; repair is capped at real injury; shielding is credited as body damage actually prevented after armor. Current weapon accuracy and growth use the previously reviewed exact progression curve.')
table([['Preparation action','Behavior'], ['Repair','Exact partial body/Core purchase; no free base healing'], ['Restore','Explicitly restores a wreck to half maximum body'], ['Rearm','Empty living mine: 19 Credits for permanent stock'], ['Enhance','Earned level gate plus quoted sequential purchase; preserves wounds and never revives a wreck']], [110,360])
para('Optional recovery budget', head)
para('Results show the full repair/restore/rearm cost and projected remaining reward/wallet. Starting wounds are reported separately. These are planning figures, not automatic charges. You can spend less and fight wounded, or keep Credits for another improvement.')
story.append(PageBreak())
para('Measured encounters and recovery', title)
para('The evidence bundle contains eight actual C01S01 terminal receipts, including a repaired repeat, stored Repair Node, half-body Rifle, emergency Cadet recovery and immediate surrender. Each result is journaled and finalized twice to confirm that the second request does not pay again.')
labels = {
'guided-standard-two-paid-clears':'Guided Standard',
'owned-repair-stored-standard':'Repair Node stored',
'rifle-starts-half-body-standard':'Rifle begins at half body',
'sentry-starts-half-body-with-repair':'Half-body Sentries / Repair Node',
'sentry-starts-half-body-without-repair':'Half-body Sentries / Node stored',
'zero-wallet-all-wreck-emergency-cadet':'Zero-cash emergency / Cadet',
'immediate-surrender-standard':'Immediate surrender',
}
rows = [['Actual case','Outcome / seconds','Gross Credits','Full recovery budget']]
for r in measurements['records']:
    q = r['rewards']; rows.append([labels[r['case']] + (f" / clear {r['iteration']}" if 'two-paid' in r['case'] else ''), f"{r['outcome']} / {r['combatSeconds']:.2f}", q['creditedCredits'], q['recovery']['credits']])
table(rows,[205,100,70,95])
para('What these comparisons establish', head)
para('Quotes reconcile with real preparation purchases. First-clear/discovery claims are not paid twice. Useful deployed assets receive XP and spent permanent stock remains spent. The catastrophic zero-wallet, zero-Core, all-wreck starter army can win the authored Cadet recovery fight without paid repairs; owned identities, enhancements and XP are preserved.')
para('Emergency reconstruction is deliberate', head)
para('Recovery first offers the cheapest priced viable defense if affordable. Otherwise it raises Core to the prescribed minimum and reuses suitable owned Warden/basic weapons at half maximum body. It creates only genuinely missing basics. Obstructions may be stored, never silently sold. At the ownership cap, a needed conversion requires an explicit loss preview. Subsidized refunds remain locked until that identity participates in a finalized victory; newly created emergency bodies never acquire free resale base value.')
para('Free practice uses the owned grown army', head)
para('The new-schema practice clone starts with full body and normal stock but retains earned levels and purchased enhancements. It never repairs the saved campaign or grants currency, XP or discovery. Old practice checkpoints retain their original replay rules.')
para('The tutorial is a teaching encounter', head)
para('These eight deterministic receipts do not establish the required whole-game recovery/income ratio or long-term leveling pace. There are no ranged, air, stealth or boss threats in this slice. Prices and XP were not arbitrarily retuned to make the teaching scenario imitate later campaign balance. Generated budgets, three competent layouts and the required larger seed sets remain future balance work.')
story.append(PageBreak())
para('Save safety and verification', title)
para(f"{verification['unitTests']} unit tests in {verification['unitFiles']} files and all {verification['browserTests']} browser checks pass. Type checking, lint, formatting, deterministic scenario and production build also pass. Browser checks exercise the actual UI and native IndexedDB, including failed imports and failed result commits.")
para('Interrupted sieges keep a durable starting checkpoint. Restart replays that beginning; there is no offline or mid-battle resume. Pending terminal results preserve their exact rewards/body capture for retry. Campaign, previous snapshot, receipt and monotonic claim fence commit together. Preparation cannot overwrite an active attempt or an unacknowledged saved result.')
para('Complete backups retain checkpoints, pending rewards and receipts. Import into another slot reseals only its binding while preserving captured battle meaning. Newer local fences block stale backups from reclaiming rewards. Injected receipt/checkpoint failures leave wallet and all stores unchanged, then the identical result can retry.')
para('Additional defects corrected', head)
para('Battle controls are disabled until handlers are ready, preventing a visible 4× choice from leaving combat at 1×. Failed-result recovery stops the old render loop before replacing its interface. Return Title restores the real title screen. Audio-device suspension/resume failure is contained; pausing silences the mixer immediately and cannot stop result accounting.')
para('The interface was checked at normal and 200% scale in 412×915, 800×1280 and 1280×800 viewports. No horizontal overflow was detected. This is desktop emulation, not physical Lenovo performance or TalkBack certification.')
para('Still in development', head)
para('Other Warden/doctrine combinations, full roster, later campaign stages, enemy variants, bosses, promotions/signatures, all modes and complete results analysis remain open. A four-Node follow-up identified self-repair incorrectly consuming an external slot; its versioned correction follows this checkpoint. Sale is not enabled in the interface; active emergency-sale recovery still requires its full identity/tombstone rules. Per-asset contact/anatomy refinement and actual Android measurements remain required. The repository is a development checkpoint, not a public deployed release.')
para('Continuing work', head)
para('Continue with individual support-channel and injury/action contracts, followed by the next dependency-ready roster element. Keep old replay versions compatible and compare actual mechanics, contribution and recovery together. No new creative choice is required to continue local engineering; physical-device acceptance needs a playable hosted build and your tablet observations when available.')
para('Primary reference checked: MDN IDBTransaction (2026-10-08), active/inactive task boundaries and auto-commit. Crypto/schema rebasing completes before final write transactions. Original blueprint SHA-256 and source/test evidence are included in the ZIP.',small)
def footer(canvas, doc):
    canvas.setFont('Review',8); canvas.setFillColor(colors.HexColor('#57717d'))
    canvas.drawString(38,24,'Resonance Bastion • 0.2.6 • first paid slice; full campaign open')
    canvas.drawRightString(A4[0]-38,24,str(doc.page))
pdf = REVIEW / 'Resonance_Bastion_Combat_Progression_Review.pdf'
SimpleDocTemplate(str(pdf),pagesize=A4,leftMargin=38,rightMargin=38,topMargin=38,bottomMargin=40).build(story,onFirstPage=footer,onLaterPages=footer)
files = {pdf.name:pdf, 'COMBAT_RESULT_INTEGRATION.md':ROOT/'docs/COMBAT_RESULT_INTEGRATION.md', 'STATUS.md':ROOT/'docs/STATUS.md', 'evidence/COMBAT_PROGRESSION.json':ROOT/'docs/evidence/COMBAT_PROGRESSION.json', 'evidence/COMBAT_PROGRESSION_TESTS.json':ROOT/'docs/evidence/COMBAT_PROGRESSION_TESTS.json'}
for name in ['campaign-victory-summary.png','progression-800-18.png','progression-1280-36.png']:
    p = ROOT/'test-results'/name
    if p.exists(): files['screenshots/'+name]=p
manifest = {name:{'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for name,p in files.items()}
archive = REVIEW / 'Resonance_Bastion_Combat_Progression_Review.zip'
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
    for name,p in files.items(): z.write(p,name)
    z.writestr('MANIFEST.json',json.dumps(manifest,indent=2)+'\n')
with zipfile.ZipFile(archive) as z:
    assert z.testzip() is None
    for name,m in manifest.items(): assert len(z.read(name))==m['bytes'] and hashlib.sha256(z.read(name)).hexdigest()==m['sha256']
for p in [pdf,archive]: shutil.copyfile(p,DELIVERY/p.name)
print(json.dumps({p.name:{'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in [pdf,archive]},indent=2))
