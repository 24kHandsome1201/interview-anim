import { recorder } from '../../js/util.js';

const code = `def threeSum(nums):
    nums.sort()
    ans = []
    n = len(nums)
    for i in range(n):
        if i and nums[i] == nums[i - 1]:
            continue            # 跳过重复的三元组
        l, r = i + 1, n - 1
        while l < r:
            s = nums[i] + nums[l] + nums[r]
            if s < 0:
                l += 1
            elif s > 0:
                r -= 1
            else:
                ans.append([nums[i], nums[l], nums[r]])
                l += 1
                r -= 1
                while l < r and nums[l] == nums[l - 1]:
                    l += 1      # 跳过重复的左数
                while l < r and nums[r] == nums[r + 1]:
                    r -= 1      # 跳过重复的右数
    return ans`;

export default {
  id: 'lc-15', track: 'algo', num: 15, slug: '3sum', title: '三数之和', category: '双指针', difficulty: '中等',
  code,
  oneLine: '排序后固定一个数，剩下用双指针夹逼',
  summary: '找出数组中所有和为 0 且不重复的三元组。',
  ideas: [
    '先<b>排序</b>：有序后才能用双指针，而且相同元素相邻，方便去重。',
    '固定 <code>nums[i]</code>，问题退化成在 <code>[i+1, n−1]</code> 里找两数和 = <code>−nums[i]</code>，即排序版的两数之和。',
    '三处去重：i 与前一个相同则跳过；命中后 l/r 各自滑过相同值，避免重复三元组。',
  ],
  complexity: '时间 O(n²)，空间 O(log n)（排序栈）',
  presets: [
    { name: '示例 1', input: { nums: [-1, 0, 1, 2, -1, -4] } },
    { name: '示例 2（有重复）', input: { nums: [-2, 0, 0, 2, 2, -1, 1] } },
  ],
  validate(inp) {
    if (!Array.isArray(inp.nums) || inp.nums.some((x) => !Number.isInteger(x))) return 'nums 需要是整数数组';
    if (inp.nums.length < 3 || inp.nums.length > 10) return '数组长度 3~10';
    return null;
  },
  run({ nums }) {
    const rec = recorder();
    const a = [...nums].sort((x, y) => x - y);
    const n = a.length;
    const ans = [];
    let i = 0, l = -1, r = -1;
    const skip = new Set();
    const foundCells = {};
    const scene = (extra = {}, note = '') => [
      { type: 'array', id: 'a', label: `排序后的 nums${note}`, values: a, colors: { ...foundCells, ...Object.fromEntries([...skip].map((x) => [x, 'dim'])), ...extra }, pointers: { i, l, r } },
      { type: 'map', id: 'ans', label: '已找到的三元组', headers: ['#', '三元组'], entries: ans.length ? ans.map((t, k) => [k + 1, `[${t.join(', ')}]`]) : [['∅', '']] },
    ];
    rec.step(2, `先排序：<code>[${a.join(', ')}]</code>。固定第一个数，剩下两个用双指针从两端夹逼。`, scene({}, '（排序后相同元素相邻，去重容易）'));
    for (i = 0; i < n; i++) {
      if (i && a[i] === a[i - 1]) {
        skip.add(i);
        rec.step([6, 7], `<code>nums[${i}] = ${a[i]}</code> 与前一个相同，以它开头的三元组都找过了，<code>continue</code> 跳过。`, scene({ [i]: 'bad' }));
        continue;
      }
      l = i + 1; r = n - 1;
      rec.step(8, `固定 <code>nums[${i}] = ${a[i]}</code>（${a[i] > 0 ? '已大于 0，后面不会更小，但继续演示' : `需要 l、r 两数和 = ${-a[i]}`}），l = ${l}，r = ${r}。`, scene({ [i]: 'cur' }));
      while (l < r) {
        const s = a[i] + a[l] + a[r];
        rec.step(10, `<code>${a[i]} + ${a[l]} + ${a[r]} = ${s}</code>，${s === 0 ? '命中！' : s < 0 ? '偏小，l 右移使和变大。' : '偏大，r 左移使和变小。'}`, scene({ [i]: 'cur', [l]: 'cmp', [r]: 'cmp' }));
        if (s < 0) { l++; continue; }
        if (s > 0) { r--; continue; }
        ans.push([a[i], a[l], a[r]]);
        foundCells[l] = 'ok'; foundCells[r] = 'ok'; foundCells[i] = 'ok';
        rec.step([16, 17, 18], `记录三元组 <code>[${a[i]}, ${a[l]}, ${a[r]}]</code>，然后 l、r 同时内缩继续找下一组。`, scene());
        l++; r--;
        let skipped = 0;
        while (l < r && a[l] === a[l - 1]) { l++; skipped++; }
        while (l < r && a[r] === a[r + 1]) { r--; skipped++; }
        if (skipped) rec.step([20, 23], `跳过 ${skipped} 个与刚用过的值相同的元素，避免重复三元组。`, scene({ [i]: 'cur' }));
      }
    }
    rec.step(23, `结束。共找到 <code>${ans.length}</code> 个不重复三元组：${ans.map((t) => `[${t.join(', ')}]`).join('，') || '无'}。`, scene());
    const cmp = (x, y) => { for (let k = 0; k < 3; k++) if (x[k] !== y[k]) return x[k] - y[k]; return 0; };
    return { steps: rec.steps, result: [...ans].sort(cmp) };
  },
  solve({ nums }) {
    const a = [...nums].sort((x, y) => x - y);
    const out = new Set();
    for (let i = 0; i < a.length; i++)
      for (let j = i + 1; j < a.length; j++)
        for (let k = j + 1; k < a.length; k++)
          if (a[i] + a[j] + a[k] === 0) out.add([a[i], a[j], a[k]].join(','));
    return [...out].map((s) => s.split(',').map(Number)).sort((x, y) => { for (let k = 0; k < 3; k++) if (x[k] !== y[k]) return x[k] - y[k]; return 0; });
  },
};
