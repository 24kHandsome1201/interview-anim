import { recorder } from '../../js/util.js';

const code = `def twoSum(nums, target):
    seen = {}            # 值 -> 下标
    for i, x in enumerate(nums):
        if target - x in seen:
            return [seen[target - x], i]
        seen[x] = i
    return []`;

export default {
  id: 'lc-1', track: 'algo', num: 1, slug: 'two-sum', title: '两数之和', category: '哈希', difficulty: '简单',
  code,
  oneLine: '边扫边把数放进哈希表，查 target − x 是否出现过',
  summary: '给定整数数组 nums 和目标值 target，返回和为 target 的两个下标。每种输入只有一组答案。',
  ideas: [
    '暴力是 O(n²) 两重循环；把「找另一个数」变成<b>哈希表查询</b>就是 O(1)。',
    '遍历到 <code>x = nums[i]</code> 时，只需要知道 <code>target − x</code> 之前出没出现过、在哪个下标。',
    '查不到就把 <code>x → i</code> 存进表里继续；查到立刻返回答案，一趟扫完。',
  ],
  complexity: '时间 O(n)，空间 O(n)',
  presets: [
    { name: '示例 1', input: { nums: [2, 7, 11, 15], target: 9 } },
    { name: '示例 2', input: { nums: [3, 2, 4], target: 6 } },
  ],
  validate(inp) {
    if (!Array.isArray(inp.nums) || inp.nums.some((x) => !Number.isInteger(x))) return 'nums 需要是整数数组';
    if (!Number.isInteger(inp.target)) return 'target 需要是整数';
    if (inp.nums.length < 2 || inp.nums.length > 12) return '数组长度 2~12';
    return null;
  },
  run({ nums, target }) {
    const rec = recorder();
    const seen = new Map();
    const entries = [];
    const done = {};
    const scene = (extra = {}, ptr = {}) => [
      { type: 'array', id: 'a', label: 'nums', values: nums, colors: { ...done, ...extra }, pointers: ptr },
      { type: 'map', id: 'm', label: 'seen（值 → 下标）', headers: ['值', '下标'], entries: [...entries], colors: extra.__map || {} },
      { type: 'vars', id: 'v', items: { target, i: ptr.i ?? '—', 'target − x': extra.__c ?? '—' } },
    ];
    rec.step(2, '初始化一个空哈希表 <code>seen</code>，用来记录「见过的值 → 它的下标」。', scene());
    for (let i = 0; i < nums.length; i++) {
      const x = nums[i], c = target - x;
      rec.step(3, `i = ${i}，<code>x = ${x}</code>，需要的另一半是 <code>target − x = ${c}</code>。查表里有没有 ${c}。`, scene({ [i]: 'cur', __c: c }, { i }));
      if (seen.has(c)) {
        const j = seen.get(c);
        rec.step([4, 5], `表里就有 <code>${c}</code>，在下标 ${j}。<code>${nums[j]} + ${x} = ${target}</code>，返回 <code>[${j}, ${i}]</code>。`,
          [{ type: 'array', id: 'a', label: 'nums', values: nums, colors: { ...done, [j]: 'ok', [i]: 'ok' }, pointers: { j, i } },
           { type: 'map', id: 'm', label: 'seen（值 → 下标）', headers: ['值', '下标'], entries: [...entries], colors: { [c]: 'ok' } },
           { type: 'vars', id: 'v', items: { target, 答案: `[${j}, ${i}]` } }]);
        return { steps: rec.steps, result: [j, i] };
      }
      seen.set(x, i); entries.push([x, i]); done[i] = 'dim';
      rec.step(6, `表里没有 ${c}，把 <code>${x} → ${i}</code> 存进表里（如果后面出现 ${c}，就能立刻配上对）。`, scene({ [i]: 'hl' }, { i }));
    }
    rec.step(7, '扫完整个数组都没配上对，返回空数组（题目保证不会发生）。', scene());
    return { steps: rec.steps, result: [] };
  },
  solve({ nums, target }) {
    for (let i = 0; i < nums.length; i++)
      for (let j = i + 1; j < nums.length; j++)
        if (nums[i] + nums[j] === target) return [i, j];
    return [];
  },
};
