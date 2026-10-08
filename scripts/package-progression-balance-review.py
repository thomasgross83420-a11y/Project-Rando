"""Standalone mobile documentation and scientific figure; no game-art editing."""
import json,hashlib,zipfile,shutil
from pathlib import Path
from html import escape
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from reportlab.platypus import SimpleDocTemplate,Paragraph,Spacer,Image,Table,TableStyle,PageBreak
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
ROOT=Path(__file__).resolve().parents[1]
REVIEW=ROOT/'docs/review';OUT=Path('/workspace/shared/Resonance_Bastion_Progression_Balance');OUT.mkdir(parents=True,exist_ok=True)
DELIVERY=Path('/workspace/shared/downloads');DELIVERY.mkdir(parents=True,exist_ok=True)
evidence=json.loads((ROOT/'docs/evidence/PROGRESSION_BALANCE.json').read_text())
tests=json.loads((ROOT/'docs/evidence/PROGRESSION_BALANCE_TESTS.json').read_text())
refs=evidence['statReferences'];groups=evidence['cases'];runs=evidence['results']
for name,font in [('Review','DejaVuSans.ttf'),('Bold','DejaVuSans-Bold.ttf')]:pdfmetrics.registerFont(TTFont(name,'/usr/share/fonts/truetype/dejavu/'+font))
body=ParagraphStyle('Body',fontName='Review',fontSize=10,leading=14,spaceAfter=9,textColor=colors.HexColor('#243946'))
heading=ParagraphStyle('Heading',parent=body,fontName='Bold',fontSize=13,leading=18,spaceBefore=10,keepWithNext=True)
title=ParagraphStyle('Title',parent=heading,fontSize=19,leading=25)
small=ParagraphStyle('Small',parent=body,fontSize=8,leading=11)
story=[]
def para(text,style=body):story.append(Paragraph(escape(text),style))
def table(rows,widths):
 t=Table([[Paragraph(escape(str(v)),small)for v in row]for row in rows],colWidths=widths,repeatRows=1)
 t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),colors.HexColor('#e3edf0')),('GRID',(0,0),(-1,-1),.4,colors.HexColor('#afc2ca')),('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),7),('RIGHTPADDING',(0,0),(-1,-1),7)]));story.append(t);story.append(Spacer(1,9))
para('Resonance Bastion',title);para('Progression balance review • 0.2.5 • 2026-10-08',heading)
para('The missing accuracy progression rule is now implemented, and specified growth runs through captured per-asset combat studies. Upgrade prices and gates are exact. The original playable practice remains compatible; paid campaign progression is still being connected to its save/result system.')
para('What the 90% example really means',heading)
para('Sentry accuracy rises from 90% to 95%: five percentage points, halving its raw miss chance. Accuracy is one part of progression. With the specified damage and firing-rate growth, and purchased Enhancement 10, theoretical output after the accuracy roll rises from 45 to 124.80 DPS (2.77 times). Durability rises from 1200 to 2652 (2.21 times). These figures exclude armor, movement misses, cover and perks.')
para('Accuracy now improves consistently by weapon role',heading)
table([['Starting accuracy','Level 100'],['80%','90%'],['85%','92.5%'],['90%','95%'],['95%','97.5%'],['100%','100%']],[235,235])
para('Each weapon halves its own starting miss chance across levels 1–100. More accurate weapons keep their advantage. Perfect-accuracy attacks remain perfect. Every intermediate gain is kept as an exact fraction. This is an initial measured engineering rule, with further tuning tied to appropriate encounter tests.')
para('Corrections and safeguards',heading)
para('Separate assets can have separate levels and enhancements without changing every instance of their type. Health increases preserve existing wounds. Movement speed, footprint, armor and fixed support cadence do not receive invented growth. Upgrade quotes require the earned gates and previous tier. Exact prices avoid a floating-point boundary error (55 Credits incorrectly becoming 56); zero-damage repair previews now cost zero.')
para('No input is required from you for the next engineering work. Your direction authorizes the audit and necessary corrections. Whole-game feel and physical tablet acceptance will need appropriate playtests as the remaining systems become playable.')
story.append(PageBreak())
para('Progression that can be inspected',title)
base=[r for r in refs if r['enhancement']==0]
paid=[next(r for r in refs if r['level']==l and r['enhancement']==l//10)for l in [1,10,25,50,75,100]]
fig,axes=plt.subplots(1,2,figsize=(9,4),layout='constrained')
for points,label,color in [(base,'Level only / E0','#27768b'),(paid,'Allowed E purchased','#bb6735')]:
 axes[0].plot([r['level']for r in points],[r['rollWeightedDPS']for r in points],marker='o',label=label,color=color)
 axes[1].plot([r['level']for r in points],[r['body']for r in points],marker='o',label=label,color=color)
for ax in axes:ax.set_xlabel('Asset level');ax.grid(alpha=.2);ax.set_xlim(1,100);ax.legend(fontsize=8)
axes[0].set_ylabel('Theoretical roll-weighted DPS');axes[1].set_ylabel('Sentry Integrity');fig.suptitle('Specified discrete Sentry growth • excludes armor, cover and travel misses',fontsize=11)
fig.savefig(OUT/'progression-growth.png',dpi=170);fig.savefig(OUT/'progression-growth.svg');plt.close(fig)
story.append(Image(str(OUT/'progression-growth.png'),width=470,height=210))
para('Level growth and paid upgrades are separate',heading)
table([['Level / enhancement','Body','Shot','Ticks','Accuracy'],*[[f"{r['level']} / E{r['enhancement']}",f"{r['body']:.1f}",f"{r['damage']:.2f}",r['intervalTicks'],f"{r['accuracyPercent']:.2f}%"]for r in paid]],[115,88,88,72,107])
para('E tiers shown are assumed purchases, not free grants. An E10 Sentry has paid 2690 enhancement Credits in total. All star promotions cost another 82000 Credits and 82 Cores; both rank and asset level gate each next promotion. Promotion benefits and the timing of these investments still need the real campaign roster, budgets and contribution data.')
para('Keeping a reliable starting defense',heading)
para('The present evidence supports fixing the missing growth equation while retaining the Sentry’s useful starting reliability. Reducing its initial accuracy just to enlarge the percentage-point gain would make early defense less predictable without a measured need. Future changes will compare player and enemy progression, role value, affordable recovery and meaningful upgrades together.')
story.append(PageBreak())
para('What the combat studies establish',title)
para(f"{len(runs)} deterministic runs cover {len(groups)} configurations and four paired accuracy seeds. Tests use the current authored 24-body schedule at levels 1/10/25/50/75/100, purchased versus unpurchased enhancements, declared enemy bands, a reduced Rifle/Bulwark network and accuracy-growth comparisons.")
selected=['guided-L1-E0-band1','guided-L100-E10-band20','guided-L100-E10-band20-baseline-accuracy','mobile-L1-E0-band20','mobile-L100-E10-band20']
rows=[['Controlled scenario','Wins','Median seconds','Median body recovery']]
for name in selected:
 g=next(g for g in groups if g['id']==name)
 label=name.replace('guided-','Guided ').replace('mobile-','Mobile ').replace('-band',' / band ').replace('-baseline-accuracy',' / base accuracy')
 rows.append([label,f"{g['outcomes'].count('Victory')}/{g['runs']}",f"{g['combatSeconds']['median']:.2f}",str(g['bodyRecovery']['median'])+' Credits'])
table(rows,[220,45,95,110])
para('Accuracy rolls and actual hits are different',heading)
shot=[s for r in runs for s in r['shots']]
count=sum(s['released']for s in shot);passedmiss=sum(s['passedButDidNotLandIntended']for s in shot);missland=sum(s['failedButLandedIntended']for s in shot)
para(f"Across these studies, {count} projectile releases were observed. {passedmiss} successful accuracy rolls resolved without contacting the intended target; {missland} failed rolls still contacted it. Contacts with another enemy, cover, expired shots and unresolved flights are recorded separately. Actual capped body damage is measured independently: a contact is not automatically credited as damage.")
para('The limits are part of the result',heading)
para('This is a teaching encounter, not a generated late-game army. Four seeds are a sensitivity sample, not statistical or fun certification. The fixture lacks full enemy budgets, ranged threats, bosses, doctrines, promotion perks and real contribution-based campaign leveling. Its body-recovery quotes exclude stock rearm and do not establish the required recovery-to-income ratio. XP pacing, rewards and prices are not retuned using this tutorial as if it represented the campaign.')
para('Verification and next implementation',heading)
para(f"{tests['unitTests']} unit tests and {tests['browserTests']} browser checks passed, with typecheck, lint, deterministic scenario and production build. Exact v1/v2 practice replay hashes are retained. Frozen grown profiles are deterministic across tick batches. Physical Lenovo performance, Android sharing and TalkBack are not certified by desktop browser checks.")
para('Next work connects actual contribution, ending body and permanent stock to the versioned campaign profile and production result adapter, with complete ordinary-run backup/recovery before paid launches. Existing anatomy/contact refinement and full 360° travel remain required. No blueprint roster category has been dropped.')
para('Research: Factorio developer posts #169 and #304 informed progression-stage comparisons and verification of actual upgrade effects. The GDC formula-balance session overview informed explicit arithmetic. Links and the complete decision are in PROGRESSION_BALANCE.md inside the ZIP; no external game’s tuning values were copied.',small)
def footer(c,d):
 c.setFont('Review',8);c.setFillColor(colors.HexColor('#57717d'));c.drawString(38,24,'Resonance Bastion • 0.2.5 • current-slice studies; full balance open');c.drawRightString(A4[0]-38,24,str(d.page))
pdf=REVIEW/'Resonance_Bastion_Progression_Balance_Review.pdf'
SimpleDocTemplate(str(pdf),pagesize=A4,leftMargin=38,rightMargin=38,topMargin=38,bottomMargin=40).build(story,onFirstPage=footer,onLaterPages=footer)
files={pdf.name:pdf,'PROGRESSION_BALANCE.md':ROOT/'docs/PROGRESSION_BALANCE.md',
 'evidence/PROGRESSION_BALANCE.json':ROOT/'docs/evidence/PROGRESSION_BALANCE.json',
 'evidence/PROGRESSION_BALANCE_TESTS.json':ROOT/'docs/evidence/PROGRESSION_BALANCE_TESTS.json',
 'evidence/PROGRESSION_CONTRACTS.json':ROOT/'docs/evidence/PROGRESSION_CONTRACTS.json',
 'review/progression-growth.png':OUT/'progression-growth.png','review/progression-growth.svg':OUT/'progression-growth.svg'}
manifest={n:{'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}for n,p in files.items()}
zpath=REVIEW/'Resonance_Bastion_Progression_Balance_Review.zip'
with zipfile.ZipFile(zpath,'w',zipfile.ZIP_DEFLATED)as z:
 for n,p in files.items():z.write(p,n)
 z.writestr('MANIFEST.json',json.dumps(manifest,indent=2)+'\n')
with zipfile.ZipFile(zpath)as z:
 assert z.testzip()is None
 for n,m in manifest.items():assert len(z.read(n))==m['bytes']and hashlib.sha256(z.read(n)).hexdigest()==m['sha256']
for p in [pdf,zpath]:shutil.copyfile(p,DELIVERY/p.name)
print(json.dumps({p.name:{'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}for p in [pdf,zpath]},indent=2))
