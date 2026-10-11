import { recorder } from '../../js/util.js';

const code = `from collections import deque

def maxSlidingWindow(nums, k):
    dq = deque()       # 存下标，对应值单调递减
    ans = []
    for i, x in enumerate(nums):
        while dq and nums[dq[-1]] < x:
            dq.pop()   # 比 x 小又靠左，不可能是最大值
        dq.append(i)
        if dq[0] <= i - k:
            dq.popleft()  # 队头滑出窗口
        if i >= k - 1:
            ans.append(nums[dq[0]])
    return ans`;

export default {
  id: 'lc-239', track: 'algo', num: 239, slug: 'sliding-window-maximum', title: '滑动窗口最大值', category: '滑动窗口', difficulty: '困难',
  code,
  oneLine: '单调递减双端队列，队头永远是窗口最大值',
  summary: '大小为 k 的窗口在数组上从左往右滑，返回每个窗口里的最大值。',
  ideas: [
    '队列里存<b>下标</b>，保持它们对应的值<b>单调递减</b>：新元素 x 进队前，把队尾所有比 x 小的下标弹出——它们又小又靠左，永无出头之日。',
    '队头就是当前最大值。每次滑窗后检查队头是否还在窗口内（<code>dq[0] ≤ i−k</code>），不在就弹出。',
    '每个元素最多进队、出队一次，所以是 O(n) 而不是 O(nk)。',
  ],
  complexity: '时间 O(n)，空间 O(k)',
  presets: [
    { name: '示例 1', input: { nums: [1, 3, -1, -3, 5, 3, 6, 7], k: 3 } },
    { name: '示例 2', input: { nums: [9, 10, 9, -7, -4, -8, 2, -6], k: 5 } },
  ],
  validate(inp) {
    if (!Array.isArray(inp.nums) || inp.nums.some((x) => !Number.isInteger(x))) return 'nums 需要是整数数组';
    if (!Number.isInteger(inp.k) || inp.k < 1 || inp.k > inp.nums.length) return 'k 取 1 ~ len(nums)';
    if (inp.nums.length > 12) return '为了动画清晰，最多 12 个元素';
    return null;
  },
  run({ nums, k }) {
    const rec = recorder();
    const dq = [];
    const ans = [];
    let i = -1;
    const winColors = () => {
      const c = {};
      for (let j = Math.max(0, i - k + 1); j <= i; j++) c[j] = 'win';
      return c;
    };
    const scene = (extra = {}, vars = {}) => [
      { type: 'array', id: 'a', label: `nums（窗口大小 k=${k}，蓝底为当前窗口）`, values: nums, colors: { ...winColors(), ...extra }, pointers: { i } },
      { type: 'array', id: 'd', label: '单调队列 dq（显示下标对应的值）', values: dq.map((x) => nums[x]), indexLabels: dq.map(String), colors: Object.fromEntries(dq.map((x, j) => [j, x === dq[0] && i >= k - 1 ? 'hl' : ''])) },
      { type: 'array', id: 'r', label: '答案 ans', values: ans, showIndex: false },
      { type: 'vars', id: 'v', items: { i, '窗口': i >= 0 ? `[${Math.max(0, i - k + 1)}, ${i}]` : '—', ...vars } },
    ];
    rec.step(4, '初始化空的<b>单调递减</b>队列 dq（存下标）：队首始终是窗口最大值的下标。', scene());
    for (i = 0; i < nums.length; i++) {
      const x = nums[i];
      rec.step(6, `i = ${i}，<code>x = ${x}</code> 进窗口。窗口范围 [${Math.max(0, i - k + 1)}, ${i}]。`, scene({ [i]: 'cur' }));
      while (dq.length && nums[dq[dq.length - 1]] < x) {
        const j = dq.pop();
        rec.step([7, 8], `队尾下标 ${j}（值 ${nums[j]}）比 ${x} 小，而且比 ${x} 靠左，之后任何窗口只要有 ${x} 就不会选它 → <code>dq.pop()</code>。`, scene({ [j]: 'bad', [i]: 'cur' }));
      }
      dq.push(i);
      rec.step(9, `<code>dq.append(${i})</code>。队列对应的值保持单调递减：[${dq.map((j) => nums[j]).join(', ')}]。`, scene({ [i]: 'hl' }));
      if (dq[0] <= i - k) {
        const j = dq.shift();
        rec.step([10, 11], `队头下标 ${j} 已滑出窗口（${j} ≤ ${i} − ${k}），<code>dq.popleft()</code>。`, scene({ [j]: 'bad' }));
      }
      if (i >= k - 1) {
        ans.push(nums[dq[0]]);
        rec.step([12, 13], `窗口已满。队头 <code>dq[0] = ${dq[0]}</code> 即最大值下标 → ans 加入 <code>${nums[dq[0]]}</code>。`, scene({ [dq[0]]: 'ok' }));
      }
    }
    rec.step(14, `结束。所有窗口最大值：<code>[${ans.join(', ')}]</code>。`, scene());
    return { steps: rec.steps, result: ans };
  },
  solve({ nums, k }) {
    const ans = [];
    for (let i = k - 1; i < nums.length; i++) ans.push(Math.max(...nums.slice(i - k + 1, i + 1)));
    return ans;
  },
};
