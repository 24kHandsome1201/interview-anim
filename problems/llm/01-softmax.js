import { recorder, round } from '../../js/util.js';

const code = `import torch

def softmax(x):
    x = x - x.max()      # 先减最大值，防止 exp 溢出
    e = torch.exp(x)
    return e / e.sum()   # 归一化，所有元素和为 1`;

const fmtV = (x) => (x === Infinity ? '∞' : round(x, 4));

export default {
  id: 'llm-1', track: 'llm', num: 1, title: '数值稳定的 softmax', category: '基础算子',
  code,
  oneLine: '先减 max 再 exp，数学等价但绝不溢出',
  summary: '实现 softmax：把 logits 变成和为 1 的概率分布。面试考点是数值稳定性——大 logits 直接 exp 会溢出成 inf。',
  ideas: [
    'softmax(x)ᵢ = eˣⁱ / Σeˣʲ。<b>指数运算对大正数会溢出</b>：exp(1000) = inf。',
    '减最大值不改变结果：eˣⁱ⁻ᵐ / Σeˣʲ⁻ᵐ ≡ softmax(x)，因为分子分母同除 eᵐ。',
    '减完最大值后最大的数变成 0，exp 最多是 1，分母 ∈ [1, n]，绝对安全。',
  ],
  complexity: '时间 O(n)，空间 O(1)（就地）',
  presets: [
    { name: '大 logits（朴素实现溢出）', input: { x: [1000, 1001, 1002] } },
    { name: '普通 logits', input: { x: [2.0, 1.0, 0.1, -1.0] } },
  ],
  validate(inp) {
    if (!Array.isArray(inp.x) || inp.x.some((v) => typeof v !== 'number' || !isFinite(v))) return 'x 需要是数字数组';
    if (inp.x.length < 2 || inp.x.length > 8) return '长度 2~8';
    return null;
  },
  run({ x }) {
    const rec = recorder();
    const labels = x.map((_, i) => `x${i}`);
    const m = Math.max(...x);
    const naive = x.map((v) => Math.exp(v));
    const sub = x.map((v) => v - m);
    const e = sub.map(Math.exp);
    const s = e.reduce((a, b) => a + b, 0);
    const out = e.map((v) => v / s);
    const arr = (id, label, values, colors) => ({ type: 'array', id, label, values: values.map(fmtV), colors, indexLabels: labels });
    rec.step(4, `输入 logits = [${x.join(', ')}]。先求最大值 <code>max = ${m}</code>。${m > 100 ? `⚠️ 若不减 max，exp(${m}) 会直接溢出成 inf！` : ''}`,
      [arr('l', 'logits x', x), { type: 'vars', id: 'v', items: { 'max(x)': m } }]);
    if (m > 100) {
      rec.step(4, `反面教材：naive 实现直接 <code>exp(x)</code>，得到 <code>[${naive.map((v) => fmtV(v)).join(', ')}]</code>，sum = inf，inf/inf = NaN，概率全崩。`,
        [arr('n', 'naive exp(x)（溢出！）', naive.map((v) => (isFinite(v) ? v : '∞')), x.map(() => 'bad')), arr('l', 'logits x', x)]);
    }
    rec.step(4, `每个元素减 max：<code>x − ${m}</code> = [${sub.map((v) => round(v, 2)).join(', ')}]。最大值变 0，其余全为负。`,
      [{ type: 'row', id: 'sub', items: [
        { label: 'x', values: [x] },
        { op: '−' },
        { label: 'max', values: [[m]] },
        { op: '→' },
        { label: 'x − max', values: [sub.map((v) => round(v, 2))], colors: Object.fromEntries(sub.map((v, i) => [`0,${i}`, v === 0 ? 'hl' : ''])) }] }]);
    rec.step(5, `<code>e = exp(x − max)</code> = [${e.map((v) => round(v, 3)).join(', ')}]。现在所有值 ∈ (0, 1]，不可能溢出。`,
      [arr('e', 'e = exp(x − max)', e.map((v) => round(v, 3)))]);
    rec.step(6, `<code>sum(e) = ${round(s, 4)}</code>，每个元素除以它。`,
      [arr('e', 'e', e.map((v) => round(v, 3)), e.map(() => 'cmp')), { type: 'vars', id: 'v', items: { 'sum(e)': round(s, 4) } }]);
    rec.step(6, `输出概率 = [${out.map((v) => round(v, 4)).join(', ')}]，和为 1。最大 logit ${x.indexOf(Math.max(...x))} 拿到最大概率 ${round(Math.max(...out), 4)}——softmax 放大了差距但保持了相对大小。`,
      [{ type: 'probs', id: 'p', label: 'softmax(x) 概率分布', tokens: labels, values: out, fmt: (v) => round(v, 4) }]);
    return { steps: rec.steps, result: out.map((v) => round(v, 6)) };
  },
  solve({ x }) {
    // independent: softmax in log space via logsumexp
    const lse = Math.log(x.reduce((a, v) => a + Math.exp(v - Math.max(...x)), 0)) + Math.max(...x);
    return x.map((v) => round(Math.exp(v - lse), 6));
  },
};
