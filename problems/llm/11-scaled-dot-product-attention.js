import { recorder, randMatrix, round, roundM } from '../../js/util.js';

const code = `import math
import torch

def attention(Q, K, V, mask=None):
    d_k = Q.size(-1)
    scores = Q @ K.transpose(-2, -1) / d_k ** 0.5
    if mask is not None:
        scores = scores.masked_fill(mask == 0,
                                      float('-inf'))
    weights = torch.softmax(scores, dim=-1)
    return weights @ V`;

const TOKENS = ['我', '爱', '大', '模', '型', '！'];

function compute(T, d, seed, causal) {
  const Q = randMatrix(T, d, seed), K = randMatrix(T, d, seed + 7), V = randMatrix(T, d, seed + 13);
  const scale = Math.sqrt(d);
  const raw = Q.map((q) => K.map((k) => q.reduce((s, x, j) => s + x * k[j], 0)));
  const scores = raw.map((r) => r.map((x) => x / scale));
  const masked = scores.map((r, i) => r.map((x, j) => (causal && j > i ? -Infinity : x)));
  const weights = masked.map((r) => { const m = Math.max(...r); const e = r.map((x) => Math.exp(x - m)); const s = e.reduce((a, b) => a + b, 0); return e.map((x) => x / s); });
  const out = weights.map((w) => V[0].map((_, j) => w.reduce((s, x, k) => s + x * V[k][j], 0)));
  return { Q, K, V, scale, scores, masked, weights, out };
}

