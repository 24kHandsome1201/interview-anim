// Scene renderer. A scene is an array of layers; each layer has {type, id, label}.
// Layers with the same id+type are updated in place so CSS transitions animate between steps.

const SVGNS = 'http://www.w3.org/2000/svg';
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const cls = (c) => (c ? `cls-${c}` : '');
const fmt = (v) => (v === null || v === undefined ? '' : typeof v === 'number' && !Number.isInteger(v) ? String(Math.round(v * 100) / 100) : String(v));
const PCLS = ['', 'p1', 'p2', 'p3'];

export const LAYER_TYPES = ['array', 'bars', 'matrix', 'vars', 'map', 'text', 'tensor', 'probs', 'tree', 'graph', 'list', 'legend', 'row'];

export function renderScene(root, scene) {
  const keep = new Set();
  let prev = null;
  for (const layer of scene) {
    const key = `${layer.type}:${layer.id ?? layer.label ?? ''}`;
    keep.add(key);
    let el = [...root.children].find((c) => c.dataset.key === key);
    if (!el) {
      el = document.createElement('div');
      el.className = 'layer';
      el.dataset.key = key;
    }
    if (prev ? prev.nextSibling !== el : root.firstChild !== el) root.insertBefore(el, prev ? prev.nextSibling : root.firstChild);
    renderLayer(el, layer);
    prev = el;
  }
  [...root.children].forEach((c) => { if (!keep.has(c.dataset.key)) c.remove(); });
}

function renderLayer(el, layer) {
  let lbl = el.querySelector(':scope > .lbl');
  if (layer.label) {
    if (!lbl) { lbl = document.createElement('div'); lbl.className = 'lbl'; el.prepend(lbl); }
    lbl.innerHTML = esc(layer.label);
  } else if (lbl) lbl.remove();
  let body = el.querySelector(':scope > .body');
  if (!body || body.dataset.type !== layer.type) {
    body?.remove();
    body = document.createElement('div');
    body.className = 'body';
    body.dataset.type = layer.type;
    el.append(body);
  }
  const fn = R[layer.type];
  if (!fn) { body.textContent = `未知图层类型: ${layer.type}`; return; }
  fn(body, layer);
}

function pointerEls(host, pointers, centerOf) {
  const names = Object.keys(pointers || {});
  // group pointers that share the same position so labels stack as "i,j"
  const groups = new Map();
  names.forEach((n, k) => {
    const p = pointers[n];
    if (p === null || p === undefined || p < 0) return;
    if (!groups.has(p)) groups.set(p, []);
    groups.get(p).push([n, k]);
  });
  const want = new Set();
  for (const [pos, list] of groups) {
    for (const [n, k] of list) {
      want.add(n);
      let pe = host.querySelector(`:scope > .ptr[data-n="${CSS.escape(n)}"]`);
      if (!pe) { pe = document.createElement('div'); pe.className = `ptr ${PCLS[k % 4]}`; pe.dataset.n = n; host.append(pe); pe.style.transition = 'none'; }
      const label = list.map((x) => x[0]).join(',');
      pe.textContent = label;
      pe.style.visibility = list[0][0] === n ? 'visible' : 'hidden';
      const x = centerOf(pos);
      pe.style.transform = `translateX(calc(${x}px - 50%))`;
      if (pe.style.transition === 'none') requestAnimationFrame(() => { pe.style.transition = ''; });
    }
  }
  host.querySelectorAll(':scope > .ptr').forEach((pe) => { if (!want.has(pe.dataset.n)) pe.remove(); });
}

