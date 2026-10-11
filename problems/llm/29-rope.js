import { recorder, randMatrix, round, roundM } from '../../js/util.js';

const code = `import torch
import math

def rope(x, base=10000):
    T, d = x.shape                      # d 为偶数
    out = torch.zeros_like(x)
    for pos in range(T):
        for i in range(0, d, 2):
            theta = pos * base ** (-i / d)
            c, s = math.cos(theta), math.sin(theta)
            a, b = x[pos, i], x[pos, i + 1]
            out[pos, i]     = a * c - b * s
            out[pos, i + 1] = a * s + b * c
    return out`;

export default {
  id: 'llm-29', track: 'llm', num: 29, title: 'RoPE 旋转位置编码', category: '位置编码',
  code,
  oneLine: '把每对维度当复数旋转 pos·θ，q·k 自动只含相对位置',
  summary: 'RoPE：不加位置向量，而是对 Q、K 的每对维度做旋转，转角随位置线性增长。点积自动只依赖相对距离 m−n。',
  ideas: [
    '把 (x₀, x₁) 看成一个二维向量（复数），按角度 <code>θ = pos · base^(−2i/d)</code> 旋转；不同维度对转速不同。',
    '关键性质：旋转后的点积 <code>R(m)·R(n)ᵀ</code> 只取决于 <b>m − n</b> 和原始向量——绝对位置消失，相对位置自然进入注意力分数。',
    '对比 sinusoidal：RoPE 是<b>乘性</b>地作用在 Q、K 上，不改数值范围，外推与相对位置建模都更好（LLaMA 全家在用）。',
  ],
  complexity: '时间 O(T·d)，无参数',
  presets: [
    { name: 'T=4, d=4', input: { T: 4, d: 4, seed: 3 } },
    { name: 'T=5, d=6', input: { T: 5, d: 6, seed: 8 } },
  ],
  validate(inp) {
    if (!Number.isInteger(inp.T) || inp.T < 2 || inp.T > 6) return 'T 取 2~6';
    if (!Number.isInteger(inp.d) || inp.d < 2 || inp.d > 8 || inp.d % 2) return 'd 取 2~8 的偶数';
    return null;
  },
  run({ T, d, seed = 1 }) {
    const rec = recorder();
    const x = randMatrix(T, d, seed);
    const rot = (pos) => {
      const r = Array(d).fill(0);
      for (let i = 0; i < d; i += 2) {
        const th = pos * Math.pow(10000, -i / d);
        const c = Math.cos(th), s = Math.sin(th);
        r[i] = x[pos][i] * c - x[pos][i + 1] * s;
        r[i + 1] = x[pos][i] * s + x[pos][i + 1] * c;
      }
      return r;
    };
    const out = Array.from({ length: T }, (_, p) => rot(p));
    const O = Array.from({ length: T }, () => Array(d).fill(''));
    const rl = Array.from({ length: T }, (_, i) => `pos${i}`);
    const dl = Array.from({ length: d }, (_, j) => `d${j}`);
    const xMat = (rc) => ({ type: 'matrix', id: 'x', label: '输入 x（Q 或 K 的行）', values: roundM(x), rowLabels: rl, colLabels: dl, heat: 'diverge', rowColors: rc });
    const oMat = (colors) => ({ type: 'matrix', id: 'o', label: '旋转后 out', values: O.map((r) => r.map((v) => (typeof v === 'number' ? round(v) : v))), rowLabels: rl, colLabels: dl, heat: 'diverge', colors });
    rec.step(4, `输入 [${T}, ${d}]：每行是某位置上 q 或 k 的向量。RoPE 把每对 (d2i, d2i+1) 当二维向量旋转 pos·θ。`, [{ type: 'tensor', id: 'sh', name: 'x', shape: [T, d], names: ['T 位置', 'd 维度'] }, xMat()]);
    for (let pos = 0; pos < T; pos++) {
      for (let i = 0; i < d; i += 2) {
        const th = pos * Math.pow(10000, -i / d);
        rec.step([8, 10], `pos=${pos}，维度对 (d${i}, d${i + 1})：<code>θ = ${pos} × 10000^(−${i}/${d}) = ${round(th, 4)}</code> rad ≈ ${round((th * 180) / Math.PI, 1)}°${pos === 0 ? '（pos=0 不旋转）' : ''}。`,
          [xMat({ [pos]: 'cur' }), { type: 'vars', id: 'v', items: { pos, 维度对: `(d${i},d${i + 1})`, 'θ(rad)': round(th, 4), cosθ: round(Math.cos(th), 3), sinθ: round(Math.sin(th), 3) } }]);
      }
      O[pos] = out[pos];
      rec.step([11, 13], `pos=${pos} 整行旋转完：<code>[${x[pos].map((v) => round(v, 2)).join(', ')}]</code> → <code>[${out[pos].map((v) => round(v, 2)).join(', ')}]</code>。`,
        [xMat({ [pos]: 'ok' }), oMat({ [`${pos},0`]: 'ok', ...Object.fromEntries(dl.map((_, j) => [`${pos},${j}`, 'ok'])) })]);
    }
    // relative property demo
    const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
    const p1 = 1, p2 = Math.min(3, T - 1);
    const d1 = dot(out[p1], out[p2]);
    // choose two positions with same gap for the second pair: need p2-p1 = q2-q1
    const gap = p2 - p1;
    const q1 = Math.min(T - 1 - gap, p1 + (T - 1 - gap > p1 ? 1 : -1));
    const q2 = q1 + gap;
    const d2 = dot(out[q1], out[q2]);
    rec.step(14, `验证相对性：<code>RoPE(x${p1}) · RoPE(x${p2}) = ${round(d1, 4)}</code>；另一对相同间隔的位置 (${q1},${q2}) 得 <code>${round(d2, 4)}</code>。若 x 各行相同则完全相等——实际中点积只由间隔 ${gap} 和原向量决定，绝对位置已被「旋转差」消掉。`,
      [oMat({ [`${p1},0`]: 'cur', [`${p2},0`]: 'cmp', [`${q1},0`]: 'hl', [`${q2},0`]: 'hl' })]);
    return { steps: rec.steps, result: roundM(out, 4) };
  },
  solve({ T, d, seed = 1 }) {
    // independent: complex multiplication form
    const x = randMatrix(T, d, seed);
    return roundM(x.map((row, pos) => {
      const r = Array(d).fill(0);
      for (let i = 0; i < d; i += 2) {
        const th = pos * Math.exp((-i * Math.log(10000)) / d);
        const zr = row[i], zi = row[i + 1];
        const c = Math.cos(th), s = Math.sin(th);
        // (zr + i·zi) * e^{iθ}
        r[i] = zr * c - zi * s;
        r[i + 1] = zr * s + zi * c;
      }
      return r;
    }), 4);
  },
  pyArgs({ T, d, seed = 1 }) {
    return [randMatrix(T, d, seed)];
  },
};
