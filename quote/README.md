# Powercore V3 prototype quotation package

Prepared 2026-10-26. This package requests fabrication and assembly pricing for one complete electronics set, with an optional five-set comparison. It is a quotation package, not a release for production or an electrical redesign.

**Preferred quotation specification: 2 oz finished copper (nominal 70 micrometres) on both outer layers of all four boards, conditional on supplier DFM review.** State finished copper after plating, not starting foil weight. Retain the source inner-layer stackup unless the supplier proposes and documents an alternative. Quote the original source outer-copper stackup separately for cost comparison. The source KiCad files still record the original stackup; this preferred quote specification is an explicitly proposed fabrication change, not an already validated design revision.

## Files to upload

Create one PCB fabrication/assembly line item for each folder. Upload that folder's `gerbers.zip`, `bom-quote.csv`, and `positions.csv` together. The CSV contains exact manufacturer identifiers where available, plus sourcing notes. Map the manufacturer part number column in the supplier's import interface. A blank LCSC field means custom sourcing by manufacturer part number, not permission to omit the part.

The supplier must preserve BOM text identifiers such as `0603` and `0402`; import the Footprint and part-number columns as text. The companion workbook is a review aid, not the supplier import file.

| Board | Revision | Layers | Approximate outline | Parts per board | Grouped BOM rows | SMD | Through-hole or manual |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Motherboard | H | 6 | 230 x 76 mm | 94 | 29 | 62 | 32 |
| Boost converter | G | 4 | 70 x 34 mm | 29 | 17 | 28 | 1 |
| Pi filter | G | 4 | 83 x 70 mm | 44 | 4 | 42 | 2 |
| Power management | G | 4 | 38 x 70 mm | 49 | 10 | 49 | 0 |
| Complete set | | | | 216 | 60 | 181 | 35 |

Dimensions come from the source Edge.Cuts bounding box. Supplier CAM must confirm routed dimensions, tolerances, layer mapping, drill files, and panelization.

## Required quote assumptions

- One complete set is one motherboard plus one of each daughterboard. Request one assembled set and five assembled sets separately. If minimum PCB quantity exceeds assembled quantity, state how many spare bare boards are included.
- Motherboard U1, U2 and U3 are the three custom daughterboards, not catalog ICs. They remain in the repository's production BOM for design hierarchy but are excluded from the supplier quote BOM to avoid double-counting. Quote final daughterboard installation separately.
- Quote 30 Mill-Max `0906-8-15-20-76-14-11-0` spring contacts on the motherboard. These are board-only assembly items with no independent schematic symbols. Confirm insertion, alignment, mating height, soldering method and any jig charge.
- Include the boost converter's axial capacitor C14, pi filter axial capacitors C4/C6, and motherboard WAGO J1/J2 in the manual/through-hole assembly price. Custom footprints and centroid offsets require assembly review.
- Existing placement files are preserved. Their centroid positions and rotation conventions sometimes differ from KiCad footprint origins. `board-manifest.json` lists these differences. Confirm polarity and orientation in the supplier's assembly preview before an order.
- Request exact MPN sourcing for boost R9 (`RL1206FR-070R09L`) and L1 (`SRR1210-681M`), motherboard Q2 (`DMP45H4D9HK3-13`), R8/R10/R11 (`RT0805BRD07332KL`) and R7/R9/R24 (`SR2512JK-7W10RL`). Quote fees and lead times explicitly. No unreviewed electrical substitutions.
- Existing catalog mappings have not all been independently requalified or checked for live stock. Supplier confirmation of each exact MPN is required.

## Items to resolve before assembly

1. **Motherboard L1 ferrite bead:** source Value is `BBUP00100505330Y00` (33 ohm at 100 MHz), but source Manufacturer# is `BLM15AX100SN1D` (10 ohm at 100 MHz), with differing current/DCR specifications. C668299 was not independently verified. The quote BOM deliberately blanks automatic supplier identifiers and marks HOLD. Quote both candidates as alternatives and select one before ordering; do not omit the position from the final total.
2. **Copper thickness:** KiCad stackups specify 0.035 mm outer copper on all four boards. Upstream issue #4 describes a 2 oz motherboard; its only reply explains plating and gives no design-specific justification for retaining 1 oz. Gerbers do not settle this fabrication specification. Prefer 2 oz finished outer copper on all four boards for quotation, with a source-stackup comparison. Supplier DFM must check trace/space, pads, annular rings and the resulting stackup before accepting that change. If DFM requires layout changes, report them; do not silently revert to 1 oz. Thicker copper improves conductor resistance and heat spreading but does not validate peak current, component ratings or isolation. Preserve the source inner-layer specification in the manifest or state the supplier's proposed stackup. All source boards specify 1.6 mm overall thickness.
3. **Finish and assembly process:** source stackups name HAL SnPb finishes. Confirm the supplier's supported finish and solder process and identify any proposed change in the quote; do not silently substitute a finish to obtain a low headline price.
4. **Electrical validation:** the BOM changes do not close upstream issue #1's capacitor DC-bias, inductor, ripple-current and thermal concerns. The firmware's current 75 W average-input pulse-skipping setpoint is not a validated continuous-power rating. No power or current limit was raised.

## Cost breakdown to request

Ask for PCB fabrication, excess bare-board quantity, stencils/setup for four designs, parts and minimum purchase quantities, custom sourcing/consignment, SMT assembly, manual assembly/spring-contact fixtures, daughterboard installation, inspection, shipping, taxes/tariffs, and lead time. Keep one-time charges separate from per-set charges. Ask for an optional comparison leaving through-hole/manual work to the customer.

Exclude enclosure machining, thermal interface materials, external 48 V supply, USB supply/cable, output cables, machine motion/controller, dielectric system, electrodes, and electrical bring-up/testing equipment unless quoted separately. These remain part of the complete machine budget.

No quotation has been submitted and no supplier price has been obtained. A parts subtotal or PCB-only quote is not an assembled, delivered power-supply price.

## Provenance and regeneration

The four Gerber archives are unmodified copies of the existing H/G manufacturing outputs. Their SHA-256 hashes, source paths, layer thicknesses and placement differences are in `board-manifest.json`. Changes to KiCad files are procurement metadata only; copper geometry, footprints, nets, component values and firmware are unchanged. The old schematic PDFs and interactive HTML BOMs were not regenerated and must not override these corrected CSV files.

See [BOM reconciliation](../docs/bom-reconciliation.md) for corrections and evidence. To rebuild, run `python tools/audit_bom.py` then `node tools/build_quote.mjs` with `@oai/artifact-tool` installed in the Node module path. The audit uses only Python's standard library. The builder writes corrected production CSVs, supplier quote CSVs, a review workbook in `outputs/powercore-bom-review/`, and this folder's generated data. Run `python tools/package_quote.py` to validate and create the delivery ZIP.
