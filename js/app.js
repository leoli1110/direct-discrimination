import * as E from './engine.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtT = (t) => (!Number.isFinite(t) ? '—' : t >= 100 ? `${t.toFixed(0)} s` : t >= 1 ? `${t.toFixed(2)} s` : t >= 0.1 ? `${t.toFixed(3)} s` : `${(t * 1000).toFixed(0)} ms`);
const fmtI = (I) => (I >= 1e4 ? `${(I / 1000).toFixed(1)} kA` : I >= 1000 ? `${(I / 1000).toFixed(2)} kA` : I >= 10 ? `${I.toFixed(0)} A` : `${I.toFixed(2)} A`);
const PALETTE = { light: ['#1d5f8a', '#b4441c', '#2c7a4b', '#7b4a9e', '#9a7412', '#0e7783', '#8c2b4b', '#4a5560'], dark: ['#6cb2e0', '#f08a5d', '#6fcf8f', '#b993dd', '#e3bd57', '#4fc4cf', '#e47b9b', '#a5b0ba'] };

let DB = null;
const S = { items: [], baseKV: 0.4, faultKA: 10, xRange: 'auto', bands: true, uid: 1, cat: 'ALL', brand: '', q: '', collapsed: new Set() };
const CUSTOM = new Map(); // user-defined curves: id -> device definition (model 'custom')
const dev = (id) => CUSTOM.get(id) || DB.devices.find((d) => d.id === id);
const CC_TYPES = { FUSE: 'Fuse', MCB: 'MCB', MCCB: 'MCCB', ACB: 'ACB', RELAY: 'Relay', DAMAGE: 'Damage / withstand', OTHER: 'Other' };
const LS_KEY = 'tcc-studio.mycurves.v1';
function loadMyCurves() {
  try { const arr = JSON.parse(localStorage.getItem(LS_KEY) || '[]'); for (const d of arr) if (d && d.id && Array.isArray(d.points)) CUSTOM.set(d.id, { ...d, saved: true }); } catch { /* storage unavailable */ }
}
function storeMyCurves() {
  try { localStorage.setItem(LS_KEY, JSON.stringify([...CUSTOM.values()].filter((d) => d.saved))); } catch { /* storage unavailable */ }
}

// ------------------------------------------------------------ boot
async function boot() {
  const theme = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  document.documentElement.dataset.theme = theme;
  DB = await (await fetch('db/curvedb.json')).json();
  loadMyCurves();
  initLibrary(); initToolbar(); initTabs(); initCustomCurves(); renderDatabase(); renderMethod();
  if (!loadFromHash()) demoStudy();
  renderStudy(); draw();
  new ResizeObserver(() => draw()).observe($('#chart-wrap'));
}

function demoStudy() {
  add('cdg11-3s', { kV: 11, ctPri: 100, ctSec: 1, plugRange: '50-200%', plug: 100, tms: 0.2, label: 'HV CDG11 (11 kV)' }, false);
  add('se-ml52', { In: 250, io: 250, Ir: 250, tr: 8, isd: 8, tsd: 0.2, i2t: false, label: 'Main LV ML5.2 250 A' }, false);
  add('hager-h3-p160-tm', { In: 100, irX: 1, Ii: 800, label: 'Sub-board h3+ 100 A' }, false);
  add('se-ic60n', { curve: 'C', In: 32, label: 'Final circuit iC60N C32' }, false);
  autoChain();
}

function add(id, overrides = {}, rerender = true) {
  const d = dev(id); if (!d) return;
  const st = { ...E.defaultSettings(d), ...overrides, uid: S.uid++, downOf: null };
  if (!overrides.label) st.label = shortName(d, st);
  st.color = nextColor();
  E.normalize(d, st);
  S.items.push(st);
  if (rerender) { renderStudy(); draw(); }
}
function nextColor() {
  const pal = PALETTE.light; const used = S.items.map((i) => i.color);
  return pal.find((c) => !used.includes(c)) || pal[S.items.length % pal.length];
}
function shortName(d, st) {
  const m = d.manufacturer.startsWith('Generic') ? '' : d.manufacturer.split(' ')[0] + ' ';
  const series = d.series.split(' — ')[0].split(' (')[0];
  if (d.model === 'mcb') return `${m}${series} ${st.curve}${st.In}`;
  if (d.model === 'idmt') return `${series.split(' / ')[0]}`;
  if (d.model === 'custom') return d.series;
  return `${m}${series} ${st.In} A`;
}
const colorFor = (it) => { const t = document.documentElement.dataset.theme; const i = PALETTE.light.indexOf(it.color); return t === 'dark' && i >= 0 ? PALETTE.dark[i] : it.color; };
const kScale = (it) => it.kV / S.baseKV;

// ------------------------------------------------------------ library
function initLibrary() {
  const brands = [...new Set(DB.devices.map((d) => d.manufacturer))].sort((a, b) => (a.startsWith('Generic') ? 1 : 0) - (b.startsWith('Generic') ? 1 : 0) || a.localeCompare(b));
  $('#lib-brand').insertAdjacentHTML('beforeend', brands.map((b) => `<option>${esc(b)}</option>`).join(''));
  $('#lib-search').addEventListener('input', (e) => { S.q = e.target.value.toLowerCase(); renderLibrary(); });
  $('#lib-brand').addEventListener('change', (e) => { S.brand = e.target.value; renderLibrary(); });
  $$('.chip').forEach((c) => c.addEventListener('click', () => { S.cat = c.dataset.cat; $$('.chip').forEach((x) => x.setAttribute('aria-pressed', x === c)); renderLibrary(); }));
  $('#lib-list').addEventListener('click', (e) => {
    const ed = e.target.closest('[data-edit]'); if (ed) { e.stopPropagation(); openEditor(CUSTOM.get(ed.dataset.edit)); return; }
    const rm = e.target.closest('[data-forget]'); if (rm) { e.stopPropagation(); forgetCurve(rm.dataset.forget); return; }
    const b = e.target.closest('[data-add]'); if (b) add(b.dataset.add);
  });
  renderLibrary();
}
function devMeta(d) {
  if (d.model === 'mcb') return `${Object.keys(d.curves).join(' · ')} curves · ${d.ratings[0]}–${d.ratings[d.ratings.length - 1]} A`;
  if (d.model === 'tm') return `Thermal-magnetic · ${d.ratings[0]}–${d.ratings[d.ratings.length - 1]} A`;
  if (d.model === 'etu') return `Electronic ${d.S ? 'LSI' : 'LI'} · ${d.ratings[0]}–${d.ratings[d.ratings.length - 1]} A`;
  if (d.model === 'custom') { const p = E.sortPts(d.points); return `${CC_TYPES[d.category] || 'Custom'} · ${p.length} points${d.mode === 'band' ? ' · band' : ''}${p.length ? ` · ${fmtI(p[0].I * (d.unit === 'x' ? d.base : 1))}–${fmtI(p[p.length - 1].I * (d.unit === 'x' ? d.base : 1))}` : ''}`; }
  return `IDMT · ${Object.keys(d.curves).map((k) => k.split(' ')[0]).join(' · ')}`;
}
function renderLibrary() {
  const mine = [...CUSTOM.values()].filter((d) => d.saved || S.items.some((i) => i.deviceId === d.id));
  const list = DB.devices.filter((d) => (S.cat === 'ALL' || d.category === S.cat) && (!S.brand || d.manufacturer === S.brand) &&
    (!S.q || `${d.manufacturer} ${d.series} ${d.standard} ${Object.keys(d.curves || {}).join(' ')} ${d.category}`.toLowerCase().includes(S.q)));
  const myList = mine.filter((d) => (S.cat === 'ALL' || S.cat === 'CUSTOM') && !S.brand && (!S.q || `${d.series} ${CC_TYPES[d.category] || ''} custom`.toLowerCase().includes(S.q)));
  $('#lib-count').textContent = `${list.length + myList.length} / ${DB.devices.length + mine.length}`;
  const groups = {};
  for (const d of list) (groups[d.category] ||= []).push(d);
  const names = { MCB: 'Miniature circuit breakers', MCCB: 'Moulded-case circuit breakers', ACB: 'Air circuit breakers', RELAY: 'Overcurrent relays (IDMT)' };
  const myHtml = myList.length ? `<div class="lib-group"><h3>My curves</h3>${myList.map((d) => `<div class="lib-item" data-add="${d.id}" role="button" tabindex="0" title="Add to study">
      <span class="li-name">${esc(d.series)}</span><span class="li-add" aria-hidden="true">+</span>
      <span class="li-meta">${esc(devMeta(d))}${d.saved ? '' : ' · this study only'}</span>
      <span class="li-edit"><span data-edit="${d.id}" role="button" tabindex="0">Edit</span>${d.saved ? `<span data-forget="${d.id}" role="button" tabindex="0">Remove</span>` : ''}</span></div>`).join('')}</div>`
    : S.cat === 'CUSTOM' ? `<p class="study-empty">No custom curves yet. Use “+ Custom curve” to enter current–time points, paste a list or load a .txt / .csv file.</p>` : '';
  $('#lib-list').innerHTML = (list.length || myHtml) ? myHtml + ['MCB', 'MCCB', 'ACB', 'RELAY'].filter((g) => groups[g]).map((g) => `
    <div class="lib-group"><h3>${names[g]}</h3>
    ${groups[g].map((d) => `<button class="lib-item" data-add="${d.id}" title="Add to study">
      <span class="li-name">${esc(d.manufacturer.startsWith('Generic') ? d.series : `${d.manufacturer.replace(' Electric', '')} · ${d.series}`)}</span>
      <span class="li-add" aria-hidden="true">+</span>
      <span class="li-meta">${esc(devMeta(d))}</span></button>`).join('')}</div>`).join('')
    : `<p class="study-empty">No devices match these filters.</p>`;
}

