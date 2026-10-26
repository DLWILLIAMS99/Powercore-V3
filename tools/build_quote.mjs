// Run audit_bom.py first. Requires @oai/artifact-tool in the Node module path.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {Workbook,SpreadsheetFile} from '@oai/artifact-tool';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const work=path.resolve(root,'../.bom-workspace');
const data=JSON.parse(await fs.readFile(path.join(work,'bom-audit.json'),'utf8'));
const output=path.join(root,'quote');
await fs.mkdir(output,{recursive:true});
const wb=Workbook.create();
const overview=wb.worksheets.add('Board summary');
const detail=wb.worksheets.add('Quote BOM');
const csv=(rows)=>'\uFEFF'+rows.map(row=>row.map(value=>{
  const s=String(value??''); return /[",\r\n]/.test(s)?'"'+s.replaceAll('"','""')+'"':s;
}).join(',')).join('\r\n')+'\r\n';
const original=['Designator','Footprint','Quantity','Value','LCSC Part #'];
const enriched=[...original,'Manufacturer','Manufacturer Part Number','Distributor Part Number'];
const quoteHeaders=[...enriched,'Quote status','Notes'];
const all=[['Board',...quoteHeaders]];
const summary=[['Board','Revision','Layers','Components','Quote rows','Sourcing by MPN','Holds']];
const summaries=[];
for(const [board,b] of Object.entries(data)){
  const short=board.replace('dual-converter-','').replace('-V1.0','');
  const prod=[enriched], quote=[quoteHeaders];
  let external=0,hold=0,count=0;
  for(const row of b.bom){
    const refs=row.Designator.split(',').map(x=>x.trim());
    const p=b.schematic[refs[0]]??b.pcb[refs[0]];
    const clean=x=>!x||x==='NULL'||x==='~'?'':x;
    const manufacturer=clean(p.Manufacturer),mpn=clean(p['Manufacturer#']);
    for(const ref of refs){
      const q=b.schematic[ref]??b.pcb[ref];
      for(const k of ['Value','Manufacturer','Manufacturer#','LCSC Part #']){
        if(clean(p[k])!==clean(q[k]))throw Error(`${board}: nonuniform ${k} at ${ref}`);
      }
    }
    const part=[row.Designator,row.Footprint,Number(row.Quantity),row.Value,clean(p['LCSC Part #']),manufacturer,mpn,clean(p['Distributor#'])];
    prod.push(part);
    if(short==='motherboard'&&['U1','U2','U3'].includes(refs[0]))continue;
    let status=part[4]?'Existing mapping':'Source by MPN';
    let note='Existing catalog mapping; supplier must confirm exact MPN and availability.';
    if(!part[4]){external++;note='Quote exact manufacturer part; LCSC mapping not verified. Include sourcing/handling fees.';}
    if(short==='motherboard'&&refs.includes('R15')){
      status='Corrected mapping';note='Upstream PR #5: 100 ohm 0603, 1%, 0.1 W. C105588 / RC0603FR-07100RL. Reel variant updated in source metadata.';
    }
    if(short==='boost-converter-module'&&refs[0]==='R9'){
      note='Upstream issue #3: remove disputed C375525 mapping. Retain original RL1206FR-070R09L, 90 milliohm, 1%, 0.25 W, 1206. No 50 milliohm substitution.';
    }
    if(short==='motherboard'&&refs[0]==='L1'){
      status='HOLD';hold++;
      note='Design value BBUP00100505330Y00 (33 ohm @100MHz) conflicts with manufacturer MPN BLM15AX100SN1D (10 ohm @100MHz). Original supplier ID C668299 unverified. Quote both candidates separately; select before ordering.';
    }
    if(short==='motherboard'&&refs[0].startsWith('POGO'))note='30 through-hole spring contacts. Quote procurement, insertion and soldering separately; confirm contact height and alignment.';
    if(short==='motherboard'&&refs[0]==='U5')note='Use TMCS1133C1AQDVGR (25mV/A). C3 in footprint name is a legacy name, not permission to substitute C3 sensitivity.';
    if(short==='boost-converter-module'&&refs[0]==='C15')note='Manufacturer field repaired from TDK Corporation to C5750X6S2W225KT000N. Catalog mapping C445674; confirm orderable suffix.';
    if(short==='boost-converter-module'&&refs[0]==='R6')note='Manufacturer field aligned to existing distributor number and C861433: RT0603BRD0749K3L, 49.3k, 0.1%, 0603.';
    if(short==='motherboard'&&refs[0]==='L1'){
      // Never let automatic supplier matching silently resolve the electrical ambiguity.
      part[4]='';part[5]='';part[6]='';part[7]='';
    }
    const q=[...part,status,note];quote.push(q);all.push([short,...q]);count+=part[2];
  }
  const sh=await Workbook.fromCSV(csv(prod),{sheetName:'Production'});
  // Author corrected production CSV through the workbook engine, preserving text IDs.
  const ps=sh.worksheets.getItemAt(0);
  ps.getRange(`A1:H${prod.length}`).setNumberFormat('@');
  ps.getRange(`A1:H${prod.length}`).values=prod;
  sh.recalculate();
  await fs.writeFile(path.join(root,'circuit-boards',board,'production','bom.csv'),csv(ps.getRange(`A1:H${prod.length}`).values));
  const temp=Workbook.create();
  const qs=temp.worksheets.add('Supplier BOM');
  qs.getRange(`A1:J${quote.length}`).setNumberFormat('@');
  qs.getRange(`A1:J${quote.length}`).values=quote;
  const folder=path.join(output,short);await fs.mkdir(folder,{recursive:true});
  await fs.writeFile(path.join(folder,'bom-quote.csv'),csv(qs.getRange(`A1:J${quote.length}`).values));
  await fs.copyFile(path.join(root,'circuit-boards',board,'production','positions.csv'),path.join(folder,'positions.csv'));
  await fs.copyFile(path.join(root,b.fabrication_zip),path.join(folder,'gerbers.zip'));
  summary.push([short,b.revision,b.copper.length,count,quote.length-1,external,hold]);
  summaries.push({board:short,revision:b.revision,components:count,rows:quote.length-1,dimensions:b.dimensions,tht_or_manual_components:b.tht_or_manual_components,smd_components:b.smd_components,placement_offsets:b.placement_offsets,copper:b.copper,fabrication_source:b.fabrication_zip,fabrication_sha256:b.fabrication_sha256});
  // Individual CSV sheets are working exports; the workbook only needs the combined detail.
  qs.showGridLines=false;
  qs.getRange(`A1:J${quote.length}`).format.font={name:'Arial',size:10};
  qs.getRange('A1:J1').format={fill:'#23364D',font:{name:'Arial',bold:true,color:'#FFFFFF'}};
  qs.getRange(`A1:J${quote.length}`).format.columnWidth=25;
  qs.getRange(`A1:J${quote.length}`).format.rowHeight=24;
  qs.getRange(`A1:A${quote.length}`).format.columnWidth=48;
  qs.getRange(`G1:H${quote.length}`).format.columnWidth=36;
  qs.getRange(`J1:J${quote.length}`).format.columnWidth=100;
  qs.getRange(`A2:A${quote.length}`).format.wrapText=true;
  qs.getRange(`J2:J${quote.length}`).format.wrapText=true;
  qs.getRange(`A2:J${quote.length}`).format.autofitRows();
  qs.getRange(`C2:C${quote.length}`).setNumberFormat('0');
  qs.freezePanes.freezeRows(1);
}
overview.getRange('A2').values=[['Powercore V3 quotation review']];
overview.getRange('A3').values=[['One complete electronics set; quote only. No supplier prices entered.']];
overview.getRange(`A5:G${summary.length+4}`).values=summary;
overview.getRange('A12').values=[['HOLD: motherboard L1 bead identity requires a design decision before assembly.']];
overview.getRange('A14').values=[['Motherboard U1/U2/U3 are the three daughterboards above; exclude from purchased parts.']];
overview.getRange('A16').values=[['Cost request: 1 complete set, plus 5-set comparison. Include sourcing, setup, assembly, inspection, shipping and tax.']];
overview.getRange('A18').values=[['Preferred quote: 2oz finished outer copper on all four boards, subject to supplier DFM; retain source inner stackup.']];
overview.getRange('A20').values=[['Source files remain at 35um outer copper. Quote that stackup separately; 2oz is a proposed fabrication change.']];
detail.getRange(`A1:K${all.length}`).setNumberFormat('@');
// Explicit units prevent automatic display coercion of 0402/0603/0805 IDs.
const displayRows=all.map((row,i)=>row.map((v,j)=>i>0&&j===2&&/^0\d{3}$/.test(String(v))?`${v} (imperial)`:v));
detail.getRange(`A1:K${all.length}`).values=displayRows;
for(const sh of [overview,detail]){
  sh.showGridLines=false;
  sh.getUsedRange().format.font={name:'Arial',size:10};
  sh.getUsedRange().format.rowHeight=24;
  sh.getUsedRange().format.columnWidth=24;
}
overview.getRange('A2').format.font={name:'Arial',size:14,bold:true};
overview.getRange('A5:G5').format={fill:'#23364D',font:{name:'Arial',bold:true,color:'#FFFFFF'}};
overview.getRange('A5:A9').format.columnWidth=32;
overview.getRange('B5:G9').format.columnWidth=18;
overview.getRange('A12').format.font={color:'#9C3C10',bold:true};
detail.getRange('A1:K1').format={fill:'#23364D',font:{name:'Arial',bold:true,color:'#FFFFFF'}};
detail.getRange(`A1:B${all.length}`).format.columnWidth=40;
detail.getRange(`H1:I${all.length}`).format.columnWidth=36;
detail.getRange(`K1:K${all.length}`).format.columnWidth=100;
detail.getRange(`B2:B${all.length}`).format.wrapText=true;
detail.getRange(`K2:K${all.length}`).format.wrapText=true;
detail.getRange(`A2:K${all.length}`).format.autofitRows();
detail.getRange(`D2:D${all.length}`).setNumberFormat('0');
detail.getRange(`J2:J${all.length}`).conditionalFormats.add('containsText',{text:'HOLD',format:{fill:'#FFF0D6',font:{color:'#9C3C10',bold:true}}});
detail.freezePanes.freezeRows(1);
wb.recalculate();
console.log((await wb.inspect({kind:'table',range:'Board summary!A5:G9',maxChars:2200,tableMaxRows:5,tableMaxCols:7})).ndjson);
console.log((await wb.inspect({kind:'match',searchTerm:'#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!',options:{useRegex:true,maxResults:10},maxChars:1000})).ndjson);
for(const name of ['Board summary','Quote BOM']){
  const png=await wb.render({sheetName:name,range:name==='Board summary'?'A1:H21':'C1:J8',scale:1,format:'png'});
  await fs.writeFile(path.join(work,`${name.replaceAll(' ','-')}.png`),new Uint8Array(await png.arrayBuffer()));
}
const book=await SpreadsheetFile.exportXlsx(wb);
const bookDir=path.join(root,'outputs','powercore-bom-review');await fs.mkdir(bookDir,{recursive:true});
await book.save(path.join(bookDir,'quote-review.xlsx'));
await fs.writeFile(path.join(output,'board-manifest.json'),JSON.stringify({scope:'Quotation only; existing Gerbers unchanged; PCB properties updated without geometry edits.',preferred_quote:{outer_copper:'2 oz finished copper on F.Cu and B.Cu of all four boards; nominal 70 micrometres after plating',inner_copper:'Retain source stackup below; document any supplier proposal',condition:'Supplier DFM must confirm trace/space, pads, annular rings and stackup compatibility before ordering',comparison:'Separately quote original source outer copper; copper arrays below describe the source, not the preferred quote'},boards:summaries},null,2)+'\n');
console.log(JSON.stringify({physicalComponents:summaries.reduce((s,b)=>s+b.components,0),quoteRows:all.length-1,workbook:path.join(bookDir,'quote-review.xlsx')}));
