# ---------------------------------------------------------------- 2026.2 additions: ABB Tmax T + XT5-XT7, CHINT
# Executed by build_db.py before the db dict is assembled (shares its namespace).
SOURCES.update({
 "abb_tmax_t": ("ABB SACE Tmax T generation technical catalogue (1SDC210015D0208)", "https://library.e.abb.com/public/66d794a3c839491d8d95b1aed96e1a71/1SDC210015D0208.pdf", "ABB"),
 "abb_tmax_t_0202": ("ABB Tmax T generation technical catalogue (1SDC210015D0202)", "https://library.e.abb.com/public/0b4f0e5be0152a69c12572c2002fb9ae/1SDC210015D0202.pdf", "ABB"),
 "abb_xt_iec_2020": ("ABB SACE Tmax XT IEC technical catalogue 2020 (1SDC210100D0205)", "https://library.e.abb.com/public/af51e01127ae485581c3024eaedbf30c/Tmax%20XT_IEC_CATALOG_2020_1SDC210100D0205.pdf", "ABB"),
 "abb_xt7_manual": ("ABB Ekip Touch trip unit manual for SACE Tmax XT7 (1SDH001821A1002)", "https://library.e.abb.com/public/7b2d001cc1d44e7aa758691dfcab2298/1SDH001821A1002-B.pdf", "ABB"),
 "chint_nxb63": ("CHINT NXB-63 miniature circuit breaker catalogue", "https://www.chintglobal.com/content/dam/chint/global/product-center/low-voltage/iec/final-power-distribution/mcb/nxb-63/catalog/NXB-63-MCB-Catalog.pdf", "CHINT"),
 "chint_nb1": ("CHINT NB1-63 miniature circuit breaker catalogue", "https://www.chintglobal.com/content/dam/chint/global/product-center/low-voltage/iec/final-power-distribution/mcb/nb1-63/catalog/NB1-63-MCB-Catalog.pdf", "CHINT"),
 "chint_nxm": ("CHINT NXM moulded case circuit breaker catalogue", "https://www.chintglobal.com/content/dam/chint/global/product-center/low-voltage/iec/secondary-power-distribution/mccb/nxm/catalog/NXM-MCCB-Catalog.pdf", "CHINT"),
 "chint_nm8n": ("CHINT NM8N moulded case circuit breaker catalogue", "https://www.chintglobal.com/content/dam/chint/global/product-center/low-voltage/iec/secondary-power-distribution/mccb/nm8n/catalog/NM8N-MCCB-Catalog.pdf", "CHINT"),
 "chint_nm1": ("CHINT NM1 moulded case circuit breaker catalogue", "https://www.chintglobal.com/content/dam/chint/global/product-center/low-voltage/iec/secondary-power-distribution/mccb/nm1/catalog/NM1-MCCB-Catalog.pdf", "CHINT"),
 "chint_nm1_kr": ("CHINT NM1 catalogue 2024 (Korea)", "https://www.chintglobal.kr/upload/file/0%202024%20Catalog/NM1_%EC%B9%B4%ED%83%88%EB%A1%9C%EA%B7%B8.pdf", "CHINT"),
 "chint_nxa": ("CHINT NXA air circuit breaker catalogue (2501)", "https://www.chintglobal.com/content/dam/chint/global/product-center/low-voltage/iec/main-power-distribution/acb/nxa/catalog/2501-NXA-ACB-Catalog.pdf", "CHINT"),
 "chint_na8": ("CHINT NA8 air circuit breaker catalogue 2023", "https://chintglobal.vn/wp-content/uploads/2023/04/na8-catalog-2023-en-1-compressed-1.pdf", "CHINT"),
})

II = {"clearMin": 0.01, "tripMax": 0.05, "basis": "assumed"}

# Tmax T published thermal example (T4N 250, I1 = 0.9·In): at 2·I1 cold trip 105.3–357.8 s, hot 21.4–105.3 s.
def tmax_band(basis, note):
    out = {}
    for key, tconv in (("le63", 3600), ("gt63", 7200)):
        lo = solve_curve(x0=1.05, pts=[(2.0, 105.3)], a=_nom["a"])
        hi = solve_curve(a=_nom["a"], pts=[(1.30, tconv), (2.0, 357.8)])
        out[key] = band(lo, hi, basis, note)
    return out
TMAX_T_BAND = tmax_band("datasheet",
    "Cold-state band through the Tmax T catalogue example (2·I1: 105.3–357.8 s) and IEC 60947-2 conventional currents 1.05/1.30·I1. "
    "Curve shape between points follows the TM-D reference exponent (assumed).")
TMAX_XT_BAND = tmax_band("assumed",
    "Tmax XT catalogue gives no thermal times; the Tmax T published cold band (2·I1: 105.3–357.8 s) is applied as ABB reference shape (assumed).")
CHINT_TM_BAND = generic_tm_band(1.05, 1.30)

def ra(rmap, lo=5, hi=10):
    return {k: [lo * k, hi * k] for k in rmap}

