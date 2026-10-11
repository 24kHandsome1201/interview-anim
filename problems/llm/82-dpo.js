import { recorder, round } from '../../js/util.js';

const code = `import torch
import torch.nn.functional as F

def dpo_loss(lp_pol_c, lp_pol_r,
             lp_ref_c, lp_ref_r, beta):
    # 每条：policy 相对 ref 对 chosen / rejected 的偏好差
    logit = beta * ((lp_pol_c - lp_ref_c)
                    - (lp_pol_r - lp_ref_r))
    return -F.logsigmoid(logit).mean()`;

export default {
  id: 'llm-82', track: 'llm', num: 82, title: 'DPO Loss', category: '对齐 / RL',
  code,
  oneLine: '让 policy 比 ref 更偏好 chosen：−logσ(β·Δlog_ratio)',
  summary: 'DPO（Direct Preference Optimization）：跳过奖励模型和 RL，直接用偏好对 (chosen, rejected) 训 policy 相对 reference 模型抬高 chosen、压低 rejected。',
  ideas: [
    '对每对样本算 <code>log(π/ref)</code>：chosen 的 log-ratio 应升高，rejected 的应降低。',
    '核心量 <code>logit = β·[(lp_π(c)−lp_ref(c)) − (lp_π(r)−lp_ref(r))]</code>：两个 log-ratio 之差，衡量 policy 相对 ref 多偏 chosen 多少。',
    '<b>β 是 KL 强度</b>：β 大 → logit 对差异更敏感、policy 偏离 ref 的代价更高；loss = −logsigmoid(logit) 的均值。',
  ],
  complexity: '每对 O(1)（log-probs 已由前向得到）',
  presets: [
    { name: '3 对样本, β=0.1', input: { beta: 0.1, lp_pol_c: [-1.2, -0.8, -2.0], lp_pol_r: [-2.5, -2.0, -3.0], lp_ref_c: [-1.5, -1.0, -2.0], lp_ref_r: [-2.0, -1.8, -2.5] } },
    { name: 'β=1.0（更强约束）', input: { beta: 1.0, lp_pol_c: [-1.2, -0.8], lp_pol_r: [-2.5, -2.0], lp_ref_c: [-1.5, -1.0], lp_ref_r: [-2.0, -1.8] } },
  ],
  validate(inp) {
    for (const k of ['lp_pol_c', 'lp_pol_r', 'lp_ref_c', 'lp_ref_r'])
      if (!Array.isArray(inp[k]) || inp[k].some((v) => typeof v !== 'number')) return `${k} 需要是数字数组`;
    const n = inp.lp_pol_c.length;
    if (n < 1 || n > 6 || ['lp_pol_r', 'lp_ref_c', 'lp_ref_r'].some((k) => inp[k].length !== n)) return '四个数组等长，1~6 对';
    if (typeof inp.beta !== 'number' || inp.beta <= 0) return 'beta 需要正数';
    return null;
  },
  run(inp) {
    const rec = recorder();
    const { beta } = inp;
    const n = inp.lp_pol_c.length;
    const logsig = (x) => -Math.log(1 + Math.exp(-x));
    const rows = [];
    const scene = (i = -1, vars = {}) => [
      { type: 'matrix', id: 'd', label: '每对样本的计算', values: rows.map((r) => r.slice(0, 7)), rowLabels: rows.map((_, k) => `pair${k}`), colLabels: ['π_c−ref_c', 'π_r−ref_r', '差', 'logit=β·差', 'loss', '', ''], colors: i >= 0 ? Object.fromEntries([0, 1, 2, 3, 4].map((j) => [`${i},${j}`, 'cur'])) : {} },
      { type: 'vars', id: 'v', items: { β: beta, ...vars } },
    ];
    rec.step([4, 5], `${n} 对偏好样本，β = ${beta}。先算每个 log-ratio：<code>π/ref</code> 在 chosen 和 rejected 上各偏了多少。`, scene());
    let total = 0;
    for (let i = 0; i < n; i++) {
      const dc = inp.lp_pol_c[i] - inp.lp_ref_c[i];
      const dr = inp.lp_pol_r[i] - inp.lp_ref_r[i];
      const diff = dc - dr;
      const logit = beta * diff;
      const loss = -logsig(logit);
      rows.push([round(dc, 3), round(dr, 3), round(diff, 3), round(logit, 3), round(loss, 4), '', '']);
      total += loss;
      rec.step(6, `pair${i}：chosen log-ratio = ${round(inp.lp_pol_c[i])} − (${round(inp.lp_ref_c[i])}) = <code>${round(dc, 3)}</code>；rejected = <code>${round(dr, 3)}</code>。policy 在 chosen 上比 ref 高 ${round(dc - dr, 3)}。`, scene(i));
      rec.step([7, 8], `<code>logit = ${beta} × (${round(dc, 3)} − ${round(dr, 3)}) = ${round(logit, 3)}</code> → loss = −logσ(${round(logit, 3)}) = <code>${round(loss, 4)}</code>。logit 越大（越偏好 chosen）loss 越小。`, scene(i));
    }
    const mean = total / n;
    rec.step(9, `<code>loss = mean = ${round(mean, 4)}</code>。梯度会推高 π(chosen)、压低 π(rejected)——但都以 ref 为锚，β 越大锚越紧。`, scene(-1, { 'mean loss': round(mean, 5) }));
    return { steps: rec.steps, result: round(mean, 6) };
  },
  solve(inp) {
    const { beta } = inp;
    const n = inp.lp_pol_c.length;
    let s = 0;
    for (let i = 0; i < n; i++) {
      const z = beta * ((inp.lp_pol_c[i] - inp.lp_ref_c[i]) - (inp.lp_pol_r[i] - inp.lp_ref_r[i]));
      s += Math.log(1 + Math.exp(-z));
    }
    return round(s / n, 6);
  },
};
