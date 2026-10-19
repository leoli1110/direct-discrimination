# ---------------------------------------------------------------- 2026.3 additions: RCBO / RCD and earth-fault (G) functions
# Executed by build_db.py after additions_2026b.py (shares its namespace).
import copy

SOURCES.update({
 "eaton_frbm6": ("Eaton xEffect FRBm6 RCBO catalogue (CA003015EN) — includes the IEC 61008/61009 tripping-time tables", "https://www.eaton.com/content/dam/eaton/products/electrical-circuit-protection/circuit-breakers/xeffect-rcbo-frbm6m/eaton-xeffect-frbm6-rcbo-catalog-ca003015en-en-us.pdf", "Eaton"),
 "se_idpn_vigi": ("Schneider Electric Acti9 iDPN N Vigi RCBO product data sheet", "https://www.farnell.com/datasheets/3126244.pdf", "Schneider Electric"),
 "se_icv40": ("Schneider Electric Acti9 iCV40N RCBO product page (A9DC3616)", "https://www.se.com/ie/en/product/A9DC3616/residual-current-breaker-with-overcurrent-protection-rcbo-acti9-icv40n-1p+n-16a-c-curve-6000a-a-type-30ma/", "Schneider Electric"),
 "abb_ds201": ("ABB DS201 L H RCBO data sheet (9AKK107492A6648, Sept 2025)", "https://library.e.abb.com/public/f0185ed3587d43019e2711110e85e678/DS201%20L%20H_9AKK107492A6648_Tech%20Datasheet_Sept25.pdf?x-sign=b8nKR7CxJmrWLROsHX/iVrSpW/lpNGgS/sNANsozcTo9eL9P8DVZ0Y3gZRGfuJPb", "ABB"),
 "siemens_5su1": ("Siemens 5SU1 RCBO guide", "https://assets.new.siemens.com/siemens/assets/api/uuid:47293844-ab7b-49ae-a11c-5ba393f7de60/5SU1-RCBO-Guide_original.pdf", "Siemens"),
 "legrand_dx3_rcbo": ("Legrand DX3 1P+N type A C16 30 mA 6 kA RCBO (411131)", "https://www.legrand.com.au/en/catalog/products/dx3-1pn-type-c16a-30ma-6ka-rcbo-411131", "Legrand"),
 "hager_rcbo_ie": ("Hager Ireland RCBO range (1P+N 6 kA / 10 kA, 2P/4P)", "https://www.hager.ie/files/download/0/24901_1/0/RCBOs", "Hager"),
 "hager_ada_au": ("Hager ADA1xxT RCBO 6 kA C-curve (AS/NZS 61009.1)", "https://assets.hager.com/step-content/P/HA_22827059/Document/std.lang.all/ADA1XXT_RCBOS_6KA_C.pdf", "Hager"),
 "chint_nb1l": ("CHINT NB1L RCBO catalogue", "https://www.chintglobal.kr/upload/file/Catalogue/NB1L%20catalog.pdf", "CHINT"),
 "chint_nxble": ("CHINT NXBLE-63 RCBO product page", "https://www.chintglobal.com/global/en/products/low-voltage/iec/final-power-distribution/nxble-63.html", "CHINT"),
})

STD_RCD_NOTE = ("Residual (earth-fault) band from the IEC 61008-1 / 61009-1 tripping-time table for sinusoidal residual current: "
                "no trip below 0.5·IΔn; maximum break time 0.3 / 0.15 / 0.04 s at 1 / 2 / 5·IΔn (type S 0.5 / 0.2 / 0.15 s, "
                "minimum non-actuating 0.13 / 0.06 / 0.05 s; type G minimum 10 ms), as reproduced in Eaton's FRBm6 catalogue.")

def rcd(idn, types, classes=("general",), basis="datasheet", tmax_idn=None, note=""):
    r = {"idn": list(idn), "types": list(types), "classes": list(classes), "basis": basis, "timeBasis": "standard", "note": note}
    if tmax_idn: r["tmaxIdn"] = tmax_idn
    return r

