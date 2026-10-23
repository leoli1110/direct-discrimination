import React from 'react';
import { DB } from '../../data/db';

export const MethodView: React.FC = () => {
  const a = (k: string, text: string) => (
    <a
      href={DB.sources[k]?.url}
      target="_blank"
      rel="noopener noreferrer"
    >
      {text}
    </a>
  );

  return (
    <main className="view method">
      <article className="prose">
        <h1>How the curves are generated</h1>
        <p>
          TCC Studio does not contain digitised manufacturer curves. Each band is a parametric model rebuilt from the setting ranges, tolerances and conventional test points published in the cited datasheets and standards. Where a document leaves a gap, the model fills it with a stated assumption, tagged <span className="tag assumed">assumed</span> in the database.
        </p>

        <h2>MCB — IEC 60898-1 / IEC 60947-2</h2>
        <p>
          The thermal band uses an I²-law model <span className="eq">t = K / ((I/(x₀·In))² − 1)</span>. The lower edge passes through the 1.13·In no-trip asymptote and 1 s at 2.55·In. The upper edge passes through 1.45·In at 1 h and 60 s at 2.55·In (120 s above 32 A). These are the IEC 60898-1 conventional points summarised in {a('siemens_mcb_guide', 'the Siemens MCB guide')} and {a('abb_s200', 'ABB S200 data')}. As a check, the fitted upper edge gives 38.5 s at 3·In, 11.7 s at 5·In and 2.7 s at 10·In. These fall inside ABB's published windows of 45 s, 15 s and 4 s. Devices certified only to IEC 60947-2 use 1.05/1.30·In conventional currents. The magnetic region is drawn between the lower and upper instantaneous limits of each curve letter. Operation is within 0.1 s under 60898-1 and 0.2 s under 60947-2, per {a('beama_2026', 'BEAMA')}.
        </p>

        <h2>MCCB thermal-magnetic</h2>
        <p>
          Pick-up limits are 1.05/1.30·Ir (or the manufacturer's stated values). Schneider ComPacT NSX and NSXm bands are fitted to their published times ({a('se_nsx_cat', 'catalogue')}). ABB Tmax T bands pass through the catalogue's worked example (T4N 250 at 2·I1: 105.3–357.8 s from cold) ({a('abb_tmax_t', 'Tmax T catalogue')}); Tmax XT reuses that ABB shape and is tagged assumed. Other brands, including CHINT, do not publish thermal time points in the cited documents, so they reuse the NSX TM-D shape as a reference and are tagged assumed. Magnetic thresholds use the datasheet value or range with its stated tolerance. If no tolerance is stated, IEC 60947-2 ±20 % is used.
        </p>

        <h2>MCCB and ACB electronic (LSI)</h2>
        <p>
          Long-time uses <span className="eq">t = tr · (ref/(I/Ir))²</span> with tr defined at the manufacturer's reference multiple: 6·Ir for Schneider, Siemens, Eaton, Legrand, Hager, CHINT NM8N/NXA/NA8 and ABB PR221/PR222/PR231/PR232, 3·I1 for ABB Ekip and PR331/PR332, and 2·Ir for CHINT NXM. Settings that the trip unit allows to be switched off appear as OFF. MicroLogic uses a thermal-image form <span className="eq">t = tr · (36 − c)/((I/Ir)² − c), c = 0.844</span>, which reproduces the published 1.5·Ir, 6·Ir and 7.2·Ir times exactly. Short-time is definite-time, or I²t-ON below the reference current. Schneider's published non-trip and maximum-break times form the band. Instantaneous is drawn from 10 ms to the published maximum break time. If a manufacturer gives no tolerance, only the nominal line is drawn.
        </p>

        <h2>IDMT relays — IEC 60255-151, IEEE C37.112 and CDG</h2>
        <p>
          IEC: <span className="eq">t = TMS · k / ((I/Is)^α − 1)</span> with SI 0.14/0.02, VI 13.5/1, EI 80/2 and LTI 120/1, per {a('iec60255_ecalpro', 'ECalPro')}. IEEE: <span className="eq">t = TD · (A/(M^p − 1) + B)</span> with constants from {a('ieee_c37112', 'IEEE C37.112-1996')}. Curves are capped at 20× setting.
        </p>
        <p>
          The CDG11 3 s relay follows BS 142, which uses the same equation as IEC SI (2.97 s at 10× setting). It has error class E7.5, which gives a ±7.5 % band, and plug settings of 50–200 %, 20–80 % or 10–40 %, per {a('cdg_brochure', 'the CDG11 brochure')}. CDG12, CDG13 and CDG14 map to LTI, VI and EI per {a('cdg_ops', 'the operating instructions')}. CDG12's 30 s at 5× tap matches IEC LTI exactly. The 1.3 s CDG11 is approximated by scaling SI and is tagged assumed. CDG21 adds a high-set instantaneous element. Relay current is converted to primary amps with Is = plug % × CT primary. All devices are then referred to the study base voltage by multiplying by kV<sub>device</sub>/kV<sub>base</sub>.
        </p>

        <h2>Coordination check</h2>
        <p>
          For each linked pair, the check scans current from the downstream pick-up up to the fault level. It returns the first current where the downstream latest clearing time reaches the upstream earliest operating time. Relay pairs are also checked against a CTI of 0.4 s if either relay is electromechanical, otherwise 0.3 s. This tool does not model current-limiting energy selectivity (I²t let-through). For breaker-to-breaker selectivity at short-circuit levels, use the manufacturer's selectivity tables.
        </p>

        <h2>RCBOs and RCDs</h2>
        <p>
          An RCBO is drawn twice. Its overcurrent part is an MCB curve (IEC 61009-1 uses the same thermal and magnetic limits as IEC 60898-1) on the phase-fault chart. Its residual part is drawn on the earth-fault chart. The residual band follows the IEC 61008-1 / 61009-1 tripping-time table for sinusoidal residual current, as reproduced in {a('eaton_frbm6', "Eaton's FRBm6 catalogue")}: no trip below 0.5·IΔn, and a maximum break time of 0.3 s at IΔn, 0.15 s at 2·IΔn and 0.04 s at 5·IΔn. Type S (selective) devices break within 0.5 / 0.2 / 0.15 s and do not operate before 0.13 / 0.06 / 0.05 s. Type G devices have a 10 ms minimum delay. Where a manufacturer prints a faster time, the band uses it, as with {a('chint_nb1l', 'CHINT NB1L')} at ≤ 0.1 s at IΔn. The lower edge of non-delayed devices is drawn at 10 ms (assumed). The residual type (AC, A, F, B) is recorded, but the band is for sinusoidal residual current; pulsating or smooth DC thresholds differ.
        </p>

        <h2>Earth-fault chart</h2>
        <p>
          The Earth fault button switches the chart to earth-fault (residual) current, which can start in the milliampere range. This view plots RCBO and RCD residual bands, the G (ground-fault) function of electronic trip units, IDMT relays set to the Earth fault function, and custom curves of the Earth fault / RCD type. G uses Ig as a multiple of In with its pick-up tolerance, and tg either as definite time or I²t (t = tg·(Iref/I)² below the reference current). For MicroLogic 6.2, the printed non-trip and maximum break times for each tg setting are used directly. Tick "Phase devices too" to add phase overcurrent curves, which also clear earth faults in TN systems. The coordination check and the fault marker then use the earth-fault current.
        </p>

        <h2>Residual add-on modules and relays</h2>
        <p>
          MCCB residual-current add-ons and earth-leakage relays are listed with the RCBOs and drawn on the earth-fault chart: {a('se_vigipact', 'Schneider VigiPacT for NSX100–630')} (IΔn 0.03–30 A, Δt 0–4 s, 30 mA always instantaneous), {a('abb_rcsel', 'ABB RC Sel for XT2–XT4')} (0.03 A instantaneous, 0.05–10 A with Δt up to 3 s), {a('siemens_3va_lv10', 'Siemens 3VA RCD520 and RCD820')}, {a('eaton_xfi', 'Eaton NZM1-XFI')} (Δt 10–450 ms) and {a('se_vigirex', 'Schneider Vigirex RH99M')}. For a delayed setting, the band starts at the non-actuating time Δt. Its maximum break time is drawn at 2·Δt + 40 ms, which is an assumption, because the documents give only Δt. Intermediate steps the documents do not print are marked as assumed.
        </p>

        <h2>Fault analysis</h2>
        <p>
          The Fault analysis tab treats the study as a radial network. Each device sits at the end of its upstream device's cable, and each device can feed one cable (conductor, insulation, installation method, phase and PE size, length, parallel runs, load). The source is either a transformer (rating, uk, load losses, MV fault level) or a known fault level at the origin (Ik3, X/R and optionally the external loop impedance Ze). Following {a('iec60909_c', 'IEC 60909-0')}, maximum currents use cmax (1.05 or 1.10) and conductor resistance at 20 °C. Minimum currents use cmin (0.95 or 0.90) and resistance at the insulation's maximum operating temperature. Transformer impedance comes from uk and the load losses, or from the typical R/X of {a('eig_isc', "the Electrical Installation Guide's transformer table")} when losses are unknown, with the {a('iec60909_kt', 'IEC 60909 correction factor KT')}. The MV network adds Z = c·Un²/Sk with R/X = 0.1. Cable resistance follows {a('iec60228', 'IEC 60228')}, with reactance 0.08 mΩ/m. The earth-fault loop uses the phase and PE conductors, and the transformer is treated as Dyn (Z0 = Z1). In TT systems, the loop adds RA + RB.
        </p>
        <p>For each device, the analysis reports:</p>
        <ul>
          <li>The maximum fault current at its line terminals, as the larger of Ik3, line–neutral and line–PE. Single-phase circuits use line–neutral and line–PE.</li>
          <li>A comparison against the breaking capacity of the selected performance version (Icu, warning when above Ics).</li>
          <li>For its cable: Ib ≤ In ≤ Iz, using {a('iec60364_552_pvc', 'IEC 60364-5-52')} current-carrying capacities ({a('nbr5410_ampacity', 'NBR 5410 tables')} where the IEC table was not available), the ambient correction √((θmax − θa)/(θmax − θref)) and a grouping factor.</li>
          <li>Cumulative voltage drop.</li>
          <li>The clearing time at the minimum earth fault at the end of the circuit, against {a('iec60364_41', 'IEC 60364-4-41 Table 41.1')}. Final circuits up to 63 A are detected automatically, and distribution circuits get 5 s (TN) or 1 s (TT).</li>
          <li>The adiabatic check k²S² ≥ I²t, with k from {a('bs7671_k', 'BS 7671 Table 54.3')}. Below 0.1 s, the device's let-through energy governs, so the check asks for the manufacturer's I²t.</li>
        </ul>
        <p>Back-up (cascading) ratings, motor contribution, ring or meshed networks, busbar trunking impedance and generator sources are not modelled.</p>

        <h2>Custom curves</h2>
        <p>
          Any device that is not in the database, such as a fuse, a motor starting curve, a cable or transformer withstand curve or a relay you digitised from a manufacturer chart, can be entered as a custom curve. This works like Curve Direct's "curve defined by points": give the curve a name, then add, edit or delete current–time points, paste a list, load a <span className="mono">.txt</span> or <span className="mono">.csv</span> points list, or click points straight onto the chart. A curve needs at least two points.
        </p>
        <p>
          Between points the curve is interpolated linearly on the log-log chart. Two points at the same current give a vertical step, for example an instantaneous trip. Below the first point the device does not operate. Above the last point it either holds the last time or the curve ends, as you choose. In band mode each row has a minimum and a maximum time, and the coordination check uses the minimum as the earliest operating time and the maximum as the latest clearing time.
        </p>
        <p>
          Currents can be entered in amperes or as multiples of a base current, which is useful when you copy points from a chart drawn in multiples of In or Ir. On the study card, the current and time multipliers shift the whole curve, for example ×0.577 to move a curve across a delta-star transformer for a phase-to-phase fault. Custom curves are saved inside the study file and its link. Ticking "Save to My curves" keeps a curve in the library list. That list is also saved with the study file and link, even when no device in the study uses the curve.
        </p>
        <p>
          Points list format: one point per line, giving current, then time, then an optional maximum time. Values can be separated by spaces, tabs, commas or semicolons. When the separator is a tab or semicolon, decimal commas are accepted. Lines starting with <span className="mono">#</span> and header lines are ignored.
        </p>

        <h2>Limits</h2>
        <ul>
          <li>Ambient derating is not applied. Each entry records its calibration reference temperature (20–50 °C).</li>
          <li>G functions are plotted only for trip units whose G settings were found in the cited documents. Inhibition of G at high currents, and DC or pulsating residual thresholds, are not modelled.</li>
          <li>Some rating lists marked in notes are typical values that were not extracted from the cited page. Check catalogue numbers before use.</li>
        </ul>

        <p>
          <b>{DB.meta.disclaimer}</b>
        </p>
      </article>
    </main>
  );
};
