import { recorder, randMatrix, round, roundM, matmul, softmax, transpose } from '../../js/util.js';

const code = `import torch

def gqa(Q, K, V, h_q, h_kv):
    # Q: [h_q, T, dk]，K/V: [h_kv, T, dk]
    rep = h_q // h_kv
    K = K.repeat_interleave(rep, dim=0)   # 共享
    V = V.repeat_interleave(rep, dim=0)
    s = Q @ K.transpose(-2, -1) / Q.size(-1) ** 0.5
    attn = torch.softmax(s, dim=-1)
    return attn @ V`;

const GC = ['cur', 'cmp', 'hl', 'ok'];

export default {
  id: 'llm-18', track: 'llm', num: 18, title: 'GQA 分组查询注意力', category: 'Attention',
  code,
  oneLine: 'h_q 个 Q 头共享 h_kv 个 KV 头，KV cache 直接缩小 rep 倍',
  summary: 'GQA：多个 query 头共享同一个 key/value 头。MHA 是 h_kv = h_q 的特例，MQA 是 h_kv = 1 的特例，GQA 是折中。',
  ideas: [
    'MHA 里每个 Q 头都配一对 K、V，KV cache 随头数线性膨胀，是长上下文推理的显存大头。',
    'GQA 让 <b>h_q / h_kv 个 Q 头共享一对 KV</b>：K、V 用 <code>repeat_interleave</code> 复制后照常算注意力。',
    'KV cache 显存缩到 <b>h_kv / h_q</b>（如 32 Q 头 + 8 KV 头 → 省 75%），代价是极小的精度损失。',
  ],
  complexity: '与 MHA 相同计算量；KV cache 显存 ÷ (h_q / h_kv)',
  presets: [
    { name: '4 Q 头共享 2 KV 头', input: { T: 3, dk: 2, h_q: 4, h_kv: 2, seed: 5 } },
    { name: 'MQA（全部共享 1 个）', input: { T: 3, dk: 2, h_q: 4, h_kv: 1, seed: 5 } },
  ],
  validate(inp) {
    if (!Number.isInteger(inp.T) || inp.T < 2 || inp.T > 5) return 'T 取 2~5';
    if (!Number.isInteger(inp.dk) || inp.dk < 1 || inp.dk > 4) return 'dk 取 1~4';
    if (!Number.isInteger(inp.h_q) || !Number.isInteger(inp.h_kv) || inp.h_kv < 1 || inp.h_q % inp.h_kv || inp.h_q / inp.h_kv > 8) return 'h_kv 需整除 h_q，且每组 ≤ 8 个 Q 头';
    if (inp.h_q > 6) return 'h_q 最多 6';
    return null;
  },
  run({ T, dk, h_q, h_kv, seed = 1 }) {
    const rec = recorder();
    const rep = h_q / h_kv;
    const Q = Array.from({ length: h_q }, (_, i) => randMatrix(T, dk, seed + i * 11));
    const K = Array.from({ length: h_kv }, (_, i) => randMatrix(T, dk, seed + 100 + i * 11));
    const V = Array.from({ length: h_kv }, (_, i) => randMatrix(T, dk, seed + 200 + i * 11));
    const group = (qi) => Math.floor(qi / rep);
    const scale = Math.sqrt(dk);
    const outs = Q.map((q, qi) => {
      const kv = group(qi);
      const s = matmul(q, transpose(K[kv])).map((r) => r.map((v) => v / scale));
      return matmul(s.map(softmax), V[kv]);
    });
    const rl = Array.from({ length: T }, (_, i) => `t${i}`);
    const kl = Array.from({ length: dk }, (_, j) => `d${j}`);
    const shapes = [h_q, h_kv];
    const memMHA = h_q * 2, memGQA = h_kv * 2;
    const kvMapLayer = (hlQ = -1, hlKV = -1) => ({ type: 'map', id: 'gm', label: `Q 头 → KV 头映射（每 ${rep} 个 Q 头共享 1 个 KV 头）`, headers: ['Q 头', 'KV 头'], entries: Array.from({ length: h_q }, (_, i) => [`q${i}`, `kv${group(i)}`]), colors: Object.fromEntries(Array.from({ length: h_q }, (_, i) => [`q${i}`, i === hlQ ? GC[group(i) % 4] : GC[group(i) % 4]])) });
    rec.step(3, `Q 有 <code>h_q = ${h_q}</code> 个头，但 K、V 只有 <code>h_kv = ${h_kv}</code> 个——每个 KV 头服务 <code>${rep}</code> 个 Q 头。`,
      [{ type: 'tensor', id: 'sq', name: 'Q', shape: [1, h_q, T, dk], names: ['B', 'h_q', 'T', 'dk'] },
       { type: 'tensor', id: 'sk', name: 'K / V', shape: [1, h_kv, T, dk], names: ['B', 'h_kv', 'T', 'dk'] },
       { type: 'vars', id: 'v', items: { 'KV cache 倍数': `MHA 存 ${memMHA} 份 → GQA 只存 ${memGQA} 份`, 节省: `${Math.round((1 - h_kv / h_q) * 100)}%` } }]);
    rec.step([7, 8], `<code>repeat_interleave(${rep})</code>：逻辑上把每个 KV 头复制 ${rep} 份，让 Q、K、V 头数对齐（实际实现直接让 Q 头共享，不真的复制内存）。`, [kvMapLayer()]);
    const W = Array.from({ length: h_q }, () => Array.from({ length: T }, () => Array(T).fill('')));
    for (let qi = 0; qi < h_q; qi++) {
      const kv = group(qi);
      for (let i = 0; i < T; i++) for (let j = 0; j < T; j++) {
        const s = matmul(Q[qi], transpose(K[kv]))[i][j] / scale;
        W[qi][i][j] = round(s);
      }
      rec.step(9, `<code>q${qi}</code> 使用 <code>kv${kv}</code>（第 ${Math.floor(qi / rep) === kv ? Math.floor(qi % rep) + 1 : ''} 个共享它的 Q 头）算注意力：Q[${qi}] · K[${kv}]ᵀ / √${dk}。`,
        [kvMapLayer(qi, kv),
         { type: 'matrix', id: `w`, label: `head q${qi} 的 scores（颜色同左侧 kv${kv} 组）`, values: W[qi], rowLabels: rl, colLabels: rl, heat: 'diverge', colors: Object.fromEntries(rl.map((_, j) => [`${0},${j}`, GC[kv % 4]])) }]);
    }
    rec.step([9, 10], `每个头各自 softmax + ×V，得到 ${h_q} 份 [T, ${dk}] 输出。注意 q0、q1 的注意力权重来自<b>同一份 KV</b>——这就是省显存的来源。`,
      [{ type: 'row', id: 'outs', items: outs.map((o, qi) => ({ label: `out q${qi}（kv${group(qi)}）`, values: roundM(o), rowLabels: rl, colLabels: kl, heat: 'diverge' })) }]);
    rec.step(10, `完成。对比：MHA 的 KV cache 是 ${h_q}×2 份，GQA 只有 ${h_kv}×2 份；h_kv=1 时退化为 MQA。推理质量略降但长上下文省显存非常明显。`,
      [{ type: 'vars', id: 'v', items: { '每 token KV cache': `MHA: ${h_q * 2 * dk} 元素 → GQA: ${h_kv * 2 * dk} 元素`, 节省: `${Math.round((1 - h_kv / h_q) * 100)}%` } }]);
    return { steps: rec.steps, result: roundM(outs.flat(), 4) };
  },
  solve({ T, dk, h_q, h_kv, seed = 1 }) {
    const rep = h_q / h_kv;
    const Q = Array.from({ length: h_q }, (_, i) => randMatrix(T, dk, seed + i * 11));
    const K = Array.from({ length: h_kv }, (_, i) => randMatrix(T, dk, seed + 100 + i * 11));
    const V = Array.from({ length: h_kv }, (_, i) => randMatrix(T, dk, seed + 200 + i * 11));
    const outs = [];
    for (let qi = 0; qi < h_q; qi++) {
      const kv = Math.floor(qi / rep);
      for (let i = 0; i < T; i++) {
        const s = K[kv].map((kr) => Q[qi][i].reduce((a, v, k) => a + v * kr[k], 0) / Math.sqrt(dk));
        const w = softmax(s);
        outs.push(V[kv][0].map((_, c) => w.reduce((a, x, j) => a + x * V[kv][j][c], 0)));
      }
    }
    return roundM(outs, 4);
  },
  pyArgs({ T, dk, h_q, h_kv, seed = 1 }) {
    return {
      Q: Array.from({ length: h_q }, (_, i) => randMatrix(T, dk, seed + i * 11)),
      K: Array.from({ length: h_kv }, (_, i) => randMatrix(T, dk, seed + 100 + i * 11)),
      V: Array.from({ length: h_kv }, (_, i) => randMatrix(T, dk, seed + 200 + i * 11)),
      h_q, h_kv,
    };
  },
};
