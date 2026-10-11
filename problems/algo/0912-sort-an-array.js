import { recorder } from '../../js/util.js';

const code = `def sortArray(nums):
    def qs(lo, hi):
        if lo >= hi:
            return
        pivot = nums[hi]          # Lomuto：固定取最后一个
        i = lo                    # ≤pivot 区的右边界
        for j in range(lo, hi):
            if nums[j] < pivot:
                nums[i], nums[j] = nums[j], nums[i]
                i += 1
        nums[i], nums[hi] = nums[hi], nums[i]  # pivot 归位
        qs(lo, i - 1)
        qs(i + 1, hi)
    qs(0, len(nums) - 1)
    return nums`;

export default {
  id: 'lc-912', track: 'algo', num: 912, slug: 'sort-an-array', title: '排序数组（快速排序）', category: '排序', difficulty: '中等',
  code,
  oneLine: 'Lomuto 划分：小于 pivot 的滚到左边，pivot 归位后两边递归',
  summary: '手写快速排序：选 pivot 把数组划分成「小于它」和「不小于它」两半，pivot 落位，两边递归。',
  ideas: [
    'Lomuto 划分：固定取末尾为 pivot，<code>i</code> 指向下一个「小于 pivot」该放的位置；扫到小的就和 i 换，i 前进。',
    '扫完把 pivot 换到 i——左边全小于它、右边全不小于它，pivot 已到最终位置（<b>一次划分定一个元素</b>）。',
    '演示取末元素做 pivot 是为了确定性；面试时应说明要<b>随机选 pivot</b>，否则有序输入退化成 O(n²)。',
  ],
  complexity: '平均 O(n log n)，最坏 O(n²)；空间 O(log n)（递归栈）',
  presets: [
    { name: '示例', input: { nums: [5, 2, 9, 4, 7, 1, 8, 3] } },
    { name: '较短', input: { nums: [4, 1, 3, 5, 2] } },
  ],
  validate(inp) {
    if (!Array.isArray(inp.nums) || !inp.nums.length || inp.nums.some((x) => !Number.isInteger(x))) return 'nums 需要是整数数组';
    if (inp.nums.length > 10) return '为了动画清晰，最多 10 个元素';
    return null;
  },
  run({ nums }) {
    const rec = recorder();
    const a = [...nums];
    const n = a.length;
    const ok = new Set();
    const depth = new Map();
    const scene = (extra = {}, ptr = {}, vars = {}) => [
      { type: 'array', id: 'a', label: 'nums（绿色=已归位，橙色=pivot）', values: [...a], colors: { ...Object.fromEntries([...ok].map((x) => [x, 'ok'])), ...extra }, pointers: ptr },
      { type: 'vars', id: 'v', items: vars },
    ];
    rec.step(2, `调用 <code>qs(0, ${n - 1})</code>。Lomuto 划分固定取末尾元素做 pivot。`, scene());
    const qs = (lo, hi, dep = 0) => {
      depth.set(dep, (depth.get(dep) || 0) + 1);
      if (lo >= hi) {
        if (lo === hi) { ok.add(lo); rec.step([3, 4], `区间 [${lo}, ${hi}] 只剩一个元素，天然有序，直接归位。`, scene({ [lo]: 'ok' })); }
        return;
      }
      const pivot = a[hi];
      let i = lo;
      rec.step(5, `区间 <code>[${lo}, ${hi}]</code>：取 <code>pivot = nums[${hi}] = ${pivot}</code>，i = ${lo}。`, scene({ [hi]: 'cmp' }, { i, j: lo }));
      for (let j = lo; j < hi; j++) {
        if (a[j] < pivot) {
          [a[i], a[j]] = [a[j], a[i]];
          rec.step([8, 9, 10], `<code>nums[${j}] = ${a[i]} < ${pivot}</code>：与 nums[${i}] 交换，小于 pivot 的区域扩一格，i → ${i + 1}。`, scene({ [hi]: 'cmp', [i]: 'cur' }, { i, j }, { pivot, i, j }));
          i++;
        } else {
          rec.step(8, `<code>nums[${j}] = ${a[j]} ≥ ${pivot}</code>：不动，留在右边区域。`, scene({ [hi]: 'cmp', [j]: 'dim' }, { i, j }, { pivot, i, j }));
        }
      }
      [a[i], a[hi]] = [a[hi], a[i]];
      ok.add(i);
      rec.step(11, `把 pivot 换到位置 ${i}：<code>nums[${i}] = ${pivot}</code> 归位！左边都 < ${pivot}，右边都 ≥ ${pivot}。`, scene({ [i]: 'ok' }, { i }));
      if (lo <= i - 1) rec.step(12, `递归排左半 <code>qs(${lo}, ${i - 1})</code>。`, scene({}, {}, {}));
      qs(lo, i - 1, dep + 1);
      if (i + 1 <= hi) rec.step(13, `递归排右半 <code>qs(${i + 1}, ${hi})</code>。`, scene({}, {}, {}));
      qs(i + 1, hi, dep + 1);
    };
    qs(0, n - 1);
    rec.step(15, `排序完成：<code>[${a.join(', ')}]</code>。`, scene());
    return { steps: rec.steps, result: a };
  },
  solve({ nums }) {
    return [...nums].sort((x, y) => x - y);
  },
};
