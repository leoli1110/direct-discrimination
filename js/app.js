import * as E from './engine.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtT = (t) => (!Number.isFinite(t) ? '—' : t >= 100 ? `${t.toFixed(0)} s` : t >= 1 ? `${t.toFixed(2)} s` : t >= 0.1 ? `${t.toFixed(3)} s` : `${(t * 1000).toFixed(0)} ms`);
const fmtI = (I) => (I >= 1e4 ? `${(I / 1000).toFixed(1)} kA` : I >= 1000 ? `${(I / 1000).toFixed(2)} kA` : I >= 10 ? `${I.toFixed(0)} A` : `${I.toFixed(2)} A`);
const PALETTE = { light: ['#1d5f8a', '#b4441c', '#2c7a4b', '#7b4a9e', '#9a7412', '#0e7783', '#8c2b4b', '#4a5560'], dark: ['#6cb2e0', '#f08a5d', '#6fcf8f', '#b993dd', '#e3bd57', '#4fc4cf', '#e47b9b', '#a5b0ba'] };

let DB = null;
const S = { items: [], baseKV: 0.4, faultKA: 10, xRange: 'auto', bands: true, uid: 1, cat: 'ALL', brand: '', q: '', collapsed: new Set() };
const dev = (id) => DB.devices.find((d) => d.id === id);

