import { recorder, randMatrix, round, roundM, softmax } from '../../js/util.js';

const code = `import torch

@torch.no_grad()
def generate(K_cache, V_cache, q_t, k_t, v_t):
    # 每步只算新 token 的 k, v 并追加到缓存
    K_cache = torch.cat([K_cache, k_t], dim=0)
    V_cache = torch.cat([V_cache, v_t], dim=0)
    scores = q_t @ K_cache.T / q_t.size(-1) ** 0.5
    attn = torch.softmax(scores, dim=-1)
    return attn @ V_cache, K_cache, V_cache`;

const TOKENS = ['我', '爱', '大', '模', '型', '！'];

export default {
  id: 'llm-20', track: 'llm', num: 20, title: 'KV Cache 增量解码', category: 'Attention',
  code,
  oneLine: '每步只算 1 个 token 的 Q，K/V 从缓存读，越攒越长',
  summary: '自回归解码时，已经生成的 token 的 K、V 不会变——把它们缓存起来，每步只算新 token 的 q·k·v，把 O(T²) 的重复计算降到 O(T)。',
  ideas: [
    '不带 cache 的解码：每生成一个 token 都对<b>整段</b>重新算 K、V，复杂度 O(T²)。',
    '带 cache：K、V 矩阵每步只<b>追加一行</b>；新 token 的 q 对缓存的全部 K 做注意力即可，老 token 的 K/V 绝不重算。',
    '代价：显存随生成长度线性增长（这也是 GQA/MQA 省显存的动机）。',
  ],
  complexity: '每步 O(T·d)（缓存命中部分）；省掉 O(T·d²) 的 K/V 重投影',
  presets: [
    { name: '预填充 2 + 解码 3', input: { T0: 2, steps: 3, d: 4, seed: 3 } },
    { name: '预填充 1 + 解码 4', input: { T0: 1, steps: 4, d: 3, seed: 8 } },
  ],
  validate(inp) {
    if (!Number.isInteger(inp.T0) || inp.T0 < 1 || inp.T0 > 4) return 'T0 取 1~4';
    if (!Number.isInteger(inp.steps) || inp.steps < 1 || inp.steps > 5) return 'steps 取 1~5';
    if (!Number.isInteger(inp.d) || inp.d < 2 || inp.d > 6) return 'd 取 2~6';
    return null;
  },
  run({ T0, steps, d, seed = 1 }) {
    const rec = recorder();
    const total = T0 + steps;
    // prefill: cache has T0 rows
    const K = randMatrix(T0, d, seed), V = randMatrix(T0, d, seed + 50);
    const Kgrow = K.map((r) => [...r]), Vgrow = V.map((r) => [...r]);
    const rl = Array.from({ length: total }, (_, i) => TOKENS[i]);
    const dl = Array.from({ length: d }, (_, j) => `d${j}`);
    const outs = [];
    const kMat = (label, colors) => ({ type: 'matrix', id: 'k', label, values: roundM(Kgrow), rowLabels: rl.slice(0, Kgrow.length), colLabels: dl, heat: 'diverge', colors });
    const vMat = (label, colors) => ({ type: 'matrix', id: 'vm', label, values: roundM(Vgrow), rowLabels: rl.slice(0, Vgrow.length), colLabels: dl, heat: 'diverge', colors });
    rec.step(5, `预填充：前 ${T0} 个 token 的 K、V 已算好放进缓存（这是 prompt 阶段一次性算的）。之后每生成一个 token 只往缓存追加一行。`,
      [kMat('K_cache'), vMat('V_cache'), { type: 'tensor', id: 'sh', name: 'K_cache', shape: [Kgrow.length, d], names: ['已缓存 token 数', 'd'] }]);
    for (let t = 0; t < steps; t++) {
      const cur = T0 + t;
      const q = randMatrix(1, d, seed + 100 + cur * 7)[0];
      const k = randMatrix(1, d, seed + 200 + cur * 7)[0];
      const v = randMatrix(1, d, seed + 300 + cur * 7)[0];
      rec.step([6, 7], `第 ${t + 1} 步：新 token「${TOKENS[cur]}」只算它自己的 <code>k_t、v_t</code>（1×${d}），<code>cat</code> 追加到缓存末尾——之前的 ${Kgrow.length} 行不重算。`,
        [{ type: 'matrix', id: 'nk', label: `新的 k_t（只有 1 行）`, values: [k.map((x) => round(x))], colLabels: dl, heat: 'diverge' }, kMat('K_cache'), vMat('V_cache')]);
      Kgrow.push(k); Vgrow.push(v);
      rec.step(7, `缓存追加后：K_cache 形状 [${Kgrow.length}, ${d}]（+1 行）。`,
        [kMat('K_cache（底部为刚追加的行）', { [`${Kgrow.length - 1},0`]: 'ok', ...Object.fromEntries(dl.map((_, j) => [`${Kgrow.length - 1},${j}`, 'ok'])) }), vMat('V_cache', Object.fromEntries(dl.map((_, j) => [`${Vgrow.length - 1},${j}`, 'ok'])))]);
      const scores = Kgrow.map((kr) => q.reduce((a, x, j) => a + x * kr[j], 0) / Math.sqrt(d));
      const w = softmax(scores);
      rec.step([8, 9], `<code>q_t</code>（新 token 的查询）对<b>整个缓存</b>做注意力：scores = q·Kᵀ/√d = [${scores.map((x) => round(x)).join(', ')}] → 权重 [${w.map((x) => round(x)).join(', ')}]。`,
        [{ type: 'row', id: 'att', items: [
          { label: `q_t「${TOKENS[cur]}」`, values: [q.map((x) => round(x))], colLabels: dl, heat: 'diverge' },
          { op: '·' },
          kMat('K_cache'),
          { op: '→' },
          { label: 'attn 权重', values: [w.map((x) => round(x))], colLabels: rl.slice(0, Kgrow.length), heat: true }] }]);
      const o = dl.map((_, j) => w.reduce((a, x, i) => a + x * Vgrow[i][j], 0));
      outs.push(o);
      rec.step(10, `输出 = Σ 权重 · V_cache 行 = [${o.map((x) => round(x)).join(', ')}]。本步只算了 1 个新 k/v 和 ${Kgrow.length} 次点积；不用 cache 则要重算全部 ${Kgrow.length} 个 token 的 K、V 投影。`,
        [vMat('V_cache'), { type: 'array', id: 'o', label: `输出 o_t「${TOKENS[cur]}」`, values: o.map((x) => round(x)), indexLabels: dl }]);
    }
    rec.step(10, `解码完成。共生成 ${steps} 个 token，缓存从 ${T0} 行长到 ${total} 行。省下的就是每步对所有历史 token 的 K/V 重投影——这是所有 LLM 推理引擎的基础优化。`,
      [kMat('最终 K_cache'), vMat('最终 V_cache')]);
    return { steps: rec.steps, result: roundM(outs, 4) };
  },
  solve({ T0, steps, d, seed = 1 }) {
    // independent: recompute full K/V each step from scratch
    const total = T0 + steps;
    const outs = [];
    for (let t = 0; t < steps; t++) {
      const cur = T0 + t;
      const q = randMatrix(1, d, seed + 100 + cur * 7)[0];
      const allK = [...randMatrix(T0, d, seed), ...Array.from({ length: t + 1 }, (_, s) => randMatrix(1, d, seed + 200 + (T0 + s) * 7)[0])];
      const allV = [...randMatrix(T0, d, seed + 50), ...Array.from({ length: t + 1 }, (_, s) => randMatrix(1, d, seed + 300 + (T0 + s) * 7)[0])];
      const w = softmax(allK.map((kr) => q.reduce((a, x, j) => a + x * kr[j], 0) / Math.sqrt(d)));
      outs.push(allV[0].map((_, j) => w.reduce((a, x, i) => a + x * allV[i][j], 0)));
    }
    return roundM(outs, 4);
  },
  pyArgs({ T0, steps, d, seed = 1 }) {
    return {
      K: randMatrix(T0, d, seed), V: randMatrix(T0, d, seed + 50),
      steps: Array.from({ length: steps }, (_, t) => {
        const cur = T0 + t;
        return { q: [randMatrix(1, d, seed + 100 + cur * 7)[0]], k: [randMatrix(1, d, seed + 200 + cur * 7)[0]], v: [randMatrix(1, d, seed + 300 + cur * 7)[0]] };
      }),
    };
  },
};
