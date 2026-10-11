import { recorder, randMatrix, round, roundM } from '../../js/util.js';

const code = `import torch

def rms_norm(x, weight, eps=1e-6):
    ms = x.pow(2).mean(dim=-1, keepdim=True)
    rms = torch.sqrt(ms + eps)
    return x / rms * weight`;

export default {
  id: 'llm-9', track: 'llm', num: 9, title: 'RMSNorm', category: '基础算子',
  code,
  oneLine: '不减均值，直接除以均方根：更简单更快',
  summary: '实现 RMSNorm（LLaMA 等现代模型用的归一化）：只对每行做缩放，不做中心化。',
  ideas: [
    'RMSNorm = LayerNorm <b>去掉减均值那一步</b>：<code>rms = √(mean(x²))</code>，然后 x/rms × weight。',
    '省掉均值计算意味着少一次减法、少维护一个统计量，实测更快，效果与 LayerNorm 相当。',
    '对比记忆：LayerNorm 是「先中心化再标准化 + γβ」，RMSNorm 是「只按均方根缩放 + weight」（通常没有 β 偏置）。',
  ],
  complexity: '时间 O(T·d)，空间 O(1)',
  presets: [
    { name: 'T=3, d=4', input: { T: 3, d: 4, seed: 4 } },
    { name: 'T=4, d=4', input: { T: 4, d: 4, seed: 9 } },
  ],
  validate(inp) {
    if (!Number.isInteger(inp.T) || inp.T < 2 || inp.T > 6) return 'T 取 2~6';
    if (!Number.isInteger(inp.d) || inp.d < 2 || inp.d > 6) return 'd 取 2~6';
    return null;
  },
  run({ T, d, seed = 1 }) {
    const rec = recorder();
    const x = randMatrix(T, d, seed);
    const w = randMatrix(1, d, seed + 3, 0.5)[0].map((v) => round(1 + v, 2));
    const dl = Array.from({ length: d }, (_, j) => `d${j}`);
    const rl = Array.from({ length: T }, (_, i) => `t${i}`);
    const eps = 1e-6;
    const rms = x.map((r) => Math.sqrt(r.reduce((a, v) => a + v * v, 0) / d + eps));
    const out = x.map((r, i) => r.map((v, j) => (v / rms[i]) * w[j]));
    const O = Array.from({ length: T }, () => Array(d).fill(''));
    const xMat = (colors) => ({ type: 'matrix', id: 'x', label: '输入 x [T, d]', values: roundM(x), rowLabels: rl, colLabels: dl, heat: 'diverge', colors });
    const oMat = (colors) => ({ type: 'matrix', id: 'o', label: '输出 = x / rms × weight', values: O.map((r) => r.map((v) => (typeof v === 'number' ? round(v) : v))), rowLabels: rl, colLabels: dl, heat: 'diverge', colors });
    rec.step(4, `输入 [${T}, ${d}]，weight = [${w.join(', ')}]。注意 RMSNorm <b>不减均值</b>——直接算均方根。`,
      [{ type: 'row', id: 'in', items: [xMat(), { label: 'weight γ', values: [w] }] }]);
    for (let i = 0; i < T; i++) {
      rec.step([4, 5], `第 ${i + 1} 行：<code>rms = √(Σx²/${d} + eps) = √(${round(x[i].reduce((a, v) => a + v * v, 0) / d, 4)}) = ${round(rms[i], 3)}</code>。对比 LayerNorm：这里没有 mean 减法。`,
        [xMat(Object.fromEntries(dl.map((_, j) => [`${i},${j}`, 'cur']))), { type: 'vars', id: 'v', items: { [`rms[${i}]`]: round(rms[i], 4) } }]);
      O[i] = out[i];
      rec.step(6, `<code>out[${i}] = x / ${round(rms[i], 3)} × weight</code> = [${out[i].map((v) => round(v, 2)).join(', ')}]。缩放后该行的均方根 ≈ 1，再逐特征乘 weight。`,
        [oMat(Object.fromEntries(dl.map((_, j) => [`${i},${j}`, 'ok'])))]);
    }
    rec.step(6, '完成。每行只做缩放不做平移——少一步中心化，计算更省，这就是 LLaMA 系模型选它的原因。', [oMat()]);
    return { steps: rec.steps, result: roundM(out, 4) };
  },
  solve({ T, d, seed = 1 }) {
    const x = randMatrix(T, d, seed);
    const w = randMatrix(1, d, seed + 3, 0.5)[0].map((v) => round(1 + v, 2));
    return roundM(x.map((r) => {
      let s = 0;
      for (const v of r) s += v * v;
      const rms = Math.sqrt(s / d + 1e-6);
      return r.map((v, j) => (v / rms) * w[j]);
    }), 4);
  },
};
