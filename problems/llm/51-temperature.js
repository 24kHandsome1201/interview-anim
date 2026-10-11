import { recorder, round, softmax } from '../../js/util.js';

const code = `import torch

def sample(logits, temperature, u):
    p = torch.softmax(logits / temperature, dim=-1)
    cum = 0.0
    for i, pi in enumerate(p):
        cum += pi
        if u < cum:
            return i          # 按累积分布采样
    return len(p) - 1`;

const TOK = ['的', '是', '在', '我', '了', '和', '有', '不'];

export default {
  id: 'llm-51', track: 'llm', num: 51, title: 'Temperature 采样', category: '解码采样',
  code,
  oneLine: 'logits ÷ T 再 softmax：T 小更尖锐，T 大更平均',
  summary: '温度采样：softmax 前先把 logits 除以温度 T。T < 1 放大差距（接近 argmax），T > 1 抹平分布（更随机），T → 0 即贪心。',
  ideas: [
    '<code>p = softmax(logits / T)</code>：T 缩小等价于 logits 放大 → 高分 token 概率更高，分布更尖。',
    'T = 1 是原始分布；T → 0 退化为 argmax；T → ∞ 趋向均匀分布。',
    '采样就是掷一次落在累积分布上的骰子：给一个 u ∈ [0,1)，找第一个使累积概率 > u 的 token。',
  ],
  complexity: '时间 O(vocab)',
  presets: [
    { name: '常规', input: { logits: [3.0, 2.0, 1.0, 0.5], u: 0.7 } },
    { name: '差距小', input: { logits: [1.2, 1.0, 0.9, 0.8, 0.5], u: 0.5 } },
  ],
  validate(inp) {
    if (!Array.isArray(inp.logits) || inp.logits.some((v) => typeof v !== 'number')) return 'logits 需要是数字数组';
    if (inp.logits.length < 2 || inp.logits.length > 8) return '长度 2~8';
    if (typeof inp.u !== 'number' || inp.u < 0 || inp.u >= 1) return 'u 取 [0, 1)';
    return null;
  },
  run({ logits, u }) {
    const rec = recorder();
    const tk = TOK.slice(0, logits.length);
    const Ts = [0.5, 1, 2];
    const pick = (p) => { let c = 0; for (let i = 0; i < p.length; i++) { c += p[i]; if (u < c) return i; } return p.length - 1; };
    const probs = Ts.map((T) => softmax(logits.map((v) => v / T)));
    const picks = probs.map(pick);
    const probsLayer = (label, vals, colors) => ({ type: 'probs', id: 'p', label, tokens: tk, values: vals.map((v) => round(v, 4)), colors, fmt: (v) => round(v, 4) });
    rec.step(4, `logits = [${logits.join(', ')}]，固定随机数 <code>u = ${u}</code> 做累积分布采样。对比三个温度：T = ${Ts.join('、')}。`,
      [probsLayer('T=1 的原始分布', probs[1])]);
    for (let ti = 0; ti < Ts.length; ti++) {
      const T = Ts[ti], p = probs[ti];
      const scaled = logits.map((v) => v / T);
      rec.step(4, `T = ${T}：logits/T = [${scaled.map((v) => round(v, 2)).join(', ')}]${T < 1 ? '——除以小于 1 的数放大了差距' : T > 1 ? '——除以大于 1 的数压缩了差距' : ''}。softmax 后分布${T < 1 ? '更尖锐' : T > 1 ? '更平坦' : '不变'}。`,
        [probsLayer(`T = ${T} 的分布`, p), { type: 'vars', id: 'v', items: { T, '最大概率': `${tk[p.indexOf(Math.max(...p))]}: ${round(Math.max(...p), 3)}` } }]);
      let c = 0;
      for (let i = 0; i <= picks[ti]; i++) {
        c += p[i];
        rec.step([5, 6, 7, 8], `累积到「${tk[i]}」：cum += ${round(p[i], 3)} = ${round(c, 3)}。${u < c ? `<code>u = ${u} < ${round(c, 3)}</code> → 命中 <code>${tk[i]}</code>！` : '还没超过 u，继续。'}`,
          [probsLayer(`T = ${T}，u = ${u} 落在累积分布上的位置`, p, p.map((_, j) => (j < i ? 'dim' : j === i ? (u < c ? 'ok' : 'cur') : '')))]);
        if (u < c) break;
      }
    }
    rec.step(9, `对比结果：T = ${Ts.map((T, i) => `${T} → ${tk[picks[i]]}`).join('；')}。低温几乎总选概率最大的 token，高温给小概率 token 更多机会。`,
      [probsLayer('最终对比', probs[0], probs[0].map((_, j) => (j === picks[0] ? 'ok' : '')))]);
    return { steps: rec.steps, result: Object.fromEntries(Ts.map((T, i) => [T, tk[picks[i]]])) };
  },
  solve({ logits, u }) {
    const Ts = [0.5, 1, 2];
    const out = {};
    for (const T of Ts) {
      const m = Math.max(...logits) / T;
      const e = logits.map((v) => Math.exp(v / T - m));
      const s = e.reduce((a, b) => a + b, 0);
      let c = 0, i = 0;
      for (; i < e.length; i++) { c += e[i] / s; if (u < c) break; }
      out[T] = TOK[Math.min(i, e.length - 1)];
    }
    return out;
  },
};