# ---------------- ABB Tmax T thermal-magnetic
t1_ii = {16: [500, 630], 20: [500, 630], 25: [500, 630], 32: [500, 630], 40: [500, 630], 50: [500, 630]}
add(id="abb-t1-tmd", manufacturer="ABB", series="Tmax T1 160 TMD", category="MCCB", model="tm",
    standard="IEC 60947-2", refTempC=40, ratings=[16, 20, 25, 32, 40, 50, 63, 80, 100, 125, 160], thermal=TMAX_T_BAND,
    ir={"min": 0.7, "max": 1.0, "steps": None, "basis": "datasheet"},
    ii={"stepsA": t1_ii, "fixedA": {63: 630, 80: 800, 100: 1000, 125: 1250, 160: 1600}, "tol": 0.2, "basis": "datasheet"},
    instTimes=II, breaking="T1 B/C/N", sources=["abb_tmax_t_0202", "abb_tmax_t"],
    notes="I1 0.7–1·In; I3 fixed: 630 A for 16–63 A (500 A version on T1B/C/N), 10·In above. Magnetic ±20 % (IEC 60947-2 §8.3.3.1.2).")
t2_fixed = {1.6: 16, 2: 20, 2.5: 25, 3.2: 32, 4: 40, 5: 50, 6.3: 63, 8: 80, 10: 100, 12.5: 125, 16: 500, 20: 500, 25: 500, 32: 500,
            40: 500, 50: 500, 63: 630, 80: 800, 100: 1000, 125: 1250, 160: 1600}
add(id="abb-t2-tmd", manufacturer="ABB", series="Tmax T2 160 TMD", category="MCCB", model="tm",
    standard="IEC 60947-2", refTempC=40, ratings=list(t2_fixed), thermal=TMAX_T_BAND,
    ir={"min": 0.7, "max": 1.0, "steps": None, "basis": "datasheet"}, ii={"fixedA": t2_fixed, "tol": 0.2, "basis": "datasheet"},
    instTimes=II, breaking="T2 N/S/H/L", sources=["abb_tmax_t_0202", "abb_tmax_t"],
    notes="I1 0.7–1·In; I3 fixed: 10·In up to 12.5 A, 500 A for 16–50 A, 10·In for 63–160 A. ±20 %.")
add(id="abb-t2-tmg", manufacturer="ABB", series="Tmax T2 160 TMG (generator)", category="MCCB", model="tm",
    standard="IEC 60947-2", refTempC=40, ratings=[16, 25, 40, 63, 80, 100, 125, 160], thermal=TMAX_T_BAND,
    ir={"min": 0.7, "max": 1.0, "steps": None, "basis": "datasheet"},
    ii={"fixedA": {16: 160, 25: 160, 40: 200, 63: 200, 80: 240, 100: 300, 125: 375, 160: 480}, "tol": 0.2, "basis": "datasheet"},
    instTimes=II, breaking="T2 N/S/H/L", sources=["abb_tmax_t_0202"], notes="Generator protection: I3 = 3·In (minimum 160/200 A on low ratings).")
add(id="abb-t3-tmd", manufacturer="ABB", series="Tmax T3 250 TMD", category="MCCB", model="tm",
    standard="IEC 60947-2", refTempC=40, ratings=[63, 80, 100, 125, 160, 200, 250], thermal=TMAX_T_BAND,
    ir={"min": 0.7, "max": 1.0, "steps": None, "basis": "datasheet"}, ii={"xIn": 10, "tol": 0.2, "basis": "datasheet"},
    instTimes=II, breaking="T3 N/S", sources=["abb_tmax_t_0202", "abb_tmax_t"], notes="I1 0.7–1·In; I3 = 10·In fixed (630–2500 A).")
add(id="abb-t3-tmg", manufacturer="ABB", series="Tmax T3 250 TMG (generator)", category="MCCB", model="tm",
    standard="IEC 60947-2", refTempC=40, ratings=[63, 80, 100, 125, 160, 200, 250], thermal=TMAX_T_BAND,
    ir={"min": 0.7, "max": 1.0, "steps": None, "basis": "datasheet"},
    ii={"fixedA": {63: 400, 80: 400, 100: 400, 125: 400, 160: 480, 200: 600, 250: 750}, "tol": 0.2, "basis": "datasheet"},
    instTimes=II, breaking="T3 N/S", sources=["abb_tmax_t_0202"], notes="Generator protection: I3 = 3·In (400 A minimum).")
add(id="abb-t4-tm", manufacturer="ABB", series="Tmax T4 250/320 TMD/TMA", category="MCCB", model="tm",
    standard="IEC 60947-2", refTempC=40, ratings=[20, 32, 50, 80, 100, 125, 160, 200, 250], thermal=TMAX_T_BAND,
    ir={"min": 0.7, "max": 1.0, "steps": None, "basis": "datasheet"},
    ii={"fixedA": {20: 320, 32: 320, 50: 500}, "rangeA": ra([80, 100, 125, 160, 200, 250]), "tol": 0.2, "basis": "datasheet"},
    instTimes=II, breaking="T4 N/S/H/L/V", sources=["abb_tmax_t"],
    notes="TMD 20–50 A: I3 fixed 320/320/500 A. TMA 80–250 A: I3 5–10·In. Thermal band uses the catalogue's T4N 250 example (2·I1: 105.3–357.8 s cold).")
add(id="abb-t5-tma", manufacturer="ABB", series="Tmax T5 400/630 TMA", category="MCCB", model="tm",
    standard="IEC 60947-2", refTempC=40, ratings=[320, 400, 500], thermal=TMAX_T_BAND,
    ir={"min": 0.7, "max": 1.0, "steps": None, "basis": "datasheet"}, ii={"rangeA": ra([320, 400, 500]), "tol": 0.2, "basis": "datasheet"},
    instTimes=II, breaking="T5 N/S/H/L/V", sources=["abb_tmax_t"], notes="I1 0.7–1·In; I3 5–10·In (1600–5000 A) ±20 %.")