def std_mag(curves):
    m = {"B": mag(3, 5, "standard"), "C": mag(5, 10, "standard"), "D": mag(10, 20, "standard")}
    return {c: m[c] for c in curves}

def rcbo(**kw):
    kw.setdefault("category", "RCBO"); kw.setdefault("model", "mcb"); kw.setdefault("thermal", B898)
    kw.setdefault("standard", "IEC/EN 61009-1"); kw.setdefault("refTempC", 30)
    kw["sources"] = kw["sources"] + ["eaton_frbm6"]
    add(**kw)

rcbo(id="se-icv40n", manufacturer="Schneider Electric", series="Acti9 iCV40N RCBO 1P+N", standard="IEC/EN 61009-2-1",
     ratings=[6, 10, 16, 20, 25, 32, 40], curves=std_mag("BC"), breaking="Icn 6 kA",
     rcd=rcd([30, 100, 300], ["A", "A-SI"]), sources=["se_icv40"],
     notes="Ratings 6–40 A, B and C curves, 30/100/300 mA, type A or A-SI. Magnetic ranges not printed: IEC 61009 B 3–5·In, C 5–10·In used.")
rcbo(id="se-idpn-vigi", manufacturer="Schneider Electric", series="Acti9 iDPN N Vigi RCBO 1P+N", standard="IEC/EN 61009-2-1",
     ratings=[6, 10, 16, 20, 25, 32, 40], curves={"C": mag(5, 10)}, breaking="Icn 6 kA",
     rcd=rcd([30], ["AC"]), sources=["se_idpn_vigi"],
     notes="Data sheet: C 5–10·In, 30 mA type AC, instantaneous earth-leakage. Only the 40 A sheet was read; 6–40 A list is the typical range (assumed).")
rcbo(id="abb-ds201", manufacturer="ABB", series="DS201 L H RCBO 1P+N",
     ratings=[6, 10, 16, 20, 25, 32, 40], curves={"C": mag(5, 10)}, breaking="Icn 4.5 kA (IEC 61009-1); Icu 6 kA / Ics 4.5 kA (IEC 60947-2)",
     rcd=rcd([30], ["AC", "A", "APR", "F"]), sources=["abb_ds201"],
     notes="C 5–10·In; 30 mA; AC (6–40 A), A (10, 16 A), F (10, 16, 25 A); IΔm 3 kA; thermal reference 30 °C.")
rcbo(id="siemens-5su1", manufacturer="Siemens", series="SENTRON 5SU1 RCBO",
     ratings=[6, 10, 13, 16, 20, 25, 32], curves=std_mag("BC"), breaking="6 kA / 10 kA",
     rcd=rcd([30, 300], ["A", "A super-resistant"]), sources=["siemens_5su1"],
     notes="2-, 3- and 4-pole; B and C; 30 mA (300 mA on 3P/4P). Magnetic ranges not printed: IEC 61009 values used.")
rcbo(id="eaton-frbm6", manufacturer="Eaton", series="xEffect FRBm6 RCBO",
     ratings=[2, 4, 6, 10, 13, 16, 20, 25, 32, 40], curves=std_mag("BCD"), breaking="Icn 6 kA",
     rcd=rcd([10, 30, 100, 300], ["AC", "A", "Super A", "G/A", "F"], classes=("general", "G")), sources=["eaton_frbm6"],
     notes="1+N 2–40 A (B, C, D), 2P 6–40 A, 3+N 6–32 A. Types G/A and F are 10 ms time-delayed (class G). Rating steps between 2 and 40 A are typical (assumed).")