const R = {
  array(body, L) {
    let host = body.querySelector('.arr');
    if (!host) { host = document.createElement('div'); host.className = 'arr'; body.append(host); }
    host.classList.toggle('noidx', L.showIndex === false);
    const cells = [...host.querySelectorAll(':scope > .cell')];
    L.values.forEach((v, i) => {
      let c = cells[i];
      if (!c) { c = document.createElement('div'); host.insertBefore(c, host.querySelector('.ptr')); }
      const idx = L.indexLabels ? L.indexLabels[i] : i;
      const s = fmt(v);
      c.className = `cell ${cls(L.colors?.[i])} ${s.length > 3 ? 'wide' : ''}`;
      c.innerHTML = `<span class="ix">${esc(idx)}</span>${esc(s)}`;
    });
    cells.slice(L.values.length).forEach((c) => c.remove());
    const live = [...host.querySelectorAll(':scope > .cell')];
    pointerEls(host, L.pointers, (i) => {
      if (i >= live.length) { const last = live[live.length - 1]; return last ? last.offsetLeft + last.offsetWidth * 1.5 + 6 : 22; }
      return live[i].offsetLeft + live[i].offsetWidth / 2;
    });
  },

  bars(body, L) {
    let host = body.querySelector('.bars');
    if (!host) { host = document.createElement('div'); host.className = 'bars'; body.append(host); }
    const unit = L.unit || 22;
    const cols = [...host.querySelectorAll(':scope > .col')];
    L.values.forEach((v, i) => {
      let c = cols[i];
      if (!c) { c = document.createElement('div'); c.innerHTML = '<div class="wl"></div><div class="w"></div><div class="b"></div><div class="v"></div>'; host.insertBefore(c, host.querySelector('.ptr')); }
      c.className = `col ${cls(L.colors?.[i])}`;
      const w = L.water?.[i] || 0;
      c.querySelector('.w').style.height = `${w * unit}px`;
      c.querySelector('.b').style.height = `${Math.max(v * unit, 2)}px`;
      c.querySelector('.v').textContent = fmt(v);
      const wl = c.querySelector('.wl');
      wl.textContent = w ? `+${fmt(w)}` : '';
      wl.style.bottom = `${(v + w) * unit + 2}px`;
    });
    cols.slice(L.values.length).forEach((c) => c.remove());
    const live = [...host.querySelectorAll(':scope > .col')];
    pointerEls(host, L.pointers, (i) => (live[i] ? live[i].offsetLeft + live[i].offsetWidth / 2 : 0));
    host.style.paddingTop = `${(Math.max(...L.values.map((v, i) => v + (L.water?.[i] || 0)), 1) * unit) - Math.max(...L.values, 1) * unit + 16}px`;
  },

  matrix(body, L) { body.innerHTML = matrixHTML(L); },

  row(body, L) {
    // horizontal composition of small matrices/text with operators, e.g. Q · Kᵀ = S
    body.innerHTML = `<div class="mat-row">${L.items.map((it) => {
      if (it.op) return `<div class="mat-op">${esc(it.op)}</div>`;
      if (it.type === 'tensor') return tensorHTML(it);
      return `<div>${it.label ? `<div class="lbl">${esc(it.label)}</div>` : ''}${matrixHTML(it)}</div>`;
    }).join('')}</div>`;
  },

  vars(body, L) {
    const old = new Map([...body.querySelectorAll('.var')].map((e) => [e.dataset.n, e.dataset.v]));
    body.innerHTML = `<div class="vars">${Object.entries(L.items).map(([n, v]) => {
      const s = typeof v === 'object' && v !== null ? JSON.stringify(v) : fmt(v);
      const changed = old.size && old.get(n) !== s;
      return `<div class="var ${cls(L.colors?.[n])} ${changed ? 'flash' : ''}" data-n="${esc(n)}" data-v="${esc(s)}"><span class="n">${esc(n)}</span>${esc(s)}</div>`;
    }).join('')}</div>`;
  },

  map(body, L) {
    const [hk, hv] = L.headers || ['key', 'value'];
    body.innerHTML = `<div class="map"><div class="h">${esc(hk)}</div><div class="h">${esc(hv)}</div>${(L.entries.length ? L.entries : [['∅', '']]).map(([k, v]) => {
      const c = cls(L.colors?.[String(k)]);
      return `<div class="k ${c}">${esc(fmt(k))}</div><div class="v ${c}">${esc(typeof v === 'object' ? JSON.stringify(v) : fmt(v))}</div>`;
    }).join('')}</div>`;
  },

  text(body, L) { body.innerHTML = `<div class="txt">${esc(L.text)}</div>`; },

  tensor(body, L) { body.innerHTML = tensorHTML(L); },

  legend(body, L) {
    body.innerHTML = `<div class="legend">${L.items.map(([c, t]) => `<span class="${cls(c)}"><i></i>${esc(t)}</span>`).join('')}</div>`;
  },

  probs(body, L) {
    const max = L.max ?? Math.max(...L.values, 1e-9);
    body.innerHTML = `<div class="probs">${L.values.map((v, i) => {
      const c = L.colors?.[i];
      return `<div class="tk ${c === 'dim' ? 'row-dim' : ''}">${esc(L.tokens[i])}</div><div class="track ${c === 'dim' ? 'row-dim' : ''}"><div class="fill ${cls(c === 'dim' ? '' : c)}" style="width:${(Math.max(v, 0) / max) * 100}%"></div></div><div class="pv ${c === 'dim' ? 'row-dim' : ''}">${esc(fmt(L.fmt ? L.fmt(v) : v))}</div>`;
    }).join('')}</div>`;
  },

  tree(body, L) {
    const byId = new Map(L.nodes.map((n) => [n.id, n]));
    const childIds = new Set(L.nodes.flatMap((n) => [n.left, n.right]).filter((x) => x !== null && x !== undefined));
    const root = L.nodes.find((n) => !childIds.has(n.id));
    const pos = new Map();
    let order = 0, depth = 0;
    (function walk(id, d) {
      if (id === null || id === undefined) return;
      const n = byId.get(id);
      walk(n.left, d + 1);
      pos.set(id, { x: order++, y: d });
      depth = Math.max(depth, d);
      walk(n.right, d + 1);
    })(root?.id, 0);
    const gx = 46, gy = 62, r = 18, pad = 26;
    const W = Math.max(order, 1) * gx + pad, H = (depth + 1) * gy + 20;
    const X = (id) => pos.get(id).x * gx + pad, Y = (id) => pos.get(id).y * gy + 26;
    let s = '';
    for (const n of L.nodes) for (const ch of [n.left, n.right]) {
      if (ch === null || ch === undefined || !pos.has(ch)) continue;
      s += `<line class="edge ${cls(L.edgeColors?.[`${n.id}-${ch}`])}" x1="${X(n.id)}" y1="${Y(n.id)}" x2="${X(ch)}" y2="${Y(ch)}"/>`;
    }
    for (const n of L.nodes) {
      if (!pos.has(n.id)) continue;
      s += `<g class="node ${cls(L.colors?.[n.id])}"><circle cx="${X(n.id)}" cy="${Y(n.id)}" r="${r}"/><text x="${X(n.id)}" y="${Y(n.id)}">${esc(fmt(n.val))}</text>`;
      if (L.sub?.[n.id] !== undefined) s += `<text class="sub" x="${X(n.id)}" y="${Y(n.id) + r + 11}">${esc(L.sub[n.id])}</text>`;
      s += '</g>';
    }
    for (const [name, id] of Object.entries(L.pointers || {})) {
      if (id === null || id === undefined || !pos.has(id)) continue;
      s += `<text class="plabel" x="${X(id)}" y="${Y(id) - r - 6}">${esc(name)}</text>`;
    }
    body.innerHTML = `<svg class="viz" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${s}</svg>`;
  },

  graph(body, L) {
    const W = L.width || 420, H = L.height || 260, r = 20;
    const P = new Map(L.nodes.map((n) => [n.id, { x: 30 + n.x * (W - 60), y: 30 + n.y * (H - 60) }]));
    let s = `<defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="currentColor"/></marker></defs>`;
    for (const e of L.edges) {
      const a = P.get(e.from), b = P.get(e.to);
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1;
      const x1 = a.x + (dx / d) * r, y1 = a.y + (dy / d) * r, x2 = b.x - (dx / d) * (r + 2), y2 = b.y - (dy / d) * (r + 2);
      s += `<line class="edge ${cls(e.color)}" style="color:var(--fg, var(--c-dim))" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" ${L.directed ? 'marker-end="url(#ah)"' : ''}/>`;
    }
    for (const n of L.nodes) {
      const p = P.get(n.id);
      s += `<g class="node ${cls(L.colors?.[n.id])}"><circle cx="${p.x}" cy="${p.y}" r="${r}"/><text x="${p.x}" y="${p.y}">${esc(n.label ?? n.id)}</text>`;
      if (L.sub?.[n.id] !== undefined) s += `<text class="sub" x="${p.x}" y="${p.y + r + 12}">${esc(L.sub[n.id])}</text>`;
      s += '</g>';
    }
    body.innerHTML = `<svg class="viz" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${s}</svg>`;
  },

  list(body, L) {
    // nodes laid out left→right in array order; next: {id: targetId|null}; arrows can point backwards.
    const gx = 78, r = 20, y = 46;
    const idx = new Map(L.nodes.map((n, i) => [n.id, i]));
    const W = L.nodes.length * gx + 60, H = 112;
    const X = (i) => 34 + i * gx;
    let s = `<defs><marker id="lah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="currentColor"/></marker></defs>`;
    for (const n of L.nodes) {
      const t = L.next?.[n.id];
      if (t === null || t === undefined || !idx.has(t)) continue;
      const i = idx.get(n.id), j = idx.get(t);
      const c = cls(L.edgeColors?.[n.id]);
      if (j === i + 1) s += `<line class="edge ${c}" style="color:var(--fg, var(--c-dim))" x1="${X(i) + r}" y1="${y}" x2="${X(j) - r - 2}" y2="${y}" marker-end="url(#lah)"/>`;
      else if (j === i - 1) s += `<path class="edge ${c}" style="color:var(--fg, var(--c-dim))" d="M${X(i) - r},${y + 6} Q${(X(i) + X(j)) / 2},${y + 30} ${X(j) + r + 2},${y + 6}" marker-end="url(#lah)"/>`;
      else { const up = j > i ? -1 : 1; s += `<path class="edge ${c}" style="color:var(--fg, var(--c-dim))" d="M${X(i)},${y + up * r} C${X(i)},${y + up * 44} ${X(j)},${y + up * 44} ${X(j)},${y + up * (r + 2)}" marker-end="url(#lah)"/>`; }
    }
    L.nodes.forEach((n, i) => {
      s += `<g class="node ${cls(L.colors?.[n.id])}"><rect x="${X(i) - r}" y="${y - r}" width="${2 * r}" height="${2 * r}" rx="9"/><text x="${X(i)}" y="${y}">${esc(fmt(n.val))}</text></g>`;
    });
    const at = new Map();
    for (const [name, id] of Object.entries(L.pointers || {})) {
      if (id === null || id === undefined || !idx.has(id)) continue;
      if (!at.has(id)) at.set(id, []);
      at.get(id).push(name);
    }
    for (const [id, names] of at) s += `<text class="plabel" x="${X(idx.get(id))}" y="${y + r + 30}">▲ ${esc(names.join(','))}</text>`;
    if (L.nullTail !== false) s += `<text class="sub" x="${X(L.nodes.length) - 18}" y="${y + 4}">null</text>`;
    body.innerHTML = `<svg class="viz" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${s}</svg>`;
  },
};