add(id="abb-t5-tmg", manufacturer="ABB", series="Tmax T5 400/630 TMG (generator)", category="MCCB", model="tm",
    standard="IEC 60947-2", refTempC=40, ratings=[320, 400, 500], thermal=TMAX_T_BAND,
    ir={"min": 0.7, "max": 1.0, "steps": None, "basis": "datasheet"}, ii={"rangeA": ra([320, 400, 500], 2.5, 5), "tol": 0.2, "basis": "datasheet"},
    instTimes=II, breaking="T5 N/S/H/L/V", sources=["abb_tmax_t"], notes="Generator protection: I3 2.5–5·In.")
add(id="abb-t6-tma", manufacturer="ABB", series="Tmax T6 630/800 TMA", category="MCCB", model="tm",
    standard="IEC 60947-2", refTempC=40, ratings=[630, 800], thermal=TMAX_T_BAND,
    ir={"min": 0.7, "max": 1.0, "steps": None, "basis": "datasheet"}, ii={"rangeA": ra([630, 800]), "tol": 0.2, "basis": "datasheet"},
    instTimes=II, breaking="T6 N/S/H/L", sources=["abb_tmax_t"], notes="I1 0.7–1·In; I3 5–10·In (3150–8000 A). No thermal-magnetic unit for 1000 A.")

# ---------------- ABB Tmax T electronic
PR_STEPS = [1, 1.5, 2, 2.5, 3, 3.5, 4.5, 5.5, 6.5, 7, 7.5, 8, 8.5, 9, 10]
PR221_NOTE = "PR221DS-LS/I: S and I are alternatives — S defaults to OFF; switch I to OFF if you use S."
add(id="abb-t2-pr221", manufacturer="ABB", series="Tmax T2 PR221DS-LS/I", category="MCCB", model="etu",
    standard="IEC 60947-2", ratings=[10, 25, 63, 100, 160],
    L={"ir": {"steps": [round(0.4 + 0.04 * i, 2) for i in range(16)], "unit": "xIn"}, "tr": {"steps": [3, 6, 12]}, "form": "i2t", "ref": 6,
       "basis": "datasheet", "pickup": [1.05, 1.30], "tTol": [-0.10, 0.10], "note": "t = k/I², t1 at 6·I1; ±10 % up to 2·In."},
    S={"isd": {"steps": [0] + PR_STEPS, "unit": "xIn"}, "tol": 0.10, "tsd": {"steps": [0.1, 0.25]}, "tTol": 0.20, "i2t": True, "i2tFixed": True, "defaultOff": True,
       "i2tRef": 8, "i2tRefUnit": "xIn", "i2tRefBasis": "datasheet"},
    I={"xInSteps": [0] + PR_STEPS, "tol": 0.20, "band": [0.01, 0.04]},
    sources=["abb_tmax_t_0202"], notes="I1 0.4–1·In step 0.04; t1 3/6/12 s @6·I1; I2 1–10·In, t2 0.1/0.25 s @8·In (I²t); I3 1–10·In ±20 %, ≤40 ms. " + PR221_NOTE)
add(id="abb-t456-pr221", manufacturer="ABB", series="Tmax T4/T5/T6 PR221DS-LS/I", category="MCCB", model="etu",
    standard="IEC 60947-2", ratings=[100, 160, 250, 320, 400, 630, 800, 1000],
    L={"ir": {"steps": [round(0.4 + 0.04 * i, 2) for i in range(16)], "unit": "xIn"}, "tr": {"fixed": 12}, "form": "i2t", "ref": 6,
       "basis": "datasheet", "pickup": [1.10, 1.30], "tTol": [-0.10, 0.10], "note": "t = k/I², t1 = 12 s at 6·I1; trip 1.1–1.3·I1."},
    S={"isd": {"steps": [0] + PR_STEPS, "unit": "xIn"}, "tol": 0.10, "tsd": {"steps": [0.1, 0.25]}, "tTol": 0.10, "i2t": True, "i2tFixed": True, "defaultOff": True,
       "i2tRef": 8, "i2tRefUnit": "xIn", "i2tRefBasis": "datasheet"},
    I={"xInSteps": [0] + PR_STEPS, "tol": 0.10, "band": [0.01, 0.04]},
    sources=["abb_tmax_t"], notes="T4 In 320, T5 630, T6 1000 A: 10·In setting = 9.5·In. " + PR221_NOTE)
add(id="abb-t456-pr222", manufacturer="ABB", series="Tmax T4/T5/T6 PR222DS/P LSI(G)", category="MCCB", model="etu",
    standard="IEC 60947-2", ratings=[100, 160, 250, 320, 400, 630, 800, 1000],
    L={"ir": {"min": 0.4, "max": 1.0, "step": 0.01, "unit": "xIn"}, "tr": {"min": 3, "max": 18, "step": 0.5}, "form": "i2t", "ref": 6,
       "basis": "datasheet", "pickup": [1.10, 1.30], "tTol": [-0.10, 0.10], "note": "t = k/I², t1 3–18 s (max 10.5 s on T4 320 / T5 630 / T6 1000) at 6·I1."},
    S={"isd": {"min": 0.6, "max": 10, "step": 0.1, "unit": "xIn"}, "tol": 0.10, "tsd": {"min": 0.05, "max": 0.5, "step": 0.01}, "tTol": 0.10,
       "i2t": True, "i2tRef": 8, "i2tRefUnit": "xIn", "i2tRefBasis": "datasheet"},
    I={"xInMin": 1.5, "xInMaxAll": 12, "tol": 0.10, "band": [0.01, 0.05]},
    G={"note": "LSIG: I4 0.2–1·In, t4 0.1–0.8 s (not plotted)"},
    sources=["abb_tmax_t"], notes="Electronic setting values (PR010/T or dialogue). I2 0.6–10·In, t2 0.05–0.5 s (t=k or t=k/I² @8·In); I3 1.5–12·In ±10 %.")
