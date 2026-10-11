import { recorder } from '../../js/util.js';

const code = `def subarraySum(nums, k):
    cnt = {0: 1}       # 前缀和 -> 出现次数
    pre = 0
    ans = 0
    for x in nums:
        pre += x
        ans += cnt.get(pre - k, 0)
        cnt[pre] = cnt.get(pre, 0) + 1
    return ans`;

export default {
  id: 'lc-560', track: 'algo', num: 560, slug: 'subarray-sum-equals-k', title: '和为 K 的子数组', category: '哈希', difficulty: '中等',
  code,
  oneLine: '前缀和 + 哈希表，把「子数组和为 k」变成「pre − k 出现过几次」',
  summary: '给定整数数组 nums 和整数 k，统计和为 k 的连续子数组个数（数组里有负数，滑动窗口失效）。',
  ideas: [
    '子数组 <code>[j+1..i]</code> 的和 = <code>pre[i] − pre[j]</code>。要和为 k，即 <code>pre[j] = pre[i] − k</code>。',
    '所以遍历到 i 时，只需知道<b>前缀和等于 pre − k 的次数</b>，直接累加进答案。',
    '注意先把 <code>{0: 1}</code> 放进表里：空前缀和为 0，处理从头开始的子数组。',
  ],
  complexity: '时间 O(n)，空间 O(n)',
  presets: [
    { name: '示例 1', input: { nums: [1, 1, 1], k: 2 } },
    { name: '示例 2（含负数）', input: { nums: [1, 2, -1, 3, -2, 1], k: 3 } },
  ],
  validate(inp) {
    if (!Array.isArray(inp.nums) || inp.nums.some((x) => !Number.isInteger(x))) return 'nums 需要是整数数组';
    if (!Number.isInteger(inp.k)) return 'k 需要是整数';
    if (inp.nums.length > 12) return '为了动画清晰，最多 12 个元素';
    return null;
  },
  run({ nums, k }) {
    const rec = recorder();
    const n = nums.length;
    const cnt = new Map([[0, 1]]);
    const pre = Array(n).fill('');
    const dim = {};
    let p = 0, ans = 0;
    const entries = () => [...cnt.entries()];
    const scene = (extra = {}, vars = {}) => [
      { type: 'array', id: 'a', label: 'nums', values: nums, colors: { ...dim, ...extra }, pointers: { i: vars.i } },
      { type: 'array', id: 'p', label: '前缀和 pre', values: [...pre], showIndex: true },
      { type: 'map', id: 'm', label: 'cnt（前缀和 → 次数）', headers: ['前缀和', '次数'], entries: entries(), colors: extra.__map || {} },
      { type: 'vars', id: 'v', items: { k, pre: p, 'pre − k': p - k, ans, ...vars } },
    ];
    rec.step(2, '先放入 <code>{0: 1}</code>：空前缀的和是 0，这样「从第 0 个元素开始」的子数组也能被统计到。', scene({}, { i: null }));
    for (let i = 0; i < n; i++) {
      p += nums[i]; pre[i] = p;
      rec.step([5, 6], `加入 <code>nums[${i}] = ${nums[i]}</code>，前缀和更新为 <code>pre = ${p}</code>。`, scene({ [i]: 'cur' }, { i }));
      const need = p - k;
      const hit = cnt.get(need) || 0;
      ans += hit;
      rec.step(7, `要凑出和为 ${k} 的子数组，需要之前出现过前缀和 <code>${p} − ${k} = ${need}</code>。表里出现了 <code>${hit}</code> 次 → ans += ${hit}${hit ? '，说明有 ' + hit + ' 个以 i 结尾的合法子数组' : ''}。`,
        scene({ [i]: hit ? 'ok' : 'cur', __map: { [need]: hit ? 'ok' : 'bad' } }, { i }));
      cnt.set(p, (cnt.get(p) || 0) + 1);
      rec.step(8, `把当前前缀和 <code>${p}</code> 记入表中，次数变为 <code>${cnt.get(p)}</code>。`, scene({ [i]: 'dim', __map: { [p]: 'hl' } }, { i }));
      dim[i] = 'dim';
    }
    rec.step(9, `遍历结束，和为 ${k} 的子数组共有 <code>${ans}</code> 个。`, scene({}, { i: null }));
    return { steps: rec.steps, result: ans };
  },
  solve({ nums, k }) {
    let ans = 0;
    for (let i = 0; i < nums.length; i++) {
      let s = 0;
      for (let j = i; j < nums.length; j++) { s += nums[j]; if (s === k) ans++; }
    }
    return ans;
  },
};
