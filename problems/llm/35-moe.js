import { recorder, randMatrix, round, roundM, softmax } from '../../js/util.js';

const code = `import torch

def moe_forward(x, W_gate, experts, k):
    logits = x @ W_gate                    # [T, E]
    probs = torch.softmax(logits, dim=-1)
    topv, topi = probs.topk(k, dim=-1)     # 每个 token 选 k 个专家
    w = topv / topv.sum(dim=-1, keepdim=True)   # 重新归一化
    out = torch.zeros_like(x)
    for t in range(x.size(0)):
        for j in range(k):
            e = topi[t, j]
            out[t] += w[t, j] * experts[e](x[t])
    return out`;

export default {
  id: 'llm-35', track: 'llm', num: 35, title: 'MoE Top-k 路由', category: 'FFN / MoE',
  code,
  oneLine: 'Gate softmax 后只激活 top-k 专家，按权重加权合并',
  summary: '混合专家（MoE）层：路由器给每个 token 对全部专家打分，只激活分数最高的 k 个，输出按归一化权重加权求和。',
  ideas: [
    '每个专家是一个独立 FFN。router（一个线性层）输出 <code>[T, E]</code> logits，softmax 后取 top-k。',
    '<b>Sparse 激活</b>：参数总量很大但每 token 只算 k 个专家，计算量与稠密小模型相当——这是 Mixtral、DeepSeek 扩容的核心。',
    '只保留的 top-k 权重还要<b>重新归一化</b>（除以和），否则输出幅度会随 k 变化。训练中再加 load-balancing loss 防止所有 token 挤到同一个专家。',
  ],
  complexity: '每 token 计算 O(k·d²) 而非 E·d²；参数量 O(E·d²)',
  presets: [
    { name: 'T=3, E=4, k=2', input: { T: 3, d: 3, E: 4, k: 2, seed: 5 } },
    { name: 'T=4, E=4, k=1', input: { T: 4, d: 3, E: 4, k: 1, seed: 9 } },
  ],
  validate(inp) {
    if (!Number.isInteger(inp.T) || inp.T < 1 || inp.T > 5) return 'T 取 1~5';
    if (!Number.isInteger(inp.d) || inp.d < 2 || inp.d > 4) return 'd 取 2~4';
    if (!Number.isInteger(inp.E) || inp.E < 2 || inp.E > 6) return 'E 取 2~6';
    if (!Number.isInteger(inp.k) || inp.k < 1 || inp.k > inp.E) return 'k 取 1~E';
    return null;
  },
  run({ T, d, E, k, seed = 1 }) {
    const rec = recorder();
    const x = randMatrix(T, d, seed);
    const Wg = randMatrix(d, E, seed + 7);
    const experts = Array.from({ length: E }, (_, e) => randMatrix(d, d, seed + 20 + e));
    const logits = x.map((r) => Wg[0].map((_, j) => r.reduce((s, v, i) => s + v * Wg[i][j], 0)));
    const probs = logits.map(softmax);
    const top = probs.map((p) => p.map((v, e) => [v, e]).sort((a, b) => b[0] - a[0]).slice(0, k));
    const w = top.map((ts) => { const s = ts.reduce((a, [v]) => a + v, 0); return ts.map(([v, e]) => [v / s, e]); });
    const out = x.map((r, t) => r.map((_, j) => w[t].reduce((s, [wv, e]) => s + wv * r.reduce((a, xv, i) => a + xv * experts[e][i][j], 0), 0)));
    const rl = Array.from({ length: T }, (_, i) => `t${i}`);
    const el = Array.from({ length: E }, (_, i) => `E${i}`);
    const dl = Array.from({ length: d }, (_, j) => `d${j}`);
    const expCount = Array(E).fill(0);
    w.forEach((ts) => ts.forEach(([, e]) => expCount[e]++));
    rec.step(5, `输入 x [${T}, ${d}]，${E} 个专家。router：logits = x @ W_gate → [${T}, ${E}]。`,
      [{ type: 'row', id: 'lg', items: [
        { label: 'x', values: roundM(x), rowLabels: rl, colLabels: dl, heat: 'diverge' },
        { op: '@' },
        { label: 'W_gate', values: roundM(Wg), rowLabels: dl, colLabels: el, heat: 'diverge' },
        { op: '→' },
        { label: 'logits', values: roundM(logits), rowLabels: rl, colLabels: el, heat: 'diverge' }] }]);
    rec.step(6, 'softmax 把每行变成概率分布：', [{ type: 'matrix', id: 'p', label: 'probs = softmax(logits)', values: roundM(probs), rowLabels: rl, colLabels: el, heat: true }]);
    const tokLists = Array.from({ length: E }, () => []);
    for (let t = 0; t < T; t++) {
      const colors = {};
      probs[t].forEach((v, e) => { colors[`${t},${e}`] = top[t].some(([, ee]) => ee === e) ? 'ok' : 'dim'; });
      rec.step(7, `token t${t}：top-${k} 专家 = ${top[t].map(([v, e]) => `E${e}(${round(v, 2)})`).join('、')}；其余专家的计算<b>完全跳过</b>。`,
        [{ type: 'matrix', id: 'p', label: 'probs（绿=选中，暗=跳过）', values: roundM(probs), rowLabels: rl, colLabels: el, heat: true, colors }]);
      rec.step(8, `权重重新归一化：${top[t].map(([v, e]) => `${round(v, 3)}`).join(' + ')} → ${w[t].map(([v, e]) => `w_E${e} = ${round(v, 3)}`).join('，')}。`,
        [{ type: 'vars', id: 'v', items: Object.fromEntries(w[t].map(([v, e]) => [`w_E${e}`, round(v, 4)])) }]);
      w[t].forEach(([, e]) => tokLists[e].push(`t${t}`));
      rec.step([9, 12], `<code>out[t${t}] = ${w[t].map(([v, e]) => `${round(v, 2)}·E${e}(x)`).join(' + ')}</code> = [${out[t].map((v) => round(v, 2)).join(', ')}]。`,
        [{ type: 'map', id: 'el', label: '各专家分到的 token', headers: ['专家', 'tokens'], entries: el.map((e, i) => [e, tokLists[i].join(' ') || '—']), colors: Object.fromEntries(w[t].map(([, e]) => [`E${e}`, 'ok'])) },
         { type: 'array', id: `o`, label: `out[t${t}]`, values: out[t].map((v) => round(v)), indexLabels: dl }]);
    }
    rec.step(12, `完成。${E} 个专家每个 token 只用 ${k} 个——参数量 ×${E} 但计算只 ×${k}。token 分布：${tokLists.map((l, i) => `E${i} ← ${l.length}`).join('，')}（训练时用 load-balancing loss 防止倾斜）。`,
      [{ type: 'matrix', id: 'o', label: '输出 out [T, d]', values: roundM(out), rowLabels: rl, colLabels: dl, heat: 'diverge' }]);
    return { steps: rec.steps, result: roundM(out, 4) };
  },
  solve({ T, d, E, k, seed = 1 }) {
    const x = randMatrix(T, d, seed);
    const Wg = randMatrix(d, E, seed + 7);
    const experts = Array.from({ length: E }, (_, e) => randMatrix(d, d, seed + 20 + e));
    const logits = x.map((r) => Wg[0].map((_, j) => r.reduce((s, v, i) => s + v * Wg[i][j], 0)));
    const probs = logits.map(softmax);
    return roundM(probs.map((p, t) => {
      const ord = p.map((v, e) => [v, e]).sort((a, b) => b[0] - a[0]).slice(0, k);
      const s = ord.reduce((a, [v]) => a + v, 0);
      const res = Array(d).fill(0);
      for (const [v, e] of ord)
        for (let j = 0; j < d; j++)
          for (let i = 0; i < d; i++) res[j] += (v / s) * x[t][i] * experts[e][i][j];
      return res;
    }), 4);
  },
};
