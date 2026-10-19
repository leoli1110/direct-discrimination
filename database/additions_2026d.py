# ---------------------------------------------------------------- 2026.4 additions
# Breaking capacities (Icu/Ics per performance version), residual-current add-on modules and relays,
# and the cable / network reference data used by the fault-analysis module.
# Executed by build_db.py after additions_2026c.py (shares its namespace).

SOURCES.update({
 "se_vigipact": ("Schneider Electric ComPacT NSX user guide (DOCA0187) — VigiPacT add-on earth-leakage protection", "https://productinfo.se.com/compactnsxuserguide/doca0187-compact-nsx-user-guide/English/BM_ComPacT_NSX_DOCA0187_0000547863.xml/$/TPC_Earth_LeakageProtectionByVigiPactAdd_On_354b1ab7_T000227050", "Schneider Electric"),
 "abb_rcsel": ("ABB RC Sel XT2-XT4 residual current release instructions (1SDH000721R0503)", "https://library.e.abb.com/public/de8bc478ec76430c88f1a198dbabbe61/1SDH000721R0503.pdf", "ABB"),
 "siemens_3va_lv10": ("Siemens SENTRON 3VA molded case circuit breakers catalogue LV 10 (2023) — RCD310/510/520/820", "https://assets.new.siemens.com/siemens/assets/api/uuid:77ecee1e-a769-4de2-8f27-0a6d1e23559f/Catalogo-Disjuntores-3VA-LV10-2023-10-EN-.pdf", "Siemens"),
 "eaton_xfi": ("Eaton NZM1-XFI(R) residual-current module instruction leaflet (IL01219028Z)", "https://www.eaton.com/content/dam/eaton/technicaldocumentation/il/circuit-breakers/nzm/eaton-residual-current-module-mount-right-nzm1-il01219028z.pdf", "Eaton"),
 "se_vigirex": ("Schneider Electric Vigirex RH10M/RH21M/RH99M/RH197 earth-leakage relays data", "https://anco.com.pk/wp-content/uploads/2025/05/Schneider_Electric_Vigirex-RH10MPRH21MPRH99MRH197RHU_56173.pdf", "Schneider Electric"),
 "iec60228": ("IEC 60228:2004 Conductors of insulated cables — Table 2 class 2 conductor resistance (preview)", "https://cdn.standards.iteh.ai/samples/12024/921fee9a88c24612b68340a7330c2262/IEC-60228-2004.pdf", "IEC"),
 "iec60364_552_pvc": ("IEC 60364-5-52 Table B.52.4 (PVC, three loaded conductors), reproduced by TI-Soft", "https://www.ti-soft.com/en/support/help/electricaldesign/standards/iec-60364-5-52/current-carrying-capacity/table_b_52_4", "IEC"),
 "nbr5410_ampacity": ("NBR 5410 Tables 36–39 ampacity (IEC 60364-5-52 method basis; PVC and XLPE, Cu and Al, methods A1–F), LOGOS reference", "https://www.logoscalc.com/en/reference/nbr-5410-ampacity-table", "ABNT"),
 "bs7671_k": ("BS 7671 Table 54.3 — k for protective conductors incorporated in a cable (OW Electric summary)", "https://www.owelectric.co.uk/posts/main-earthing-terminals-protective-conductors-cross-sectional-areas-bonding-calculations/", "IET"),
 "eig_isc": ("Schneider Electric Electrical Installation Guide — 3-phase short-circuit current at any point within a LV installation", "https://www.electrical-installation.org/enwiki/3-phase_short-circuit_current_(Isc)_at_any_point_within_a_LV_installation", "Schneider Electric"),
 "iec60909_c": ("IEC 60909-0 voltage factor c table (Wiley sample chapter, Schlabbach: Short-circuit currents)", "https://application.wiley-vch.de/books/sample/3527341366_c01.pdf", "IEC"),
 "iec60909_kt": ("IEC 60909-0 transformer correction factor KT (kVA Tools documentation)", "https://www.kvatools.io/docs/short_circuit_analyzer_doc", "IEC"),
 "iec60364_41": ("IEC 60364-4-41:2005 Table 41.1 maximum disconnection times (preview)", "https://cdn.standards.iteh.ai/samples/10887/b410f7c10853465e9e7f293d9e18fd98/IEC-60364-4-41-2005.pdf", "IEC"),
})

