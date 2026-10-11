import { recorder } from '../../js/util.js';

const code = `def search(nums, target):
    lo, hi = 0, len(nums) - 1
    while lo <= hi:
        mid = (lo + hi) // 2
        if nums[mid] == target:
            return mid
        if nums[lo] <= nums[mid]:
            # 左半有序
            if nums[lo] <= target < nums[mid]:
                hi = mid - 1
            else:
                lo = mid + 1
        else:
            # 右半有序
            if nums[mid] < target <= nums[hi]:
                lo = mid + 1
            else:
                hi = mid - 1
    return -1`;

export default {
  id: 'lc-33', track: 'algo', num: 33, slug: 'search-in-rotated-sorted-array', title: '搜索旋转排序数组', category: '二分查找', difficulty: '中等',
  code,
  oneLine: '旋转后仍有一半有序：判断 target 在不在有序那半边',
  summary: '升序数组在某点旋转过（如 [4,5,6,7,0,1,2]），在 O(log n) 内找 target 的下标。',
  ideas: [
    '旋转数组一刀切开，<b>至少有一半是有序的</b>：<code>nums[lo] ≤ nums[mid]</code> 则左半有序，否则右半有序。',
    '有序的那半边能用一次比较判断 target 是否落在区间内；落在就走那半边，否则走另半边。',
    '每轮砍掉一半，所以仍是 O(log n)。',
  ],
  complexity: '时间 O(log n)，空间 O(1)',
  presets: [
    { name: '找得到', input: { nums: [4, 5, 6, 7, 0, 1, 2], target: 0 } },
    { name: '找不到', input: { nums: [4, 5, 6, 7, 0, 1, 2], target: 3 } },
  ],
  validate(inp) {
    if (!Array.isArray(inp.nums) || !inp.nums.length || inp.nums.some((x) => !Number.isInteger(x))) return 'nums 需要是整数数组';
    if (inp.nums.length > 12) return '为了动画清晰，最多 12 个元素';
    if (!Number.isInteger(inp.target)) return 'target 需要是整数';
    return null;
  },
  run({ nums, target }) {
    const rec = recorder();
    const n = nums.length;
    let lo = 0, hi = n - 1;
    const dim = {};
    const scene = (extra = {}, mid = null) => [
      { type: 'array', id: 'a', label: 'nums（暗色=已排除，蓝底=当前搜索区间）', values: nums, colors: { ...Object.fromEntries(Array.from({ length: n }, (_, i) => [i, i >= lo && i <= hi ? 'win' : 'dim'])), ...dim, ...extra }, pointers: { lo, mid, hi } },
      { type: 'vars', id: 'v', items: { lo, hi, mid: mid ?? '—', target } },
    ];
    rec.step(2, `初始搜索区间 <code>[0, ${n - 1}]</code>。每次取 mid，利用「必有一半有序」砍半。`, scene());
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      rec.step(4, `<code>mid = (${lo} + ${hi}) // 2 = ${mid}</code>，nums[mid] = ${nums[mid]}。`, scene({ [mid]: 'cur' }, mid));
      if (nums[mid] === target) {
        rec.step([5, 6], `<code>nums[${mid}] = ${target}</code>，命中！返回下标 <code>${mid}</code>。`, scene({ [mid]: 'ok' }, mid));
        return { steps: rec.steps, result: mid };
      }
      if (nums[lo] <= nums[mid]) {
        rec.step(7, `<code>nums[${lo}] = ${nums[lo]} ≤ nums[${mid}] = ${nums[mid]}</code> → <b>左半 [${lo}, ${mid}] 有序</b>。`, scene({ [mid]: 'cur' }, mid));
        const inside = nums[lo] <= target && target < nums[mid];
        rec.step([9, 10, 11, 12], inside
          ? `${target} 落在有序区间 [${nums[lo]}, ${nums[mid]}) 内 → <code>hi = ${mid - 1}</code>，右半全排除。`
          : `${target} 不在 [${nums[lo]}, ${nums[mid]}) → <code>lo = ${mid + 1}</code>，左半全排除。`, scene({ [mid]: 'cur' }, mid));
        if (inside) { for (let i = mid; i <= hi; i++) dim[i] = 'dim'; hi = mid - 1; }
        else { for (let i = lo; i <= mid; i++) dim[i] = 'dim'; lo = mid + 1; }
      } else {
        rec.step(13, `<code>nums[${lo}] = ${nums[lo]} > nums[${mid}] = ${nums[mid]}</code> → 左半有旋转点，<b>右半 [${mid}, ${hi}] 有序</b>。`, scene({ [mid]: 'cur' }, mid));
        const inside = nums[mid] < target && target <= nums[hi];
        rec.step([15, 16, 17, 18], inside
          ? `${target} 落在 (${nums[mid]}, ${nums[hi]}] 内 → <code>lo = ${mid + 1}</code>，左半全排除。`
          : `${target} 不在 (${nums[mid]}, ${nums[hi]}] → <code>hi = ${mid - 1}</code>，右半全排除。`, scene({ [mid]: 'cur' }, mid));
        if (inside) { for (let i = lo; i <= mid; i++) dim[i] = 'dim'; lo = mid + 1; }
        else { for (let i = mid; i <= hi; i++) dim[i] = 'dim'; hi = mid - 1; }
      }
    }
    rec.step(19, `<code>lo > hi</code>，搜索区间为空，${target} 不存在 → 返回 <code>-1</code>。`, scene());
    return { steps: rec.steps, result: -1 };
  },
  solve({ nums, target }) {
    const i = nums.indexOf(target);
    return i === -1 ? -1 : i;
  },
};