// ------------------------------------------------------------ toolbar & tabs
function initToolbar() {
  $('#base-kv').addEventListener('change', (e) => { S.baseKV = Math.max(0.01, +e.target.value || 0.4); refresh(); });
  $('#fault-ka').addEventListener('change', (e) => { S.faultKA = Math.max(0, +e.target.value || 0); refresh(); });
  $('#x-range').addEventListener('change', (e) => { S.xRange = e.target.value; draw(); });
  $('#show-bands').addEventListener('change', (e) => { S.bands = e.target.checked; draw(); });
  $('#btn-clear').addEventListener('click', () => { S.items = []; refresh(); });
  $('#btn-autochain').addEventListener('click', () => { autoChain(); refresh(); });
  $('#btn-theme').addEventListener('click', () => { const r = document.documentElement; r.dataset.theme = r.dataset.theme === 'dark' ? 'light' : 'dark'; draw(); renderStudy(); });
  $('#btn-save').addEventListener('click', () => download('tcc-study.json', JSON.stringify(serialize(), null, 1), 'application/json'));
  $('#file-load').addEventListener('change', async (e) => { const f = e.target.files[0]; if (!f) return; try { applyStudy(JSON.parse(await f.text())); } catch (err) { alert('Could not read study file: ' + err.message); } e.target.value = ''; });
  const pop = $('#export-pop'), eb = $('#btn-export');
  eb.addEventListener('click', (e) => { e.stopPropagation(); pop.hidden = !pop.hidden; eb.setAttribute('aria-expanded', !pop.hidden); });
  document.addEventListener('click', () => { pop.hidden = true; eb.setAttribute('aria-expanded', 'false'); });
  pop.addEventListener('click', (e) => { const b = e.target.closest('[data-export]'); if (b) doExport(b.dataset.export); });
}
function initTabs() {
  $$('.tab').forEach((t) => t.addEventListener('click', () => {
    $$('.tab').forEach((x) => x.setAttribute('aria-selected', x === t));
    $$('.view').forEach((v) => { v.hidden = v.id !== `view-${t.dataset.view}`; });
    if (t.dataset.view === 'study') draw();
  }));
}
function refresh() { renderStudy(); draw(); }