DEV = {d["id"]: d for d in devices}

# ---------------- breaking capacity per performance version
# option: (code, icu, ics, basis, note). icu is kA, or a list of [max In (A), kA] thresholds for frame-dependent values.
def BC(id_, opts, source, note=""):
    d = DEV[id_]
    out = []
    for o in opts:
        code, icu, ics = o[0], o[1], o[2]
        basis = o[3] if len(o) > 3 else "datasheet"
        e = {"code": code, "basis": basis}
        if isinstance(icu, list): e["icuBy"] = icu
        else: e["icu"] = icu
        if ics is not None: e["ics"] = ics   # % of Icu
        if len(o) > 4 and o[4]: e["note"] = o[4]
        out.append(e)
    if source not in SOURCES: source = d["sources"][0]   # fall back to the family's own primary source
    d["bc"] = {"options": out, "source": source, "note": note}
    if source not in d["sources"]: d["sources"].append(source)

A = "assumed"; S = "standard"
# MCBs / RCBOs (Icn to IEC 60898-1 / 61009-1, Icu to IEC 60947-2 where printed)
BC("gen-60898", [("Icn 4.5 kA", 4.5, None, S), ("Icn 6 kA", 6, None, S), ("Icn 10 kA", 10, None, S), ("Icn 15 kA", 15, None, S), ("Icn 25 kA", 25, None, S)], "iec60898_std", "IEC 60898-1 standard values; choose the product's rating.")
BC("se-ic60n", [("Icn 6 kA (IEC 60898-1)", 6, None), ("Icu 10 kA (IEC 60947-2, 6–63 A)", [[4, 50], [63, 10]], None)], "se_ic60")
BC("se-ik60n", [("Icn 6 kA", 6, None)], "se_ik60")
BC("abb-s200", [("S200 Icn 6 kA", 6, None), ("S200M Icn 10 kA", 10, None), ("S200 Icu 10 kA (IEC 60947-2)", 10, None), ("S200M Icu 15 kA (IEC 60947-2)", 15, None)], "abb_s200")
BC("siemens-5sl", [("Icn 6 kA", 6, None), ("Icn 10 kA", 10, None)], "siemens_5sl")
BC("siemens-5sy", [("Icn 10 kA", 10, None, A), ("Icn 15 kA", 15, None), ("Icu 25 kA (IEC 60947-2)", 25, None)], "siemens_5sy", "Catalogue gives 'up to' values; the 10 kA version is assumed.")
BC("eaton-faz", [("Icu 10 / 15 kA (IEC 60947-2)", [[40, 10], [63, 15]], None)], "eaton_faz", "10 kA up to 40 A, 15 kA for 50–63 A.")
BC("legrand-dx3", [("Icu 50 kA", 50, 75)], "legrand_dx3")
BC("hager-n", [("Icn 10 kA", 10, None)], "hager_n")
BC("chint-nxb63", [("Icn 6 kA", 6, None), ("Icn 10 kA", 10, None)], "chint_nxb")
BC("chint-nb1", [("Icn 6 kA (IEC 60898-1)", 6, None), ("Icu 10 kA (IEC 60947-2)", 10, None)], "chint_nb1")
BC("se-icv40n", [("Icn 6 kA", 6, None)], "se_icv40")
BC("se-idpn-vigi", [("Icn 6 kA", 6, None)], "se_idpn_vigi")
BC("abb-ds201", [("Icn 4.5 kA (IEC 61009-1)", 4.5, None), ("Icu 6 kA (IEC 60947-2)", 6, 75)], "abb_ds201")
BC("siemens-5su1", [("6 kA", 6, None), ("10 kA", 10, None)], "siemens_5su1")
BC("eaton-frbm6", [("Icn 6 kA", 6, None)], "eaton_frbm6")
BC("legrand-dx3-rcbo", [("Icn 6 kA", 6, None)], "legrand_dx3_rcbo")
BC("hager-rcbo-10ka", [("Icn 10 kA", 10, None)], "hager_rcbo_ie")
BC("hager-ada-au", [("6 kA", 6, None)], "hager_ada_au")
BC("chint-nb1l", [("Icn 6 kA", 6, None), ("Icn 10 kA (NB1L-40/63)", 10, None)], "chint_nb1l")
BC("chint-nxble63", [("Icn 6 kA", 6, None)], "chint_nxble")
BC("iec61009-rcbo", [("Icn 3 kA", 3, None, S), ("Icn 4.5 kA", 4.5, None, S), ("Icn 6 kA", 6, None, S), ("Icn 10 kA", 10, None, S)], "eaton_frbm6", "IEC 61009-1 standard values; choose the product's rating.")

