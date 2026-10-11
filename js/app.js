import { problems } from '../problems/index.js';
import { renderScene, highlightPy } from './render.js';
import { PLAN } from './plan.js';

const $ = (s, r = document) => r.querySelector(s);
const main = $('#main'), sidebar = $('#sidebar');
const TRACK_NAME = { algo: '算法', llm: '大模型' };
const byId = new Map(problems.map((p) => [p.id, p]));
let track = localStorage.getItem('track') || 'algo';
let player = null;
let initStep = 0;

function planFor(t) { return PLAN[t].map((x) => ({ ...x, p: byId.get(x.id) })); }

function renderSidebar(activeId) {
  const items = planFor(track);
  const cats = [];
  for (const it of items) { if (!cats.includes(it.category)) cats.push(it.category); }
  sidebar.innerHTML = cats.map((c) => `<div class="cat">${c}</div>${items.filter((it) => it.category === c).map((it) =>
    `<a class="item ${it.id === activeId ? 'on' : ''} ${it.p ? '' : 'todo'}" href="#/p/${it.id}"><span class="num">${it.num ?? ''}</span><span>${it.title}</span></a>`).join('')}`).join('');
  document.querySelectorAll('#trackTabs button').forEach((b) => b.classList.toggle('on', b.dataset.track === track));
}

function home() {
  const sec = (t) => `<h2>${TRACK_NAME[t]} · ${PLAN[t].length} 题 <span style="font-size:13px;color:var(--muted);font-weight:400">已完成 ${planFor(t).filter((x) => x.p).length}</span></h2>
    <div class="cards">${planFor(t).map((it) => `<a class="card ${it.p ? '' : 'todo'}" href="#/p/${it.id}">
      <div class="meta"><span>${it.num ? (t === 'algo' ? `LC ${it.num}` : `#${it.num}`) : ''}</span><span>${it.category}</span></div>
      <div class="t">${it.title}</div><div class="s">${it.p ? it.p.oneLine || '' : '制作中'}</div></a>`).join('')}</div>`;
  main.innerHTML = `<div class="home"><h1>面试题动画讲解</h1>
    <p class="lead">每道题都能逐步播放：左边看数据怎么变，右边看对应的 Python 代码执行到哪一行，下面是这一步的中文解释。可以换输入，看不同例子下的过程。</p>
    ${sec('algo')}${sec('llm')}</div>`;
}

function page(p) {
  const presetOpts = p.presets.map((x, i) => `<option value="${i}">${x.name}</option>`).join('');
  const meta = p.track === 'algo'
    ? `<span class="tag lc">LeetCode ${p.num}</span>${p.difficulty ? `<span class="tag">${p.difficulty}</span>` : ''}<span class="tag">${p.category}</span>`
    : `<span class="tag">${p.category}</span>`;
  const link = p.slug ? ` · <a href="https://leetcode.cn/problems/${p.slug}/" target="_blank" rel="noopener" style="color:var(--accent)">去力扣做题 ↗</a>` : '';
  main.innerHTML = `
    <div class="ph"><h1>${p.title}</h1>${meta}</div>
    <div class="summary">${p.summary}${link}</div>
    ${p.ideas ? `<ol class="ideas">${p.ideas.map((x) => `<li>${x}</li>`).join('')}</ol>` : ''}
    <div class="input-row">
      <span>输入</span><select id="preset">${presetOpts}</select>
      <input id="custom" spellcheck="false" autocapitalize="off" autocomplete="off">
      <button id="runBtn">运行</button><div class="err" id="err"></div>
    </div>
    <div class="stage-wrap">
      <div class="panel"><div class="stage" id="stage"></div><div class="narr" id="narr"></div></div>
      <div><div class="code" id="code"></div>${p.complexity ? `<div class="complex">复杂度：${p.complexity}</div>` : ''}</div>
    </div>
    <div class="controls">
      <button id="first" title="回到开头">⏮</button><button id="prev" title="上一步 (←)">◀</button>
      <button id="play" class="play" title="播放/暂停 (空格)">▶</button><button id="next" title="下一步 (→)">▶︎|</button>
      <input type="range" id="scrub" min="0" value="0">
      <span class="cnt" id="cnt"></span>
      <select id="speed" title="速度"><option value="1800">0.5×</option><option value="1100" selected>1×</option><option value="600">2×</option><option value="300">4×</option></select>
    </div>`;
  $('#code').innerHTML = p.code.split('\n').map((l, i) => `<div class="ln" data-l="${i + 1}"><span class="no">${i + 1}</span><span>${highlightPy(l)}</span></div>`).join('');
  const custom = $('#custom');
  const load = (input) => {
    let out;
    try { out = p.run(JSON.parse(JSON.stringify(input))); $('#err').textContent = ''; }
    catch (e) { $('#err').textContent = `输入有误：${e.message}`; return; }
    $('#stage').innerHTML = '';
    startPlayer(out.steps);
  };
  const usePreset = (i) => { custom.value = JSON.stringify(p.presets[i].input); load(p.presets[i].input); };
  $('#preset').onchange = (e) => usePreset(+e.target.value);
  $('#runBtn').onclick = () => {
    let v;
    try { v = JSON.parse(custom.value); } catch { $('#err').textContent = '请输入合法的 JSON，例如 {"height":[0,1,0,2]}'; return; }
    if (p.validate) { const msg = p.validate(v); if (msg) { $('#err').textContent = msg; return; } }
    load(v);
  };
  usePreset(0);
}

