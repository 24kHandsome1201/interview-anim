// Node smoke tests: every problem builds steps for every preset; final result matches the
// independent reference `solve(input)`; code lines referenced by steps exist; layer types are known.
import { problems } from '../problems/index.js';
import { LAYER_TYPES } from '../js/render.js';

const close = (a, b) => {
  if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) < 1e-6;
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((x, i) => close(x, b[i]));
  if (a && b && typeof a === 'object' && typeof b === 'object') { const ka = Object.keys(a).sort(), kb = Object.keys(b).sort(); return close(ka, kb) && ka.every((k) => close(a[k], b[k])); }
  return JSON.stringify(a) === JSON.stringify(b);
};
let fail = 0;
const ids = new Set();
const required = ['id', 'track', 'title', 'category', 'summary', 'code', 'presets', 'run', 'solve'];
for (const p of problems) {
  const errs = [];
  for (const k of required) if (p[k] === undefined) errs.push(`missing ${k}`);
  if (ids.has(p.id)) errs.push('duplicate id'); ids.add(p.id);
  const nLines = (p.code || '').split('\n').length;
  for (const pre of p.presets || []) {
    let out;
    try { out = p.run(JSON.parse(JSON.stringify(pre.input))); } catch (e) { errs.push(`${pre.name}: run threw ${e.stack}`); continue; }
    if (!out.steps?.length) errs.push(`${pre.name}: no steps`);
    if (out.steps.length > 400) errs.push(`${pre.name}: too many steps (${out.steps.length})`);
    out.steps.forEach((s, i) => {
      const ls = Array.isArray(s.line) ? s.line : [s.line];
      for (const l of ls) if (l != null && (l < 1 || l > nLines)) errs.push(`${pre.name} step ${i}: line ${l} out of range 1..${nLines}`);
      if (!s.text) errs.push(`${pre.name} step ${i}: empty text`);
      for (const L of s.scene || []) if (!LAYER_TYPES.includes(L.type)) errs.push(`${pre.name} step ${i}: unknown layer ${L.type}`);
    });
    const ref = p.solve(JSON.parse(JSON.stringify(pre.input)));
    if (!close(out.result, ref)) errs.push(`${pre.name}: result ${JSON.stringify(out.result)} != reference ${JSON.stringify(ref)}`);
  }
  if (errs.length) { fail++; console.log(`FAIL ${p.id} ${p.title}\n  ${errs.join('\n  ')}`); }
  else console.log(`ok   ${p.id} ${p.title} (${p.presets.length} presets)`);
}
console.log(`\n${problems.length - fail}/${problems.length} problems passed`);
process.exit(fail ? 1 : 0);