# MCCBs — Icu at 380/415 V
NSX = [("B 25 kA", 25, 100, "datasheet", "NSX100–250 only"), ("F 36 kA", 36, 100), ("N 50 kA", 50, 100), ("H 70 kA", 70, 100), ("S 100 kA", 100, 100), ("L 150 kA", 150, 100), ("R 200 kA", 200, 100)]
for _id in ("se-nsx-tmd", "se-ml22", "se-ml52"):
    BC(_id, NSX, "se_nsx_cat", "Icu at 380/415 V, Ics = 100 % Icu. VigiPacT add-ons are not compatible with R, HB1, HB2 versions.")
BC("se-nsxm-tmd", [("E 16 kA", 16, 100), ("B 25 kA", 25, 100), ("F 36 kA", 36, 100), ("N 50 kA", 50, 100), ("H 70 kA", 70, 100)], "se_nsx_cat")
XT = "abb_xt_iec_2020"
BC("abb-xt1-tmd", [("B 18 kA", 18, 100), ("C 25 kA", 25, 100), ("N 36 kA", 36, 100), ("S 50 kA", 50, 75), ("H 70 kA", 70, 50)], XT, "Ics at 415 V.")
XT2 = [("N 36 kA", 36, 100), ("S 50 kA", 50, 100), ("H 70 kA", 70, 100), ("L 120 kA", 120, 100), ("V 150 kA", 150, 100)]
BC("abb-xt2-tm", XT2, XT)
BC("abb-xt3-tmd", [("N 36 kA", 36, 100), ("S 50 kA", 50, 100)], XT)
BC("abb-xt4-tma", XT2 + [("X 200 kA", 200, 100)], XT)
BC("abb-xt-ekip-lsi", XT2 + [("X 200 kA (XT4 only)", 200, 100)], XT)
XT5 = [("N 36 kA", 36, 100), ("S 50 kA", 50, 100), ("H 70 kA", 70, 100), ("L 120 kA", 120, 100), ("V 200 kA", 200, 100), ("X 200 kA", 200, 100)]
for _id in ("abb-xt5-tma", "abb-xt5-ekipdip-lsi", "abb-xt5-ekiptouch"): BC(_id, XT5, XT)
for _id in ("abb-xt6-tma", "abb-xt6-ekipdip-lsi"): BC(_id, [("N 36 kA", 36, 100), ("S 50 kA", 50, 100), ("H 70 kA", 70, 100)], XT)
for _id in ("abb-xt7-ekipdip-lsi", "abb-xt7-ekiptouch"): BC(_id, [("S 50 kA", 50, 100), ("H 70 kA", 70, 100), ("L 120 kA", 120, 100)], XT)
BC("abb-xt-ekipdip-lsi", [("N 36 kA", 36, 100), ("S 50 kA", 50, 100), ("H 70 kA", 70, 100), ("L 120 kA (XT2/XT5)", 120, 100), ("V 150 kA (XT2; XT5 200 kA)", 150, 100)], XT,
   "Values common to XT2/XT5/XT6; the lower figure is used where frames differ.")
T = "abb_tmax_t"
BC("abb-t1-tmd", [("B 16 kA", 16, None, A), ("C 25 kA", 25, None, A), ("N 36 kA", 36, None, A)], T, "T1 values not readable in the cited catalogue (assumed typical).")
for _id in ("abb-t2-tmd", "abb-t2-tmg", "abb-t2-pr221"):
    BC(_id, [("N 36 kA", 36, None, A), ("S 50 kA", 50, None, A), ("H 70 kA", 70, None, A), ("L 85 kA", 85, None, A)], T, "T2 values not readable in the cited catalogue (assumed typical).")