// ------------------------------------------------------------ study cards
function controlHtml(it, d, c) {
  const id = `c${it.uid}-${c.key}`, val = it[c.key];
  const fmt = c.fmt || ((v) => `${v}${c.unit ? ' ' + c.unit : ''}`);
  const wide = ['Ii', 'Ir', 'fine', 'curve', 'plug', 'tms', 'isd'].includes(c.key) && c.kind === 'range' ? ' wide' : (c.kind === 'select' && String(fmt(c.values?.[0])).length > 18 ? ' wide' : '');
  if (c.kind === 'select') return `<label class="ctl${wide}" for="${id}">${esc(c.label)}<select id="${id}" data-k="${c.key}">${c.values.map((v) => `<option value="${esc(v)}"${String(v) === String(val) || Math.abs(+v - +val) < 1e-9 ? ' selected' : ''}>${esc(fmt(v))}</option>`).join('')}</select></label>`;
  if (c.kind === 'range') return `<label class="ctl wide" for="${id}">${esc(c.label)} <span class="rv">${esc(fmt(+val))}</span><input type="range" id="${id}" data-k="${c.key}" min="${c.min}" max="${c.max}" step="${c.step}" value="${val}"></label>`;
  if (c.kind === 'fixed') return `<div class="ctl">${esc(c.label)}<span class="fixed">${esc(fmt(c.value))} · fixed</span></div>`;
  if (c.kind === 'toggle') return `<label class="toggle"><input type="checkbox" data-k="${c.key}"${val ? ' checked' : ''}> ${esc(c.label)}</label>`;
  return `<label class="ctl" for="${id}">${esc(c.label)}${c.unit ? ` (${c.unit})` : ''}<input type="number" id="${id}" data-k="${c.key}" value="${val}" ${c.min !== undefined ? `min="${c.min}"` : ''} ${c.max !== undefined ? `max="${c.max}"` : ''} step="${c.step || 'any'}"></label>`;
}
function renderStudy() {
  const host = $('#study-list');
  if (!S.items.length) { host.innerHTML = `<p class="study-empty">No devices yet. Pick a breaker or relay from the library — each one is plotted with its tolerance band and linked to its datasheet.</p>`; renderSelectivity(); return; }
  host.innerHTML = S.items.map((it) => {
    const d = dev(it.id ?? it.deviceId), ev = E.evaluate(d, it);
    const ctls = E.controlsFor(d, it).map((c) => controlHtml(it, d, c)).join('');
    const others = S.items.filter((o) => o.uid !== it.uid);
    const src = d.sources.map((s) => `<a href="${DB.sources[s].url}" target="_blank" rel="noopener">${esc(DB.sources[s].publisher)}${d.sources.length > 1 ? ' · ' + esc(DB.sources[s].title.slice(0, 28)) + '…' : ''}</a>`).join('');
    const collapsed = S.collapsed.has(it.uid);
    return `<div class="card" data-uid="${it.uid}" data-hidden="${!it.visible}">
      <div class="card-head">
        <label class="card-color" style="background:${colorFor(it)}" title="Curve colour"><input type="color" data-k="color" value="${it.color}" aria-label="Curve colour"></label>
        <div class="card-title"><input type="text" data-k="label" value="${esc(it.label)}" aria-label="Label"><div class="card-sub" title="${esc(d.manufacturer + ' ' + d.series)}">${d.model === 'custom' ? `Custom ${esc((CC_TYPES[d.category] || '').toLowerCase())} · ${esc(d.series)}` : `${esc(d.manufacturer)} · ${esc(d.series)}`}</div></div>
        <div class="card-tools">
          <button data-act="vis" title="${it.visible ? 'Hide' : 'Show'} curve" aria-label="Toggle visibility">${it.visible ? eyeIcon : eyeOffIcon}</button>
          <button data-act="dup" title="Duplicate" aria-label="Duplicate">${dupIcon}</button>
          <button data-act="fold" title="${collapsed ? 'Expand' : 'Collapse'}" aria-label="Collapse">${collapsed ? chevDown : chevUp}</button>
          <button data-act="del" title="Remove" aria-label="Remove">${xIcon}</button>
        </div>
      </div>
      <div class="card-body${collapsed ? ' collapsed' : ''}">
        ${ctls}
        <label class="ctl wide">Downstream of<select data-k="downOf"><option value="">— none (top of chain) —</option>${others.map((o) => `<option value="${o.uid}"${o.uid === it.downOf ? ' selected' : ''}>${esc(o.label)}</option>`).join('')}</select></label>
        <div class="card-foot"><span class="mono">${esc(ev.settingsText)}</span></div>
        <div class="card-foot">${d.model === 'custom' ? `<span class="tag user">user-defined</span> <button class="btn small" data-act="edit">Edit points</button>` : `${basisTags(d)} ${src}`}</div>
      </div></div>`;
  }).join('');
  bindCards();
  renderSelectivity();
  saveHash();
}
function basisTags(d) {
  const b = new Set();
  const walk = (o) => { if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) { if (/basis$/i.test(k) && typeof v === 'string') b.add(v); else walk(v); } };
  walk(d); if (d.tolBasis) b.add(d.tolBasis);
  return [...b].filter((x) => x !== 'user').map((x) => `<span class="tag ${x}">${x}</span>`).join('');
}
function bindCards() {
  $$('#study-list .card').forEach((card) => {
    const it = S.items.find((i) => i.uid === +card.dataset.uid), d = dev(it.deviceId);
    card.querySelectorAll('[data-k]').forEach((el) => {
      const k = el.dataset.k;
      const evt = el.type === 'range' || el.type === 'color' || el.type === 'text' ? 'input' : 'change';
      el.addEventListener(evt, () => {
        let v = el.type === 'checkbox' ? el.checked : el.value;
        if (k === 'downOf') v = v ? +v : null;
        else if (!['label', 'color', 'curve', 'plugRange'].includes(k) && el.type !== 'checkbox') v = +v;
        if (el.type === 'number' && !(v > 0) && k !== 'downOf') return;
        it[k] = v;
        if (k === 'io') it.Ir = v;
        E.normalize(d, it);
        if (k === 'label' || k === 'color') { if (k === 'color') card.querySelector('.card-color').style.background = colorFor(it); draw(); renderSelectivity(); saveHash(); return; }
        if (el.type === 'range') { // live update without rebuilding (keeps drag)
          const c = E.controlsFor(d, it).find((x) => x.key === k); const rv = el.parentElement.querySelector('.rv');
          if (rv && c) rv.textContent = (c.fmt || ((x) => x))(+it[k]);
          card.querySelector('.card-foot .mono').textContent = E.evaluate(d, it).settingsText;
          draw(); renderSelectivity(); clearTimeout(bindCards.t); bindCards.t = setTimeout(saveHash, 300); return;
        }
        refresh();
      });
    });
    card.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', () => {
      const a = b.dataset.act;
      if (a === 'del') { S.items = S.items.filter((x) => x !== it); S.items.forEach((x) => { if (x.downOf === it.uid) x.downOf = it.downOf; }); }
      if (a === 'vis') it.visible = !it.visible;
      if (a === 'dup') { const c = { ...it, uid: S.uid++, label: it.label + ' (copy)', color: nextColor(), downOf: null }; S.items.splice(S.items.indexOf(it) + 1, 0, c); }
      if (a === 'fold') S.collapsed.has(it.uid) ? S.collapsed.delete(it.uid) : S.collapsed.add(it.uid);
      if (a === 'edit') { openEditor(d); return; }
      refresh();
    }));
  });
}
const svgI = (p) => `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
const eyeIcon = svgI('<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>');
const eyeOffIcon = svgI('<path d="M3 3l18 18"/><path d="M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3 3.9M6.6 6.6C3.7 8.4 2 12 2 12s3.5 7 10 7a9.6 9.6 0 0 0 5.4-1.6"/>');
const dupIcon = svgI('<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h8"/>');
const xIcon = svgI('<path d="M6 6l12 12M18 6L6 18"/>');
const chevUp = svgI('<path d="M6 15l6-6 6 6"/>');
const chevDown = svgI('<path d="M6 9l6 6 6-6"/>');

// ------------------------------------------------------------ chart
const Y0 = 0.001, Y1 = 10000;
let lastScale = null;
function xDomain() {
  if (S.xRange !== 'auto') { const [a, b] = S.xRange.split(',').map(Number); return [10 ** a, 10 ** b]; }
  const vis = S.items.filter((i) => i.visible);
  if (!vis.length) return [1, 1e5];
  let lo = Infinity;
  for (const it of vis) { const ev = E.evaluate(dev(it.deviceId), it); lo = Math.min(lo, ev.pickup * kScale(it)); }
  const a = Math.floor(Math.log10(lo * 0.8));
  const hiNeed = Math.max(S.faultKA * 1000 * 1.5, lo * 1000);
  const b = Math.max(a + 3, Math.ceil(Math.log10(hiNeed)));
  return [10 ** a, 10 ** Math.min(b, a + 6)];
}
function cssVar(n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim(); }

function draw() {
  const svg = $('#chart'), wrap = $('#chart-wrap');
  const W = wrap.clientWidth, H = wrap.clientHeight; if (!W || !H) return;
  const narrow = W < 520;
  const m = { l: narrow ? 46 : 62, r: narrow ? 10 : 18, t: 14, b: narrow ? 40 : 46 };
  const [X0, X1] = xDomain();
  const pw = W - m.l - m.r, ph = H - m.t - m.b;
  const sx = (I) => m.l + ((Math.log10(I) - Math.log10(X0)) / (Math.log10(X1) - Math.log10(X0))) * pw;
  const sy = (t) => m.t + (1 - (Math.log10(t) - Math.log10(Y0)) / (Math.log10(Y1) - Math.log10(Y0))) * ph;
  lastScale = { sx, sy, X0, X1, m, pw, ph, W, H };
  const C = { paper: cssVar('--paper'), major: cssVar('--grid-major'), minor: cssVar('--grid-minor'), axis: cssVar('--axis'), text: cssVar('--muted'), fault: cssVar('--fault'), font: 'Geist Mono, ui-monospace, monospace' };
  let g = `<rect x="0" y="0" width="${W}" height="${H}" fill="${C.paper}"/>`;
  // grid
  const d0 = Math.floor(Math.log10(X0)), d1 = Math.ceil(Math.log10(X1));
  for (let d = d0; d <= d1; d++) for (let k = 1; k < 10; k++) { const I = k * 10 ** d; if (I < X0 || I > X1) continue; const x = sx(I).toFixed(1); g += `<line x1="${x}" x2="${x}" y1="${m.t}" y2="${m.t + ph}" stroke="${k === 1 ? C.major : C.minor}" stroke-width="${k === 1 ? 1 : 0.7}"/>`; }
  for (let d = -3; d <= 4; d++) for (let k = 1; k < 10; k++) { const t = k * 10 ** d; if (t < Y0 || t > Y1) continue; const y = sy(t).toFixed(1); g += `<line x1="${m.l}" x2="${m.l + pw}" y1="${y}" y2="${y}" stroke="${k === 1 ? C.major : C.minor}" stroke-width="${k === 1 ? 1 : 0.7}"/>`; }
  // axis labels
  const fs = narrow ? 9 : 10.5;
  for (let d = d0; d <= d1; d++) { const I = 10 ** d; if (I < X0 * 0.999 || I > X1 * 1.001) continue; const lab = I >= 1e6 ? `${I / 1e6}M` : I >= 1000 ? `${I / 1000}k` : `${I}`; g += `<text x="${sx(I)}" y="${m.t + ph + 15}" fill="${C.text}" font-size="${fs}" font-family="${C.font}" text-anchor="middle">${lab}</text>`; }
  for (let d = -3; d <= 4; d++) { const t = 10 ** d; const lab = t >= 1 ? `${t}` : `${t}`; g += `<text x="${m.l - 6}" y="${sy(t) + 3.5}" fill="${C.text}" font-size="${fs}" font-family="${C.font}" text-anchor="end">${lab}</text>`; }
  g += `<text x="${m.l + pw / 2}" y="${H - 8}" fill="${C.text}" font-size="${fs + 0.5}" font-family="Geist, sans-serif" text-anchor="middle">Current (A) at ${S.baseKV} kV base</text>`;
  g += `<text transform="translate(${narrow ? 11 : 14},${m.t + ph / 2}) rotate(-90)" fill="${C.text}" font-size="${fs + 0.5}" font-family="Geist, sans-serif" text-anchor="middle">Time (s)</text>`;
  g += `<rect x="${m.l}" y="${m.t}" width="${pw}" height="${ph}" fill="none" stroke="${C.axis}" stroke-width="1"/>`;
  g += `<defs><clipPath id="plotclip"><rect x="${m.l}" y="${m.t}" width="${pw}" height="${ph}"/></clipPath></defs><g clip-path="url(#plotclip)">`;
  // fault marker
  const If = S.faultKA * 1000;
  if (If > X0 && If < X1) { const x = sx(If); g += `<line x1="${x}" x2="${x}" y1="${m.t}" y2="${m.t + ph}" stroke="${C.fault}" stroke-width="1.2" stroke-dasharray="5 4"/><text x="${x - 4}" y="${m.t + 12}" fill="${C.fault}" font-size="${fs}" font-family="${C.font}" text-anchor="end">If ${fmtI(If)}</text>`; }
  // curves
  const clampT = (t) => Math.min(Y1 * 1.5, Math.max(Y0 / 1.5, t));
  const labels = [];
  for (const it of S.items) {
    if (!it.visible) continue;
    const d = dev(it.deviceId), ev = E.evaluate(d, it), k = kScale(it), col = colorFor(it);
    const pts = E.sample(ev, k, X0, X1, Math.round(Math.max(260, pw)));
    const path = (key) => { let s = '', on = false; for (const p of pts) { const t = p[key]; if (!Number.isFinite(t)) { on = false; continue; } s += `${on ? 'L' : 'M'}${sx(p.I).toFixed(1)},${sy(clampT(t)).toFixed(1)}`; on = true; } return s; };
    const same = pts.every((p) => p.lo === p.hi || (!Number.isFinite(p.lo) && !Number.isFinite(p.hi)) || Math.abs(p.lo - p.hi) / p.hi < 1e-9);
    if (S.bands && !same) {
      const fp = pts.filter((p) => Number.isFinite(p.lo));
      if (fp.length > 1) {
        const top = fp.map((p) => `${sx(p.I).toFixed(1)},${sy(clampT(Number.isFinite(p.hi) ? p.hi : Y1 * 1.5)).toFixed(1)}`);
        const bot = fp.slice().reverse().map((p) => `${sx(p.I).toFixed(1)},${sy(clampT(p.lo)).toFixed(1)}`);
        g += `<polygon points="${top.join(' ')} ${bot.join(' ')}" fill="${col}" fill-opacity="0.13" stroke="none"/>`;
      }
      g += `<path d="${path('lo')}" fill="none" stroke="${col}" stroke-width="1.1" stroke-opacity="0.85"/>`;
      g += `<path d="${path('hi')}" fill="none" stroke="${col}" stroke-width="1.9"/>`;
    } else {
      g += `<path d="${path(ev.nom ? 'nom' : 'hi')}" fill="none" stroke="${col}" stroke-width="2"/>`;
    }
    if (ev.nom && S.bands && !same) g += `<path d="${path('nom')}" fill="none" stroke="${col}" stroke-width="1" stroke-dasharray="4 3"/>`;
    // label anchor: point near t = 100 s on the upper curve
    const anchor = pts.find((p) => Number.isFinite(p.hi) && p.hi <= 300) || pts.find((p) => Number.isFinite(p.hi));
    if (anchor) labels.push({ x: sx(anchor.I) + 5, y: sy(clampT(anchor.hi)), text: it.label, col });
  }
  // de-overlap labels
  labels.sort((a, b) => a.y - b.y);
  for (let i = 1; i < labels.length; i++) if (labels[i].y - labels[i - 1].y < 13 && Math.abs(labels[i].x - labels[i - 1].x) < 160) labels[i].y = labels[i - 1].y + 13;
  if (!narrow) for (const L of labels) { const t = narrow && L.text.length > 18 ? L.text.slice(0, 17) + '…' : L.text; g += `<text x="${Math.min(L.x, m.l + pw - 4)}" y="${L.y}" fill="${L.col}" font-size="${fs}" font-family="Geist, sans-serif" font-weight="600" text-anchor="${L.x > m.l + pw - 120 ? 'end' : 'start'}" paint-order="stroke" stroke="${C.paper}" stroke-width="3">${esc(t)}</text>`; }
  g += previewSvg(sx, sy, m, pw, ph);
  g += `</g><g id="cursor"></g>`;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.innerHTML = g;
  $('#empty-chart').hidden = S.items.some((i) => i.visible);
  showLegend();
  bindCursor();
}
function bindCursor() {
  const svg = $('#chart');
  if (svg._bound) return; svg._bound = true;
  const move = (e) => {
    if (!lastScale) return;
    const r = svg.getBoundingClientRect(); const { m, pw, ph, X0, X1, sx, sy, W } = lastScale;
    const x = ((e.clientX - r.left) / r.width) * W, y = ((e.clientY - r.top) / r.height) * lastScale.H;
    if (x < m.l || x > m.l + pw || y < m.t || y > m.t + ph) return;
    const I = 10 ** (Math.log10(X0) + ((x - m.l) / pw) * (Math.log10(X1) - Math.log10(X0)));
    let g = `<line x1="${x}" x2="${x}" y1="${m.t}" y2="${m.t + ph}" stroke="${cssVar('--axis')}" stroke-width="0.8" stroke-opacity="0.6"/>`;
    const parts = [`<span class="ro-i">${fmtI(I)}</span>`];
    for (const it of S.items) {
      if (!it.visible) continue;
      const d = dev(it.deviceId), ev = E.evaluate(d, it), k = kScale(it);
      const lo = ev.lo(I / k), hi = ev.hi(I / k), col = colorFor(it);
      for (const t of [lo, hi]) if (Number.isFinite(t) && t > Y0 && t < Y1) g += `<circle cx="${x}" cy="${sy(t)}" r="3" fill="${col}"/>`;
      const txt = !Number.isFinite(hi) && !Number.isFinite(lo) ? 'no trip' : lo === hi ? fmtT(hi) : `${fmtT(lo)} – ${Number.isFinite(hi) ? fmtT(hi) : 'no trip'}`;
      parts.push(`<span class="ro-item"><span class="swatch" style="background:${col}"></span>${esc(it.label)}: ${txt}</span>`);
    }
    $('#cursor').innerHTML = g;
    $('#readout').innerHTML = parts.join('');
  };
  svg.addEventListener('pointermove', move);
  svg.addEventListener('pointerdown', move);
  svg.addEventListener('pointerleave', () => { const c = $('#cursor'); if (c) c.innerHTML = ''; showLegend(); });
}

function showLegend() {
  const vis = S.items.filter((i) => i.visible);
  $('#readout').innerHTML = vis.length ? vis.map((it) => `<span class="ro-item"><span class="swatch" style="background:${colorFor(it)}"></span>${esc(it.label)}</span>`).join('') + `<span class="ro-hint">· hover or tap the chart for operating times</span>`
    : `<span class="ro-hint">Hover the chart to read operating times at any current.</span>`;
}

// ------------------------------------------------------------ coordination
function autoChain() {
  const evs = S.items.map((it) => ({ it, pu: E.evaluate(dev(it.deviceId), it).pickup * kScale(it) })).sort((a, b) => b.pu - a.pu);
  evs.forEach((e, i) => { e.it.downOf = i === 0 ? null : evs[i - 1].it.uid; });
}
const isEM = (d) => d.model === 'idmt' && d.id.startsWith('cdg');
function renderSelectivity() {
  const tbl = $('#sel-table');
  const pairs = S.items.filter((i) => i.downOf && S.items.some((u) => u.uid === i.downOf)).map((dn) => ({ dn, up: S.items.find((u) => u.uid === dn.downOf) }));
  const head = `<thead><tr><th>Upstream</th><th>Downstream</th><th>Pick-up ratio</th><th>Selective up to</th><th>At fault ${fmtI(S.faultKA * 1000)}</th><th>Result</th></tr></thead>`;
  if (!pairs.length) { tbl.innerHTML = head + `<tbody><tr class="empty-row"><td colspan="6">Link devices with “Downstream of” on each card, or use Auto-chain.</td></tr></tbody>`; return; }
  const If = S.faultKA * 1000;
  const rows = pairs.map(({ up, dn }) => {
    const du = dev(up.deviceId), dd = dev(dn.deviceId);
    const eu = E.evaluate(du, up), ed = E.evaluate(dd, dn), ku = kScale(up), kd = kScale(dn);
    const puR = (eu.pickup * ku) / (ed.pickup * kd);
    const [X0, X1] = xDomain();
    const lim = E.selectivity(eu, ku, ed, kd, Math.max(X0, ed.pickup * kd), Math.max(If, X0 * 10));
    let margin, need = null, mTxt;
    const relays = eu.isRelay;
    if (relays) {
      const tu = eu.nom(If / ku), td = ed.isRelay ? ed.nom(If / kd) : ed.hi(If / kd);
      margin = tu - td; need = isEM(du) || isEM(dd) ? 0.4 : 0.3;
      mTxt = Number.isFinite(margin) ? `Δt ${fmtT(margin)} (CTI ${need} s)` : !Number.isFinite(tu) ? 'upstream does not operate' : '—';
    } else {
      const tu = eu.lo(If / ku), td = ed.hi(If / kd);
      margin = tu - td; mTxt = Number.isFinite(tu) && Number.isFinite(td) ? `down ≤ ${fmtT(td)} · up ≥ ${fmtT(tu)}` : !Number.isFinite(td) ? 'downstream does not clear' : 'upstream does not operate';
    }
    let res, cls;
    if (puR < 1) { res = 'Upstream picks up first'; cls = 'bad'; }
    else if (relays && Number.isFinite(margin) && margin < need) { res = margin > 0 ? `CTI short by ${fmtT(need - margin)}` : 'Overlap at If'; cls = margin > 0 ? 'warn' : 'bad'; }
    else if (lim === null) { res = relays ? 'Graded' : 'Selective (time-current)'; cls = 'ok'; }
    else if (lim < If) { const inst = eu.lo(lim / ku) <= 0.1; res = inst ? `Partial to ${fmtI(lim)} · check tables` : `Partial to ${fmtI(lim)}`; cls = 'warn'; }
    else { res = 'Selective (time-current)'; cls = 'ok'; }
    return `<tr><td><span class="swatch" style="background:${colorFor(up)}"></span> ${esc(up.label)}</td><td><span class="swatch" style="background:${colorFor(dn)}"></span> ${esc(dn.label)}</td>
      <td class="num">${puR.toFixed(2)}</td><td class="num">${lim === null ? `≥ ${fmtI(If)}` : fmtI(lim)}</td><td class="num">${mTxt}</td><td><span class="badge ${cls}">${res}</span></td></tr>`;
  });
  tbl.innerHTML = head + `<tbody>${rows.join('')}</tbody>`;
}

// ------------------------------------------------------------ persistence (file + URL hash)
function serialize() {
  const used = [...new Set(S.items.map((i) => i.deviceId))].filter((id) => CUSTOM.has(id)).map((id) => { const { saved, ...d } = CUSTOM.get(id); return d; });
  return { app: 'tcc-studio', version: DB.meta.version, baseKV: S.baseKV, faultKA: S.faultKA, customCurves: used, items: S.items.map(({ uid, ...r }) => ({ uid, ...r })) };
}
function applyStudy(o) {
  if (!o || !Array.isArray(o.items)) throw new Error('not a study file');
  for (const d of o.customCurves || []) if (d && d.id && Array.isArray(d.points)) CUSTOM.set(d.id, { ...d, model: 'custom', saved: CUSTOM.get(d.id)?.saved || false });
  S.baseKV = +o.baseKV || 0.4; S.faultKA = +o.faultKA || 10;
  $('#base-kv').value = S.baseKV; $('#fault-ka').value = S.faultKA;
  S.items = o.items.filter((i) => dev(i.deviceId)).map((i) => E.normalize(dev(i.deviceId), { ...i }));
  S.uid = Math.max(0, ...S.items.map((i) => i.uid)) + 1;
  refresh(); if (DB) renderLibrary();
}
function saveHash() {
  try { const s = btoa(unescape(encodeURIComponent(JSON.stringify(serialize())))); history.replaceState(null, '', '#s=' + s); } catch (e) { /* hash not available in some frames */ }
}
function loadFromHash() {
  const m = location.hash.match(/#s=([^&]+)/); if (!m) return false;
  try { applyStudy(JSON.parse(decodeURIComponent(escape(atob(m[1]))))); return true; } catch { return false; }
}

// ------------------------------------------------------------ export
function download(name, data, type) {
  const blob = data instanceof Blob ? data : new Blob([data], { type });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
function doExport(kind) {
  const svg = $('#chart');
  const src = `<?xml version="1.0" encoding="UTF-8"?>` + (() => { const x = new XMLSerializer().serializeToString(svg); return x.includes('xmlns="http://www.w3.org/2000/svg"') ? x : x.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"'); })();
  if (kind === 'svg') return download('tcc-chart.svg', src, 'image/svg+xml');
  if (kind === 'png') {
    const { W, H } = lastScale; const img = new Image(); const scale = 2;
    img.onload = () => { const c = document.createElement('canvas'); c.width = W * scale; c.height = H * scale; const x = c.getContext('2d'); x.scale(scale, scale); x.drawImage(img, 0, 0); c.toBlob((b) => download('tcc-chart.png', b)); };
    img.onerror = () => alert('PNG export failed in this browser — try SVG export.');
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(src); return;
  }
  if (kind === 'csv') {
    const [X0, X1] = xDomain(); const lines = ['label,current_A_at_base,t_min_s,t_max_s,t_nominal_s'];
    for (const it of S.items) { const ev = E.evaluate(dev(it.deviceId), it); for (const p of E.sample(ev, kScale(it), X0, X1, 200)) lines.push([`"${it.label.replace(/"/g, "'")}"`, p.I.toPrecision(5), Number.isFinite(p.lo) ? p.lo.toPrecision(5) : '', Number.isFinite(p.hi) ? p.hi.toPrecision(5) : '', p.nom != null && Number.isFinite(p.nom) ? p.nom.toPrecision(5) : ''].join(',')); }
    return download('tcc-curves.csv', lines.join('\n'), 'text/csv');
  }
  if (kind === 'report') {
    const L = [`# TCC study report`, ``, `Base voltage ${S.baseKV} kV · fault level ${S.faultKA} kA · database ${DB.meta.version}`, ``, `> ${DB.meta.disclaimer}`, ``, `## Devices`, ``, `| Label | Device | Voltage | Settings | Sources |`, `|---|---|---|---|---|`];
    for (const it of S.items) { const d = dev(it.deviceId); L.push(`| ${it.label} | ${d.model === 'custom' ? 'Custom curve: ' + d.series : d.manufacturer + ' ' + d.series} | ${it.kV} kV | ${E.evaluate(d, it).settingsText} | ${d.model === 'custom' ? 'user-defined points' : d.sources.map((s) => `[${DB.sources[s].publisher}](${DB.sources[s].url})`).join(', ')} |`); }
    L.push('', '## Coordination', '', '| Upstream | Downstream | Pick-up ratio | Selective up to | At fault | Result |', '|---|---|---|---|---|---|');
    $$('#sel-table tbody tr').forEach((tr) => { const c = [...tr.children].map((td) => td.textContent.trim()); if (c.length === 6) L.push(`| ${c.join(' | ')} |`); });
    return download('tcc-report.md', L.join('\n'), 'text/markdown');
  }
}

