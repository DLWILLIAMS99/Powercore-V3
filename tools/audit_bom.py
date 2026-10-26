"""Inspect KiCad component properties and reconcile BOM/placement coverage."""
import csv
import json
import re
import hashlib
import io
import subprocess
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def blocks(text, tag):
    """Yield balanced top-level child expressions, preserving original offsets."""
    depth = 0
    quoted = escaped = False
    start = None
    for i, c in enumerate(text):
        if quoted:
            if escaped:
                escaped = False
            elif c == '\\':
                escaped = True
            elif c == '"':
                quoted = False
            continue
        if c == '"':
            quoted = True
        elif c == '(':
            if depth == 1 and text.startswith('(' + tag, i) and text[i+len(tag)+1].isspace():
                start = i
            depth += 1
        elif c == ')':
            depth -= 1
            if depth == 1 and start is not None:
                yield start, i + 1, text[start:i+1]
                start = None

def props(block):
    return {json.loads(k): json.loads(v) for k, v in re.findall(r'\(property\s+("(?:[^"\\]|\\.)*")\s+("(?:[^"\\]|\\.)*")', block)}

def components(path):
    text = path.read_text(encoding='utf-8-sig')
    tag = 'symbol' if path.suffix == '.kicad_sch' else 'footprint'
    return [(a,b,p,block) for a,b,block in blocks(text, tag) if (p := props(block)).get('Reference')]