function heatColor(v, lo, hi, diverge) {
  if (diverge) {
    const m = Math.max(Math.abs(lo), Math.abs(hi)) || 1;
    const t = Math.max(-1, Math.min(1, v / m));
    return t >= 0 ? `rgba(59,108,246,${0.08 + 0.7 * t})` : `rgba(214,69,69,${0.08 + 0.7 * -t})`;
  }
  const t = hi === lo ? 0.5 : (v - lo) / (hi - lo);
  return `rgba(59,108,246,${0.06 + 0.78 * t})`;
}

function matrixHTML(L) {
  const flat = L.values.flat().filter((x) => typeof x === 'number' && isFinite(x));
  const lo = Math.min(...flat), hi = Math.max(...flat);
  const head = L.colLabels ? `<tr>${L.rowLabels ? '<th></th>' : ''}${L.colLabels.map((c) => `<th>${esc(c)}</th>`).join('')}</tr>` : '';
  const rows = L.values.map((row, r) => `<tr>${L.rowLabels ? `<th>${esc(L.rowLabels[r])}</th>` : ''}${row.map((v, c) => {
    const k = L.colors?.[`${r},${c}`] ?? L.rowColors?.[r] ?? L.colColors?.[c];
    const isNum = typeof v === 'number' && isFinite(v);
    let style = '';
    if (L.heat && isNum && !k) {
      const bg = heatColor(v, lo, hi, L.heat === 'diverge');
      style = `background:${bg};${(L.heat !== 'diverge' && (v - lo) / ((hi - lo) || 1) > 0.6) ? 'color:#fff;' : ''}`;
    }
    const shown = v === -Infinity ? '-∞' : fmt(v);
    return `<td class="${cls(k)} ${L.heat && !k ? 'heat' : ''}" style="${style}">${esc(shown)}</td>`;
  }).join('')}</tr>`).join('');
  return `<table class="mat">${head}${rows}</table>`;
}