for _id in ("abb-t3-tmd", "abb-t3-tmg"):
    BC(_id, [("N 36 kA", 36, None, A), ("S 50 kA", 50, None, A)], T, "T3 values not readable in the cited catalogue (assumed typical).")
T45 = [("N 36 kA", 36, 100), ("S 50 kA", 50, 100), ("H 70 kA", 70, 100), ("L 120 kA", 120, 100), ("V 200 kA", 200, 100)]
for _id in ("abb-t4-tm", "abb-t5-tma", "abb-t5-tmg"): BC(_id, T45, T, "T4 250 A: L and V only; N/S/H listed for T4 320 A.")
BC("abb-t6-tma", [("N 36 kA", 36, 100), ("S 50 kA", 50, 100), ("H 70 kA", 70, 100), ("L 100 kA", 100, 100)], T)
for _id in ("abb-t456-pr221", "abb-t456-pr222"):
    BC(_id, [("N 36 kA", 36, 100), ("S 50 kA", 50, 100), ("H 70 kA", 70, 100), ("L 100 kA (T4/T5 120 kA)", 100, 100), ("V 150 kA (T4/T5 200 kA)", 150, 100)], T, "Lower T6 values used where frames differ.")
for _id in ("abb-t7-pr231", "abb-t7-pr232", "abb-t7-pr332"):
    BC(_id, [("S 50 kA", 50, 100), ("H 70 kA", 70, 100), ("L 120 kA", 120, 100), ("V 150 kA (800–1250 A)", 150, 100), ("X 170 kA (800 A)", 170, 100)], T)
for _id in ("siemens-3va1-tm240", "siemens-3va-etu350", "siemens-3va-etu550", "siemens-3va-etu560"):
    BC(_id, [("M 55 kA (415 V)", 55, None), ("H 85 kA", 85, None, A), ("C 110 kA", 110, None, A), ("L 150 kA", 150, None, A)], "siemens_no_cat", "Only class M is stated in the cited catalogue; H/C/L are assumed typical values.")
BC("eaton-nzm-a", [("NZMB 25 kA", 25, 100, "datasheet", "NZM1/2"), ("NZMC 36 kA", 36, 100), ("NZMN 50 kA", 50, 100), ("NZMH 100 kA (NZM2/3 150 kA)", 100, 50)], "eaton_nzm", "Lower NZM1 value used where frames differ.")
BC("eaton-nzm-ve", [("NZMC 36 kA (NZM2/3)", 36, 100), ("NZMN 50 kA", 50, 74), ("NZMH 85 kA (NZM2/3 150 kA)", 85, 50)], "eaton_nzm", "Lower NZM4 values used where frames differ (NZM4 Ics 37/43 kA).")
BC("legrand-dpx3-160", [("16 kA", 16, 100), ("25 kA", 25, 100), ("36 kA", 36, 100), ("50 kA", 50, 100)], "legrand_dpx3")
BC("legrand-dpx3-250", [("25 kA (DPX3 250)", 25, 100), ("36 kA", 36, 100), ("50 kA", 50, 100), ("70 kA", 70, 100), ("100 kA (DPX3 630)", 100, 100)], "legrand_dpx3")
BC("legrand-dpx3-630-s2", [("36 kA", 36, 100), ("50 kA", 50, 100), ("70 kA", 70, 100), ("100 kA", 100, 100)], "legrand_dpx3")
BC("hager-h3-p160-tm", [("H 25 kA", 25, 100), ("M 50 kA", 50, 100), ("E 70 kA", 70, 71)], "hager_h3")
BC("hager-h3-p250-tm", [("M 50 kA", 50, 100), ("E 70 kA", 70, 71)], "hager_h3")
BC("hager-h3-lsni", [("H 25 kA (P160)", 25, 100), ("M 50 kA", 50, 100), ("E 70 kA", 70, 71)], "hager_h3")
for _id in ("chint-nxm-tm", "chint-nxm-etu"):
    BC(_id, [("E 15 kA", 15, None, A), ("S 36 kA", 36, 56), ("F 50 kA", 50, None, A), ("H 70 kA", 70, None, A)], "chint_nxm",
       "Only NXM-250S (36/20 kA) is readable in the cited catalogue; E/F/H take the catalogue's 15–70 kA range ends (assumed).")