// ------------------------------------------------------------ database & method views
function keyRanges(d) {
  if (d.model === 'mcb') return Object.entries(d.curves).map(([k, v]) => `${k} ${v.lo}–${v.hi}×In`).join(', ');
  if (d.model === 'tm') return `Ir ${d.ir.steps ? d.ir.steps.join('/') : `${d.ir.min}–${d.ir.max}`}×In`;
  if (d.model === 'etu') return `L ${d.L.form === 'thermal-image' ? 'thermal image' : 'I²t'} @${d.L.ref}×Ir${d.S ? ' · S' : ''}${d.I ? ' · I' : ''}`;
  return Object.entries(d.curves).map(([k, v]) => `${k}: k=${v.k}, α=${v.alpha}${v.L ? `, B=${v.L}` : ''}${v.scale && v.scale !== 1 ? `, ×${v.scale}` : ''}`).join('; ');
}
function renderDatabase() {
  $('#db-version').textContent = `v${DB.meta.version}`;
  const brands = new Set(DB.devices.map((d) => d.manufacturer.split(' (')[0]));
  $('#db-summary').textContent = `${DB.devices.length} device families across ${[...brands].filter((b) => !b.startsWith('Generic')).length} manufacturers plus generic IEC / IEEE standards, built from ${Object.keys(DB.sources).length} published documents (accessed ${DB.meta.built}). Every value is tagged with its basis.`;
  $('#basis-legend').innerHTML = Object.entries(DB.meta.basisLegend).filter(([k]) => k !== 'user').map(([k, v]) => `<span><span class="tag ${k}">${k}</span>${esc(v)}</span>`).join('');
  const render = (q = '') => {
    const rows = DB.devices.filter((d) => !q || JSON.stringify(d).toLowerCase().includes(q));
    $('#db-table').innerHTML = `<thead><tr><th>Type</th><th>Manufacturer</th><th>Series</th><th>Standard</th><th>Ratings</th><th>Characteristic</th><th>Basis</th><th>Datasheet notes</th><th>Sources</th></tr></thead><tbody>` +
      rows.map((d) => `<tr><td>${d.category}</td><td>${esc(d.manufacturer)}</td><td class="series">${esc(d.series)}</td><td>${esc(d.standard)}${d.refTempC ? `<br><span class="mono">${d.refTempC} °C ref.</span>` : ''}</td>
      <td class="num">${d.ratings ? `${d.ratings[0]}–${d.ratings[d.ratings.length - 1]} A<br><span class="mono" style="color:var(--faint)">${d.ratings.length} ratings</span>` : `CT ${d.ctSec.join('/')} A`}</td>
      <td>${esc(keyRanges(d))}</td><td>${basisTags(d)}</td><td class="notes">${esc(d.notes)}${d.breaking ? `<br><b>Breaking:</b> ${esc(d.breaking)}` : ''}</td>
      <td class="src">${d.sources.map((s) => `<a href="${DB.sources[s].url}" target="_blank" rel="noopener">${esc(DB.sources[s].title.slice(0, 42))}${DB.sources[s].title.length > 42 ? '…' : ''}</a>`).join('')}</td></tr>`).join('') + '</tbody>';
  };
  render();
  $('#db-search').addEventListener('input', (e) => render(e.target.value.toLowerCase()));
  $('#db-sources').innerHTML = Object.entries(DB.sources).map(([k, s]) => `<li><a href="${s.url}" target="_blank" rel="noopener">${esc(s.title)}</a> — ${esc(s.publisher)} <span>${k} · accessed ${s.accessed}</span></li>`).join('');
}
function renderMethod() {
  const a = (k, t) => `<a href="${DB.sources[k].url}" target="_blank" rel="noopener">${t}</a>`;
  $('#method-body').innerHTML = `
  <h1>How the curves are generated</h1>
  <p>TCC Studio does not contain digitised manufacturer curves. Each band is a parametric model rebuilt from the setting ranges, tolerances and conventional test points published in the cited datasheets and standards. Where a document leaves a gap, the model fills it with a stated assumption, tagged <span class="tag assumed">assumed</span> in the database.</p>
  <h2>MCB — IEC 60898-1 / IEC 60947-2</h2>
  <p>The thermal band uses an I²-law model <span class="eq">t = K / ((I/(x₀·In))² − 1)</span>. The lower edge passes through the 1.13·In no-trip asymptote and 1 s at 2.55·In. The upper edge passes through 1.45·In at 1 h and 60 s at 2.55·In (120 s above 32 A). These are the IEC 60898-1 conventional points summarised in ${a('siemens_mcb_guide', 'the Siemens MCB guide')} and ${a('abb_s200', 'ABB S200 data')}. As a check, the fitted upper edge gives 38.5 s at 3·In, 11.7 s at 5·In and 2.7 s at 10·In. These fall inside ABB's published windows of 45 s, 15 s and 4 s. Devices certified only to IEC 60947-2 use 1.05/1.30·In conventional currents. The magnetic region is drawn between the lower and upper instantaneous limits of each curve letter. Operation is within 0.1 s under 60898-1 and 0.2 s under 60947-2, per ${a('beama_2026', 'BEAMA')}.</p>
  <h2>MCCB thermal-magnetic</h2>
  <p>Pick-up limits are 1.05/1.30·Ir (or the manufacturer's stated values). Schneider ComPacT NSX and NSXm bands are fitted to their published times (${a('se_nsx_cat', 'catalogue')}). ABB Tmax T bands pass through the catalogue's worked example (T4N 250 at 2·I1: 105.3–357.8 s from cold) (${a('abb_tmax_t', 'Tmax T catalogue')}); Tmax XT reuses that ABB shape and is tagged assumed. Other brands, including CHINT, do not publish thermal time points in the cited documents, so they reuse the NSX TM-D shape as a reference and are tagged assumed. Magnetic thresholds use the datasheet value or range with its stated tolerance. If no tolerance is stated, IEC 60947-2 ±20 % is used.</p>
  <h2>MCCB and ACB electronic (LSI)</h2>
  <p>Long-time uses <span class="eq">t = tr · (ref/(I/Ir))²</span> with tr defined at the manufacturer's reference multiple: 6·Ir for Schneider, Siemens, Eaton, Legrand, Hager, CHINT NM8N/NXA/NA8 and ABB PR221/PR222/PR231/PR232, 3·I1 for ABB Ekip and PR331/PR332, and 2·Ir for CHINT NXM. Settings that the trip unit allows to be switched off appear as OFF. MicroLogic uses a thermal-image form <span class="eq">t = tr · (36 − c)/((I/Ir)² − c), c = 0.844</span>, which reproduces the published 1.5·Ir, 6·Ir and 7.2·Ir times exactly. Short-time is definite-time, or I²t-ON below the reference current. Schneider's published non-trip and maximum-break times form the band. Instantaneous is drawn from 10 ms to the published maximum break time. If a manufacturer gives no tolerance, only the nominal line is drawn.</p>
  <h2>IDMT relays — IEC 60255-151, IEEE C37.112 and CDG</h2>
  <p>IEC: <span class="eq">t = TMS · k / ((I/Is)^α − 1)</span> with SI 0.14/0.02, VI 13.5/1, EI 80/2 and LTI 120/1, per ${a('iec60255_ecalpro', 'ECalPro')}. IEEE: <span class="eq">t = TD · (A/(M^p − 1) + B)</span> with constants from ${a('ieee_c37112', 'IEEE C37.112-1996')}. Curves are capped at 20× setting.</p>
  <p>The CDG11 3 s relay follows BS 142, which uses the same equation as IEC SI (2.97 s at 10× setting). It has error class E7.5, which gives a ±7.5 % band, and plug settings of 50–200 %, 20–80 % or 10–40 %, per ${a('cdg_brochure', 'the CDG11 brochure')}. CDG12, CDG13 and CDG14 map to LTI, VI and EI per ${a('cdg_ops', 'the operating instructions')}. CDG12's 30 s at 5× tap matches IEC LTI exactly. The 1.3 s CDG11 is approximated by scaling SI and is tagged assumed. CDG21 adds a high-set instantaneous element. Relay current is converted to primary amps with Is = plug % × CT primary. All devices are then referred to the study base voltage by multiplying by kV<sub>device</sub>/kV<sub>base</sub>.</p>
  <h2>Coordination check</h2>
  <p>For each linked pair, the check scans current from the downstream pick-up up to the fault level. It returns the first current where the downstream latest clearing time reaches the upstream earliest operating time. Relay pairs are also checked against a CTI of 0.4 s if either relay is electromechanical, otherwise 0.3 s. This tool does not model current-limiting energy selectivity (I²t let-through). For breaker-to-breaker selectivity at short-circuit levels, use the manufacturer's selectivity tables.</p>
  <h2>Custom curves</h2>
  <p>Any device that is not in the database, such as a fuse, a motor starting curve, a cable or transformer withstand curve or a relay you digitised from a manufacturer chart, can be entered as a custom curve. This works like Curve Direct's "curve defined by points": give the curve a name, then add, edit or delete current–time points, paste a list, load a <span class="mono">.txt</span> or <span class="mono">.csv</span> points list, or click points straight onto the chart. A curve needs at least two points.</p>
  <p>Between points the curve is interpolated linearly on the log-log chart. Two points at the same current give a vertical step, for example an instantaneous trip. Below the first point the device does not operate. Above the last point it either holds the last time or the curve ends, as you choose. In band mode each row has a minimum and a maximum time, and the coordination check uses the minimum as the earliest operating time and the maximum as the latest clearing time.</p>
  <p>Currents can be entered in amperes or as multiples of a base current, which is useful when you copy points from a chart drawn in multiples of In or Ir. On the study card, the current and time multipliers shift the whole curve, for example ×0.577 to move a curve across a delta-star transformer for a phase-to-phase fault. Custom curves are saved inside the study file and its link. Ticking "Save to My curves" also keeps them in this browser for reuse in other studies.</p>
  <p>Points list format: one point per line, giving current, then time, then an optional maximum time. Values can be separated by spaces, tabs, commas or semicolons. When the separator is a tab or semicolon, decimal commas are accepted. Lines starting with <span class="mono">#</span> and header lines are ignored.</p>
  <h2>Limits</h2>
  <ul><li>Ambient derating is not applied. Each entry records its calibration reference temperature (20–50 °C).</li><li>Ground-fault (G) functions are stored in the database but not plotted.</li><li>Some rating lists marked in notes are typical values that were not extracted from the cited page. Check catalogue numbers before use.</li></ul>
  <p><b>${esc(DB.meta.disclaimer)}</b></p>`;
}