function tensorHTML(L) {
  return `<div class="tensor">${L.name ? `<span class="name">${esc(L.name)}</span>` : ''}<span class="br">[</span>${L.shape.map((d, i) => `<div class="dim ${cls(L.colors?.[i])}"><span class="dn">${esc(L.names?.[i] ?? '')}</span><span class="dv">${esc(d)}</span></div>`).join('')}<span class="br">]</span>${L.note ? `<span class="note">${esc(L.note)}</span>` : ''}</div>`;
}

// Minimal Python syntax highlighter.
const KW = new Set('def return if elif else for while in not and or is None True False class import from as with lambda yield break continue pass try except raise global nonlocal assert del'.split(' '));
const BI = new Set('len range min max sum abs sorted enumerate zip list dict set tuple int float str print self super torch np math heapq collections deque defaultdict Counter isinstance any all reversed map filter'.split(' '));
export function highlightPy(line) {
  let out = '', i = 0;
  while (i < line.length) {
    const ch = line[i];
    if (ch === '#') { out += `<span class="cm">${esc(line.slice(i))}</span>`; break; }
    if (ch === '"' || ch === "'") {
      let j = i + 1; while (j < line.length && line[j] !== ch) j++;
      out += `<span class="str">${esc(line.slice(i, j + 1))}</span>`; i = j + 1; continue;
    }
    if (/[0-9]/.test(ch) && !/[A-Za-z_]/.test(line[i - 1] || '')) {
      let j = i; while (j < line.length && /[0-9.e]/.test(line[j])) j++;
      out += `<span class="num">${esc(line.slice(i, j))}</span>`; i = j; continue;
    }
    if (/[A-Za-z_]/.test(ch)) {
      let j = i; while (j < line.length && /[A-Za-z0-9_]/.test(line[j])) j++;
      const w = line.slice(i, j);
      if (KW.has(w)) out += `<span class="kw">${w}</span>`;
      else if (BI.has(w)) out += `<span class="bi">${w}</span>`;
      else if (line[j] === '(') out += `<span class="fn">${w}</span>`;
      else out += esc(w);
      i = j; continue;
    }
    out += esc(ch); i++;
  }
  return out || ' ';
}
