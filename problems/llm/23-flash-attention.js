import { recorder, randMatrix, round, roundM, softmax } from '../../js/util.js';

const code = `import torch
import math

def flash_row(q, K, V, B):
    m, l = float('-inf'), 0.0      # 运行 max / 归一和
    acc = torch.zeros(q.size(-1))
    for s in range(0, K.size(0), B):
        Kb, Vb = K[s:s + B], V[s:s + B]      # 载一块
        sj = q @ Kb.T / math.sqrt(q.size(-1))
        m_new = max(m, sj.max())
        alpha = math.exp(m - m_new)          # 旧量缩放
        beta = torch.exp(sj - m_new)         # 新块权重
        l = l * alpha + beta.sum()
        acc = acc * alpha + beta @ Vb
        m = m_new
    return acc / l`;

export default {
  id: 'llm-23', track: 'llm', num: 23, title: 'FlashAttention 分块计算', category: 'Attention',
  code,
  oneLine: 'online softmax：逐块更新 m、l、acc，不存完整 scores 矩阵',
  summary: 'FlashAttention 的核心思想：把 K、V 分块载入 SRAM，用 online softmax 逐块更新归一化常数和累积输出，避免显式存储 N×N 的注意力矩阵。',
  ideas: [
    '普通注意力要把整个 <code>scores [T,T]</code> 写回显存再读回做 softmax，IO 是瓶颈（attention 是 memory-bound）。',
    '<b>Online softmax</b>：维护 running max m 和 running sum l。新块到来时用 <code>α = e^(m−m_new)</code> 把旧累积量「重新缩放」到新基准，数学上与一次性 softmax 完全等价。',
    '输出累加器 <code>acc</code> 同样先乘 α 再加新块的 β·V；最后 acc/l 就是正确的注意力输出，而 scores 矩阵从未完整存在过。',
  ],
  complexity: '计算量同普通注意力；空间 O(B·d)（不存 scores），IO 大幅降低',
  presets: [
    { name: 'K 分 3 块', input: { T: 6, d: 3, B: 2, seed: 4 } },
    { name: 'K 分 2 块', input: { T: 4, d: 4, B: 2, seed: 9 } },
  ],
  validate(inp) {
    if (!Number.isInteger(inp.T) || inp.T < 2 || inp.T > 8) return 'T 取 2~8';
    if (!Number.isInteger(inp.d) || inp.d < 2 || inp.d > 6) return 'd 取 2~6';
    if (!Number.isInteger(inp.B) || inp.B < 1 || inp.B >= inp.T) return 'B 取 1 ~ T−1';
    return null;
  },
  run({ T, d, B, seed = 1 }) {
    const rec = recorder();
    const q = randMatrix(1, d, seed)[0];
    const K = randMatrix(T, d, seed + 7);
    const V = randMatrix(T, d, seed + 13);
    const scale = Math.sqrt(d);
    const full = K.map((k) => q.reduce((a, x, j) => a + x * k[j], 0) / scale);
    const kl = Array.from({ length: T }, (_, i) => `k${i}`);
    const dl = Array.from({ length: d }, (_, j) => `d${j}`);
    let m = -Infinity, l = 0;
    let acc = Array(d).fill(0);
    const vars = () => ({ type: 'vars', id: 'v', items: { 'm（running max）': m === -Infinity ? '-∞' : round(m, 4), 'l（running sum）': round(l, 4), acc: `[${acc.map((x) => round(x)).join(', ')}]` } });
    const kMat = (hl = {}, lb = 'K') => ({ type: 'matrix', id: 'k', label: lb, values: roundM(K), rowLabels: kl, colLabels: dl, heat: 'diverge', rowColors: hl });
    rec.step(4, `只看<b>一行</b> query q（FlashAttention 对每个 q 行独立处理）：q = [${q.map((x) => round(x)).join(', ')}]。K、V 有 ${T} 行，按块大小 B=${B} 分 ${Math.ceil(T / B)} 块处理。`,
      [{ type: 'array', id: 'q', label: 'q', values: q.map((x) => round(x)), indexLabels: dl }, kMat(), { type: 'matrix', id: 'vm', label: 'V', values: roundM(V), rowLabels: kl, colLabels: dl, heat: 'diverge' }]);
    rec.step(4, `初始化：<code>m = −∞, l = 0, acc = 0</code>。m 和 l 是 online softmax 的归一化状态。`, [vars()]);
    for (let s = 0; s < T; s += B) {
      const e = Math.min(s + B, T);
      const idx = Array.from({ length: e - s }, (_, i) => s + i);
      const sj = idx.map((i) => full[i]);
      const hl = Object.fromEntries(idx.map((i) => [i, 'cur']));
      rec.step([6, 7], `载入第 ${s / B + 1} 块（行 ${s}..${e - 1}）：<code>sj = q·Kbᵀ/√d = [${sj.map((x) => round(x)).join(', ')}]</code>。只这一小块进 SRAM，不看其他行。`,
        [kMat(hl), vars()]);
      const mNew = Math.max(m, ...sj);
      const alpha = Math.exp(m - mNew);
      const beta = sj.map((x) => Math.exp(x - mNew));
      rec.step([8, 9, 10], `新基准 <code>m_new = max(${m === -Infinity ? '-∞' : round(m, 4)}, ${round(Math.max(...sj), 4)}) = ${round(mNew, 4)}</code>。旧累积要「降级」：α = e^(${m === -Infinity ? '−∞' : round(m, 4)} − ${round(mNew, 4)}) = <code>${round(alpha, 4)}</code>；新块权重 β = e^(sj − m_new) = [${beta.map((x) => round(x)).join(', ')}]。`,
        [kMat(hl), vars(), { type: 'array', id: 'b', label: 'β（新块未归一化权重）', values: beta.map((x) => round(x)), indexLabels: idx.map((i) => `k${i}`) }]);
      l = l * alpha + beta.reduce((a, b) => a + b, 0);
      acc = acc.map((a, j) => a * alpha + idx.reduce((s2, i, k) => s2 + beta[k] * V[i][j], 0));
      m = mNew;
      rec.step([11, 12, 13], `更新：<code>l = l·α + Σβ = ${round(l, 4)}</code>，<code>acc = acc·α + β·Vb</code>（旧贡献先按 α 缩放再累加）。`,
        [{ type: 'matrix', id: 'vm2', label: 'Vb（本块）', values: roundM(V.slice(s, e)), rowLabels: idx.map((i) => `k${i}`), colLabels: dl, heat: 'diverge' }, vars()]);
    }
    const out = acc.map((a) => a / l);
    rec.step(14, `最后 <code>out = acc / l</code> = [${out.map((x) => round(x)).join(', ')}]。全程从未拼出完整 scores 行，结果却和一次性 softmax 一模一样。`,
      [vars(), { type: 'array', id: 'o', label: '输出 acc/l', values: out.map((x) => round(x)), indexLabels: dl, colors: out.map(() => 'ok') }]);
    const ref = softmax(full).map((w, i) => w);
    const refOut = dl.map((_, j) => ref.reduce((a, w, i) => a + w * V[i][j], 0));
    rec.step(14, `对照：一次性 softmax 的结果 = [${refOut.map((x) => round(x)).join(', ')}] —— 两者一致（误差 < 1e-6），这就是 online softmax 的正确性。`,
      [{ type: 'array', id: 'o', label: '输出 acc/l', values: out.map((x) => round(x)), indexLabels: dl }, { type: 'array', id: 'o2', label: '一次性 softmax 参考', values: refOut.map((x) => round(x)), indexLabels: dl }]);
    return { steps: rec.steps, result: out.map((x) => round(x, 6)) };
  },
  solve({ T, d, B, seed = 1 }) {
    // independent: full softmax attention for the same q
    const q = randMatrix(1, d, seed)[0];
    const K = randMatrix(T, d, seed + 7);
    const V = randMatrix(T, d, seed + 13);
    const w = softmax(K.map((k) => q.reduce((a, x, j) => a + x * k[j], 0) / Math.sqrt(d)));
    return V[0].map((_, j) => round(w.reduce((a, x, i) => a + x * V[i][j], 0), 6));
  },
  pyArgs({ T, d, B, seed = 1 }) {
    return [randMatrix(1, d, seed)[0], randMatrix(T, d, seed + 7), randMatrix(T, d, seed + 13), B];
  },
};