T7_RATINGS = [400, 630, 800, 1000, 1250, 1600]
add(id="abb-t7-pr231", manufacturer="ABB", series="Tmax T7 PR231/P LS/I", category="MCCB", model="etu",
    standard="IEC 60947-2", ratings=T7_RATINGS,
    L={"ir": {"steps": [round(0.4 + 0.04 * i, 2) for i in range(16)], "unit": "xIn"}, "tr": {"steps": [3, 6, 9, 12]}, "form": "i2t", "ref": 6,
       "basis": "datasheet", "pickup": [1.10, 1.30], "tTol": [-0.10, 0.10], "note": "t = k/I², t1 3–12 s at 6·I1 (intermediate steps assumed)."},
    S={"isd": {"steps": [0] + PR_STEPS, "unit": "xIn"}, "tol": 0.10, "tsd": {"steps": [0.1, 0.25]}, "tTol": 0.20, "i2t": True, "defaultOff": True,
       "i2tRef": 10, "i2tRefUnit": "xIn", "i2tRefBasis": "datasheet"},
    I={"xInSteps": [0] + PR_STEPS, "tol": 0.10, "band": [0.01, 0.06]},
    sources=["abb_tmax_t"], notes="S (t=k or k/I² @10·In) and I are alternatives — set the unused one to OFF.")
add(id="abb-t7-pr232", manufacturer="ABB", series="Tmax T7 PR232/P LSI", category="MCCB", model="etu",
    standard="IEC 60947-2", ratings=T7_RATINGS,
    L={"ir": {"steps": [round(0.4 + 0.04 * i, 2) for i in range(16)], "unit": "xIn"}, "tr": {"steps": [3, 6, 12, 18]}, "form": "i2t", "ref": 6,
       "basis": "datasheet", "pickup": [1.10, 1.30], "tTol": [-0.10, 0.10], "note": "t = k/I², t1 at 6·I1."},
    S={"isd": {"steps": [0, 0.6, 0.8, 1.2, 1.8, 2.4, 3, 3.6, 4.2, 5, 5.8, 6.6, 7.4, 8.2, 9, 10], "unit": "xIn"}, "tol": 0.10,
       "tsd": {"steps": [0.1, 0.25, 0.5, 0.8]}, "tTol": 0.10, "i2t": True, "i2tRef": 10, "i2tRefUnit": "xIn", "i2tRefBasis": "datasheet"},
    I={"xInSteps": [0, 1.5, 2.5, 3, 4, 4.5, 5, 5.5, 6.5, 7, 7.5, 8, 9, 9.5, 10.5, 12], "tol": 0.10, "band": [0.01, 0.06]},
    sources=["abb_tmax_t"], notes="I1 0.4–1·In step 0.04; t1 3/6/12/18 s @6·I1; I2 0.6–10·In, t2 0.1–0.8 s; I3 1.5–12·In ±10 %.")
add(id="abb-t7-pr332", manufacturer="ABB", series="Tmax T7 PR331/P · PR332/P LSI(G)", category="MCCB", model="etu",
    standard="IEC 60947-2", ratings=T7_RATINGS,
    L={"ir": {"min": 0.4, "max": 1.0, "step": 0.01, "unit": "xIn"}, "tr": {"min": 3, "max": 144, "step": 3}, "form": "i2t", "ref": 3,
       "basis": "datasheet", "pickup": [1.05, 1.20], "tTol": [-0.10, 0.10], "note": "t = k/I², t1 at 3·I1 (PR331/P steps 3-12-24-36-48-72-108-144 s)."},
    S={"isd": {"min": 0.6, "max": 10, "step": 0.1, "unit": "xIn"}, "tol": 0.07, "tsd": {"min": 0.05, "max": 0.8, "step": 0.01}, "tTol": 0.10,
       "i2t": True, "i2tRef": 10, "i2tRefUnit": "xIn", "i2tRefBasis": "datasheet"},
    I={"xInMin": 1.5, "xInMaxAll": 15, "tol": 0.10, "band": [0.01, 0.03]},
    G={"note": "I4 0.2–1·In, t4 0.1–1 s (not plotted)"},
    sources=["abb_tmax_t"], notes="I2 ±7 % (≤6·In); I3 1.5–15·In ±10 %, ≤30 ms. PR331/P uses discrete steps of the same ranges.")

