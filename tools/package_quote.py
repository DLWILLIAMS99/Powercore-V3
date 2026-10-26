"""Validate supplier exports and build a portable quotation ZIP; no network calls."""
import csv
import hashlib
import json
import re
import zipfile
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
QUOTE=ROOT/'quote'

def rows(path):
    with path.open(encoding='utf-8-sig',newline='') as f:
        return list(csv.DictReader(f))

def main():
    manifest=json.loads((QUOTE/'board-manifest.json').read_text(encoding='utf-8'))
    total=0
    holds=[]
    for board in manifest['boards']:
        folder=QUOTE/board['board']
        parts=rows(folder/'bom-quote.csv')
        assert len(parts)==board['rows']
        assert sum(int(r['Quantity']) for r in parts)==board['components']
        refs=[x.strip() for r in parts for x in r['Designator'].split(',')]
        assert len(refs)==len(set(refs))
        assert all(int(r['Quantity'])==len(r['Designator'].split(',')) for r in parts)
        assert set(refs)=={p['Designator'] for p in rows(folder/'positions.csv')}
        assert board['smd_components']+board['tht_or_manual_components']==board['components']
        assert hashlib.sha256((folder/'gerbers.zip').read_bytes()).hexdigest()==board['fabrication_sha256']
        with zipfile.ZipFile(folder/'gerbers.zip') as z:
            assert z.testzip() is None
        for row in parts:
            if row['Quote status']=='HOLD':
                assert not row['LCSC Part #'] and not row['Manufacturer Part Number']
                holds.append((board['board'],row['Designator']))
            else:
                assert row['Manufacturer Part Number']
            assert 'TBD' not in row['LCSC Part #'] and row['LCSC Part #']!='NULL'
            assert not row['LCSC Part #'] or re.fullmatch(r'C\d+',row['LCSC Part #'])
        if board['board']=='motherboard':
            assert not {'U1','U2','U3'}&set(refs)
            r=next(r for r in parts if 'R15' in r['Designator'].split(', '))
            assert r['LCSC Part #']=='C105588'
            assert r['Manufacturer Part Number']=='RC0603FR-07100RL'
            assert sum(int(r['Quantity']) for r in parts if r['Designator'].startswith('POGO'))==30
            assert next(r for r in parts if r['Designator']=='U5')['Manufacturer Part Number']=='TMCS1133C1AQDVGR'
            assert next(r for r in parts if r['Designator']=='C3')['Footprint']=='0805'
        if board['board']=='boost-converter-module':
            r=next(r for r in parts if r['Designator']=='R9')
            assert r['LCSC Part #']=='' and r['Manufacturer Part Number']=='RL1206FR-070R09L'
        total+=board['components']
    assert total==216
    assert holds==[('motherboard','L1')]
    output=ROOT/'outputs/powercore-bom-review'
    output.mkdir(parents=True,exist_ok=True)
    target=output/'powercore-v3-quote-package.zip'
    with zipfile.ZipFile(target,'w',compression=zipfile.ZIP_DEFLATED) as z:
        for p in sorted(QUOTE.rglob('*')):
            if p.is_file():
                z.write(p,'quote/'+p.relative_to(QUOTE).as_posix())
        z.write(ROOT/'docs/bom-reconciliation.md','docs/bom-reconciliation.md')
    with zipfile.ZipFile(target) as z:
        assert z.testzip() is None
        assert len(z.namelist())==15
    print(json.dumps({'components':total,'grouped_rows':sum(b['rows'] for b in manifest['boards']),'smd':sum(b['smd_components'] for b in manifest['boards']),'tht_or_manual':sum(b['tht_or_manual_components'] for b in manifest['boards']),'holds':holds,'package':str(target)},indent=2))

if __name__=='__main__':
    main()