rcbo(id="legrand-dx3-rcbo", manufacturer="Legrand", series="DX3 RCBO 1P+N 6 kA", standard="IEC 61009-1; IEC 60947-2",
     ratings=[6, 10, 16, 20, 25, 32], curves=std_mag("C"), breaking="Icn 6 kA",
     rcd=rcd([30], ["A"]), sources=["legrand_dx3_rcbo"], notes="C curve 6–32 A (AU range 411128–411134), 30 mA type A.")
add(id="hager-rcbo-10ka", manufacturer="Hager", series="RCBO 1P+N 10 kA (ADB/ADC/ACB/AEC)", category="RCBO", model="mcb",
    standard="BS EN / IEC 61009-1", refTempC=30, thermal=B898, ratings=[6, 10, 16, 20, 25, 32, 40, 45],
    ratingsByCurve={"B": [6, 10, 16, 20, 25, 32, 40, 45], "C": [6, 10, 16, 20, 25, 32, 40]}, curves=std_mag("BC"), breaking="10 kA",
    rcd=rcd([10, 30, 100], ["A", "AC"]), sources=["hager_rcbo_ie", "eaton_frbm6"],
    notes="Commercial/industrial single pole + solid neutral, 10 kA; 10/30/100 mA. Magnetic ranges not printed: IEC 61009 values used.")
rcbo(id="hager-ada-au", manufacturer="Hager", series="ADA1xxT RCBO 6 kA (AS/NZS)", standard="AS/NZS 61009.1",
     ratings=[6, 10, 16, 20, 25, 32, 40, 45], curves={"C": mag(5, 10)}, breaking="6 kA",
     rcd=rcd([30], ["A"]), sources=["hager_ada_au"], notes="C 5–10·In, 6–45 A, 30 mA type A.")
rcbo(id="chint-nb1l", manufacturer="CHINT", series="NB1L RCBO",
     ratings=[1, 2, 3, 4, 6, 8, 10, 13, 16, 20, 25, 32, 40], curves={"B": mag(3, 5), "C": mag(5, 10)}, breaking="Icn 6 kA (10 kA NB1L-40/63)",
     rcd=rcd([30, 100, 300], ["AC", "A"], tmax_idn=0.1), sources=["chint_nb1l"],
     notes="B 3–5·In, C 5–10·In; 30/100/300 mA; break time at IΔn ≤ 0.1 s (catalogue), so the band uses 0.1 s instead of the standard 0.3 s; reference 30 °C. NB1L-63 adds 50/63 A.")
rcbo(id="chint-nxble63", manufacturer="CHINT", series="NXBLE-63 RCBO",
     ratings=[6, 10, 13, 16, 20, 25, 32, 40, 50, 63], curves={"B": mag(3, 5), "C": mag(5, 10)}, breaking="Icn 6 kA",
     rcd=rcd([30, 100, 300], ["AC", "A"], basis="assumed"), sources=["chint_nxble"],
     notes="B 3–5·In, C 5–10·In; 30/100/300 mA. Residual type not stated on the page (AC/A assumed).")
add(id="iec61009-rcbo", manufacturer="Generic (standard)", series="IEC 61009-1 RCBO", category="RCBO", model="mcb",
    standard="IEC 61009-1", refTempC=30, thermal=B898, ratings=[6, 10, 13, 16, 20, 25, 32, 40, 50, 63], curves=std_mag("BCD"),
    breaking="Icn per product", rcd=rcd([10, 30, 100, 300, 500], ["AC", "A", "F", "B"], classes=("general", "S"), basis="standard"),
    sources=["eaton_frbm6", "beama_2026"], notes="Standard envelope for any RCBO. " + STD_RCD_NOTE)
add(id="iec61008-rccb", manufacturer="Generic (standard)", series="IEC 61008-1 RCCB (residual only)", category="RCBO", model="rcd",
    standard="IEC 61008-1", ratings=[16, 25, 40, 63, 80, 100, 125], breaking="no overcurrent protection",
    rcd=rcd([10, 30, 100, 300, 500, 1000], ["AC", "A", "F", "B"], classes=("general", "S", "G"), basis="standard"),
    sources=["eaton_frbm6"], notes="Residual-current circuit breaker without overcurrent release: plotted on the earth-fault chart only. " + STD_RCD_NOTE)

