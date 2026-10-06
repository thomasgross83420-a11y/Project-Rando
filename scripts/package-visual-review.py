"""Lossless labeled Gate 1 contact sheets. No sprite generation or interpolation.
Requires the already adopted Pillow==12.3.0. Outputs never belong in Git.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import json, sys, textwrap, html, zipfile, shutil
root = Path(__file__).resolve().parents[1]
out = Path(sys.argv[1] if len(sys.argv)>1 else '/workspace/shared/Resonance_Bastion_Gate1_Review')
meta = json.loads((out/'capture.json').read_text())
manifest = json.loads((root/'public/assets/foundation.json').read_text())
atlas = Image.open(root/'public/assets/foundation.png').convert('RGBA')
font = ImageFont.load_default(size=18)
bold = ImageFont.load_default(size=22)
ink = '#f2f4f7'; bg = '#111923'; panel = '#17232e'
shots = {i['id']: i for i in meta['images']}
all_cards = {}

def lines(text, width):
    return textwrap.wrap(text, max(16,int((width-24)/10))) or ['']

def card(image, title, captions):
    width = max(image.width,420)
    texts = [line for caption in captions for line in lines(caption,width)]
    title_lines=lines(title,width)
    label_h=18+len(title_lines)*28+len(texts)*23+14
    result = Image.new('RGB',(width,image.height+label_h),panel)
    result.paste(image,(0,label_h))
    d=ImageDraw.Draw(result); y=12
    for line in title_lines: d.text((12,y),line,font=bold,fill='#b8eee0'); y+=28
    for line in texts: d.text((12,y),line,font=font,fill=ink); y+=23
    return result

def runtime(i):
    m=shots[i]; c=m['camera']; v=m['viewport']
    camera=f"{c['view']*90} degrees" if c else 'N/A (title/modal)'
    z=c['zoom'] if c else None
    category=('Strategic' if z<.65 else 'Tactical' if z<=1.35 else 'Close') if z else 'N/A'
    captions=[f"Viewport {v['width']}x{v['height']} CSS px | UI {m['interfaceScale']} | Camera {camera}",
              f"Zoom {category}"+(f" = {z:.6f}" if z else ''),
              f"Mode: {m['mode']}. No high-contrast/quality selector.",
              f"Source: {m['source']}; {m['crop']}.",
              f"Temporary: {m['temporary']}"]
    im=Image.open(out/m['path']).convert('RGB')
    result=card(im,m['title'],captions)
    all_cards[i]=result
    return result

def sprite(key):
    f=next(f for f in manifest['frames'] if f['key']==key)
    x,y,w,h=f['rect']; scale=2
    im=atlas.crop((x,y,x+w,y+h)).resize((w*scale,h*scale),Image.Resampling.NEAREST)
    surface=Image.new('RGBA',im.size,bg); surface.alpha_composite(im)
    temporary='Single idle candidate; not approved.'
    if ('rifle' in key or 'runner' in key or 'bulwark' in key) and f['cameraView']!=0:
        temporary+=' Procedural diagnostic view; NOT a finished matching facing.'
    captions=[f"Viewport/UI: N/A (atlas inspection) | Camera {f['cameraView']*90} degrees",
              'Zoom: 2x native pixels = 4x gameplay zoom 1; nearest-neighbor.',
              f"Mode: raw candidate palette | Source: runtime atlas foundation.png, {key}",
              f"Native {w}x{h}; foot anchor {f['anchor']}; state={f['state']}.",
              f"Temporary: {temporary}"]
    return card(surface.convert('RGB'),key,captions)

def sheet(name,title,items,cols=2,intro=''):
    col_widths=[max(item.width for item in items[c::cols]) for c in range(cols)]
    rows=[items[i:i+cols] for i in range(0,len(items),cols)]
    heights=[max(i.height for i in row) for row in rows]
    width=sum(col_widths)+16*(cols+1)
    intro_lines=lines(intro,width) if intro else []
    header=88+23*len(intro_lines)
    im=Image.new('RGB',(width,header+sum(heights)+16*(len(rows)+1)),bg)
    d=ImageDraw.Draw(im)
    d.text((16,12),'RESONANCE BASTION | GATE 1 | Awaiting User Review',font=bold,fill='#e1bf7b')
    d.text((16,44),title,font=bold,fill=ink)
    for i,l in enumerate(intro_lines): d.text((16,76+i*23),l,font=font,fill=ink)
    y=header+16
    for row,height in zip(rows,heights):
        x=16
        for col,item in enumerate(row): im.paste(item,(x,y)); x+=col_widths[col]+16
        y+=height+16
    path=out/f'{name}.png'; im.save(path,optimize=True)
    return {'file':path.name,'title':title,'dimensions':im.size,'source':'Labeled native screenshots / atlas crops; all imagery preserved or integer-nearest enlarged'}

sheets=[]
sheets.append(sheet('01-title-and-preparation','Primary tablet / actual title and preparation', [runtime('01-title-portrait'),runtime('02-preparation-portrait')],intro='Current fresh preparation uses Fit field, not a separate Fit Base preset. This is a development build, not a completed siege.'))
sheets.append(sheet('02-four-camera-orientations','Four camera orientations / real Core, Sentry and Barricade',[runtime(f'04-orientation-{v}') for v in (0,90,180,270)]))
sheets.append(sheet('03-fit-tactical-close','Current overview, tactical and close zoom',[runtime('03-fit-field'),runtime('05-tactical'),runtime('07-close')],cols=3,intro='Fit Base remains unimplemented as a distinct preset. Fit field is the current full-world control. Crops are not resized; fractional zoom may give uneven pixel sizes.'))
sheets.append(sheet('04-runtime-and-pixel-inspection','Actual-scale live comparison + enlarged runtime sprites',[runtime('06-together'),sprite('objective.harmonic_core.view0'),sprite('friendly.sentry.view0'),sprite('friendly.rifle_squad.view0'),sprite('enemy.runner.view0'),sprite('friendly.standard_barricade.view0'),sprite('terrain.basalt'),sprite('terrain.basalt.variant1'),sprite('warden.bulwark.view0')],cols=3,intro='The live comparison stages Rifle/Runner static images in the production scene solely for review. They are not campaign deployments, moving entities or combatants. Enlargements are cropped from the actual atlas, never concept art.'))
sheets.append(sheet('05-placement-selection-and-disabled','Implemented feedback / selection, placement, route text and disabled actions',[runtime(i) for i in ('08-selected','09-valid','10-invalid','09-valid-controls','10-invalid-controls','11-disabled-inventory')],intro='Selected is the existing move-preview state. Disabled refers to unfinished inventory actions. Damage/wreck states, health bars, range overlays and route lines are NOT implemented and are not fabricated here.'))
sheets.append(sheet('06-interface-scale','Primary tablet / 100% and 200% interface',[runtime('02-preparation-portrait'),runtime('16-preparation-200')],intro='200% is the actual UI setting (18px to 36px root text), not an enlarged screenshot. Additional controls require scrolling. Reduced effects currently has no animated effects to suppress.'))
sheets.append(sheet('07-landscape','Landscape / 100% and 200% interface',[runtime('12-preparation-landscape'),runtime('18-landscape-200')],intro='Both viewport orientations render, but the prescribed landscape sidebar/detail reflow is still missing. These show the current stacked layout with actual scrolling, not a mockup.'))
sheets.append(sheet('08-accessibility-controls','Current accessibility presentation / actual settings and focus',[runtime('15-accessibility'),runtime('17-camera-controls-200')],intro='No high-contrast switch, health mode or quality selector exists yet. The current dark palette, focus ring, 200% and reduced-effects control are shown. Full accessibility acceptance and physical TalkBack checks remain open.'))
keys=['objective.harmonic_core','friendly.sentry','friendly.standard_barricade','friendly.rifle_squad','enemy.runner']
sheets.append(sheet('09-static-view-and-animation-coverage','Actual static frame catalog / four camera views',[sprite(f'{key}.view{v}') for key in keys for v in range(4)],cols=4,intro='One idle frame per view only. Movement, attack, hit, damage bands, disabled battle and downed/wreck sequences are NOT implemented. Rifle/Runner views 1-3 are visibly diagnostic candidates. Do not treat these rows as an animation sequence.'))

checklist=[
'Overall artistic direction: does this feel like the intended science-fantasy fortress?',
'Pixel detail: too sparse, too dense, or comfortable at gameplay scale?',
'Perspective: do the Core, towers, walls, bodies and all four camera views agree?',
'Silhouettes: can you recognize each asset without reading its label?',
'Color and contrast: are friendlies, enemies, structures and valid/invalid placement distinguishable?',
'Terrain: are ground details, ownership boundaries and reserved precincts readable?',
'Depth: does the scene feel dimensional rather than flat?',
'Fit readability: what becomes unreadable in the current overview? Separate Fit Base and final role icons remain missing.',
'Tablet UI: are labels and buttons comfortable at 100% and 200%, portrait and landscape?',
'Overlays: do outlines, selection, nameplates or footprints obscure important artwork?',
'Presentation coherence: do the title and battlefield feel like the same game?',
'Revisions: which asset, camera view or terrain detail should change before full-roster production?',
'Missing-state expectations: are there specific movement/attack/damage cues you want evaluated when those states are implemented?'
]
limitations=[
'Awaiting User Review. No visual approval has been inferred; Gate 1 is not complete.',
'No Gate 2 work, original audio production or mass roster generation was started.',
'Only static representative candidates exist. No motion/attack/damage/downed frames, world health bars or range overlays exist.',
'Routes are validated and explained in text; route-path visualization is absent. Shadows are baked in candidates; no separate shadow system is claimed.',
'Current Fit field is not a separate Fit Base preset. No final strategic role icons. Fractional zoom sampling is not uniformly integer-sized.',
'Landscape currently uses the same stacked foundation UI, not the prescribed final sidebar/details layout.',
'High-contrast mode, durable accessibility preferences and full screen-reader/TalkBack acceptance are still missing.',
'Rifle/Runner static samples in the comparison never mutate campaign state. Their additional views remain procedural diagnostic art.',
'Chromium desktop touch emulation only; physical Android visual, GPU, storage, touch and TalkBack checks remain required.',
'No public deployment, HTTPS host or offline readiness has been verified.'
]
metadata={'status':'Awaiting User Review','capture':meta,'sheets':sheets,'checklist':checklist,'limitations':limitations,
'atlasSHA256':manifest['sha256'],'runtimeAtlasUnchanged':True,'processing':'No screenshot resampling; native atlas crops integer nearest-neighbor 2x; lossless PNG composition.'}
(out/'review-manifest.json').write_text(json.dumps(metadata,indent=2))
md=['# Resonance Bastion — Gate 1 visual review','', '**Awaiting User Review**','',*limitations,'','## Review checklist','']
md += [f'- [ ] {q}' for q in checklist]
md += ['','## Contact sheets','']+[f'- [{s["title"]}]({s["file"]})' for s in sheets]
(out/'REVIEW.md').write_text('\n'.join(md)+'\n')
css='body{margin:0;background:#111923;color:#f2f4f7;font:18px system-ui;line-height:1.5}main{max-width:1100px;margin:auto;padding:16px}a{color:#b8eee0}img{display:block;max-width:100%;height:auto;image-rendering:pixelated}figure{margin:24px 0;border:1px solid #78848b;padding:12px}figcaption{margin-bottom:12px}input{width:24px;height:24px}label{display:block;padding:8px;min-height:48px}details{margin:16px 0}summary{padding:12px;cursor:pointer}:focus-visible{outline:3px solid #ffc266}'
esc=html.escape
body='<h1>Resonance Bastion: Gate 1</h1><p><strong>Awaiting User Review</strong></p><p>This is the actual development build. Open an image for original pixels; page fitting uses nearest-neighbor CSS. No artwork or missing combat state is invented for the review.</p>'
body+='<nav aria-label="Review sections">'+''.join(f'<p><a href="#{s["file"]}">{esc(s["title"])}</a></p>' for s in sheets)+'</nav>'
body+='<h2>Known limits</h2><ul>'+''.join(f'<li>{esc(l)}</li>' for l in limitations)+'</ul>'
body+='<h2>Your visual-review checklist</h2><p>Keep approval or requested revisions in the conversation; these local checkboxes do not approve anything automatically.</p>'
body+=''.join(f'<label><input type="checkbox"> {esc(q)}</label>' for q in checklist)
for s in sheets:
    body+=f'<figure id="{s["file"]}"><figcaption>{esc(s["title"])} — labeled original-resolution contact sheet; <a href="{s["file"]}">open full size</a></figcaption><a href="{s["file"]}"><img src="{s["file"]}" alt="{esc(s["title"])}. Each panel labels viewport, interface scale, camera, zoom, presentation, source and temporary elements."></a></figure>'
body+='<details><summary>Individual runtime captures and exact metadata</summary>'
for i in meta['images']:
    body+=f'<figure><figcaption>{esc(i["title"])}<pre style="white-space:pre-wrap">{esc(json.dumps({k:v for k,v in i.items() if k!="path"},indent=2))}</pre></figcaption><a href="{i["path"]}"><img src="{i["path"]}" alt="{esc(i["title"])}"></a></figure>'
body+='</details><p><a href="review-manifest.json">Complete metadata, checklist and evidence</a></p>'
shutil.copyfile(root/'public/assets/icon.png',out/'icon.png')
(out/'index.html').write_text(f'<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" type="image/png" href="icon.png"><title>Resonance Bastion Gate 1 Review</title><style>{css}</style><main>{body}</main></html>')
# Preserve native raw PNG files as captured. Only contact sheets are composited.
archive=out.parent/'Resonance_Bastion_Gate1_Review.zip'
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
    for p in sorted(out.rglob('*')):
        if p.is_file() and p.name!='before-overview.png': z.write(p,str(p.relative_to(out.parent)))
print(json.dumps({'sheets':len(sheets),'captures':len(meta['images']),'zip':str(archive),'bytes':archive.stat().st_size,'status':'Awaiting User Review'},indent=2))