function startPlayer(steps) {
  player?.stop();
  let i = 0, timer = null;
  const scrub = $('#scrub'); scrub.max = steps.length - 1;
  const show = () => {
    const s = steps[i];
    renderScene($('#stage'), s.scene || []);
    $('#narr').innerHTML = `<span class="k">${i + 1}/${steps.length}</span>${s.text}`;
    const lines = s.line == null ? [] : Array.isArray(s.line) ? range(s.line[0], s.line[1] ?? s.line[0]) : [s.line];
    document.querySelectorAll('#code .ln').forEach((el) => el.classList.toggle('on', lines.includes(+el.dataset.l)));
    const on = document.querySelector('#code .ln.on');
    if (on) { const box = $('#code'); const top = on.offsetTop - box.clientHeight / 2; if (box.scrollHeight > box.clientHeight) box.scrollTo({ top, behavior: 'smooth' }); }
    scrub.value = i; $('#cnt').textContent = `${i + 1} / ${steps.length}`;
  };
  const go = (k) => { i = Math.max(0, Math.min(steps.length - 1, k)); show(); };
  const stop = () => { clearInterval(timer); timer = null; $('#play').textContent = '▶'; };
  const play = () => {
    if (i >= steps.length - 1) go(0);
    $('#play').textContent = '⏸';
    timer = setInterval(() => { if (i >= steps.length - 1) stop(); else go(i + 1); }, +$('#speed').value);
  };
  $('#play').onclick = () => (timer ? stop() : play());
  $('#next').onclick = () => { stop(); go(i + 1); };
  $('#prev').onclick = () => { stop(); go(i - 1); };
  $('#first').onclick = () => { stop(); go(0); };
  scrub.oninput = () => { stop(); go(+scrub.value); };
  $('#speed').onchange = () => { if (timer) { stop(); play(); } };
  if (initStep) { i = Math.min(initStep, steps.length - 1); initStep = 0; }
  player = { stop, next: () => $('#next').click(), prev: () => $('#prev').click(), toggle: () => $('#play').click() };
  show();
}
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, k) => a + k);

document.addEventListener('keydown', (e) => {
  if (!player || /INPUT|SELECT|TEXTAREA/.test(document.activeElement?.tagName)) return;
  if (e.key === 'ArrowRight') player.next();
  else if (e.key === 'ArrowLeft') player.prev();
  else if (e.key === ' ') { e.preventDefault(); player.toggle(); }
});

function route() {
  document.body.classList.remove('nav-open');
  const m = location.hash.match(/^#\/p\/([^?]+)(?:\?step=(\d+))?$/);
  initStep = m && m[2] ? +m[2] - 1 : 0;
  const p = m && byId.get(decodeURIComponent(m[1]));
  if (p) { track = p.track; localStorage.setItem('track', track); renderSidebar(p.id); page(p); }
  else { player?.stop(); player = null; renderSidebar(null); home(); }
  window.scrollTo(0, 0);
}
document.querySelectorAll('#trackTabs button').forEach((b) => (b.onclick = () => { track = b.dataset.track; localStorage.setItem('track', track); renderSidebar(null); if (!location.hash.startsWith('#/p/')) home(); else document.body.classList.add('nav-open'); }));
$('#menuBtn').onclick = () => document.body.classList.toggle('nav-open');
$('#scrim').onclick = () => document.body.classList.remove('nav-open');
window.addEventListener('hashchange', route);
route();