# ---------------- earth-fault (G) functions on electronic trip units
DEV = {d["id"]: d for d in devices}
def G(id_, **g):
    g.setdefault("basis", "datasheet")
    DEV[id_]["G"] = g

G("se-ml52", ig={"steps": [0, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 1.0], "unit": "xIn"}, tol=0.10,
  tg={"steps": [0, 0.1, 0.2, 0.3, 0.4]}, tgBands={"0": [0.02, 0.08], "0.1": [0.08, 0.14], "0.2": [0.14, 0.2], "0.3": [0.23, 0.32], "0.4": [0.35, 0.5]},
  i2t=True, i2tRef=10, i2tRefUnit="xIn", i2tRefBasis="assumed",
  note="MicroLogic 6.2 E only (OFF = 5.2). Ig ±10 % (In > 40 A dial; In = 40 A starts at 0.4); tg non-trip / max break 20/80, 80/140, 140/200, 230/320, 350/500 ms.")
G("abb-xt-ekip-lsi", ig={"steps": [0, 0.2, 0.25, 0.45, 0.55, 0.75, 0.8, 1.0], "unit": "xIn"}, tol=0.10,
  tg={"steps": [0.1, 0.2, 0.4, 0.8]}, tTol=0.15, i2t=False,
  note="Ekip LSIG (OFF = LSI). I4 ±10 %, t4 ±15 %, t = k. G is inhibited at high currents (not modelled).")
for _id in ("abb-xt5-ekipdip-lsi", "abb-xt6-ekipdip-lsi", "abb-xt7-ekipdip-lsi"):
    G(_id, ig={"steps": [0, 0.2, 0.25, 0.45, 0.55, 0.75, 0.8, 1.0], "unit": "xIn"}, tol=0.10, tg={"steps": [0.1, 0.2, 0.4, 0.8]}, tTol=0.15,
      i2t=False, basis="assumed", note="LSIG version (OFF = LSI). Settings taken from the XT2/XT4 Ekip LSIG table (assumed for this frame).")
for _id in ("abb-xt5-ekiptouch", "abb-xt7-ekiptouch"):
    G(_id, ig={"min": 0.1, "max": 1.0, "step": 0.01, "unit": "xIn", "off": True}, tol=0.07, tg={"min": 0.1, "max": 1.0, "step": 0.05}, tTol=0.15,
      i2t=True, i2tRef=2, i2tRefBasis="assumed", basis="datasheet" if _id.endswith("xt7-ekiptouch") else "assumed",
      note="I4 0.1–1·In, t4 0.1–1 s (XT7 Ekip Touch manual; XT5 assumed equal). Curves t = k or t = k/I².")
G("abb-t456-pr222", ig={"steps": [0, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0], "unit": "xIn"}, tol=0.10, tolBasis="assumed",
  tg={"min": 0.1, "max": 0.8, "step": 0.01}, tTol=0.15, i2t=True, i2tFixed=True, i2tRef=2, i2tRefBasis="assumed",
  note="PR222DS/P LSIG (OFF = LSI). I4 0.2–1·In step 0.1, t4 0.1–0.8 s, t = k/I² (reference point assumed at 2·I4).")
G("abb-t7-pr332", ig={"min": 0.2, "max": 1.0, "step": 0.02, "unit": "xIn", "off": True}, tol=0.07,
  tg={"min": 0.1, "max": 1.0, "step": 0.05}, tTol=0.10, i2t=True, i2tRef=2, i2tRefBasis="assumed",
  note="PR332/P LSIG: I4 0.2–1·In ±7 %, t4 0.1–1 s; definite time min(±10 %, ±40 ms) or t = k/I² ±15 %.")