# ---------------- ABB Tmax XT2 / XT5 / XT6 / XT7
xt2_fixed = {1.6: 16, 2: 20, 2.5: 25, 3.2: 32, 4: 40, 5: 50, 6.3: 63, 8: 80, 10: 100, 12.5: 125, 16: 300, 20: 300, 25: 300, 32: 320}
xt2_range = {40: [300, 400], 50: [300, 500], 63: [300, 630], 80: [400, 800], 100: [500, 1000], 125: [625, 1250], 160: [800, 1600]}
add(id="abb-xt2-tm", manufacturer="ABB", series="Tmax XT2 160 TMD/TMA", category="MCCB", model="tm",
    standard="IEC 60947-2", refTempC=40, ratings=list(xt2_fixed) + list(xt2_range), thermal=TMAX_XT_BAND,
    ir={"min": 0.7, "max": 1.0, "steps": None, "basis": "datasheet"}, ii={"fixedA": xt2_fixed, "rangeA": xt2_range, "tol": 0.2, "basis": "datasheet", "tolBasis": "standard"},
    instTimes=II, breaking="XT2 N/S/H/L/V", sources=["abb_xt_iec_2020"], notes="TMD 1.6–32 A fixed I3; TMA 40–160 A adjustable I3 (300 A minimum).")
add(id="abb-xt5-tma", manufacturer="ABB", series="Tmax XT5 400/630 TMA", category="MCCB", model="tm",
    standard="IEC 60947-2", refTempC=40, ratings=[320, 400, 500, 630], thermal=TMAX_XT_BAND,
    ir={"min": 0.7, "max": 1.0, "steps": None, "basis": "datasheet"}, ii={"rangeA": ra([320, 400, 500, 630]), "tol": 0.2, "basis": "datasheet", "tolBasis": "standard"},
    instTimes=II, breaking="XT5 N/S/H/L/V/X", sources=["abb_xt_iec_2020"], notes="I1 0.7–1·In; I3 5–10·In (1600–6300 A).")
add(id="abb-xt6-tma", manufacturer="ABB", series="Tmax XT6 800/1000 TMA", category="MCCB", model="tm",
    standard="IEC 60947-2", refTempC=40, ratings=[630, 800], thermal=TMAX_XT_BAND,
    ir={"min": 0.7, "max": 1.0, "steps": None, "basis": "datasheet"}, ii={"rangeA": ra([630, 800]), "tol": 0.2, "basis": "datasheet", "tolBasis": "standard"},
    instTimes=II, breaking="XT6 N/S/H/L", sources=["abb_xt_iec_2020"], notes="I1 0.7–1·In; I3 5–10·In (3150–8000 A).")
DIP_I2 = [0] + PR_STEPS
add(id="abb-xt-ekipdip-lsi", manufacturer="ABB", series="Tmax XT2/XT5/XT6 Ekip Dip LS/I", category="MCCB", model="etu",
    standard="IEC 60947-2", ratings=[10, 25, 63, 100, 160, 250, 320, 400, 630, 800, 1000],
    L={"ir": {"steps": [round(0.4 + 0.04 * i, 2) for i in range(16)], "unit": "xIn"}, "tr": {"steps": [12, 36]}, "form": "i2t", "ref": 3,
       "basis": "datasheet", "pickup": [1.05, 1.30], "tTol": [-0.10, 0.10], "note": "t = k/I², t1 12/36 s at 3·I1."},
    S={"isd": {"steps": DIP_I2, "unit": "xIn"}, "tol": 0.10, "tsd": {"steps": [0.1, 0.2]}, "tTol": 0.15, "i2t": False},
    I={"xInSteps": DIP_I2, "tol": 0.10, "band": [0.01, 0.02]},
    sources=["abb_xt_iec_2020"], notes="XT2 In 10–160 A, XT5 250–630 A, XT6 630–1000 A. S definite time t = k (0.1/0.2 s); I3 ≤20 ms.")
def dip_lsi(id_, series, ratings, tr_steps, note):
    add(id=id_, manufacturer="ABB", series=series, category="MCCB", model="etu", standard="IEC 60947-2", ratings=ratings,
        L={"ir": {"min": 0.4, "max": 1.0, "step": 0.02, "unit": "xIn"}, "tr": {"steps": tr_steps}, "form": "i2t", "ref": 3,
           "basis": "datasheet", "pickup": [1.05, 1.30], "tTol": [-0.10, 0.10], "note": "t = k/I², t1 at 3·I1; ±10 % up to 4·In."},
        S={"isd": {"steps": DIP_I2, "unit": "xIn"}, "tol": 0.10, "tsd": {"steps": [0.05, 0.1, 0.2, 0.4]}, "tTol": 0.10, "i2t": True,
           "i2tRef": 10, "i2tRefUnit": "xIn", "i2tRefBasis": "datasheet"},
        I={"xInSteps": DIP_I2, "tol": 0.10, "band": [0.01, 0.02]},
        G={"note": "LSIG versions: G not plotted"}, sources=["abb_xt_iec_2020"], notes=note)