BC("chint-nxm1600-tm", [("S 50 kA", 50, None), ("H 70 kA", 70, None)], "chint_nxm")
for _id in ("chint-nm8n125-tm", "chint-nm8n250-tm", "chint-nm8n400-630-tm", "chint-nm8n800-tm", "chint-nm8n1600-tm", "chint-nm8n-en"):
    BC(_id, [("C 36 kA", 36, None), ("S 50 kA", 50, None, A), ("Q 70 kA", 70, None, A), ("H 100 kA", 100, None, A), ("R 150 kA", 150, None)], "chint_nm8n",
       "Catalogue range C–R 36–150 kA at 400 V; the intermediate letters are assumed.")
BC("chint-nm1-tm", [("S", [[63, 20], [250, 25], [630, 35]], 50), ("H", [[63, 42], [250, 50], [630, 50], [800, 60], [1250, 65]], 50), ("R", [[250, 65], [800, 70]], 50)], "chint_nm1",
   "Frame-dependent (NM1-63/125-250/400-630/800/1250). The 380/400/415 V column mapping of the extracted catalogue text is uncertain.")
BC("chint-na8", [("N", [[2500, 65], [3200, 85], [7500, 100]], None), ("H", [[2500, 85], [3200, 100], [4000, 135], [7500, 150]], None)], "chint_na8", "Frame-dependent Icu at 400/415 V.")
BC("chint-nxa", [("N (as NA8)", [[2500, 65], [3200, 85], [7500, 100]], None, A)], "chint_nxa", "NXA Icu not readable in the cited catalogue; NA8 values assumed. Enter the nameplate value.")

# ---------------- residual-current add-on modules and earth-leakage relays (model 'rcd' with time delay)
def addon(**kw):
    kw.setdefault("category", "RCBO"); kw.setdefault("model", "rcd"); kw.setdefault("standard", "IEC 60947-2 Annex B")
    kw["sources"] = kw["sources"] + ["eaton_frbm6"]
    add(**kw)

DELAY_NOTE = (" Time-delayed setting: non-actuating time = Δt; maximum break time drawn as 2·Δt + 40 ms (assumed — the cited documents give only Δt)."
              " Δt = 0 uses the IEC general-type table.")
addon(id="se-vigipact-nsx", manufacturer="Schneider Electric", series="VigiPacT add-on — ComPacT NSX100–630",
      ratings=[100, 160, 250, 400, 630], breaking="host breaker",
      rcd={"idn": [30, 100, 300, 500, 1000, 3000, 10000, 30000], "types": ["A"], "classes": ["general"], "basis": "datasheet", "timeBasis": "datasheet",
           "delays": [0, 0.06, 0.15, 0.3, 0.5, 0.8, 1.2, 4], "instIdn": 30, "delayHi": "assumed", "typeBasis": "assumed"},
      sources=["se_vigipact"], notes="IΔn 0.03–30 A, Δt 0–4 s; at 30 mA Δt is always 0 (instantaneous). Rating = host frame. Residual type not stated on the page (A assumed)." + DELAY_NOTE)
addon(id="abb-xt-rcsel", manufacturer="ABB", series="RC Sel — residual current release for Tmax XT2–XT4",
      ratings=[160, 250], breaking="host breaker",
      rcd={"idn": [30, 50, 100, 300, 500, 1000, 3000, 5000, 10000], "types": ["A"], "classes": ["general"], "basis": "datasheet", "timeBasis": "assumed",
           "delays": [0, 0.1, 0.2, 0.3, 0.5, 1, 2, 3], "instIdn": 30, "delayHi": "assumed", "typeBasis": "assumed"},
      sources=["abb_rcsel"], notes="IΔn 0.03 A (Δt = 0 only) or 0.05–10 A with Δt 0–3 s; intermediate IΔn and Δt steps assumed." + DELAY_NOTE)
addon(id="siemens-3va-rcd520", manufacturer="Siemens", series="SENTRON 3VA RCD520 (type A) / RCD520B",
      ratings=[160, 250, 400, 630], breaking="host breaker",
      rcd={"idn": [30, 100, 300, 500, 1000, 3000, 5000], "types": ["A", "B"], "classes": ["general"], "basis": "datasheet", "timeBasis": "assumed",
           "delays": [0, 0.1, 0.25, 0.5, 1, 3], "delayHi": "assumed"},
      sources=["siemens_3va_lv10"], notes="Type A 0.03–5 A, Δt 0–3 s (RCD520B type B up to 10 s); intermediate steps and frame list assumed." + DELAY_NOTE)
