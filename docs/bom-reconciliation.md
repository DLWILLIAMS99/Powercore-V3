# BOM reconciliation for prototype quotations

Date: 2026-10-26. Scope: reconcile procurement records with current KiCad design intent and contributor reports. This work does not certify the power stage or implement speculative thermal redesigns.

## Corrections

| Board and references | Correction | Evidence |
| --- | --- | --- |
| Motherboard R15, R19, R26 | Replace erroneous C20161635 (10k) with C105588 (100 ohm). Align MPN to RC0603FR-07100RL and distributor number to 311-100HRCT-ND. Maintain 100 ohm, 1%, 0.1 W, 0603 intent; reel suffix changes from -10 to -07. | [Contributor PR #5](https://github.com/Rack-Robotics/Powercore-V3/pull/5), [LCSC C105588](https://www.lcsc.com/product-detail/C105588.html), [LCSC C20161635](https://www.lcsc.com/product-detail/C20161635.html) |
| Boost R9 | Remove disputed C375525 and earlier TBD placeholder. Preserve exact original YAGEO RL1206FR-070R09L, 90 milliohm, 1%, 0.25 W, 1206. Quote by MPN; leave LCSC blank until exact mapping is verified. No change to resistance or current limit. | [Contributor issue #3](https://github.com/Rack-Robotics/Powercore-V3/issues/3), existing KiCad Manufacturer#/Description/Power, [exact original part listing](https://www.digikey.com/en/products/detail/yageo/RL1206FR-070R09L/21768766) |
| Boost C15, C16 | Replace a manufacturer name mistakenly entered as MPN with C5750X6S2W225KT000N. Preserve 2.2uF, 450V, X6S, 2220 and C445674. | [Supplier catalog](https://www.lcsc.com/product-detail/C445674.html), existing distributor 445-7781-1-ND and description |
| Boost R4, R5 | Strip the distributor prefix/suffix from the MPN field: RC0603FR-132K2L. Retain distributor number separately. | Identical MPN already used for the same C3032396 parts on motherboard; existing distributor number |
| Boost R6 | Correct AT0603BRD0749K3L to RT0603BRD0749K3L to agree with its existing distributor number and supplier mapping. | [Supplier C861433](https://item.szlcsc.com/921771.html), existing 13-RT0603BRD0749K3LCT-ND and 49.3k, 0.1%, 0603 description |
| Motherboard R16, R27 | Replace prose mistakenly entered as MPN with RC2512JK-7W1KL. | [Supplier C7038808](https://www.lcsc.com/product-detail/C7038808.html), existing distributor number |
| Motherboard Q2 | Correct Manufacturer from Vishay Siliconix to Diodes Incorporated. Retain DMP45H4D9HK3-13 and distributor part number. | Existing [Diodes datasheet link](https://www.diodes.com/assets/Datasheets/DMP45H4D9HK3.pdf) and manufacturer part identity |

All these metadata corrections are applied to both placed schematic instances and PCB footprints. Production CSVs keep their first five columns and gain Manufacturer, Manufacturer Part Number, and Distributor Part Number columns so a supplier can source parts without invented LCSC IDs. Existing values and quantities are retained.

## Further discrepancies recorded without guessing

- Motherboard L1 has incompatible identities in Value and Manufacturer#. [The BBUP datasheet](https://yageogroup.com/content/datasheet/asset/file/DATASHEET_BBUP00100505_SERIES) identifies the 33 ohm candidate; the existing Murata metadata describes 10 ohm. No design decision is inferred from those conflicting fields. The quote BOM marks this position HOLD and asks for separate alternatives.
- Motherboard U5 must remain TMCS1133C1AQDVGR as specified by the source and firmware sensitivity. The C3 substring in its footprint name is not the ordered sensor variant.
- The unused pi-filter `buck-converter.kicad_sch` is not reachable from the current top-level schematic. Its components are not added to the passive filter BOM.
- DNP capacitors, test points, mounting holes, logos and simulation-only elements are excluded as intended. Board-only spring contacts remain included.
- [Copper-weight issue #4](https://github.com/Rack-Robotics/Powercore-V3/issues/4) and the current source stackup conflict. Quote options are requested rather than changing the design to an assumed copper weight.
- [Issue #1](https://github.com/Rack-Robotics/Powercore-V3/issues/1) and its comment raise electrical/thermal questions. Those reports do not supply validated replacement components. No capacitor, inductor, PMOS or firmware power redesign was applied.
- [PDF update PR #6](https://github.com/Rack-Robotics/Powercore-V3/pull/6) remains an independent documentation correction. Existing PDFs/HTML BOMs are historical generated views and are not the corrected procurement source for this quote.

## Checks performed

The audit checks grouped quantities, unique references, reachable schematic coverage, board-only contacts, PCB values, placement reference coverage and Gerber copper-layer count. It confirms all source changes are confined to procurement properties by comparing against the checked-out commit with only those property values masked. It records existing centroid/orientation differences instead of rewriting placement conventions. Copied Gerber/drill archives are CRC-checked and hashed.

One set has 216 physical components across four PCB designs and 60 grouped quote rows. The motherboard's three daughterboard placeholders are excluded from the purchase total. One ferrite-bead identity remains held; prices and live inventory are not populated. Supplier CAM/assembly review and hardware validation are still required before an assembly order.