dip_lsi("abb-xt5-ekipdip-lsi", "Tmax XT5 Ekip Dip LSI/LSIG", [250, 320, 400, 630], [3, 12, 36, 48], "t1 3/12/36/48 s @3·I1; I2 1–10·In, t2 0.05–0.4 s (t=k or I²t @10·In); I3 1–10·In ≤20 ms.")
dip_lsi("abb-xt6-ekipdip-lsi", "Tmax XT6 Ekip Dip LSI/LSIG", [630, 800, 1000], [3, 12, 36, 42, 72], "t1 3/12/36/MAX @3·I1 — MAX = 72 s (800 A) or 42 s (1000 A).")
add(id="abb-xt7-ekipdip-lsi", manufacturer="ABB", series="Tmax XT7 Ekip Dip LSI/LSIG", category="MCCB", model="etu",
    standard="IEC 60947-2", ratings=[800, 1000, 1250, 1600],
    L={"ir": {"steps": [0.4, 0.42, 0.45, 0.47, 0.5, 0.52, 0.55, 0.57, 0.6, 0.62, 0.65, 0.67, 0.7, 0.72, 0.75, 0.77, 0.8, 0.82, 0.85, 0.87, 0.9, 0.92, 0.95, 0.97, 1.0], "unit": "xIn"},
       "tr": {"steps": [3, 12, 24, 36, 48, 72, 108, 144]}, "form": "i2t", "ref": 3, "basis": "datasheet", "pickup": [1.05, 1.30], "tTol": [-0.10, 0.10],
       "note": "t = k/I², t1 at 3·I1; ±10 % up to 6·In."},
    S={"isd": {"steps": [0, 0.6, 0.8, 1, 1.5, 2, 2.5, 3, 3.5, 4, 5, 6, 7, 8, 9, 10], "unit": "xIn"}, "tol": 0.10,
       "tsd": {"steps": [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8]}, "tTol": 0.10, "i2t": True, "i2tRef": 10, "i2tRefUnit": "xIn", "i2tRefBasis": "datasheet"},
    I={"xInSteps": [0, 1.5, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], "tol": 0.10, "band": [0.01, 0.03]},
    sources=["abb_xt_iec_2020"], notes="I3 1.5–15·In, ≤30 ms.")
def touch(id_, series, ratings, tmax, tsdmax, i3max, src):
    add(id=id_, manufacturer="ABB", series=series, category="MCCB", model="etu", standard="IEC 60947-2", ratings=ratings,
        L={"ir": {"min": 0.4, "max": 1.0, "step": 0.001, "unit": "xIn"}, "tr": {"min": 3, "max": tmax, "step": 1}, "form": "i2t", "ref": 3,
           "basis": "datasheet", "pickup": [1.05, 1.20], "tTol": [-0.10, 0.10], "note": "t = k/I² (t1·9/(I/I1)²), t1 at 3·I1; IEC 60255-151 L curves also selectable (not modelled)."},
        S={"isd": {"min": 0.6, "max": 10, "step": 0.1, "unit": "xIn"}, "tol": 0.07, "tsd": {"min": 0.05, "max": tsdmax, "step": 0.01}, "tTol": 0.10,
           "i2t": True, "i2tRef": 10, "i2tRefUnit": "xIn", "i2tRefBasis": "datasheet"},
        I={"xInMin": 1.5, "xInMaxAll": i3max, "tol": 0.10, "band": [0.01, 0.03]},
        G={"note": "LSIG versions: G not plotted"}, sources=src,
        notes=f"I1 0.4–1·In; t1 3–{tmax} s @3·I1 (±10 % <6·In); I2 0.6–10·In ±7 %, t2 0.05–{tsdmax} s; I3 1.5–{i3max}·In ±10 %, ≤30 ms.")
touch("abb-xt5-ekiptouch", "Tmax XT5 Ekip Touch LSI/LSIG", [250, 320, 400, 630], 48, 0.5, 10, ["abb_xt_iec_2020"])
touch("abb-xt7-ekiptouch", "Tmax XT7 Ekip Touch LSI/LSIG", [800, 1000, 1250, 1600], 144, 0.8, 15, ["abb_xt_iec_2020", "abb_xt7_manual"])

# ---------------- CHINT MCB
add(id="chint-nxb63", manufacturer="CHINT", series="NXB-63", category="MCB", model="mcb",
    standard="IEC/EN 60898-1", refTempC=30, ratings=[1, 2, 3, 4, 6, 10, 16, 20, 25, 32, 40, 50, 63], thermal=B898,
    curves={"B": mag(3, 5), "C": mag(5, 10), "D": mag(10, 16)}, breaking="Icn 6 kA / 10 kA", sources=["chint_nxb63"],
    notes="B 3–5·In, C 5–10·In, D 10–16·In; 1.13/1.45/2.55·In test points as IEC 60898-1; reference 30 °C.")
add(id="chint-nb1", manufacturer="CHINT", series="NB1-63", category="MCB", model="mcb",
    standard="IEC/EN 60898-1; IEC/EN 60947-2", refTempC=30, ratings=[1, 2, 3, 4, 6, 10, 13, 16, 20, 25, 32, 40, 50, 63], thermal=B898,
    curves={"B": mag(3, 5), "C": mag(5, 10), "D": mag(10, 14)}, breaking="6 kA (60898-1) / 10 kA (60947-2)", sources=["chint_nb1"],
    notes="B 3–5·In, C 5–10·In, D 10–14·In; reference 30 °C. Thermal band from IEC 60898-1 points (not tabulated in catalogue).")

# ---------------- CHINT MCCB
nxm_r = [10, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125, 160, 180, 200, 225, 250, 315, 350, 400, 500, 630, 700, 800, 900, 1000]
add(id="chint-nxm-tm", manufacturer="CHINT", series="NXM 63–1000 thermal-magnetic", category="MCCB", model="tm",
    standard="IEC 60947-2", refTempC=40, ratings=nxm_r, thermal=CHINT_TM_BAND,
    ir={"min": 1.0, "max": 1.0, "steps": [1.0], "basis": "datasheet"}, ii={"xIn": 10, "tol": 0.2, "basis": "datasheet"},
    instTimes=II, breaking="E/S/F/H (15–70 kA)", sources=["chint_nxm"],
    notes="Thermal fixed; 1.05·In no trip / 1.30·In trip (1 h ≤63 A, 2 h >63 A). Magnetic 10·In fixed ±20 %. Motor version 12·In not included.")