export default {
  id: 'llm-11', track: 'llm', num: 11, title: 'Scaled Dot-Product Attention', category: 'Attention',
  code,
  oneLine: 'softmax(QKᵀ/√d)·V，逐行看懂',
  summary: '实现缩放点积注意力：输入 Q、K、V（形状 [T, d]），输出每个位置对所有位置加权求和后的结果。这是 MHA、GQA、FlashAttention 等所有注意力变体的基础。',
  ideas: [
    '<b>打分</b>：第 i 行 Q 和每一行 K 做点积，得到第 i 个 token 对每个 token 的相关度。',
    '<b>缩放</b>：除以 √d_k。d 越大点积方差越大，softmax 越容易饱和、梯度越小。',
    '<b>归一化</b>：按行做 softmax（dim=-1），每行权重和为 1。有 mask 时先把不允许看的位置填 −∞。',
    '<b>加权求和</b>：权重乘 V，输出第 i 行 = Σ_j w_ij · V_j。',
  ],
  complexity: '时间 O(T²·d)，空间 O(T²)（存了完整的 scores 矩阵，这正是 FlashAttention 要优化的地方）',
  presets: [
    { name: 'T=3, d=4', input: { T: 3, d: 4, seed: 3, causal: false } },
    { name: 'T=4, d=4，带因果 mask', input: { T: 4, d: 4, seed: 5, causal: true } },
  ],
  validate(inp) {
    if (!Number.isInteger(inp.T) || inp.T < 2 || inp.T > 6) return 'T 取 2~6';
    if (!Number.isInteger(inp.d) || inp.d < 2 || inp.d > 6) return 'd 取 2~6';
    return null;
  },
  run({ T, d, seed = 1, causal = false }) {
    const rec = recorder();
    const { Q, K, V, scale, scores, masked, weights, out } = compute(T, d, seed, causal);
    const tk = TOKENS.slice(0, T);
    const dl = Array.from({ length: d }, (_, j) => `d${j}`);
    const M = (id, label, values, extra = {}) => ({ id, label, values: roundM(values), rowLabels: tk, colLabels: extra.colLabels ?? dl, heat: 'diverge', ...extra });
    const S = Array.from({ length: T }, () => Array(T).fill(''));
    const W = Array.from({ length: T }, () => Array(T).fill(''));
    const O = Array.from({ length: T }, () => Array(d).fill(''));
    const inputs = (hl = {}) => ({ type: 'row', id: 'qkv', items: [
      { ...M('Q', 'Q（查询）', Q), rowColors: hl.q },
      { ...M('K', 'K（键）', K), rowColors: hl.k },
      { ...M('V', 'V（值）', V), rowColors: hl.v },
    ] });
    const sMat = (colors) => ({ type: 'matrix', id: 'S', label: causal ? 'scores = QKᵀ/√d（上三角被 mask）' : 'scores = QKᵀ / √d', values: S.map((r) => r.map((x) => (typeof x === 'number' ? round(x) : x))), rowLabels: tk, colLabels: tk, heat: 'diverge', colors });
    const wMat = (colors) => ({ type: 'matrix', id: 'W', label: 'weights = softmax(scores, dim=-1)', values: W.map((r) => r.map((x) => (typeof x === 'number' ? round(x) : x))), rowLabels: tk, colLabels: tk, heat: true, colors });
    const oMat = (colors) => ({ type: 'matrix', id: 'O', label: '输出 = weights @ V', values: O.map((r) => r.map((x) => (typeof x === 'number' ? round(x) : x))), rowLabels: tk, colLabels: dl, heat: 'diverge', colors });
    const shape = { type: 'tensor', id: 'shape', name: 'Q / K / V', shape: [T, d], names: ['T 序列长度', 'd 维度'], note: '真实模型里还会多出 batch 和 head 两个维度' };

    rec.step(4, `输入 ${T} 个 token，每个 token 有 Q、K、V 三个 ${d} 维向量。下面按行看注意力是怎么算的。`, [shape, inputs()]);
    rec.step(5, `<code>d_k = ${d}</code>，缩放因子 <code>√d_k = ${round(scale, 3)}</code>。`, [inputs(), sMat()]);
    for (let i = 0; i < T; i++) {
      for (let j = 0; j < T; j++) S[i][j] = scores[i][j];
      const colors = {}; for (let j = 0; j < T; j++) colors[`${i},${j}`] = 'cur';
      const dots = K.map((k, j) => `${tk[j]}: ${round(scores[i][j] * scale)}`).join('，');
      rec.step(6, `第 ${i + 1} 行：<code>Q[${tk[i]}]</code> 依次和每一行 K 做点积（${dots}），再除以 ${round(scale, 2)}。`, [inputs({ q: { [i]: 'cur' }, k: Object.fromEntries(tk.map((_, j) => [j, 'cmp'])) }), sMat(colors)]);
    }
    if (causal) {
      for (let i = 0; i < T; i++) for (let j = 0; j < T; j++) S[i][j] = masked[i][j];
      const colors = {}; for (let i = 0; i < T; i++) for (let j = i + 1; j < T; j++) colors[`${i},${j}`] = 'bad';
      rec.step([8, 9], '因果 mask：token i 只能看到自己和前面的 token，所以把 j > i 的位置填成 <code>-inf</code>，softmax 之后这些位置的权重就是 0。', [sMat(colors)]);
    }
    for (let i = 0; i < T; i++) {
      for (let j = 0; j < T; j++) W[i][j] = weights[i][j];
      const colors = {}; for (let j = 0; j < T; j++) colors[`${i},${j}`] = 'cur';
      rec.step(10, `对第 ${i + 1} 行做 softmax（先减掉这一行的最大值，防止 exp 溢出）。得到 ${tk[i]} 分给各 token 的注意力：${weights[i].map((w, j) => `${tk[j]} ${round(w)}`).join('，')}，加起来等于 1。`, [sMat({ ...Object.fromEntries(tk.map((_, j) => [`${i},${j}`, 'cmp'])) }), wMat(colors)]);
    }
    for (let i = 0; i < T; i++) {
      for (let j = 0; j < d; j++) O[i][j] = out[i][j];
      const colors = {}; for (let j = 0; j < d; j++) colors[`${i},${j}`] = 'ok';
      const top = weights[i].indexOf(Math.max(...weights[i]));
      rec.step(11, `输出第 ${i + 1} 行 = Σ_j weights[${tk[i]}, j] · V[j]。权重最大的是 ${tk[top]}（${round(weights[i][top])}），所以这一行的结果最接近 V[${tk[top]}]。`, [wMat(Object.fromEntries(tk.map((_, j) => [`${i},${j}`, 'cmp']))), { type: 'row', id: 'vo', items: [{ ...M('V2', 'V', V), rowColors: { [top]: 'hl' } }, { op: '→' }, { ...oMat(colors), label: '输出' }] }]);
    }
    rec.step(11, '完成。每个 token 的输出都是所有 V 的加权平均，权重由它和其他 token 的 Q·K 相似度决定。', [wMat(), { type: 'row', id: 'vo', items: [{ ...M('V2', 'V', V) }, { op: '→' }, { ...oMat(), label: '输出' }] }]);
    return { steps: rec.steps, result: roundM(out, 4) };
  },
  solve({ T, d, seed = 1, causal = false }) {
    // independent: explicit loops with logsumexp
    const Q = randMatrix(T, d, seed), K = randMatrix(T, d, seed + 7), V = randMatrix(T, d, seed + 13);
    const out = [];
    for (let i = 0; i < T; i++) {
      const s = [];
      for (let j = 0; j < T; j++) { let x = 0; for (let k = 0; k < d; k++) x += Q[i][k] * K[j][k]; s.push(causal && j > i ? -Infinity : x / Math.sqrt(d)); }
      const lse = Math.log(s.reduce((a, x) => a + Math.exp(x), 0));
      const w = s.map((x) => Math.exp(x - lse));
      out.push(Array.from({ length: d }, (_, c) => w.reduce((a, x, j) => a + x * V[j][c], 0)));
    }
    return roundM(out, 4);
  },
  pyArgs({ T, d, seed = 1, causal = false }) {
    const mask = causal ? Array.from({ length: T }, (_, i) => Array.from({ length: T }, (_, j) => (j <= i ? 1 : 0))) : null;
    return [randMatrix(T, d, seed), randMatrix(T, d, seed + 7), randMatrix(T, d, seed + 13), mask];
  },
};