addon(id="siemens-3va-rcd820", manufacturer="Siemens", series="SENTRON 3VA RCD820 (type A, up to 30 A)",
      ratings=[160, 250, 400, 630], breaking="host breaker",
      rcd={"idn": [30, 100, 300, 500, 1000, 3000, 5000, 10000, 30000], "types": ["A"], "classes": ["general"], "basis": "datasheet", "timeBasis": "assumed",
           "delays": [0, 0.1, 0.25, 0.5, 1, 3, 10], "delayHi": "assumed"},
      sources=["siemens_3va_lv10"], notes="IΔn 0.03–30 A (30 A is type AC), Δt 0–10 s; intermediate steps assumed." + DELAY_NOTE)
addon(id="eaton-nzm1-xfi", manufacturer="Eaton", series="NZM1-XFI(R) residual-current module",
      ratings=[40, 63, 100, 125, 160], breaking="host breaker",
      rcd={"idn": [30, 100, 300, 500, 1000, 3000], "types": ["A"], "classes": ["general"], "basis": "datasheet", "timeBasis": "datasheet",
           "delays": [0.01, 0.06, 0.15, 0.3, 0.45], "instIdn": 30, "instDelay": 0.01, "delayHi": "assumed", "typeBasis": "assumed"},
      sources=["eaton_xfi"], notes="IΔn 0.03/0.1/0.3/0.5/1/3 A; Δt 10/60/150/300/450 ms; IΔn 0.03 A forces Δt = 10 ms. Frame list assumed." + DELAY_NOTE)
addon(id="se-vigirex-rh99", manufacturer="Schneider Electric", series="Vigirex RH99M earth-leakage relay (with toroid and shunt trip)",
      ratings=[63, 250, 630, 1600, 4000], breaking="associated breaker",
      rcd={"idn": [30, 100, 300, 500, 1000, 3000, 5000, 10000, 30000], "types": ["A"], "classes": ["general"], "basis": "datasheet", "timeBasis": "assumed",
           "delays": [0, 0.06, 0.15, 0.25, 0.31, 0.5, 0.8, 1, 4.5], "instIdn": 30, "delayHi": "assumed", "typeBasis": "assumed"},
      sources=["se_vigirex"], notes="0.03–30 A, instantaneous at 0.03 A, 9 delay settings 0–4.5 s (individual steps not printed — assumed). Rating = associated breaker size. Add the breaker's own opening time." + DELAY_NOTE)

# ---------------- network / cable reference data for the fault analysis
CU_R = {0.5: 36.0, 0.75: 24.5, 1: 18.1, 1.5: 12.1, 2.5: 7.41, 4: 4.61, 6: 3.08, 10: 1.83, 16: 1.15, 25: 0.727, 35: 0.524, 50: 0.387, 70: 0.268,
        95: 0.193, 120: 0.153, 150: 0.124, 185: 0.0991, 240: 0.0754, 300: 0.0601, 400: 0.0470, 500: 0.0366, 630: 0.0283, 800: 0.0221, 1000: 0.0176}
AL_R = {10: 3.08, 16: 1.91, 25: 1.20, 35: 0.868, 50: 0.641, 70: 0.443, 95: 0.320, 120: 0.253, 150: 0.206, 185: 0.164, 240: 0.125, 300: 0.100,
        400: 0.0778, 500: 0.0605, 630: 0.0469, 800: 0.0367, 1000: 0.0291}
SIZES = [1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120, 150, 185, 240, 300, 400, 500, 630]
def col(*vals, start=1.5):
    s = SIZES[SIZES.index(start):]
    return {str(k): v for k, v in zip(s, vals) if v is not None}
