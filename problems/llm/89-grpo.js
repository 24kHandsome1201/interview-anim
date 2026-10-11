import { recorder, round } from '../../js/util.js';

const code = `import torch

def grpo(rewards, lp_new, lp_old, lp_ref, eps=0.2, beta=0.04):
    mean, std = rewards.mean(), rewards.std()
    adv = (rewards - mean) / (std + 1e-8)    # 组内相对优势
    ratio = torch.exp(lp_new - lp_old)
    s1 = ratio * adv
    s2 = torch.clamp(ratio, 1 - eps, 1 + eps) * adv
    kl = (lp_ref - lp_new).exp() - (lp_ref - lp_new) - 1   # k3 估计
    loss = -(torch.min(s1, s2) - beta * kl).mean()
    return adv, loss`;

export default {
  id: 'llm-89', track: 'llm', num: 89, title: 'GRPO 组内优势', category: '对齐 / RL',
  code,
  oneLine: '同一 prompt 采 G 条，用组内均值/标准差当 baseline',
  summary: 'GRPO（DeepSeek）：去掉 PPO 的 value network，对同一 prompt 采 G 条回复，用组内奖励的均值和标准差直接算 advantage。',
  ideas: [
    'PPO 需要训一个 value model 估计 baseline；GRPO 用<b>组内平均奖励</b>当 baseline：<code>A_i = (r_i − mean) / std</code>。',
    '同一 prompt 下哪些回复比同伴好、好多少，组内对比直接给出——比绝对奖励稳定且省一个网络。',
    '之后就是 PPO 式 clip 目标，再加一项到 ref 模型的 KL 惩罚（k3 估计器 <code>e^x − x − 1</code> 恒 ≥ 0）。',
  ],
  complexity: '每组 O(G·T)',
  presets: [
    { name: 'G=4', input: { rewards: [3.0, 1.0, 0.5, 0.2], lp_new: [0.1, -0.1, 0.05, 0.2], lp_old: [0, 0, 0, 0], lp_ref: [0.05, -0.05, 0.0, 0.1], eps: 0.2, beta: 0.04 } },
    { name: 'G=5', input: { rewards: [2.0, 2.0, 1.0, 0.0, 0.0], lp_new: [0.1, 0.1, -0.1, 0.0, 0.05], lp_old: [0, 0, 0, 0, 0], lp_ref: [0, 0, 0, 0, 0], eps: 0.2, beta: 0.04 } },
  ],
  validate(inp) {
    const n = inp.rewards?.length;
    if (!Array.isArray(inp.rewards) || n < 2 || n > 8) return 'rewards 取 2~8 个（组大小 G）';
    for (const k of ['lp_new', 'lp_old', 'lp_ref']) if (!Array.isArray(inp[k]) || inp[k].length !== n) return '四个数组等长';
    return null;
  },
  run({ rewards, lp_new, lp_old, lp_ref, eps = 0.2, beta = 0.04 }) {
    const rec = recorder();
    const G = rewards.length;
    const mean = rewards.reduce((a, b) => a + b, 0) / G;
    const std = Math.sqrt(rewards.reduce((a, r) => a + (r - mean) ** 2, 0) / G);
    const adv = rewards.map((r) => (r - mean) / (std + 1e-8));
    const scene = (extra = {}, vars = {}) => [
      { type: 'array', id: 'r', label: `同一 prompt 采的 ${G} 条回复的奖励`, values: rewards.map(String), colors: extra },
      { type: 'vars', id: 'v', items: { '组内 mean': round(mean, 3), '组内 std': round(std, 4), ...vars } },
    ];
    rec.step(4, `同一 prompt 采 ${G} 条回复，奖励 = [${rewards.join(', ')}]。GRPO 的 baseline 就是<b>组内均值</b>，不需要 value model。`, scene());
    rec.step(4, `<code>mean = ${round(mean, 3)}</code>，<code>std = ${round(std, 4)}</code>。`, scene({}, {}));
    for (let i = 0; i < G; i++) {
      rec.step(5, `<code>A[${i}] = (${rewards[i]} − ${round(mean, 3)}) / ${round(std, 4)} = ${round(adv[i], 3)}</code>。${adv[i] > 0 ? '高于组均值 → 正优势，更新会提高它的概率' : '低于组均值 → 负优势，更新会压低它'}。`,
        scene({ [i]: adv[i] > 0 ? 'ok' : 'bad' }, { [`A[${i}]`]: round(adv[i], 3) }));
    }
    // clip objective sketch
    const rows = adv.map((a, i) => {
      const ratio = Math.exp(lp_new[i] - lp_old[i]);
      const clip = Math.min(Math.max(ratio, 1 - eps), 1 + eps);
      const s1 = ratio * a, s2 = clip * a;
      const mn = Math.min(s1, s2);
      const kl = Math.exp(lp_ref[i] - lp_new[i]) - (lp_ref[i] - lp_new[i]) - 1;
      const obj = mn - beta * kl;
      return { ratio, clip, s1, s2, mn, kl, obj };
    });
    for (let i = 0; i < G; i++) {
      const t = rows[i];
      rec.step([6, 7, 8, 9], `回复 ${i}：<code>ratio = ${round(t.ratio, 3)}</code>，adv = ${round(adv[i], 3)} → min(r·A, clip·A) = <code>${round(t.mn, 3)}</code>；k3 KL = e^(${round(lp_ref[i] - lp_new[i], 2)})−(${round(lp_ref[i] - lp_new[i], 2)})−1 = ${round(t.kl, 4)}，扣 β·KL = ${round(beta * t.kl, 4)}。`,
        [{ type: 'vars', id: 'v', items: { i, ratio: round(t.ratio, 3), adv: round(adv[i], 3), 'min项': round(t.mn, 3), 'k3 KL': round(t.kl, 4), '目标': round(t.obj, 4) } }]);
    }
    const loss = -rows.reduce((a, t) => a + t.obj, 0) / G;
    rec.step([10, 11], `<code>loss = −mean(目标项) = ${round(loss, 5)}</code>。优势数组 = [${adv.map((a) => round(a, 2)).join(', ')}]——GRPO 的全部「value model」就是这一行减法。`, scene());
    return { steps: rec.steps, result: { adv: adv.map((a) => round(a, 4)), loss: round(loss, 6) } };
  },
  solve({ rewards, lp_new, lp_old, lp_ref, eps = 0.2, beta = 0.04 }) {
    const G = rewards.length;
    const mean = rewards.reduce((a, b) => a + b) / G;
    const sd = Math.sqrt(rewards.reduce((a, r) => a + (r - mean) ** 2, 0) / G);
    const advRaw = rewards.map((r) => (r - mean) / (sd + 1e-8));
    let s = 0;
    for (let i = 0; i < G; i++) {
      const r = Math.exp(lp_new[i] - lp_old[i]);
      const c = Math.min(Math.max(r, 1 - eps), 1 + eps);
      const kl = Math.exp(lp_ref[i] - lp_new[i]) - (lp_ref[i] - lp_new[i]) - 1;
      s += Math.min(r * advRaw[i], c * advRaw[i]) - beta * kl;
    }
    return { adv: advRaw.map((a) => round(a, 4)), loss: round(-s / G, 6) };
  },
};