G("legrand-dpx3-630-s2", ig={"min": 0.2, "max": 1.0, "step": 0.1, "unit": "xIn", "off": True}, tol=0.10, tolBasis="assumed",
  tg={"min": 0.1, "max": 1.0, "step": 0.1}, tTol=0.15, i2t=False, source="legrand_dpx3",
  note="DPX3 Sg versions (OFF = S2): Ig 0.2–1·In and OFF, tg 0.1–1 s. Tolerances not printed (assumed ±10 % / ±15 %).")
G("hager-h3-lsni", ig={"steps": [0] + [round(0.2 + 0.05 * i, 2) for i in range(17)], "unit": "xIn"}, tol=0.10, tolBasis="assumed",
  tg={"steps": [0.05, 0.1, 0.2, 0.3, 0.4, 0.5]}, tTol=0.15, i2t=True, i2tRef=2, i2tRefBasis="assumed",
  note="Ig OFF or 20–100 % In in 5 % steps (40–100 % for In = 40 A); tg 50–500 ms with I²t ON/OFF.")
G("chint-nm8n-en", ig={"steps": [0, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0], "unit": "xIn"}, tol=0.15,
  tg={"steps": [0.1, 0.2, 0.3, 0.4]}, tTol=0.20, i2t=False, note="NM8N EM version (OFF = EN): Ig 0.4–1·In ±15 %, tg 0.1–0.4 s ±20 % or ±40 ms.")
G("chint-nxa", ig={"steps": [0, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 1.0], "unit": "xIn", "maxA": 1200}, tol=0.15, tolBasis="assumed",
  tg={"steps": [0.1, 0.2, 0.3, 0.4]}, tTol=0.15, i2t=True, i2tRef=1, i2tRefUnit="xIn", basis="assumed",
  note="Catalogue gives Ig = 0.5·In (NXA16/20) or 800 A (NXA32+), Ig ≤ 1200 A, inverse t = (In or 1200 A / I)²·Tg; the selectable steps are assumed.")
G("chint-na8", ig={"steps": [0, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0], "unit": "xIn", "maxA": 1200}, tol=0.15, tolBasis="assumed",
  tg={"steps": [0.1, 0.2, 0.3, 0.4]}, tTol=0.15, i2t=True, i2tRef=1, i2tRefUnit="xIg", basis="datasheet",
  note="Ig 0.2–1·In (≤ 2500 frame) or 500–1200 A; inverse t = (Ig/I)²·tg. tg steps assumed equal to the short-time steps.")
# Siemens 3VA2 ETU560 (LSIG) — same L/S/I as ETU550, plus G
etu560 = copy.deepcopy(DEV["siemens-3va-etu550"])
etu560.update(id="siemens-3va-etu560", series="SENTRON 3VA2 ETU560 (LSIG)",
              notes=(etu560.get("notes", "") + " ETU560 adds G: Ig 0.2/0.25/0.4/0.6–1.0·In, tg 0.05–0.8 s referenced at 2·Ig, I²t can be deactivated.").strip())
etu560["G"] = {"ig": {"min": 0.2, "max": 1.0, "step": 0.05, "unit": "xIn"}, "tol": 0.10, "tolBasis": "assumed", "tg": {"min": 0.05, "max": 0.8, "step": 0.01},
               "tTol": 0.15, "i2t": True, "i2tRef": 2, "i2tRefBasis": "datasheet", "basis": "datasheet",
               "note": "Ig 0.2–1·In (minimum depends on frame), tg 0.05–0.8 s with reference point 2·Ig; G cannot be switched off."}
devices.append(etu560)
for d in devices:
    if "G" in d and isinstance(d["G"], dict) and "ig" not in d["G"]:
        n = d["G"].get("note")
        if n and n not in d.get("notes", ""): d["notes"] = (d.get("notes", "") + " G: " + n).strip()
        del d["G"]   # note-only G entries are kept in the notes text