def inspect():
    result = {}
    for board in sorted((ROOT/'circuit-boards').iterdir()):
        if not board.is_dir():
            continue
        sch = {}
        pending = [board/(board.name+'.kicad_sch')]
        seen = set()
        while pending:
            path = pending.pop()
            if path in seen:
                continue
            seen.add(path)
            text = path.read_text(encoding='utf-8-sig')
            pending.extend(board/p['Sheetfile'] for _,_,block in blocks(text,'sheet') if (p:=props(block)).get('Sheetfile'))
            for _,_,p,block in components(path):
                if not p['Reference'].startswith('#'):
                    sch[p['Reference']] = dict(p, source=path.name, dnp='(dnp yes)' in block, in_bom='(in_bom no)' not in block)
        pcb = {}
        pcb_blocks = {}
        for path in board.glob('*.kicad_pcb'):
            pcb.update({p['Reference']:p for _,_,p,_ in components(path)})
            pcb_blocks.update({p['Reference']:block for _,_,p,block in components(path)})
        bom = list(csv.DictReader((board/'production/bom.csv').open(encoding='utf-8-sig', newline='')))
        bom_refs = {r.strip() for row in bom for r in row['Designator'].split(',')}
        placed = list(csv.DictReader(io.StringIO((board/'production/positions.csv').read_text(encoding='utf-8-sig'))))
        flattened = [r.strip() for row in bom for r in row['Designator'].split(',')]
        assert len(flattened) == len(set(flattened)), (board.name,'duplicate reference')
        assert all(int(row['Quantity']) == len(row['Designator'].split(',')) for row in bom), (board.name,'quantity mismatch')
        assert {r['Designator'] for r in placed} == bom_refs - ({'U1','U2','U3'} if 'motherboard' in board.name else set()), (board.name,'placement coverage mismatch')
        required = {r for r,p in sch.items() if p['in_bom'] and not p['dnp'] and p.get('Footprint')}
        assert not required-bom_refs, (board.name,'missing populated components',required-bom_refs)
        for row in bom:
            for ref in row['Designator'].split(','):
                ref=ref.strip()
                assert ref in pcb, (board.name,ref,'missing PCB footprint')
                assert pcb[ref]['Value'] == row['Value'], (board.name,ref,'value differs from PCB')
        placement_offsets=[]
        for p in placed:
            block=pcb_blocks[p['Designator']]
            at=re.search(r'\(at\s+(-?[\d.]+)\s+(-?[\d.]+)(?:\s+(-?[\d.]+))?\)',block)
            delta=[round(float(p['Mid X'])-float(at[1]),6),round(-float(p['Mid Y'])-float(at[2]),6),round((float(p['Rotation'])-float(at[3] or 0))%360,6)]
            if any(abs(x)>0.0001 for x in delta):
                placement_offsets.append({'reference':p['Designator'],'centroid_minus_footprint_origin_mm':delta[:2],'rotation_difference_degrees':delta[2]})
        pcb_text=next(board.glob('*.kicad_pcb')).read_text(encoding='utf-8-sig')
        # Only procurement property values may differ from the checked-out commit.
        for source in [*board.glob('*.kicad_pcb'),*board.glob('*.kicad_sch')]:
            prior=subprocess.check_output(['git','show','HEAD:'+source.relative_to(ROOT).as_posix()],cwd=ROOT).decode('utf-8-sig').replace('\r\n','\n')
            current=source.read_text(encoding='utf-8-sig')
            mask=lambda s:re.sub(r'(\(property\s+"(?:Manufacturer|Manufacturer#|Distributor#|LCSC Part #)"\s+)"(?:[^"\\]|\\.)*"',r'\1"<procurement metadata>"',s)
            assert mask(prior)==mask(current),(source,'changes beyond procurement properties')
        stackup=next(b for _,_,setup in blocks(pcb_text,'setup') for _,_,b in blocks(setup,'stackup'))
        copper=[]
        for _,_,layer in blocks(stackup,'layer'):
            if '(type "copper")' in layer:
                copper.append({'layer':json.loads(re.search(r'\(layer\s+("[^"]+")',layer)[1]),'thickness_mm':float(re.search(r'\(thickness ([0-9.]+)\)',layer)[1])})
        revision=re.search(r'\(rev "([^"]+)"\)',pcb_text)[1]
        edges=[block for tag in ['gr_line','gr_rect','gr_arc','gr_circle','gr_poly'] for _,_,block in blocks(pcb_text,tag) if '(layer "Edge.Cuts")' in block]
        points=[(float(x),float(y)) for block in edges for x,y in re.findall(r'\((?:start|end|mid|xy)\s+(-?[\d.]+)\s+(-?[\d.]+)\)',block)]
        assert points,(board.name,'missing outline')
        dimensions={'width_mm':round(max(x for x,y in points)-min(x for x,y in points),4),'height_mm':round(max(y for x,y in points)-min(y for x,y in points),4),'note':'Bounding box of Edge.Cuts endpoints/midpoints; supplier CAM must confirm routed dimensions.'}
        modules={'U1','U2','U3'} if 'motherboard' in board.name else set()
        tht_refs={r for r in bom_refs-modules if '(attr through_hole)' in pcb_blocks[r] or re.search(r'\(pad\s+"[^"]*"\s+thru_hole\s',pcb_blocks[r]) or r.startswith('POGO')}
        packages=sorted((board/'production').glob('*_'+revision+'.zip'))
        assert len(packages)==1,(board.name,'ambiguous fabrication package',packages)
        package=packages[0]
        with zipfile.ZipFile(package) as z:
            assert sum(n.endswith(('.gtl','.gbl','.g1','.g2','.g3','.g4')) for n in z.namelist())==len(copper)
            assert not z.testzip()
        result[board.name] = {'schematic':sch,'pcb':pcb,'bom':bom,
            'missing_from_bom':sorted(set(sch)-bom_refs),
            'missing_from_schematic':sorted(bom_refs-set(sch)),
            'positions':placed, 'placement_offsets':placement_offsets,'copper':copper, 'revision':revision,'dimensions':dimensions,
            'tht_or_manual_components':len(tht_refs),'smd_components':len(bom_refs-tht_refs-modules),
            'fabrication_zip':str(package.relative_to(ROOT)).replace('\\','/'),
            'fabrication_sha256':hashlib.sha256(package.read_bytes()).hexdigest()}
    return result

if __name__ == '__main__':
    data = inspect()
    out = ROOT.parent/'.bom-workspace/bom-audit.json'
    out.parent.mkdir(exist_ok=True)
    out.write_text(json.dumps(data,indent=2),encoding='utf-8')
    for name,b in data.items():
        print(name, 'revision',b['revision'],'BOM rows',len(b['bom']),'components',sum(int(r['Quantity']) for r in b['bom']),'layers',len(b['copper']))