add(id="chint-nxm1600-tm", manufacturer="CHINT", series="NXM 1250/1600 thermal-magnetic", category="MCCB", model="tm",
    standard="IEC 60947-2", refTempC=40, ratings=[1000, 1250, 1600], thermal=CHINT_TM_BAND,
    ir={"min": 0.7, "max": 1.0, "steps": [0.7, 0.8, 0.9, 1.0], "basis": "datasheet"},
    ii={"stepsXIn": {"1000": [7, 8, 9, 10], "1250": [7, 8, 9, 10], "1600": [7, 8, 9, 10]}, "tol": 0.2, "basis": "datasheet", "tolBasis": "standard"},
    instTimes=II, breaking="S/H (50/70 kA)", sources=["chint_nxm"], notes="Ir 0.7-0.8-0.9-1·In (1600 frame); Ii 7-8-9-10·In.")
nxm_io = {63: [32, 36, 40, 45, 50, 56, 60, 63], 125: [63, 70, 75, 80, 90, 100, 110, 125], 160: [80, 90, 100, 110, 125, 140, 150, 160],
          250: [125, 140, 150, 160, 180, 200, 225, 250], 400: [200, 225, 250, 280, 300, 315, 350, 400], 630: [400, 450, 480, 500, 530, 560, 600, 630],
          800: [630, 660, 680, 700, 720, 750, 780, 800], 1000: [630, 680, 720, 780, 820, 900, 950, 1000], 1250: [630, 700, 800, 900, 1000, 1100, 1200, 1250],
          1600: [800, 900, 1000, 1100, 1250, 1400, 1500, 1600]}
add(id="chint-nxm-etu", manufacturer="CHINT", series="NXM electronic (distribution)", category="MCCB", model="etu",
    standard="IEC 60947-2", ratings=list(nxm_io),
    L={"ir": {"io": nxm_io}, "tr": {"steps": [12, 60, 80, 100, 150]}, "form": "i2t", "ref": 2, "basis": "datasheet",
       "pickup": [1.05, 1.30], "tTol": [-0.10, 0.10], "note": "I²t = constant; tr at 2·Ir: 12-60-80-100 s (Inm <400 A) or 12-60-100-150 s (Inm ≥400 A)."},
    S={"isd": {"steps": [0, 1.5, 2, 3, 4, 5, 6, 8], "unit": "xIr"}, "tol": 0.15, "tsd": {"fixed": 0.3}, "tTol": 0.20, "i2t": False},
    I={"xIrSteps": [0, 2, 3, 4, 6, 8, 10, 12], "tol": 0.15, "band": [0.01, 0.05], "bandBasis": "assumed"},
    sources=["chint_nxm"], notes="Rating = frame Inm; Ir dial values in A. Isd 1.5–8·Ir ±15 %, tsd 0.3 ±0.06 s; Ii 2–12·Ir ±15 %.")
nm8n_r = [16, 20, 25, 32, 40, 50, 63, 80, 100, 125, 160, 180, 200, 225, 250, 315, 350, 400, 500, 630, 700, 800, 1000, 1250, 1600]
def nm8n_tm(frame, ratings, adj, ii_steps):
    add(id=f"chint-nm8n{frame.replace('/', '-')}-tm", manufacturer="CHINT", series=f"NM8N-{frame} thermal-magnetic (TM)", category="MCCB", model="tm",
        standard="IEC 60947-2", refTempC=40, ratings=ratings, thermal=CHINT_TM_BAND,
        ir=({"min": 0.7, "max": 1.0, "steps": [0.7, 0.8, 0.9, 1.0], "basis": "datasheet"} if adj else {"min": 1.0, "max": 1.0, "steps": [1.0], "basis": "datasheet"}),
        ii={"stepsXIn": {str(r): ii_steps for r in ratings}, "tol": 0.2, "basis": "datasheet"},
        instTimes=II, breaking="C/S/Q/H/R (36–150 kA @400 V)", sources=["chint_nm8n"],
        notes=(f"Ir {'0.7-0.8-0.9-1.0·In' if adj else '1.0·In non-adjustable'}; Ii {'-'.join(str(x) for x in ii_steps)}·In ±20 %. "
               "Setting-to-frame mapping read from the catalogue TM table by column order (frame 125 | 250 | 400/630 | 800 | 1600); "
               "thermal times not printed, so the conventional 1.05/1.30·In band with the reference shape is used."))
