import { recorder, randMatrix, round, roundM, softmax } from '../../js/util.js';

const code = `import torch

def causal_attention(scores):
    T = scores.size(-1)
    mask = torch.tril(torch.ones(T, T))       # 下三角 = 1
    scores = scores.masked_fill(mask == 0,
                                float('-inf'))
    return torch.softmax(scores, dim=-1)`;

const TOKENS = ['我', '爱', '大', '模', '型', '！'];

export default {
  id: 'llm-12', track: 'llm', num: 12, title: 'Causal Mask', category: 'Attention',
  code,
  oneLine: '上三角填 −∞，让每个 token 只能看自己和过去',
  summary: '解码器自注意力的因果掩码：位置 i 只能 attend 到 ≤ i 的位置，保证自回归生成时不偷看未来。',
  ideas: [
    '<code>torch.tril(ones)</code> 生成<b>下三角</b>矩阵：行 i 中 j ≤ i 的位置为 1。',
    '<code>masked_fill(mask == 0, −inf)</code> 把未来位置的分数填成 −∞。',
    'softmax 后 e^(−∞) = 0，被 mask 的位置权重恒为 0——等价于完全看不见。',
  ],
  complexity: '时间 O(T²)，空间 O(T²)',
  presets: [
    { name: 'T=4', input: { T: 4, seed: 2 } },
    { name: 'T=5', input: { T: 5, seed: 6 } },
  ],
  validate(inp) {
    if (!Number.isInteger(inp.T) || inp.T < 2 || inp.T > 6) return 'T 取 2~6';
    return null;
  },
  run({ T, seed = 1 }) {
    const rec = recorder();
    const scores = randMatrix(T, T, seed, 2);
    const tk = TOKENS.slice(0, T);
    const mask = Array.from({ length: T }, (_, i) => Array.from({ length: T }, (_, j) => (j <= i ? 1 : 0)));
    const masked = scores.map((r, i) => r.map((v, j) => (j <= i ? v : -Infinity)));
    const attn = masked.map((r) => softmax(r.map((v) => (v === -Infinity ? -1e30 : v))));
    const M = Array.from({ length: T }, () => Array(T).fill(''));
    const W = Array.from({ length: T }, () => Array(T).fill(''));
    const sMat = (values, label, colors) => ({ type: 'matrix', id: 's', label, values: values.map((r) => r.map((v) => (typeof v === 'number' ? round(v) : v))), rowLabels: tk, colLabels: tk, heat: 'diverge', colors });
    const maskBuilt = Array.from({ length: T }, () => Array(T).fill(''));
    const maskMat = () => ({ type: 'matrix', id: 'mk', label: 'mask = tril(1)（下三角可见）', values: maskBuilt.map((r) => r.map((v) => (typeof v === 'number' ? v : v))), rowLabels: tk, colLabels: tk, colors: Object.fromEntries(maskBuilt.flatMap((r, i) => r.map((v, j) => v === 1 ? [`${i},${j}`, 'ok'] : v === 0 ? [`${i},${j}`, 'bad'] : []))) });
    rec.step(4, `输入已算好的 scores [${T}, ${T}]（QKᵀ/√d 的结果）。行 = 当前 token，列 = 它 attend 的位置。`, [sMat(scores, 'scores = QKᵀ/√d（未 mask）')]);
    for (let i = 0; i < T; i++) {
      for (let j = 0; j <= i; j++) maskBuilt[i][j] = 1;
      for (let j = i + 1; j < T; j++) maskBuilt[i][j] = 0;
      rec.step(5, `第 ${i + 1} 行（token「${tk[i]}」）：tril 保留 <code>j ≤ ${i}</code> 的位置为 1，右边全 0。`, [maskMat(), sMat(scores, 'scores')]);
    }
    for (let i = 0; i < T; i++) for (let j = 0; j < T; j++) M[i][j] = masked[i][j];
    rec.step([6, 7], `<code>masked_fill(mask == 0, −inf)</code>：所有上三角位置变成 <code>−∞</code>。这些位置等会儿 softmax 出来就是 0。`, [sMat(masked, 'masked scores（红 = −∞）', Object.fromEntries(Array.from({ length: T }, (_, i) => Array.from({ length: T }, (_, j) => (j > i ? [`${i},${j}`, 'bad'] : null))).flat().filter(Boolean)))]);
    for (let i = 0; i < T; i++) {
      for (let j = 0; j < T; j++) W[i][j] = attn[i][j];
      const colors = {}; for (let j = 0; j <= i; j++) colors[`${i},${j}`] = 'cur';
      rec.step(8, `对第 ${i + 1} 行 softmax：「${tk[i]}」只能分配权重给 ${tk.slice(0, i + 1).join('、')}（和为 1），后面全是 0。`,
        [{ type: 'matrix', id: 'w', label: 'attn = softmax(masked scores)（每行和为 1）', values: W.map((r) => r.map((v) => (typeof v === 'number' ? round(v) : v))), rowLabels: tk, colLabels: tk, heat: true, colors }]);
    }
    rec.step(8, '完成。这个下三角权重矩阵保证：token i 的输出只依赖 ≤ i 的 token——自回归训练/推理的因果性就是这么实现的。', [{ type: 'matrix', id: 'w', label: 'attn', values: roundM(attn), rowLabels: tk, colLabels: tk, heat: true }]);
    return { steps: rec.steps, result: roundM(attn, 4) };
  },
  solve({ T, seed = 1 }) {
    // independent: zero out future then normalize
    const scores = randMatrix(T, T, seed, 2);
    return roundM(scores.map((r, i) => {
      const vis = r.slice(0, i + 1);
      const m = Math.max(...vis);
      const e = vis.map((v) => Math.exp(v - m));
      const s = e.reduce((a, b) => a + b, 0);
      return e.map((v) => v / s).concat(Array(T - i - 1).fill(0));
    }), 4);
  },
  pyArgs({ T, seed = 1 }) {
    return [randMatrix(T, T, seed, 2)];
  },
};
