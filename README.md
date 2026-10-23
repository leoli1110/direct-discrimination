# Direct Discrimination — TCC Studio 2026

A browser-based time-current curve (TCC) generator and viewer for low-voltage breakers, RCBOs/RCDs and IDMT overcurrent relays from several manufacturers, with phase-fault and earth-fault charts. Every curve is built from a source-cited database of published manufacturer datasheets and standards, and you can add your own curves from current–time points.

> **Engineering aid only.** Curves are parametric reconstructions from published setting ranges and standard test points, not digitised manufacturer curves. Check against manufacturer software and selectivity tables before design or settings work.

## Features

- Log-log time-current chart (0.001–10 000 s) with tolerance bands, a fault-level marker and a hover readout.
- Phase-fault and earth-fault views. The earth-fault chart plots RCBO/RCD residual bands (IEC 61008-1 / 61009-1, general, S and G types), trip-unit G functions (definite time or I²t), relays set to earth fault, and custom earth-fault curves, with its own earth-fault current and coordination check.
- Per-device settings using each datasheet's own dials: In, Ir, tr, Isd, tsd, I²t, Ii; CT ratio, plug setting, TMS/TD and high-set for relays. Settings that can be switched off offer OFF.
- Device-voltage scaling to a study base kV, so an 11 kV relay plots correctly against 0.4 kV breakers.
- Coordination check for upstream/downstream pairs: time-current selectivity limit, and for relays a coordination time interval (CTI) of 0.4 s for electromechanical and 0.3 s for numerical relays.
- **Custom curves**, like Curve Direct's "curve defined by points":
  - name a curve and add, edit or delete current–time points
  - paste a list, load a `.txt` or `.csv` file, or click points onto the chart
  - single line or minimum/maximum band
  - currents in amperes or as multiples of a base current
  - current and time multipliers on the study card (e.g. ×0.577 across a delta-star transformer)
  - saved inside study files and links, and in a "My curves" list that is saved with the study
- **Fault analysis** tab for a radial LV network built from the study's upstream/downstream links:
  - Source: a transformer (kVA, uk, load losses, MV fault level) or a known fault level (Ik3, X/R, Ze); TN or TT earthing.
  - Per device: the cable it feeds (Cu/Al, PVC/XLPE, IEC 60364-5-52 installation method, phase and PE size, length, parallel runs, 1- or 3-phase, load current, power factor, ambient, grouping).
  - Results per device: the maximum fault at its terminals (Ik3, L-N, L-PE; IEC 60909 cmax, KT, R at 20 °C), checked against the Icu/Ics of the selected breaking version.
  - Results per circuit: Ib ≤ In ≤ Iz, cumulative voltage drop, the minimum earth fault at the circuit end (cmin, hot conductors, RA + RB in TT) against IEC 60364-4-41 disconnection times, and the adiabatic k²S² ≥ I²t check.
  - Optional markers on the chart for each device's maximum and minimum fault current.
- Save and load studies as JSON. The study is also kept in the URL hash.
- Export the chart as PNG or SVG, the curve points as CSV, or a Markdown settings report.
- Database and Method tabs, dark mode and a phone layout.

## Database coverage (v2026.4: 93 device families, 60 sources)

| Type | Coverage |
|---|---|
| MCB | Schneider Acti9 iC60N/iK60N · ABB S200/S200M · Siemens 5SL/5SY · Eaton FAZ · Legrand DX3 · Hager NBN/NCN/NDN · CHINT NXB-63, NB1-63 · generic IEC 60898-1 |
| RCBO / RCD | Schneider Acti9 iCV40N, iDPN N Vigi · ABB DS201 L H · Siemens 5SU1 · Eaton xEffect FRBm6 · Legrand DX3 RCBO · Hager 10 kA RCBO, ADA1xxT · CHINT NB1L, NXBLE-63 · generic IEC 61009-1 RCBO and IEC 61008-1 RCCB |
| Residual add-ons and relays | Schneider VigiPacT (NSX100–630), Vigirex RH99M · ABB RC Sel (XT2–XT4) · Siemens 3VA RCD520/RCD820 · Eaton NZM1-XFI |
| MCCB thermal-magnetic | Schneider NSX TM-D, NSXm · ABB Tmax T1–T6 (TMD/TMA/TMG) and Tmax XT1–XT6 · Siemens 3VA1 · Eaton NZM A · Legrand DPX3 · Hager h3+ · CHINT NXM, NM8N, NM1 |
| MCCB electronic (G where published) | Schneider MicroLogic 2.2, 5.2/6.2 · ABB PR221DS, PR222DS, PR231/P, PR232/P, PR331/P–PR332/P (Tmax T), Ekip LSI, Ekip Dip, Ekip Touch (Tmax XT2–XT7) · Siemens ETU350/550/560 · Eaton NZM VE · Legrand DPX3 S2 · Hager h3+ LSnI · CHINT NXM, NM8N EN |
| ACB | CHINT NXA, NA8 |
| Breaking capacity | Icu/Ics for each performance version of the MCB, RCBO, MCCB and ACB families (frame-dependent where catalogues differ) |
| Network data | IEC 60228 conductor resistance, IEC 60364-5-52 current-carrying capacity (PVC/XLPE, Cu/Al, methods A1, B1, B2, C, D, E), k values, IEC 60364-4-41 disconnection times, IEC 60909 voltage factors, typical transformer impedances |
| Relays | GEC/Alstom/GE CDG11 (3 s, 1.3 s), CDG12, CDG13, CDG14, CDG21/61 · IEC 60255-151 (SI/VI/EI/LTI) · IEEE C37.112 (MI/VI/EI) |