# IEC 60364-5-52 Table B.52.4 (PVC, 3 loaded) methods A1, B1, B2, C, D1 — 1.5–300 mm²
PVC_CU = {"A1": col(13.5, 18, 24, 31, 42, 56, 73, 89, 108, 136, 164, 188, 216, 245, 286, 328),
          "B1": col(15.5, 21, 28, 36, 50, 68, 89, 110, 134, 171, 207, 239, 262, 296, 346, 394),
          "B2": col(15, 20, 27, 34, 46, 62, 80, 99, 118, 149, 179, 206, 225, 255, 297, 339),
          "C": col(17.5, 24, 32, 41, 57, 76, 96, 119, 144, 184, 223, 259, 299, 341, 403, 464),
          "D1": col(18, 24, 30, 38, 50, 64, 82, 98, 116, 143, 169, 192, 217, 243, 280, 316)}
PVC_AL = {"A1": col(14, 18.5, 24, 32, 43, 57, 70, 84, 107, 129, 149, 170, 194, 227, 261, start=2.5),
          "B1": col(16.5, 22, 28, 39, 53, 70, 86, 104, 133, 161, 186, 204, 230, 269, 306, start=2.5),
          "B2": col(15.5, 21, 27, 36, 48, 62, 77, 92, 116, 139, 160, 176, 199, 232, 265, start=2.5),
          "C": col(18.5, 25, 32, 44, 59, 73, 90, 110, 140, 170, 197, 227, 259, 305, 351, start=2.5),
          "D1": col(18.5, 24, 30, 39, 50, 64, 77, 91, 112, 132, 150, 169, 190, 218, 247, start=2.5)}
# NBR 5410 Tables 36–39 (same IEC method basis): method E for PVC (2.5–630) and all XLPE methods (2.5–630); >300 mm² for PVC A1–C
nb = lambda *v: col(*v, start=2.5)
PVC_CU["E"] = nb(25, 34, 43, 60, 80, 101, 126, 153, 196, 238, 276, 319, 364, 430, 497, 597, 689, 798)
PVC_AL["E"] = col(61, 78, 96, 117, 150, 183, 212, 245, 280, 330, 381, 458, 528, 613, start=16)
for m, ext in {"A1": (390, 447, 514), "B1": (510, 587, 678), "B2": (425, 486, 559), "C": (557, 642, 743)}.items():
    PVC_CU[m].update({"400": ext[0], "500": ext[1], "630": ext[2]})
for m, ext in {"A1": (311, 356, 410), "B1": (397, 456, 527), "B2": (331, 378, 435), "C": (422, 486, 562)}.items():
    PVC_AL[m].update({"400": ext[0], "500": ext[1], "630": ext[2]})
XLPE_CU = {"A1": nb(23, 31, 40, 54, 73, 95, 117, 141, 179, 216, 249, 285, 324, 380, 435, 519, 595, 685),
           "B1": nb(28, 37, 48, 66, 88, 117, 144, 175, 222, 269, 312, 358, 408, 481, 553, 661, 760, 879),
           "B2": nb(26, 35, 44, 60, 80, 105, 128, 154, 194, 233, 268, 307, 348, 407, 465, 552, 631, 725),
           "C": nb(30, 40, 52, 71, 96, 119, 147, 179, 229, 278, 322, 371, 424, 500, 576, 692, 797, 923),
           "D1": nb(29, 37, 46, 61, 79, 101, 122, 144, 178, 211, 240, 271, 304, 351, 396, 464, 525, 596),
           "E": nb(32, 42, 54, 75, 100, 127, 158, 192, 246, 298, 346, 399, 456, 538, 621, 745, 859, 995)}
al = lambda *v: col(*v, start=16)
XLPE_AL = {"A1": al(58, 76, 94, 113, 142, 171, 197, 226, 256, 300, 344, 409, 468, 538),
           "B1": al(71, 93, 116, 140, 179, 217, 251, 289, 330, 389, 447, 536, 617, 714),
           "B2": al(64, 84, 103, 124, 156, 188, 216, 248, 281, 329, 377, 448, 513, 590),
           "C": al(76, 90, 112, 136, 174, 211, 245, 283, 323, 382, 440, 529, 610, 707),
           "D1": al(61, 78, 94, 112, 138, 164, 186, 210, 236, 272, 308, 361, 408, 464),
           "E": al(77, 97, 120, 146, 187, 227, 263, 304, 347, 409, 471, 566, 652, 755)}