nm8n_tm("125", [16, 20, 25, 32, 40, 50, 63, 80, 100, 125], False, [10])
nm8n_tm("250", [125, 160, 180, 200, 225, 250], True, [10])
nm8n_tm("400/630", [250, 315, 350, 400, 500, 630], False, [7, 8, 9, 10, 11, 12])
nm8n_tm("800", [500, 630, 700, 800], True, [5, 6, 7, 8, 9, 10])
nm8n_tm("1600", [800, 1000, 1250, 1600], True, [6, 7, 8, 9, 10])
add(id="chint-nm8n-en", manufacturer="CHINT", series="NM8N electronic EN (LSI)", category="MCCB", model="etu",
    standard="IEC 60947-2", ratings=[32, 63, 100, 160, 250, 400, 630, 800, 1000, 1250, 1600],
    L={"ir": {"steps": [0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0.95, 1.0], "unit": "xIn"}, "tr": {"steps": [3, 6, 12, 18]}, "form": "i2t", "ref": 6,
       "basis": "datasheet", "pickup": [1.05, 1.30], "tTol": [-0.10, 0.10], "note": "tr at 6·Ir ±10 %; pick-up 1.05/1.30 (IEC 60947-2, assumed)."},
    S={"isd": {"steps": [0, 1.5, 2, 3, 4, 6, 8, 10], "unit": "xIr"}, "tol": 0.15, "tsd": {"steps": [0.1, 0.2, 0.3, 0.4]}, "tTol": 0.20, "i2t": False},
    I={"xInSteps": [0, 2, 3, 4, 6, 8, 10, 12], "tol": 0.15, "band": [0.01, 0.06]},
    sources=["chint_nm8n"], notes="Isd ±15 %, tsd ±20 % or ±40 ms; Ii 2–12·In ±15 %, ≤60 ms. EM version adds G (0.4–1·In, not plotted).")
nm1_r = [10, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125, 140, 160, 180, 200, 225, 250, 300, 315, 350, 400, 450, 500, 630, 700, 800, 1000, 1250]
add(id="chint-nm1-tm", manufacturer="CHINT", series="NM1 thermal-magnetic (distribution)", category="MCCB", model="tm",
    standard="IEC 60947-2", refTempC=40, ratings=nm1_r, thermal=CHINT_TM_BAND,
    ir={"min": 1.0, "max": 1.0, "steps": [1.0], "basis": "datasheet"}, ii={"xIn": 10, "tol": 0.2, "basis": "assumed"},
    instTimes=II, breaking="S/H/R (15–70 kA)", sources=["chint_nm1_kr", "chint_nm1"],
    notes="Thermal fixed; 1.05·In no trip / 1.30·In trip (1 h ≤63 A, 2 h >63 A), calibrated at 40 °C. "
          "The magnetic setting is not legible in the available catalogue text: 10·In ±20 % (as on the successor NXM) is assumed.")

# ---------------- CHINT ACB
nxa_r = [400, 630, 800, 1000, 1250, 1600, 2000, 2500, 3200, 3600, 4000, 5000, 6300]
add(id="chint-nxa", manufacturer="CHINT", series="NXA ACB intelligent controller (M/A, P/H)", category="ACB", model="etu",
    standard="IEC 60947-2", ratings=nxa_r,
    L={"ir": {"steps": [0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0], "unit": "xIn"}, "tr": {"steps": [1, 2, 4, 8, 12, 16, 20, 24, 30]}, "form": "i2t", "ref": 6,
       "basis": "datasheet", "pickup": [1.05, 1.30], "tTol": [-0.15, 0.15], "note": "t = (6/N)²·tr, tr at 6·Ir, ±15 %. Factory tr = 2 s; tr step list taken from NA8 (assumed)."},
    S={"isd": {"steps": [0, 2, 3, 4, 5, 6, 8, 10], "unit": "xIr"}, "tol": 0.15, "tsd": {"steps": [0.1, 0.2, 0.3, 0.4]}, "tTol": 0.15, "i2t": True,
       "i2tRef": 10, "i2tRefBasis": "assumed"},
    I={"xInSteps": [0, 2, 4, 6, 8, 10, 12, 15], "tol": 0.15, "band": [0.02, 0.05], "bandBasis": "datasheet"},
    G={"note": "Ig 0.5·In (NXA16/20) or 800 A (NXA32+), inverse/definite (not plotted)"},
    sources=["chint_nxa"], notes="Isd: <0.85 no trip / >1.15 trip; 4-step definite time (values assumed 0.1–0.4 s); Ii 2–15·In, ≤50 ms.")
add(id="chint-na8", manufacturer="CHINT", series="NA8 ACB intelligent controller", category="ACB", model="etu",
    standard="IEC 60947-2", ratings=[200, 400, 630, 800, 1000, 1250, 1600, 2000, 2500, 3200, 4000, 5000, 6300, 7500],
    L={"ir": {"min": 0.4, "max": 1.0, "step": 0.01, "unit": "xIn"}, "tr": {"steps": [1, 2, 4, 8, 12, 16, 20, 24, 30]}, "form": "i2t", "ref": 6,
       "basis": "datasheet", "pickup": [1.05, 1.30], "tTol": [-0.15, 0.15], "note": "t = (6/N)²·tr (catalogue example 1.8·Ir, tr 2 s → 22.2 s). Pick-up 1.05/1.30 is IEC 60947-2 (assumed)."},
    S={"isd": {"min": 1.5, "max": 10, "step": 0.5, "unit": "xIr"}, "tol": 0.15, "tsd": {"steps": [0.1, 0.2, 0.3, 0.4]}, "tTol": 0.15, "i2t": True,
       "i2tRef": 10, "i2tRefBasis": "datasheet"},
    I={"xInMin": 2, "xInMaxAll": 15, "tol": 0.15, "band": [0.02, 0.1]},
    G={"note": "Ig 0.2–1·In (≤2500 frame) / 500–1200 A (not plotted)"},
    sources=["chint_na8"], notes="Isd <0.9 no trip / >1.15 trip; tsd definite 0.1–0.4 s or inverse I²t = (10·Ir)²·tsd; Ii 2–15·In, ≤100 ms.")