Every value is tagged with its basis:

- `datasheet`: printed in the cited manufacturer document
- `standard`: defined by the governing standard (IEC 60898-1, IEC 60947-2, IEC 60255-151, IEEE C37.112, BS 142)
- `assumed`: a modelling assumption, explained in the entry's notes

The Database tab in the app lists every entry, and the full source list with URLs is in `db/curvedb.json` under `sources`.

## Running locally

The application is built with React 19, TypeScript, and Vite.

```bash
npm run dev             # starts the Vite development server on port 3000
npm run build           # builds the production assets
npm test                # runs engine and domain calculations tests
```

## Project layout

```
src/
  App.tsx               Root React application & state coordination
  main.tsx              Vite React entry point
  index.css             Global styles, theme variables, layout & dialog styling
  types.ts              TypeScript data models & interfaces
  engine/
    engine.ts           Parametric curve algorithms, bands, sampling & selectivity
    fault.ts            Radial LV network fault analysis (IEC 60909 / IEC 60364)
  data/
    db.ts               Typed curve database loader
  components/
    Header.tsx          Top bar, navigation tabs, study save/load, export menu, theme toggle
    Disclaimer.tsx      Engineering aid disclaimer banner
    study/
      StudyView.tsx     3-column protection study view
      LibraryPanel.tsx  Device catalog with search, category chips, custom curves
      ChartCard.tsx     Interactive toolbar & chart view container
      TccChart.tsx      Log-log SVG chart with tolerance bands, fault levels & crosshair readout
      CoordinationSection.tsx Selectivity checking table & auto-chain by pick-up
      StudyPanel.tsx    Active study devices panel & clear action
      StudyCard.tsx     Device settings dials, sliders, downstream linking, citations
    fault/
      FaultView.tsx     Radial fault analysis, supply forms, cable circuit checks
    database/
      DatabaseView.tsx  Full datasheet database explorer with source links
    method/
      MethodView.tsx    Comprehensive documentation of mathematical models
    custom/
      CustomCurveModal.tsx Custom curve points editor with live chart picking
public/
  db/curvedb.json       Static database file for direct JSON download
  favicon.svg           Favicon asset
db/curvedb.json         Source-cited curve database
tests/engine.test.mjs   Engine and database tests
tests/fault.test.mjs    Fault-analysis tests against hand calculations
```

CI rebuilds the database, fails if the committed `db/curvedb.json` is out of date, and runs the tests.

## Custom curve points list format

One point per line: current, time and, for a band, maximum time. Values can be separated by spaces, tabs, commas or semicolons. When the separator is a tab or semicolon, decimal commas are accepted. Lines starting with `#` and header lines are ignored.

```
# TCC Studio custom curve: 160 A gG fuse (digitised)
# current_A	t_min_s	t_max_s
400	900	4000
600	40	200
1000	1.5	6
2000	0.05	0.2
4000	0.004	0.02
```

Between points the curve is interpolated linearly on log-log axes. Two points at the same current give a vertical step. Below the first point the device does not operate. Above the last point it either holds the last time or ends, as you choose.

## Known limitations

- The fault analysis models radial networks only: no back-up (cascading) ratings, motor contribution, generators, busbar trunking or meshed and ring networks. Below 0.1 s, the conductor withstand check asks for the manufacturer's let-through I²t.
- No let-through energy (I²t) selectivity during short circuits. Use the manufacturer's selectivity tables when both devices are in their instantaneous region.
- G is plotted only where the settings were found in the cited documents; G inhibition at high current and DC/pulsating residual thresholds are not modelled. Ambient derating is not applied.
- Where a manufacturer publishes no thermal trip times, the thermal-magnetic bands use a reference shape and are tagged `assumed`. The database notes list each case, for example CHINT NM1's magnetic setting and NXA's delay steps.