network = {
 "resistance20": {"Cu": {str(k): v for k, v in CU_R.items()}, "Al": {str(k): v for k, v in AL_R.items()}, "unit": "Ω/km at 20 °C (IEC 60228 class 2 maximum)", "source": "iec60228"},
 "reactance": {"value": 0.08, "unit": "mΩ/m", "source": "eig_isc", "note": "Typical reactance of LV cables when no manufacturer value is known."},
 "ampacity": {
   "note": "Three loaded conductors, 30 °C air / 20 °C ground. PVC methods A1–D1 up to 300 mm² from IEC 60364-5-52 Table B.52.4; other values from NBR 5410 Tables 36–39, which use the IEC method basis.",
   "methods": {"A1": "A1 — insulated conductors in conduit in a thermally insulated wall", "B1": "B1 — insulated conductors in conduit on a wall",
               "B2": "B2 — multicore cable in conduit on a wall", "C": "C — cable clipped direct to a wall", "D1": "D — cable in ducts in the ground",
               "E": "E — multicore cable in free air / on perforated tray"},
   "PVC": {"Cu": PVC_CU, "Al": PVC_AL}, "XLPE": {"Cu": XLPE_CU, "Al": XLPE_AL},
   "sources": ["iec60364_552_pvc", "nbr5410_ampacity"]},
 "insulation": {"PVC": {"thetaMax": 70, "k": {"Cu": 115, "Al": 76}, "kLarge": {"Cu": 103, "Al": 68}, "thetaFinal": 160},
                "XLPE": {"thetaMax": 90, "k": {"Cu": 143, "Al": 94}, "thetaFinal": 250},
                "source": "bs7671_k", "note": "k for a protective conductor incorporated in a cable (BS 7671 Table 54.3 / IEC 60364-5-54 Table A.54.3); PVC k drops to 103/68 above 300 mm²."},
 "alpha": {"Cu": 0.00393, "Al": 0.00403, "basis": "standard", "note": "Temperature coefficient of resistance used to correct R20 to conductor temperature."},
 "voltageFactor": {"cmax": {"6": 1.05, "10": 1.10}, "cmin": {"6": 0.95, "10": 0.90}, "source": "iec60909_c", "note": "LV 100–1000 V, voltage tolerance +6 % or +10 %."},
 "transformerKT": {"formula": "KT = 0.95·cmax / (1 + 0.6·xT)", "source": "iec60909_kt"},
 "transformers": {"source": "eig_isc", "note": "Typical 400 V distribution transformers (no-load 420 V), MV ≤ 20 kV.",
                  "rows": [[100, 4, 37.9, 59.5, 6, 37.0, 99.1], [160, 4, 16.2, 41.0, 6, 18.6, 63.5], [200, 4, 11.9, 33.2, 6, 14.1, 51.0], [250, 4, 9.2, 26.7, 6, 10.7, 41.0],
                           [315, 4, 6.2, 21.5, 6, 8.0, 32.6], [400, 4, 5.1, 16.9, 6, 6.1, 25.8], [500, 4, 3.8, 13.6, 6, 4.6, 20.7], [630, 4, 2.9, 10.8, 6, 3.5, 16.4],
                           [800, 6, 2.9, 12.9, 6, 2.6, 13.0], [1000, 6, 2.3, 10.3, 6, 1.9, 10.4], [1250, 6, 1.8, 8.3, 6, 1.5, 8.3], [1600, 6, 1.4, 6.5, 6, 1.1, 6.5],
                           [2000, 6, 1.1, 5.2, 6, 0.9, 5.2]],
                  "columns": ["kVA", "oil uk %", "oil R mΩ", "oil X mΩ", "cast-resin uk %", "cast-resin R mΩ", "cast-resin X mΩ"],
                  "approx": "Without load-loss data: R = 0.31·Z, X = 0.95·Z (CENELEC 50480 guideline quoted in the guide)."},
 "upstream": {"Ra/Xa": 0.1, "defaultMVA": 500, "source": "eig_isc"},
 "disconnection": {"TN": {"120": 0.8, "230": 0.4, "400": 0.2, "inf": 0.1}, "TT": {"120": 0.3, "230": 0.2, "400": 0.07, "inf": 0.04},
                   "distribution": {"TN": 5, "TT": 1}, "source": "iec60364_41",
                   "note": "Table 41.1 applies to final circuits up to 63 A with sockets and 32 A fixed loads; 5 s (TN) / 1 s (TT) for distribution and other circuits."},
}
