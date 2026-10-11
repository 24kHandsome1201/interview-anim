import { recorder } from '../../js/util.js';

const code = `def dailyTemperatures(T):
    ans = [0] * len(T)
    st = []                # 存下标，对应温度单调递减
    for i, t in enumerate(T):
        while st and T[st[-1]] < t:
            j = st.pop()   # j 等来了第一个更暖的日子
            ans[j] = i - j
        st.append(i)
    return ans`;

export default {
  id: 'lc-739', track: 'algo', num: 739, slug: 'daily-temperatures', title: '每日温度', category: '栈', difficulty: '中等',
  code,
  oneLine: '单调递减栈：每个更暖的日子一次性结算栈里所有比它冷的天',
  summary: '每天一个温度，对每一天求「还要等几天才会更暖」，没有则为 0。',
  ideas: [
    '栈里存<b>还没等到更暖天</b>的下标，对应温度保持单调递减。',
    '遇到温度 t 时，栈顶所有比 t 冷的天都等到了答案——它们的第一个更暖日就是今天 i，逐个弹出结算 <code>ans[j] = i − j</code>。',
    '每个下标只进栈、出栈一次，所以是 O(n)。留在栈里的天答案就是初始化的 0。',
  ],
  complexity: '时间 O(n)，空间 O(n)',
  presets: [
    { name: '示例 1', input: { T: [73, 74, 75, 71, 69, 72, 76, 73] } },
    { name: '单调递减', input: { T: [90, 80, 70, 60, 85] } },
  ],
  validate(inp) {
    if (!Array.isArray(inp.T) || inp.T.some((x) => !Number.isInteger(x))) return 'T 需要是整数数组';
    if (!inp.T.length || inp.T.length > 10) return '长度 1~10';
    return null;
  },
  run({ T }) {
    const rec = recorder();
    const n = T.length;
    const ans = Array(n).fill(0);
    const st = [];
    const done = {};
    let i = -1;
    const scene = (extra = {}) => [
      { type: 'array', id: 'a', label: '温度 T', values: T, colors: { ...done, ...extra }, pointers: { i } },
      { type: 'array', id: 's', label: '栈 st（显示下标，温度单调递减）', values: st.map(String), indexLabels: st.map((x) => T[x]) },
      { type: 'array', id: 'r', label: 'ans（还要等几天）', values: [...ans] },
    ];
    rec.step(2, '<code>ans</code> 全 0（默认等不到更暖的天）。栈存「还在等」的下标，温度保持单调递减。', scene());
    for (i = 0; i < n; i++) {
      const t = T[i];
      rec.step(4, `第 ${i} 天，温度 <code>${t}</code>。看看栈里哪些天比它冷——今天就是它们的第一个更暖日。`, scene({ [i]: 'cur' }));
      while (st.length && T[st[st.length - 1]] < t) {
        const j = st.pop();
        ans[j] = i - j;
        done[j] = 'ok';
        rec.step([5, 6, 7], `栈顶第 ${j} 天（${T[j]}° < ${t}°）弹出：<code>ans[${j}] = ${i} − ${j} = ${i - j}</code>。`, scene({ [j]: 'ok', [i]: 'cur' }));
      }
      st.push(i);
      rec.step(8, `第 ${i} 天入栈等待更暖的天。栈内温度保持递减：[${st.map((x) => T[x]).join(', ')}]。`, scene({ [i]: 'hl' }));
    }
    rec.step(9, `遍历结束。栈里剩下的天等不到更暖的日子（ans 保持 0）。最终 ans = <code>[${ans.join(', ')}]</code>。`, scene());
    return { steps: rec.steps, result: ans };
  },
  solve({ T }) {
    const n = T.length, ans = Array(n).fill(0);
    for (let i = 0; i < n; i++)
      for (let j = i + 1; j < n; j++)
        if (T[j] > T[i]) { ans[i] = j - i; break; }
    return ans;
  },
};
