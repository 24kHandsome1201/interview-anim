import { recorder, round } from '../../js/util.js';

const code = `import torch

def ppo_clip_loss(lp_new, lp_old, adv, eps=0.2):
    ratio = torch.exp(lp_new - lp_old)
    s1 = ratio * adv
    s2 = torch.clamp(ratio, 1 - eps, 1 + eps) * adv
    loss = -torch.min(s1, s2).mean()
    return loss`;

export default {
  id: 'llm-85', track: 'llm', num: 85, title: 'PPO Clip 目标', category: '对齐 / RL',
  code,
  oneLine: 'ratio 超界就 clip 掉梯度：不让一步更新走太远',
  summary: 'PPO 的 clip 目标：新策略相对旧策略的概率比 ratio 被截断在 [1−ε, 1+ε]，防止单次更新幅度过大导致训练崩溃。',
  ideas: [
    '<code>ratio = exp(lp_new − lp_old)</code>：新策略比旧策略对该 token 更倾向（>1）还是更不倾向（<1）。',
    '目标项 = ratio·adv：<b>clip 版本</b>把 ratio 压在 [1−ε, 1+ε]；取两者 min 保证不「贪多」——advantage 为正时防止过度放大，为负时防止过度惩罚。',
    '被 clip 的位置梯度为 0：这就是「一步最多走 ε 远」的实现方式（TRPO 的近似）。',
  ],
  complexity: '每 token O(1)',
  presets: [
    { name: '混合情形', input: { eps: 0.2, lp_new: [0.1, -0.5, 2.0, -1.0], lp_old: [0.0, 0.0, 1.0, 0.0], adv: [1.0, 1.0, -1.5, 2.0] } },
    { name: '全在界内', input: { eps: 0.2, lp_new: [0.1, -0.1, 0.05], lp_old: [0.0, 0.0, 0.0], adv: [1.0, -1.0, 0.5] } },
  ],
  validate(inp) {
    for (const k of ['lp_new', 'lp_old', 'adv'])
      if (!Array.isArray(inp[k]) || inp[k].some((v) => typeof v !== 'number')) return `${k} 需要是数字数组`;
    const n = inp.lp_new.length;
    if (n < 1 || n > 8 || inp.lp_old.length !== n || inp.adv.length !== n) return '三个数组等长，1~8 个 token';
    if (typeof inp.eps !== 'number' || inp.eps <= 0 || inp.eps > 0.5) return 'eps 取 (0, 0.5]';
    return null;
  },
  run({ lp_new, lp_old, adv, eps = 0.2 }) {
    const rec = recorder();
    const n = lp_new.length;
    const rows = [];
    const scene = (i = -1, vars = {}) => [
      { type: 'matrix', id: 'd', label: '逐 token 计算（clip 触发的格子标红）', values: rows, rowLabels: rows.map((_, k) => `tok${k}`), colLabels: ['ratio', 's1=r·A', 's2=clip(r)·A', 'min', 'loss项'], colors: {} },
      { type: 'vars', id: 'v', items: { ε: eps, ...vars } },
    ];
    rec.step(4, `${n} 个 token：每个有 lp_new、lp_old 和 advantage。ratio = e^(new−old)，超过 [${1 - eps}, ${1 + eps}] 就被 clip。`, scene());
    let total = 0;
    const cellColors = {};
    for (let i = 0; i < n; i++) {
      const ratio = Math.exp(lp_new[i] - lp_old[i]);
      const clipped = Math.min(Math.max(ratio, 1 - eps), 1 + eps);
      const s1 = ratio * adv[i];
      const s2 = clipped * adv[i];
      const mn = Math.min(s1, s2);
      const didClip = clipped !== ratio;
      rows.push([round(ratio, 3), round(s1, 3), round(s2, 3), round(mn, 3), round(-mn, 4)]);
      const cc = { [`${i},0`]: 'cur', [`${i},1`]: 'cmp', [`${i},2`]: didClip ? 'bad' : 'cmp', [`${i},3`]: 'ok', [`${i},4`]: 'ok' };
      total += -mn;
      rec.step([4, 5, 6], `tok${i}：<code>ratio = e^(${round(lp_new[i], 2)} − ${round(lp_old[i], 2)}) = ${round(ratio, 3)}</code>，adv = ${adv[i]}。${didClip ? `⚠️ ratio 超出 [${1 - eps}, ${1 + eps}]，被 clip 到 <code>${round(clipped, 3)}</code>` : '在界内，不 clip'}。`,
        [{ type: 'matrix', id: 'd', label: '逐 token 计算', values: rows, rowLabels: rows.map((_, k) => `tok${k}`), colLabels: ['ratio', 's1=r·A', 's2=clip(r)·A', 'min', 'loss项'], colors: cc }, { type: 'vars', id: 'v', items: { ε: eps, i, ratio: round(ratio, 3), adv: adv[i], clipped: didClip } }]);
      rec.step([7, 8], `<code>min(s1, s2) = min(${round(s1, 3)}, ${round(s2, 3)}) = ${round(mn, 3)}</code> → 该 token 贡献 loss = −(${round(mn, 3)}) = <code>${round(-mn, 4)}</code>。${didClip ? '取 min 意味着选择了 clip 后较小的项——超额部分不给梯度。' : ''}`,
        [{ type: 'matrix', id: 'd', label: '逐 token 计算', values: rows, rowLabels: rows.map((_, k) => `tok${k}`), colLabels: ['ratio', 's1=r·A', 's2=clip(r)·A', 'min', 'loss项'], colors: cc }]);
    }
    const loss = -(-total) / n * -1;
    const mean = total / n;
    rec.step(8, `<code>loss = −mean(min(s1,s2)) = ${round(mean, 5)}</code>。红色列 = clip 触发：那些位置梯度被截断，policy 一步最多移动 ε。`, scene(-1, { loss: round(mean, 5) }));
    return { steps: rec.steps, result: round(mean, 6) };
  },
  solve({ lp_new, lp_old, adv, eps = 0.2 }) {
    let s = 0;
    for (let i = 0; i < lp_new.length; i++) {
      const r = Math.exp(lp_new[i] - lp_old[i]);
      const c = Math.min(Math.max(r, 1 - eps), 1 + eps);
      s -= Math.min(r * adv[i], c * adv[i]);
    }
    return round(s / lp_new.length, 6);
  },
};
