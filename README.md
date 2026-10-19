# TCC Studio 2026

A browser-based time-current curve (TCC) generator and viewer for low-voltage breakers and IDMT overcurrent relays from several manufacturers. Every curve is built from a source-cited database of published manufacturer datasheets and standards, and you can add your own curves from current–time points.

> **Engineering aid only.** Curves are parametric reconstructions from published setting ranges and standard test points, not digitised manufacturer curves. Check against manufacturer software and selectivity tables before design or settings work.

## Features

- Log-log time-current chart (0.001–10 000 s) with tolerance bands, a fault-level marker and a hover readout.
- Per-device settings using each datasheet's own dials: In, Ir, tr, Isd, tsd, I²t, Ii; CT ratio, plug setting, TMS/TD and high-set for relays. Settings that can be switched off offer OFF.
- Device-voltage scaling to a study base kV, so an 11 kV relay plots correctly against 0.4 kV breakers.
- Coordination check for upstream/downstream pairs: time-current selectivity limit, and for relays a coordination time interval (CTI) of 0.4 s for electromechanical and 0.3 s for numerical relays.
- **Custom curves**, like Curve Direct's "curve defined by points":
  - name a curve and add, edit or delete current–time points
  - paste a list, load a `.txt` or `.csv` file, or click points onto the chart
  - single line or minimum/maximum band
  - currents in amperes or as multiples of a base current
  - current and time multipliers on the study card (e.g. ×0.577 across a delta-star transformer)
  - saved inside study files and links, and optionally in a per-browser "My curves" library
- Save and load studies as JSON. The study is also kept in the URL hash.
- Export the chart as PNG or SVG, the curve points as CSV, or a Markdown settings report.
- Database and Method tabs, dark mode and a phone layout.

## Database coverage (v2026.2: 74 device families, 37 sources)

| Type | Coverage |
|---|---|
| MCB | Schneider Acti9 iC60N/iK60N · ABB S200/S200M · Siemens 5SL/5SY · Eaton FAZ · Legrand DX3 · Hager NBN/NCN/NDN · CHINT NXB-63, NB1-63 · generic IEC 60898-1 |
| MCCB thermal-magnetic | Schneider NSX TM-D, NSXm · ABB Tmax T1–T6 (TMD/TMA/TMG) and Tmax XT1–XT6 · Siemens 3VA1 · Eaton NZM A · Legrand DPX3 · Hager h3+ · CHINT NXM, NM8N, NM1 |
| MCCB electronic | Schneider MicroLogic 2.2, 5.2/6.2 · ABB PR221DS, PR222DS, PR231/P, PR232/P, PR331/P–PR332/P (Tmax T), Ekip LSI, Ekip Dip, Ekip Touch (Tmax XT2–XT7) · Siemens ETU350/550 · Eaton NZM VE · Legrand DPX3 S2 · Hager h3+ LSnI · CHINT NXM, NM8N EN |
| ACB | CHINT NXA, NA8 |
| Relays | GEC/Alstom/GE CDG11 (3 s, 1.3 s), CDG12, CDG13, CDG14, CDG21/61 · IEC 60255-151 (SI/VI/EI/LTI) · IEEE C37.112 (MI/VI/EI) |

Every value is tagged with its basis:

- `datasheet`: printed in the cited manufacturer document
- `standard`: defined by the governing standard (IEC 60898-1, IEC 60947-2, IEC 60255-151, IEEE C37.112, BS 142)
- `assumed`: a modelling assumption, explained in the entry's notes

The Database tab in the app lists every entry, and the full source list with URLs is in `db/curvedb.json` under `sources`.

## Running locally

The app is static HTML, CSS and ES modules with no build step.

```bash
npm run serve           # or: python3 -m http.server 8765
# open http://localhost:8765
```

## Project layout

```
index.html, css/, js/app.js   UI
js/engine.js                  curve maths: settings, bands, sampling, selectivity, custom curves
db/curvedb.json               generated curve database (committed)
database/build_db.py          builds db/curvedb.json (fits thermal bands with SciPy)
database/additions_2026b.py   ABB Tmax T/XT and CHINT entries (executed by build_db.py)
tests/engine.test.mjs         engine and database tests (node --test)
```

## Rebuilding the database

```bash
pip install -r database/requirements.txt
npm run build:db
npm test
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

- No let-through energy (I²t) selectivity during short circuits. Use the manufacturer's selectivity tables when both devices are in their instantaneous region.
- Ground-fault (G) functions are stored but not plotted. Ambient derating is not applied.
- Where a manufacturer publishes no thermal trip times, the thermal-magnetic bands use a reference shape and are tagged `assumed`. The database notes list each case, for example CHINT NM1's magnetic setting and NXA's delay steps.
