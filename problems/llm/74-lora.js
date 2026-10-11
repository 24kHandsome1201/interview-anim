import { recorder, randMatrix, round, roundM, matmul, transpose } from '../../js/util.js';

const code = `import torch
import torch.nn as nn

class LoRALinear(nn.Module):
    def __init__(self, W, r, alpha):
        super().__init__()
        self.W = W                   # 冻结的预训练权重 [d_out, d_in]
        self.A = nn.Parameter(torch.randn(r, W.size(1)) * 0.01)
        self.B = nn.Parameter(torch.zeros(W.size(0), r))  # B 初始为 0
        self.s = alpha / r
    def forward(self, x):
        return x @ self.W.T + self.s * (x @ self.A.T @ self.B.T)
    def merge(self):
        return self.W + self.s * self.B @ self.A   # 推理时合并，零额外延迟`;

export default {
  id: 'llm-74', track: 'llm', num: 74, title: 'LoRA Linear', category: '微调',
  code,
  oneLine: '冻结 W，只学低秩 B·A：参数少几十倍，推理可合并回去',
  summary: 'LoRA：不动预训练权重 W，用两个低秩矩阵 A[r,d_in]、B[d_out,r]（r≪d）学增量 ΔW = α/r·BA。',
  ideas: [
    '<b>低秩假设</b>：微调带来的权重变化 ΔW 近似低秩，用 <code>B·A</code>（r×r 瓶颈）表达就够了。',
    '参数对比：d×d 的 W 全量微调 vs <code>r·(d_in + d_out)</code>，r=8、d=4096 时不到 0.4%。',
    'B 初始化为 <b>0</b>（A 随机）：保证训练起点 ΔW = 0，不破坏预训练输出；推理时 <code>W + s·BA</code> 合并成单个矩阵，零额外延迟。',
  ],
  complexity: '训练显存 ~ O(r(d_in+d_out))；合并后推理与原模型相同',
  presets: [
    { name: 'd=4, r=2', input: { d: 4, r: 2, alpha: 4, seed: 3 } },
    { name: 'd=6, r=2', input: { d: 6, r: 2, alpha: 8, seed: 7 } },
  ],
  validate(inp) {
    if (!Number.isInteger(inp.d) || inp.d < 2 || inp.d > 8) return 'd 取 2~8';
    if (!Number.isInteger(inp.r) || inp.r < 1 || inp.r >= inp.d) return 'r 取 1 ~ d−1';
    return null;
  },
  run({ d, r, alpha, seed = 1 }) {
    const rec = recorder();
    const din = d, dout = d;
    const W = randMatrix(dout, din, seed);
    const A = randMatrix(r, din, seed + 1, 0.1);
    const B = Array.from({ length: dout }, () => Array(r).fill(0));
    const Bt = randMatrix(dout, r, seed + 2, 0.3);   // 训练后的 B（演示）
    const x = randMatrix(1, din, seed + 3);
    const s = alpha / r;
    const dl = Array.from({ length: d }, (_, j) => `d${j}`);
    const t = (name, shape, names, note) => ({ type: 'tensor', id: `t-${name}`, name, shape, names, note });
    rec.step([6, 7], `LoRA 包一层 Linear：W [${dout}, ${din}] <b>冻结</b>（梯度不更新），只学两个低秩矩阵 A [${r}, ${din}] 和 B [${dout}, ${r}]。`,
      [t('W 冻结', [dout, din], ['d_out', 'd_in'], `参数量 ${dout * din}`),
       t('A 可学', [r, din], ['r', 'd_in']),
       t('B 可学', [dout, r], ['d_out', 'r']),
       { type: 'vars', id: 'v', items: { '可训参数': `${r * (din + dout)}（原 ${dout * din} 的 ${round((r * (din + dout)) / (dout * din) * 100, 1)}%）` } }]);
    rec.step(9, `初始化：<code>B = 0</code>，A 小随机值。所以初始 ΔW = s·B·A = <b>0</b>——模型行为与原始 W 完全一致，微调从零扰动开始。`,
      [{ type: 'row', id: 'ab', items: [
        { label: `B（初始全 0）`, values: B.map((rr) => rr.map(String)), rowLabels: Array.from({ length: dout }, (_, i) => `o${i}`), colLabels: Array.from({ length: r }, (_, j) => `r${j}`) },
        { op: '×' },
        { label: 'A（随机小值）', values: roundM(A), rowLabels: Array.from({ length: r }, (_, j) => `r${j}`), colLabels: dl, heat: 'diverge' },
        { op: '=' },
        { label: 'ΔW = 0', values: Array.from({ length: dout }, () => Array(din).fill(0)) }] }]);
    const y0 = matmul(x, transpose(W))[0];
    rec.step(11, `前向：<code>y = x·Wᵀ + s·(x·Aᵀ·Bᵀ)</code>。B=0 时第二项为 0，y = x·Wᵀ = [${y0.map((v) => round(v, 2)).join(', ')}]。`,
      [{ type: 'vars', id: 'v', items: { 'y（B=0 时）': `[${y0.map((v) => round(v, 2)).join(', ')}]`, '第二项': '0' } }]);
    const BA = matmul(Bt, A);
    const xA = matmul(x, transpose(A));
    const xAB = matmul(xA, transpose(Bt))[0];
    const y = y0.map((v, j) => v + s * xAB[j]);
    rec.step(11, `训练几步后 B 学到值：ΔW = s·B·A，低秩增量矩阵（秩 ≤ ${r}）。前向时旁路 <code>s·(xAᵀ)Bᵀ</code> 把增量加进输出。`,
      [{ type: 'row', id: 'dw', items: [
        { label: 'B（训练后）', values: roundM(Bt), rowLabels: Array.from({ length: dout }, (_, i) => `o${i}`), colLabels: Array.from({ length: r }, (_, j) => `r${j}`), heat: 'diverge' },
        { op: '×' },
        { label: 'A', values: roundM(A), rowLabels: Array.from({ length: r }, (_, j) => `r${j}`), colLabels: dl, heat: 'diverge' },
        { op: '=' },
        { label: `ΔW = s·BA（s = ${alpha}/${r} = ${s}）`, values: roundM(BA.map((rr) => rr.map((v) => v * s))), rowLabels: Array.from({ length: dout }, (_, i) => `o${i}`), colLabels: dl, heat: 'diverge' }] }]);
    rec.step(11, `<code>y = x·Wᵀ + ${s}·(x·Aᵀ·Bᵀ)</code> = [${y.map((v) => round(v, 2)).join(', ')}]。增量部分 = [${xAB.map((v) => round(v * s, 2)).join(', ')}]。`,
      [{ type: 'vars', id: 'v', items: { 'x·Wᵀ': `[${y0.map((v) => round(v, 2)).join(', ')}]`, 's·xAᵀBᵀ': `[${xAB.map((v) => round(v * s, 2)).join(', ')}]`, y: `[${y.map((v) => round(v, 2)).join(', ')}]` } }]);
    const merged = W.map((rr, i) => rr.map((v, j) => v + s * BA[i][j]));
    rec.step(12, `<code>merge()</code>：推理部署时把 <code>W + s·BA</code> 合成单个矩阵——与原始 Linear 完全相同的前向，<b>零额外延迟</b>。`,
      [{ type: 'matrix', id: 'm', label: '合并后 W′ = W + s·BA', values: roundM(merged), rowLabels: Array.from({ length: dout }, (_, i) => `o${i}`), colLabels: dl, heat: 'diverge' }]);
    return { steps: rec.steps, result: roundM([y], 4)[0] };
  },
  solve({ d, r, alpha, seed = 1 }) {
    const W = randMatrix(d, d, seed);
    const A = randMatrix(r, d, seed + 1, 0.1);
    const Bt = randMatrix(d, r, seed + 2, 0.3);
    const x = randMatrix(1, d, seed + 3)[0];
    const s = alpha / r;
    // merged W then single forward — independent route
    const merged = W.map((rr, i) => rr.map((v, j) => v + s * Bt[i].reduce((a, b, kk) => a + b * A[kk][j], 0)));
    return merged.map((row) => round(x.reduce((a, xv, i) => a + xv * row[i], 0), 4));
  },
};
