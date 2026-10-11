import { recorder, round, softmax } from '../../js/util.js';

const code = `import torch

def top_p_sample(logits, p, u):
    probs = torch.softmax(logits, dim=-1)
    sorted_p, idx = probs.sort(descending=True)
    cum = sorted_p.cumsum(-1)
    keep = cum - sorted_p <= p        # 累积概率 ≤ p 的最小集合
    sorted_p = sorted_p * keep
    sorted_p = sorted_p / sorted_p.sum()   # 重新归一化
    cum = sorted_p.cumsum(-1)
    j = (cum < u).sum()               # u 落在哪个 token
    return idx[j]`;

const TOK = ['的', '是', '在', '我', '了', '和', '有', '不'];

export default {
  id: 'llm-53', track: 'llm', num: 53, title: 'Top-p 采样', category: '解码采样',
  code,
  oneLine: '按概率从大到小取到累积 ≥ p 为止，只在「核」里采样',
  summary: 'Top-p（nucleus）采样：把概率从大到小排序，取累积概率刚超过 p 的最小 token 集合，其余砍掉，再重新归一化采样。',
  ideas: [
    'top-k 的问题是 k 固定：分布尖时会采到不该采的长尾，分布平时又砍掉了合理候选。',
    'top-p 按<b>累积概率</b>取核：分布尖时核很小（接近贪心），分布平时核自动变大——候选集随分布形状自适应。',
    '实现：排序 → cumsum → 保留 <code>cum − sorted_p ≤ p</code> 的位置（保证刚好把超线的那个也留下）→ 归一化 → 采样。',
  ],
  complexity: '时间 O(v·log v)（排序）',
  presets: [
    { name: 'p = 0.9', input: { logits: [3.0, 2.0, 1.0, 0.5, 0.1, -0.5], p: 0.9, u: 0.75 } },
    { name: 'p = 0.7', input: { logits: [2.0, 1.8, 1.5, 1.0], p: 0.7, u: 0.6 } },
  ],
  validate(inp) {
    if (!Array.isArray(inp.logits) || inp.logits.some((v) => typeof v !== 'number')) return 'logits 需要是数字数组';
    if (inp.logits.length < 2 || inp.logits.length > 8) return '长度 2~8';
    if (typeof inp.p !== 'number' || inp.p <= 0 || inp.p > 1) return 'p 取 (0, 1]';
    if (typeof inp.u !== 'number' || inp.u < 0 || inp.u >= 1) return 'u 取 [0, 1)';
    return null;
  },
  run({ logits, p, u }) {
    const rec = recorder();
    const tk = TOK.slice(0, logits.length);
    const probs = softmax(logits);
    const order = probs.map((v, i) => [v, i]).sort((a, b) => b[0] - a[0]);
    const cum = [];
    order.forEach(([v], i) => cum.push((cum[i - 1] || 0) + v));
    const cut = cum.findIndex((c) => c >= p);
    const keep = order.map((_, i) => i <= cut);
    const keptP = order.map(([v], i) => (keep[i] ? v : 0));
    const s = keptP.reduce((a, b) => a + b, 0);
    const renorm = keptP.map((v) => v / s);
    const pick = (() => { let c = 0; for (let i = 0; i < renorm.length; i++) { c += renorm[i]; if (u < c) return i; } return renorm.length - 1; })();
    const probsLayer = (label, vals, colors, tokens = order.map(([, i]) => tk[i])) => ({ type: 'probs', id: 'pr', label, tokens, values: vals.map((v) => round(v, 4)), colors, fmt: (v) => round(v, 4) });
    rec.step(4, `logits = [${logits.join(', ')}]，先 softmax 再按概率<b>从大到小排序</b>。`,
      [probsLayer('softmax 后（已排序）', order.map(([v]) => v))]);
    rec.step([5, 6], `累积概率：${cum.map((c, i) => `${tk[order[i][1]]} ${round(c, 3)}`).join(' → ')}。top-p 取「刚好超过 p = ${p}」的最小集合：累积到 <code>${tk[order[cut][1]]}</code> 时达到 ${round(cum[cut], 3)} ≥ ${p}。`,
      [probsLayer(`累积概率（p = ${p}）`, cum, cum.map((c, i) => (i <= cut ? 'cur' : 'dim')))]);
    rec.step(7, `保留前 ${cut + 1} 个 token 作核（nucleus），砍掉剩下 ${order.length - cut - 1} 个长尾 token。`,
      [probsLayer('核内（绿）vs 被砍（暗）', order.map(([v]) => v), order.map((_, i) => (keep[i] ? 'ok' : 'dim')))]);
    rec.step(8, `核内重新归一化：概率除以核总和 ${round(s, 3)}。`,
      [probsLayer('归一化后的核分布', renorm, renorm.map((v, i) => (v > 0 ? 'cur' : 'dim')))]);
    let c = 0;
    for (let i = 0; i <= pick; i++) {
      c += renorm[i];
      rec.step([9, 10], `累积到「${tk[order[i][1]]}」：${round(c, 3)}。${u < c ? `<code>u = ${u} < ${round(c, 3)}</code> → 采到 <code>${tk[order[i][1]]}</code>` : '未命中，继续。'}`,
        [probsLayer(`u = ${u} 采样`, renorm, renorm.map((_, j) => (j < i ? 'dim' : j === i ? (u < c ? 'ok' : 'cur') : '')))]);
      if (u < c) break;
    }
    rec.step(11, `结果：token <code>${tk[order[pick][1]]}</code>（原下标 ${order[pick][1]}）。核大小随分布自适应：分布尖 → 核小，分布平 → 核大。`,
      [probsLayer('最终结果', renorm, renorm.map((_, j) => (j === pick ? 'ok' : j <= cut ? '' : 'dim')))]);
    return { steps: rec.steps, result: order[pick][1] };
  },
  solve({ logits, p, u }) {
    const probs = softmax(logits);
    const order = probs.map((v, i) => [v, i]).sort((a, b) => b[0] - a[0]);
    let c = 0, cut = 0;
    for (let i = 0; i < order.length; i++) { c += order[i][0]; if (c >= p) { cut = i; break; } cut = i; }
    const kept = order.slice(0, cut + 1);
    const s = kept.reduce((a, [v]) => a + v, 0);
    let cc = 0;
    for (const [v, i] of kept) { cc += v / s; if (u < cc) return i; }
    return kept[kept.length - 1][1];
  },
};