// ------------------------------------------------------------ custom curves (points list editor)
// Mirrors Curve Direct's "Curve defined by points": name a curve, add / modify / delete
// current–time points, load or save a .txt points list, plus band mode and chart picking.
let ED = null; // working copy while the editor is open
function newCurveId() { return 'user-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function blankCurve() { return { id: null, manufacturer: 'User', series: '', category: 'FUSE', model: 'custom', mode: 'line', unit: 'A', base: 100, kV: S.baseKV, extend: true, points: [], sources: [], ratings: [] }; }
function initCustomCurves() {
  const dlg = $('#cc-dialog');
  $('#btn-new-curve').addEventListener('click', () => openEditor(null));
  $('#file-points').addEventListener('change', async (e) => { const f = e.target.files[0]; if (!f) return; const pts = E.parsePoints(await f.text()); e.target.value = '';
    const c = blankCurve(); c.series = f.name.replace(/\.[^.]+$/, ''); c.points = pts; if (pts.some((p) => p.t2)) c.mode = 'band'; openEditor(c, true); });
  $('#cc-unit').addEventListener('change', (e) => { ED.unit = e.target.value; $('#cc-base-wrap').hidden = ED.unit !== 'x'; renderPts(); });
  $('#cc-mode').addEventListener('change', (e) => { ED.mode = e.target.value; renderPts(); });
  for (const [id, k, f] of [['cc-name', 'series', String], ['cc-cat', 'category', String], ['cc-kv', 'kV', Number], ['cc-base', 'base', Number]]) $('#' + id).addEventListener('input', (e) => { ED[k] = f(e.target.value); if (k === 'series') validate(); });
  $('#cc-extend').addEventListener('change', (e) => { ED.extend = e.target.checked; });
  $('#cc-add').addEventListener('click', () => { const p = E.sortPts(ED.points), last = p[p.length - 1];
    ED.points.push(last ? { I: +(last.I * 2).toPrecision(4), t: +(Math.max(last.t / 5, 0.01)).toPrecision(3) } : { I: 100, t: 100 }); renderPts(true); });
  $('#cc-table').addEventListener('input', (e) => { const inp = e.target.closest('input[data-row]'); if (!inp) return;
    const v = +String(inp.value).replace(',', '.'), row = ED.points[+inp.dataset.row]; inp.classList.toggle('bad', !(v > 0)); if (v > 0) row[inp.dataset.f] = v; validate(); });
  $('#cc-table').addEventListener('change', () => { ED.points = E.sortPts(ED.points); renderPts(); });
  $('#cc-table').addEventListener('click', (e) => { const b = e.target.closest('[data-del]'); if (b) { ED.points.splice(+b.dataset.del, 1); renderPts(); } });
  $('#cc-file').addEventListener('change', async (e) => { const f = e.target.files[0]; if (!f) return; const pts = E.parsePoints(await f.text()); e.target.value = '';
    if (!pts.length) return msg('error', `No current–time pairs found in ${f.name}.`); ED.points = pts; if (pts.some((p) => p.t2)) { ED.mode = 'band'; $('#cc-mode').value = 'band'; }
    if (!ED.series) { ED.series = f.name.replace(/\.[^.]+$/, ''); $('#cc-name').value = ED.series; } renderPts(); msg('info', `Loaded ${pts.length} points from ${f.name}.`); });
  $('#cc-save-txt').addEventListener('click', () => download(`${(ED.series || 'custom-curve').replace(/[^\w.-]+/g, '_')}.txt`, E.formatPoints(ED), 'text/plain'));
  const paste = (append) => { const pts = E.parsePoints($('#cc-text').value); if (!pts.length) return msg('error', 'No current–time pairs found in the pasted text.');
    ED.points = append ? ED.points.concat(pts) : pts; if (pts.some((p) => p.t2)) { ED.mode = 'band'; $('#cc-mode').value = 'band'; } renderPts(); msg('info', `${append ? 'Appended' : 'Loaded'} ${pts.length} points.`); };
  $('#cc-paste-replace').addEventListener('click', () => paste(false));
  $('#cc-paste-append').addEventListener('click', () => paste(true));
  $('#cc-pick').addEventListener('click', () => startPick());
  $('#pick-done').addEventListener('click', () => endPick());
  $('#pick-undo').addEventListener('click', () => { if (ED && ED.points.length) { ED.points.pop(); pickStatus(); draw(); } });
  $('#cc-form').addEventListener('submit', (e) => { if (e.submitter && e.submitter.value === 'ok') { e.preventDefault(); commitEditor(); } });
  dlg.addEventListener('close', () => { if (!S.pick) ED = null; });
  $('#chart').addEventListener('pointerup', (e) => { if (!S.pick || !ED || !lastScale) return; const pt = chartPoint(e); if (!pt) return;
    const k = (ED.kV || S.baseKV) / S.baseKV, b = ED.unit === 'x' ? (ED.base || 1) : 1;
    const I = +(pt.I / k / b).toPrecision(4), t = +pt.t.toPrecision(3);
    ED.points.push(ED.mode === 'band' ? { I, t, t2: t } : { I, t }); pickStatus(); draw(); });
}
function chartPoint(e) {
  const svg = $('#chart'), r = svg.getBoundingClientRect(), { m, pw, ph, X0, X1, W, H } = lastScale;
  const x = ((e.clientX - r.left) / r.width) * W, y = ((e.clientY - r.top) / r.height) * H;
  if (x < m.l || x > m.l + pw || y < m.t || y > m.t + ph) return null;
  const I = 10 ** (Math.log10(X0) + ((x - m.l) / pw) * (Math.log10(X1) - Math.log10(X0)));
  const t = 10 ** (Math.log10(Y1) - ((y - m.t) / ph) * (Math.log10(Y1) - Math.log10(Y0)));
  return { I, t };
}
function openEditor(def, isNew = !def) {
  ED = def ? JSON.parse(JSON.stringify(def)) : blankCurve();
  ED._editing = !isNew && def && def.id ? def.id : null;
  $('#cc-title').textContent = ED._editing ? 'Edit custom curve' : 'New custom curve';
  $('#cc-ok').textContent = ED._editing ? 'Save changes' : 'Add to study';
  $('#cc-name').value = ED.series; $('#cc-cat').value = ED.category; $('#cc-kv').value = ED.kV ?? 0.4; $('#cc-mode').value = ED.mode;
  $('#cc-unit').value = ED.unit; $('#cc-base').value = ED.base ?? 100; $('#cc-base-wrap').hidden = ED.unit !== 'x'; $('#cc-extend').checked = ED.extend !== false;
  $('#cc-keep').checked = ED._editing ? !!CUSTOM.get(ED._editing)?.saved : true;
  $('#cc-text').value = ''; $('#cc-msgs').innerHTML = '';
  renderPts();
  const dlg = $('#cc-dialog'); if (!dlg.open) dlg.showModal();
  setTimeout(() => (ED.series ? $('#cc-add') : $('#cc-name')).focus(), 30);
}
function renderPts(focusLast) {
  const band = ED.mode === 'band', u = ED.unit === 'x' ? '×base' : 'A';
  const head = `<thead><tr><th>#</th><th>Current (${u})</th><th>${band ? 'Min time (s)' : 'Time (s)'}</th>${band ? '<th>Max time (s)</th>' : ''}<th></th></tr></thead>`;
  const rows = ED.points.map((p, i) => `<tr><td class="idx">${i + 1}</td>
    <td><input inputmode="decimal" data-row="${i}" data-f="I" value="${p.I}" aria-label="Current, point ${i + 1}"></td>
    <td><input inputmode="decimal" data-row="${i}" data-f="t" value="${p.t}" aria-label="Time, point ${i + 1}"></td>
    ${band ? `<td><input inputmode="decimal" data-row="${i}" data-f="t2" value="${p.t2 ?? p.t}" aria-label="Maximum time, point ${i + 1}"></td>` : ''}
    <td class="del"><button type="button" data-del="${i}" title="Delete point" aria-label="Delete point ${i + 1}">${xIcon}</button></td></tr>`).join('');
  $('#cc-table').innerHTML = head + `<tbody>${rows || `<tr class="empty-row"><td colspan="${band ? 5 : 4}">No points yet — add points, paste a list, load a .txt/.csv file or pick them on the chart.</td></tr>`}</tbody>`;
  $('#cc-npts').textContent = ED.points.length ? `${ED.points.length}` : '';
  if (focusLast) { const ins = $$('#cc-table input[data-f="I"]'); ins[ins.length - 1]?.focus(); ins[ins.length - 1]?.select(); }
  validate();
}
function validate() {
  const m = E.checkPoints(ED); if (!String(ED.series || '').trim()) m.unshift({ level: 'error', text: 'Give the curve a name.' });
  $('#cc-msgs').innerHTML = m.map((x) => `<li class="${x.level}">${esc(x.text)}</li>`).join('');
  $('#cc-ok').disabled = m.some((x) => x.level === 'error');
  return m;
}
function msg(level, text) { $('#cc-msgs').insertAdjacentHTML('afterbegin', `<li class="${level}">${esc(text)}</li>`); }
function commitEditor() {
  if (validate().some((x) => x.level === 'error')) return;
  const keep = $('#cc-keep').checked;
  const { _editing, ...def } = ED;
  def.series = def.series.trim(); def.points = E.sortPts(def.points).map((p) => (def.mode === 'band' ? { I: p.I, t: p.t, t2: p.t2 ?? p.t } : { I: p.I, t: p.t }));
  def.model = 'custom'; def.manufacturer = 'User'; def.sources = []; def.ratings = []; def.saved = keep;
  if (_editing) {
    def.id = _editing; CUSTOM.set(def.id, def);
    S.items.filter((i) => i.deviceId === def.id).forEach((i) => E.normalize(def, i));
  } else {
    def.id = newCurveId(); CUSTOM.set(def.id, def);
    add(def.id, { kV: def.kV, label: def.series }, false);
  }
  storeMyCurves();
  ED = null; $('#cc-dialog').close();
  renderLibrary(); refresh();
}
function forgetCurve(id) {
  const d = CUSTOM.get(id); if (!d) return;
  if (!confirm(`Remove “${d.series}” from My curves?${S.items.some((i) => i.deviceId === id) ? ' It stays in the current study.' : ''}`)) return;
  if (S.items.some((i) => i.deviceId === id)) d.saved = false; else CUSTOM.delete(id);
  storeMyCurves(); renderLibrary();
}
function startPick() {
  S.pick = true; $('#cc-dialog').close();
  $('#pick-name').textContent = `“${ED.series || 'new curve'}”`; $('#pick-banner').hidden = false; $('#chart-wrap').classList.add('picking');
  pickStatus(); draw();
  $('#chart-wrap').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}
function pickStatus() { $('#pick-count').textContent = `${ED.points.length} point${ED.points.length === 1 ? '' : 's'}`; }
function endPick() {
  S.pick = false; $('#pick-banner').hidden = true; $('#chart-wrap').classList.remove('picking');
  ED.points = E.sortPts(ED.points); draw(); openEditor(ED, !ED._editing);
}
// preview of the curve being edited (drawn on the chart while picking)
function previewSvg(sx, sy, m, pw, ph) {
  if (!S.pick || !ED || !ED.points.length) return '';
  const k = (ED.kV || S.baseKV) / S.baseKV, b = ED.unit === 'x' ? (ED.base || 1) : 1;
  const P = E.sortPts(ED.points).map((p) => ({ x: sx(p.I * b * k), y: sy(p.t), y2: sy(p.t2 ?? p.t) }));
  const col = cssVar('--accent');
  let g = `<path d="${P.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join('')}" fill="none" stroke="${col}" stroke-width="1.8" stroke-dasharray="6 3"/>`;
  if (ED.mode === 'band') g += `<path d="${P.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y2.toFixed(1)}`).join('')}" fill="none" stroke="${col}" stroke-width="1.2" stroke-dasharray="2 3"/>`;
  g += P.map((p) => `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3.5" fill="${cssVar('--paper')}" stroke="${col}" stroke-width="1.6"/>`).join('');
  return g;
}

boot();