// ------------------------------------------------------------ boot
async function boot() {
  const theme = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  document.documentElement.dataset.theme = theme;
  DB = await (await fetch('db/curvedb.json')).json();
  initLibrary(); initToolbar(); initTabs(); renderDatabase(); renderMethod();
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
  $('#lib-list').addEventListener('click', (e) => { const b = e.target.closest('[data-add]'); if (b) add(b.dataset.add); });
  renderLibrary();
}
function devMeta(d) {
  if (d.model === 'mcb') return `${Object.keys(d.curves).join(' · ')} curves · ${d.ratings[0]}–${d.ratings[d.ratings.length - 1]} A`;
  if (d.model === 'tm') return `Thermal-magnetic · ${d.ratings[0]}–${d.ratings[d.ratings.length - 1]} A`;
  if (d.model === 'etu') return `Electronic ${d.S ? 'LSI' : 'LI'} · ${d.ratings[0]}–${d.ratings[d.ratings.length - 1]} A`;
  return `IDMT · ${Object.keys(d.curves).map((k) => k.split(' ')[0]).join(' · ')}`;
}
function renderLibrary() {
  const list = DB.devices.filter((d) => (S.cat === 'ALL' || d.category === S.cat) && (!S.brand || d.manufacturer === S.brand) &&
    (!S.q || `${d.manufacturer} ${d.series} ${d.standard} ${Object.keys(d.curves || {}).join(' ')} ${d.category}`.toLowerCase().includes(S.q)));
  $('#lib-count').textContent = `${list.length} / ${DB.devices.length}`;
  const groups = {};
  for (const d of list) (groups[d.category] ||= []).push(d);
  const names = { MCB: 'Miniature circuit breakers', MCCB: 'Moulded-case circuit breakers', RELAY: 'Overcurrent relays (IDMT)' };
  $('#lib-list').innerHTML = list.length ? ['MCB', 'MCCB', 'RELAY'].filter((g) => groups[g]).map((g) => `
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
        <div class="card-title"><input type="text" data-k="label" value="${esc(it.label)}" aria-label="Label"><div class="card-sub" title="${esc(d.manufacturer + ' ' + d.series)}">${esc(d.manufacturer)} · ${esc(d.series)}</div></div>
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
        <div class="card-foot">${basisTags(d)} ${src}</div>
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
function serialize() { return { app: 'tcc-studio', version: DB.meta.version, baseKV: S.baseKV, faultKA: S.faultKA, items: S.items.map(({ uid, ...r }) => ({ uid, ...r })) }; }
function applyStudy(o) {
  if (!o || !Array.isArray(o.items)) throw new Error('not a study file');
  S.baseKV = +o.baseKV || 0.4; S.faultKA = +o.faultKA || 10;
  $('#base-kv').value = S.baseKV; $('#fault-ka').value = S.faultKA;
  S.items = o.items.filter((i) => dev(i.deviceId)).map((i) => E.normalize(dev(i.deviceId), { ...i }));
  S.uid = Math.max(0, ...S.items.map((i) => i.uid)) + 1;
  refresh();
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
    for (const it of S.items) { const d = dev(it.deviceId); L.push(`| ${it.label} | ${d.manufacturer} ${d.series} | ${it.kV} kV | ${E.evaluate(d, it).settingsText} | ${d.sources.map((s) => `[${DB.sources[s].publisher}](${DB.sources[s].url})`).join(', ')} |`); }
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
  <p>Pick-up limits are 1.05/1.30·Ir (or the manufacturer's stated values). Schneider ComPacT NSX and NSXm bands are fitted to their published times (${a('se_nsx_cat', 'catalogue')}). Other brands do not publish thermal time points in the cited documents, so they reuse the NSX TM-D shape as a reference and are tagged assumed. Magnetic thresholds use the datasheet value or range with its stated tolerance. If no tolerance is stated, IEC 60947-2 ±20 % is used.</p>
  <h2>MCCB electronic (LSI)</h2>
  <p>Long-time uses <span class="eq">t = tr · (ref/(I/Ir))²</span> with tr defined at the manufacturer's reference multiple: 6·Ir for Schneider, Siemens, Eaton, Legrand and Hager, and 3·I1 for ABB Ekip. MicroLogic uses a thermal-image form <span class="eq">t = tr · (36 − c)/((I/Ir)² − c), c = 0.844</span>, which reproduces the published 1.5·Ir, 6·Ir and 7.2·Ir times exactly. Short-time is definite-time, or I²t-ON below the reference current. Schneider's published non-trip and maximum-break times form the band. Instantaneous is drawn from 10 ms to the published maximum break time. If a manufacturer gives no tolerance, only the nominal line is drawn.</p>
  <h2>IDMT relays — IEC 60255-151, IEEE C37.112 and CDG</h2>
  <p>IEC: <span class="eq">t = TMS · k / ((I/Is)^α − 1)</span> with SI 0.14/0.02, VI 13.5/1, EI 80/2 and LTI 120/1, per ${a('iec60255_ecalpro', 'ECalPro')}. IEEE: <span class="eq">t = TD · (A/(M^p − 1) + B)</span> with constants from ${a('ieee_c37112', 'IEEE C37.112-1996')}. Curves are capped at 20× setting.</p>
  <p>The CDG11 3 s relay follows BS 142, which uses the same equation as IEC SI (2.97 s at 10× setting). It has error class E7.5, which gives a ±7.5 % band, and plug settings of 50–200 %, 20–80 % or 10–40 %, per ${a('cdg_brochure', 'the CDG11 brochure')}. CDG12, CDG13 and CDG14 map to LTI, VI and EI per ${a('cdg_ops', 'the operating instructions')}. CDG12's 30 s at 5× tap matches IEC LTI exactly. The 1.3 s CDG11 is approximated by scaling SI and is tagged assumed. CDG21 adds a high-set instantaneous element. Relay current is converted to primary amps with Is = plug % × CT primary. All devices are then referred to the study base voltage by multiplying by kV<sub>device</sub>/kV<sub>base</sub>.</p>
  <h2>Coordination check</h2>
  <p>For each linked pair, the check scans current from the downstream pick-up up to the fault level. It returns the first current where the downstream latest clearing time reaches the upstream earliest operating time. Relay pairs are also checked against a CTI of 0.4 s if either relay is electromechanical, otherwise 0.3 s. This tool does not model current-limiting energy selectivity (I²t let-through). For breaker-to-breaker selectivity at short-circuit levels, use the manufacturer's selectivity tables.</p>
  <h2>Limits</h2>
  <ul><li>Ambient derating is not applied. Each entry records its calibration reference temperature (20–50 °C).</li><li>Ground-fault (G) functions are stored in the database but not plotted.</li><li>Some rating lists marked in notes are typical values that were not extracted from the cited page. Check catalogue numbers before use.</li></ul>
  <p><b>${esc(DB.meta.disclaimer)}</b></p>`;
}

boot();
