// Export every problem's code + presets + expected results for the Python
// correctness check (tests/py_check.py). Run: node tests/export_cases.mjs
import fs from 'node:fs';
import { problems } from '../problems/index.js';

const out = {};
for (const p of problems) {
  out[p.id] = {
    title: p.title,
    track: p.track,
    code: p.code,
    cases: p.presets.map((pre) => {
      const input = JSON.parse(JSON.stringify(pre.input));
      const expected = p.run(JSON.parse(JSON.stringify(input))).result;
      return {
        name: pre.name,
        input,
        pyArgs: p.pyArgs ? p.pyArgs(JSON.parse(JSON.stringify(input))) : null,
        expected,
      };
    }),
  };
}
fs.writeFileSync(new URL('./cases.json', import.meta.url), JSON.stringify(out, null, 1));
const n = Object.values(out).reduce((a, p) => a + p.cases.length, 0);
console.log(`wrote tests/cases.json: ${Object.keys(out).length} problems, ${n} cases`);
