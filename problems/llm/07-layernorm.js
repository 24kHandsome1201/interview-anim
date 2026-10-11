import { recorder, randMatrix, round, roundM } from '../../js/util.js';

const code = `import torch

def layer_norm(x, gamma, beta, eps=1e-5):
    mean = x.mean(dim=-1, keepdim=True)
    var = x.var(dim=-1, unbiased=False, keepdim=True)
    x_hat = (x - mean) / torch.sqrt(var + eps)
    return gamma * x_hat + beta`;

export default {
  id: 'llm-7', track: 'llm', num: 7, title: 'LayerNorm', category: '基础算子',
  code,
  oneLine: '对每一行（最后一维）减均值除方差，再乘 γ 加 β',
  summary: '实现 LayerNorm：对输入的每个 token（每一行）独立做归一化，使其均值为 0、方差为 1，再做可学习的仿射变换。',
  ideas: [
    'LayerNorm 沿<b>最后一维（特征维 d）</b>归一化：每一行独立算 mean 和 var，与 batch 大小无关，所以训练和推理行为一致。',
    '<code>x_hat = (x − mean) / √(var + eps)</code>：eps 防止方差为 0 时除零。',
    '<code>γ·x_hat + β</code> 是可学习参数，让模型能恢复任意需要的缩放和平移。',
  ],
  complexity: '时间 O(T·d)，空间 O(1)（除输出）',
  presets: [
    { name: 'T=3, d=4', input: { T: 3, d: 4, seed: 2 } },
    { name: 'T=4, d=5', input: { T: 4, d: 5, seed: 7 } },
  ],
  validate(inp) {
    if (!Number.isInteger(inp.T) || inp.T < 2 || inp.T > 6) return 'T 取 2~6';
    if (!Number.isInteger(inp.d) || inp.d < 2 || inp.d > 6) return 'd 取 2~6';
    return null;
  },
  run({ T, d, seed = 1 }) {
    const rec = recorder();
    const x = randMatrix(T, d, seed);
    const gamma = randMatrix(1, d, seed + 3, 0.5)[0].map((v) => round(1 + v, 2));
    const beta = randMatrix(1, d, seed + 5, 0.5)[0];
    const dl = Array.from({ length: d }, (_, j) => `d${j}`);
    const rl = Array.from({ length: T }, (_, i) => `t${i}`);
    const mean = x.map((r) => r.reduce((a, b) => a + b, 0) / d);
    const varr = x.map((r, i) => r.reduce((a, v) => a + (v - mean[i]) ** 2, 0) / d);
    const xhat = x.map((r, i) => r.map((v) => (v - mean[i]) / Math.sqrt(varr[i] + 1e-5)));
    const out = xhat.map((r) => r.map((v, j) => gamma[j] * v + beta[j]));
    const XH = Array.from({ length: T }, () => Array(d).fill(''));
    const O = Array.from({ length: T }, () => Array(d).fill(''));
    const eps = 1e-5;
    const mats = (i, extraX = {}, extraH = {}, extraO = {}) => [
      { type: 'matrix', id: 'x', label: '输入 x [T, d]（逐行归一化）', values: roundM(x), rowLabels: rl, colLabels: dl, heat: 'diverge', colors: extraX },
      { type: 'matrix', id: 'h', label: 'x_hat = (x − mean)/√(var+eps)', values: XH.map((r) => r.map((v) => (typeof v === 'number' ? round(v) : v))), rowLabels: rl, colLabels: dl, heat: 'diverge', colors: extraH },
      { type: 'matrix', id: 'o', label: '输出 = γ·x_hat + β', values: O.map((r) => r.map((v) => (typeof v === 'number' ? round(v) : v))), rowLabels: rl, colLabels: dl, heat: 'diverge', colors: extraO },
    ];
    const gbRow = () => ({ type: 'row', id: 'gb', items: [
      { label: 'γ', values: [gamma] },
      { label: 'β', values: [beta] },
    ] });
    rec.step(4, `输入 x 形状 [${T}, ${d}]。LayerNorm 对<b>每一行</b>独立归一化：dim=-1 即特征维。`, [{ type: 'tensor', id: 'sh', name: 'x', shape: [T, d], names: ['T tokens', 'd 特征'] }, mats(-1)[0], gbRow()]);
    for (let i = 0; i < T; i++) {
      rec.step(4, `第 ${i + 1} 行：<code>mean = (${x[i].map((v) => round(v, 2)).join(' + ')}) / ${d} = ${round(mean[i], 3)}</code>。`, [
        mats(i, Object.fromEntries(dl.map((_, j) => [`${i},${j}`, 'cur'])))[0],
        { type: 'vars', id: 'v', items: { [`mean[${i}]`]: round(mean[i], 3) } },
      ]);
      rec.step(5, `<code>var = Σ(x − mean)² / ${d} = ${round(varr[i], 4)}</code>（总体方差，unbiased=False）。`, [
        mats(i, Object.fromEntries(dl.map((_, j) => [`${i},${j}`, 'cmp'])))[0],
        { type: 'vars', id: 'v', items: { [`mean[${i}]`]: round(mean[i], 3), [`var[${i}]`]: round(varr[i], 4), '√(var+eps)': round(Math.sqrt(varr[i] + eps), 4) } },
      ]);
      XH[i] = xhat[i];
      rec.step(6, `<code>x_hat[${i}] = (x − ${round(mean[i], 3)}) / ${round(Math.sqrt(varr[i] + eps), 3)}</code> = [${xhat[i].map((v) => round(v, 2)).join(', ')}]。这一行现在均值≈0、方差≈1。`,
        mats(i, {}, Object.fromEntries(dl.map((_, j) => [`${i},${j}`, 'cur']))).slice(0, 2));
      O[i] = out[i];
      rec.step(7, `<code>out[${i}] = γ·x_hat + β</code> = [${out[i].map((v) => round(v, 2)).join(', ')}]。γ、β 逐特征可学，让模型自己决定每个特征该缩放多少。`,
        mats(i, {}, {}, Object.fromEntries(dl.map((_, j) => [`${i},${j}`, 'ok']))).slice(1, 3));
    }
    rec.step(7, `完成。每一行都被归一化后再做仿射变换，输出形状仍是 [${T}, ${d}]。`, mats(-1).slice(2));
    return { steps: rec.steps, result: roundM(out, 4) };
  },
  solve({ T, d, seed = 1 }) {
    // independent: plain loops
    const x = randMatrix(T, d, seed);
    const gamma = randMatrix(1, d, seed + 3, 0.5)[0].map((v) => round(1 + v, 2));
    const beta = randMatrix(1, d, seed + 5, 0.5)[0];
    const out = [];
    for (const r of x) {
      const m = r.reduce((a, b) => a + b) / d;
      let v = 0;
      for (const val of r) v += (val - m) * (val - m);
      v /= d;
      out.push(r.map((val, j) => gamma[j] * ((val - m) / Math.sqrt(v + 1e-5)) + beta[j]));
    }
    return roundM(out, 4);
  },
};
