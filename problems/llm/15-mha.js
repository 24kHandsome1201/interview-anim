import { recorder, randMatrix, round, roundM, matmul, softmax, transpose } from '../../js/util.js';

const code = `import torch
import math

def mha(x, W_q, W_k, W_v, W_o, h):
    B, T, D = x.shape
    dk = D // h
    Q = x @ W_q                     # 投影
    Q = Q.view(B, T, h, dk).transpose(1, 2)   # 拆头
    K = (x @ W_k).view(B, T, h, dk).transpose(1, 2)
    V = (x @ W_v).view(B, T, h, dk).transpose(1, 2)
    scores = Q @ K.transpose(-2, -1) / math.sqrt(dk)
    attn = torch.softmax(scores, dim=-1)
    out = attn @ V                  # [B,h,T,dk]
    out = out.transpose(1, 2).reshape(B, T, D)
    return out @ W_o`;

export default {
  id: 'llm-15', track: 'llm', num: 15, title: 'Multi-Head Attention', category: 'Attention',
  code,
  oneLine: '把 D 维切成 h 个小头分别做注意力，再拼回来过 W_o',
  summary: '实现多头注意力：Q/K/V 投影后把特征维 D 切成 h 个 head，每个 head 独立做缩放点积注意力，最后 concat 并用 W_o 融合。',
  ideas: [
    '<b>为什么要多头</b>：单个注意力只能学一种「关注模式」；h 个头各自在低维 dk = D/h 空间里学不同的关系（位置、语义等）。',
    '形状变换是关键：<code>[B,T,D] → [B,T,h,dk] → [B,h,T,dk]</code>，把 head 维放到 T 前面，让每个头的 attention 就是一个 [T,T] 矩阵。',
    '每个头输出 [T,dk]，concat 回 [T,D] 后过 <code>W_o</code> 混合各头信息。',
  ],
  complexity: '时间 O(B·h·T²·dk) = O(B·T²·D)，空间 O(B·h·T²)',
  presets: [
    { name: 'T=3, D=4, h=2', input: { T: 3, D: 4, h: 2, seed: 3 } },
    { name: 'T=4, D=4, h=2', input: { T: 4, D: 4, h: 2, seed: 8 } },
  ],
  validate(inp) {
    if (!Number.isInteger(inp.T) || inp.T < 2 || inp.T > 5) return 'T 取 2~5';
    if (!Number.isInteger(inp.D) || inp.D < 2 || inp.D > 8) return 'D 取 2~8';
    if (!Number.isInteger(inp.h) || inp.h < 1 || inp.D % inp.h) return 'h 需整除 D';
    return null;
  },
  run({ T, D, h, seed = 1 }) {
    const rec = recorder();
    const dk = D / h;
    const x = randMatrix(T, D, seed);
    const Wq = randMatrix(D, D, seed + 1, 0.6), Wk = randMatrix(D, D, seed + 2, 0.6), Wv = randMatrix(D, D, seed + 3, 0.6), Wo = randMatrix(D, D, seed + 4, 0.6);
    const Q = matmul(x, Wq), K = matmul(x, Wk), V = matmul(x, Wv);
    // heads: Q_h[i] = Q[:, i*dk:(i+1)*dk]
    const heads = (M) => Array.from({ length: h }, (_, hh) => M.map((r) => r.slice(hh * dk, (hh + 1) * dk)));
    const Qh = heads(Q), Kh = heads(K), Vh = heads(V);
    const scale = Math.sqrt(dk);
    const attn = Qh.map((q, hh) => {
      const s = matmul(q, transpose(Kh[hh])).map((r) => r.map((v) => v / scale));
      return s.map(softmax);
    });
    const headOut = attn.map((a, hh) => matmul(a, Vh[hh]));
    const concat = x.map((_, t) => headOut.flatMap((o) => o[t]));
    const out = matmul(concat, Wo);
    const rl = Array.from({ length: T }, (_, i) => `t${i}`);
    const dl = Array.from({ length: D }, (_, j) => `d${j}`);
    const kl = Array.from({ length: dk }, (_, j) => `dk${j}`);
    const shape = (name, dims, names, note) => ({ type: 'tensor', id: `t-${name}`, name, shape: dims, names, note });
    rec.step(4, `输入 x [B=1, T=${T}, D=${D}]，h = ${h} 个头，每个头 dk = D/h = <code>${dk}</code>。`,
      [shape('x', [1, T, D], ['B', 'T', 'D']), { type: 'matrix', id: 'x', label: 'x', values: roundM(x), rowLabels: rl, colLabels: dl, heat: 'diverge' }]);
    rec.step(7, `线性投影：<code>Q = x @ W_q</code>（K、V 同理），形状仍是 [T, ${D}]。`,
      [{ type: 'row', id: 'qkv', items: [
        { label: 'Q = x·W_q', values: roundM(Q), rowLabels: rl, colLabels: dl, heat: 'diverge' },
        { label: 'K', values: roundM(K), rowLabels: rl, colLabels: dl, heat: 'diverge' },
        { label: 'V', values: roundM(V), rowLabels: rl, colLabels: dl, heat: 'diverge' }] }]);
    rec.step([8, 10], `<code>view → transpose</code>：把每个矩阵的 ${D} 维切成 ${h} 组 ${dk} 维（头 j 取列 ${Array.from({ length: h }, (_, i) => `${i * dk}..${(i + 1) * dk - 1}`).join(' / ')}），再把 head 维提到前面 → [B, h=${h}, T=${T}, dk=${dk}]。`,
      [shape('Q', [1, T, D], ['B', 'T', 'D']), shape('Q′', [1, T, h, dk], ['B', 'T', 'h', 'dk']), shape('Q″', [1, h, T, dk], ['B', 'h', 'T', 'dk'], '此后每个头独立做注意力')]);
    for (let hh = 0; h < 99 && hh < h; hh++) {
      const sc = matmul(Qh[hh], transpose(Kh[hh])).map((r) => r.map((v) => v / scale));
      rec.step([11, 12], `头 ${hh}：取 Q、K 的第 ${hh * dk}..${(hh + 1) * dk - 1} 列，scores = Q·Kᵀ/√${dk}。`,
        [{ type: 'row', id: `h${hh}`, items: [
          { label: `Q_head${hh}`, values: roundM(Qh[hh]), rowLabels: rl, colLabels: kl, heat: 'diverge' },
          { label: `K_head${hh}ᵀ`, values: roundM(transpose(Kh[hh])), rowLabels: kl, colLabels: rl, heat: 'diverge' },
          { op: '→' },
          { label: 'scores', values: roundM(sc), rowLabels: rl, colLabels: rl, heat: 'diverge' }] }]);
      rec.step([12, 13], `头 ${hh}：softmax + attn@V，得到该头输出 [T, ${dk}]。`,
        [{ type: 'row', id: `a${hh}`, items: [
          { label: 'attn', values: roundM(attn[hh]), rowLabels: rl, colLabels: rl, heat: true },
          { op: '@' },
          { label: `V_head${hh}`, values: roundM(Vh[hh]), rowLabels: rl, colLabels: kl, heat: 'diverge' },
          { op: '→' },
          { label: `头 ${hh} 输出`, values: roundM(headOut[hh]), rowLabels: rl, colLabels: kl, heat: 'diverge' }] }]);
    }
    rec.step([14, 15], `<code>transpose + reshape</code>：把 ${h} 个头的 [T,${dk}] 输出拼回 [T, ${D}]，再过 <code>W_o</code> 融合。`,
      [{ type: 'row', id: 'cat', items: [
        ...headOut.map((o, hh) => ({ label: `head${hh}`, values: roundM(o), rowLabels: rl, colLabels: kl, heat: 'diverge' })),
        { op: '⊕' },
        { label: 'concat [T,D]', values: roundM(concat), rowLabels: rl, colLabels: dl, heat: 'diverge' }] }]);
    rec.step(15, `输出 = concat @ W_o，形状 [${T}, ${D}]。每个头在低维各学各的，最后由 W_o 汇总。`,
      [{ type: 'matrix', id: 'o', label: '输出 = concat @ W_o', values: roundM(out), rowLabels: rl, colLabels: dl, heat: 'diverge' }]);
    return { steps: rec.steps, result: roundM(out, 4) };
  },
  solve({ T, D, h, seed = 1 }) {
    // independent: same math with explicit loops, single-shot
    const dk = D / h;
    const x = randMatrix(T, D, seed);
    const Wq = randMatrix(D, D, seed + 1, 0.6), Wk = randMatrix(D, D, seed + 2, 0.6), Wv = randMatrix(D, D, seed + 3, 0.6), Wo = randMatrix(D, D, seed + 4, 0.6);
    const proj = (W) => x.map((r) => W[0].map((_, j) => r.reduce((s, v, k) => s + v * W[k][j], 0)));
    const Q = proj(Wq), K = proj(Wk), V = proj(Wv);
    const out = x.map(() => Array(D).fill(0));
    for (let hh = 0; hh < h; hh++) {
      for (let i = 0; i < T; i++) {
        const s = [];
        for (let j = 0; j < T; j++) {
          let dot = 0;
          for (let k = 0; k < dk; k++) dot += Q[i][hh * dk + k] * K[j][hh * dk + k];
          s.push(dot / Math.sqrt(dk));
        }
        const w = softmax(s);
        for (let k = 0; k < dk; k++) {
          let acc = 0;
          for (let j = 0; j < T; j++) acc += w[j] * V[j][hh * dk + k];
          out[i][hh * dk + k] = acc;
        }
      }
    }
    return roundM(out.map((r) => Wo[0].map((_, j) => r.reduce((s, v, k) => s + v * Wo[k][j], 0))), 4);
  },
  pyArgs({ T, D, h, seed = 1 }) {
    return [[randMatrix(T, D, seed)], randMatrix(D, D, seed + 1, 0.6), randMatrix(D, D, seed + 2, 0.6), randMatrix(D, D, seed + 3, 0.6), randMatrix(D, D, seed + 4, 0.6), h];
  },
};
