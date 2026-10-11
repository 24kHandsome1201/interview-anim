import { recorder, round, roundM } from '../../js/util.js';

const code = `import torch
import math

def sinusoidal_pe(T, d, base=10000):
    P = torch.zeros(T, d)
    pos = torch.arange(T).unsqueeze(1)        # [T,1]
    i = torch.arange(0, d, 2)                 # [d/2]
    omega = base ** (-i / d)                  # 频率随维衰减
    P[:, 0::2] = torch.sin(pos * omega)       # 偶数维 sin
    P[:, 1::2] = torch.cos(pos * omega)       # 奇数维 cos
    return P`;

export default {
  id: 'llm-27', track: 'llm', num: 27, title: '正弦位置编码', category: '位置编码',
  code,
  oneLine: '每对维度一个频率，sin/cos 编码绝对位置',
  summary: 'Transformer 原论文的位置编码：给每个位置一个 d 维向量，偶数维用 sin、奇数维用 cos，频率随维度指数衰减。',
  ideas: [
    '注意力本身<b>不含顺序信息</b>（打乱输入输出一样打乱），必须注入位置。',
    '第 i 对维度的频率 <code>ωᵢ = base^(−2i/d)</code>：低维频率高（区分近邻位置），高维频率低（表达长距离）。',
    'sin/cos 的线性性质让 PE(pos+k) 能表示成 PE(pos) 的线性变换，模型容易学到「相对位置」。',
  ],
  complexity: '时间 O(T·d)，无需训练参数',
  presets: [
    { name: 'T=6, d=6', input: { T: 6, d: 6 } },
    { name: 'T=8, d=4', input: { T: 8, d: 4 } },
  ],
  validate(inp) {
    if (!Number.isInteger(inp.T) || inp.T < 2 || inp.T > 12) return 'T 取 2~12';
    if (!Number.isInteger(inp.d) || inp.d < 2 || inp.d > 10 || inp.d % 2) return 'd 取 2~10 的偶数';
    return null;
  },
  run({ T, d }) {
    const rec = recorder();
    const P = Array.from({ length: T }, (_, pos) =>
      Array.from({ length: d }, (_, j) => {
        const i = (j >> 1) * 2;
        const w = Math.pow(10000, -i / d);
        return j % 2 === 0 ? Math.sin(pos * w) : Math.cos(pos * w);
      }));
    const filled = Array.from({ length: T }, () => Array(d).fill(''));
    const dl = Array.from({ length: d }, (_, j) => `d${j}${j % 2 ? '(cos)' : '(sin)'}`);
    const rl = Array.from({ length: T }, (_, i) => `pos${i}`);
    const mat = (colors) => ({ type: 'matrix', id: 'p', label: 'P [T, d]（热力图：蓝正红负）', values: filled.map((r) => r.map((v) => (typeof v === 'number' ? round(v) : v))), rowLabels: rl, colLabels: dl, heat: 'diverge', colors });
    rec.step(4, `位置编码矩阵 [${T}, ${d}]：每行一个位置，每对维度 (2i, 2i+1) 一组频率。颜色越蓝值越大。`, [mat()]);
    for (let i = 0; i < d / 2; i++) {
      const w = Math.pow(10000, (-2 * i) / d);
      for (let pos = 0; pos < T; pos++) { filled[pos][2 * i] = P[pos][2 * i]; filled[pos][2 * i + 1] = P[pos][2 * i + 1]; }
      rec.step([6, 9], `第 ${i} 对维度（d${2 * i}, d${2 * i + 1}）：<code>ω = 10000^(−${2 * i}/${d}) = ${round(w, 4)}</code>，周期 ≈ ${round((2 * Math.PI) / w, 1)} 个位置。偶数维写 sin(pos·ω)，奇数维写 cos(pos·ω)。`,
        [mat(Object.fromEntries(Array.from({ length: T }, (_, p) => [[`${p},${2 * i}`, 'cur'], [`${p},${2 * i + 1}`, 'cur']]).flat()))]);
    }
    rec.step(9, `完成。观察：前两列随位置快速振荡（高频，区分相邻位置），后几列几乎不变（低频，标记大尺度位置）。每行都是该位置独一无二的「指纹」。`, [mat()]);
    rec.step(10, '性质：因为 sin/cos 的和角公式，PE(pos+k) 是 PE(pos) 的线性函数——模型能从中读出相对距离，这也是它可以泛化到比训练时更长序列的原因之一。', [mat()]);
    return { steps: rec.steps, result: roundM(P, 4) };
  },
  solve({ T, d }) {
    return roundM(Array.from({ length: T }, (_, pos) =>
      Array.from({ length: d }, (_, j) => {
        const w = Math.exp((-(j >> 1) * 2 * Math.log(10000)) / d);
        return j % 2 === 0 ? Math.sin(pos * w) : Math.cos(pos * w);
      })), 4);
  },
};
