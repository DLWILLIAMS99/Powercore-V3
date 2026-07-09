# Engineering Review Notes: EDM Power Stage BOM and Simulation Concerns

Date: 2026-07-08
Branch: `aoi/edm-bom-simulation-review`

## Scope

These notes capture review items raised from the upstream Powercore V3 issue discussion and identify which items were directly changed in this fork versus which require electrical redesign, stress testing, or validated simulation updates before being merged into production manufacturing outputs.

## Direct repository change applied

### Boost converter module R9 supplier mapping

File changed:

- `circuit-boards/dual-converter-boost-converter-module-V1.0/production/bom.csv`

Original BOM entry:

```csv
R9,1206,1,90mR,C375525
```

Issue finding:

- `C375525` is a 1206 thick-film resistor listed as 50 mΩ ±1%, 250 mW, not a 90 mΩ part.

Applied fork change:

```csv
R9,1206,1,90mR,TBD_VERIFY_90mR_C375525_IS_50mR
```

Rationale:

- The design value remains `90mR` because the reviewed KiCad/BOM intent appears to be 90 mΩ.
- The incorrect supplier mapping was removed from the machine-assembly field so a board assembler should not silently place a 50 mΩ part where a 90 mΩ part is specified.
- Before ordering assembled boards, replace this placeholder with a verified 90 mΩ part number that matches package, power rating, tolerance, temperature coefficient, pulse/current capability, and availability.

## Items requiring simulation or hardware validation before production ordering

The following points were raised in the upstream issue text. They are not safe to apply as blind schematic/PCB changes without a validated LTspice file, updated thermal model, and/or bench test evidence.

### LTspice model realism

Reported corrections needed:

- L1 ESR should be 45 mΩ, not 450 mΩ.
- L2 ESR should be 45 mΩ, not 22.5 mΩ.
- Ceramic output capacitor ESR should be modeled from the selected part datasheet at operating frequency, not as an ideal 0 Ω capacitor.
- DC-bias derating should be modeled; the issue text claims the selected 10 µF ceramic capacitors may behave closer to about 500 nF under 45–48 V DC bias.
- Aluminum polymer capacitor ESR should use the relevant high-frequency ESR value, not a 100 Hz value.

Status in this fork:

- Not changed yet. The connector could not reliably enumerate the `LTSpice/` tree in this session, and no corrected `.asc`/`.net` file was provided with the pasted issue text.

Recommended next action:

- Add the corrected LTspice file from the upstream issue as a new simulation file, rather than overwriting the existing one immediately.
- Recommended path pattern: `LTSpice/reviewed/` or `LTSpice/corrected/`.
- Include a short README documenting assumed ESR, ripple current, DC-bias derating, load condition, operating frequency, and thermal assumptions.

### Inductor and capacitor thermal/ripple limits

Reported concern:

- At 5 kHz, the two filter inductors may already be near or over maximum RMS current.
- At 10 kHz and high power, the filter inductors and output aluminum polymer capacitor may have poor thermal margin.
- The issue text specifically warns about early failure above roughly 350 W / 5 kHz without adequate cooling or thermal coupling.

Status in this fork:

- No electrical redesign applied.
- No production ZIP/Gerber regeneration performed.

Recommended next action:

- Treat the current design as requiring derated operation until proven otherwise.
- Add thermal validation: thermocouple or IR-camera measurements on L1/L2 and the output aluminum polymer capacitors after extended operation.
- Test for multiple-hour operation at representative duty cycle/frequency/load, not only short demonstration cuts.
- Consider active airflow and/or thermal pads coupling high-loss inductors to the enclosure if bench data supports the concern.

### High-current PMOS output voltage concern

Reported concern:

- The voltage output by the high-current PMOS is only about 19 V even though the input voltage is 48 V.

Status in this fork:

- No schematic or PCB change applied.

Recommended next action:

- Verify with bench measurements and the corrected simulation.
- Check gate drive amplitude, PMOS orientation, Rds(on), switching timing, current path impedance, and whether the measured node is being pulled down by the intended discharge load rather than representing converter failure.

## Manufacturing warning

Do not submit this branch's production BOMs for turnkey assembly until all `NULL`, blank, or `TBD_*` supplier fields are resolved and the ZIP production packages are regenerated if the assembler expects the BOM embedded inside the ZIP rather than supplied separately.

For PCBWay/JLC-style assembly, provide:

- Gerber/drill ZIP from each module's `production/` directory.
- Matching `bom.csv`.
- Matching `positions.csv`.
- Manual notes for nonstandard module footprints, pogo pins, thermal interface materials, enclosure coupling, heatsinking, and any off-board wiring.

## Safety note

Powercore V3 is a pulsed high-current/high-voltage EDM supply. Treat first assembled boards as engineering prototypes. Use current-limited input supply, isolation where appropriate, fused input wiring, enclosure grounding, shielded/twisted output leads, remote enable, and instrumentation-rated probes during bring-up.
