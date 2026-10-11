import { recorder } from '../../js/util.js';

const code = `def permute(nums):
    ans = []
    def dfs(path, used):
        if len(path) == len(nums):
            ans.append(path.copy())   # 到底了，收一个排列
            return
        for i in range(len(nums)):
            if used[i]:
                continue
            used[i] = True            # 做选择
            path.append(nums[i])
            dfs(path, used)
            path.pop()                # 撤销选择
            used[i] = False
    dfs([], [False] * len(nums))
    return ans`;

export default {
  id: 'lc-46', track: 'algo', num: 46, slug: 'permutations', title: '全排列', category: '回溯', difficulty: '中等',
  code,
  oneLine: '回溯三件套：做选择 → 递归 → 撤销选择',
  summary: '给定不含重复数字的数组 nums，返回所有可能的排列。',
  ideas: [
    '每个位置依次尝试所有还没用过的数字，路径就是 path，选完 n 个收进答案。',
    '递归前 <code>used[i] = True + path.append</code>（做选择），递归返回后 <code>path.pop + used[i] = False</code>（撤销），状态恢复到分支前的样子。',
    'used 数组让每一层 O(1) 判断谁还能选；整个搜索是一棵 n! 片叶子的决策树。',
  ],
  complexity: '时间 O(n·n!)，空间 O(n)（不计答案）',
  presets: [
    { name: 'n=3', input: { nums: [1, 2, 3] } },
    { name: 'n=4', input: { nums: [1, 2, 3, 4] } },
  ],
  validate(inp) {
    if (!Array.isArray(inp.nums) || !inp.nums.length || inp.nums.some((x) => !Number.isInteger(x))) return 'nums 需要是整数数组';
    if (new Set(inp.nums).size !== inp.nums.length) return 'nums 不能有重复元素';
    if (inp.nums.length > 4) return '为了动画清晰，最多 4 个元素（n! 增长太快）';
    return null;
  },
  run({ nums }) {
    const rec = recorder();
    const n = nums.length;
    const used = Array(n).fill(false);
    const path = [];
    const ans = [];
    const scene = (extra = {}) => [
      { type: 'array', id: 'a', label: 'nums（暗色=used 已用过）', values: nums, colors: { ...Object.fromEntries(used.map((u, i) => [i, u ? 'dim' : ''])), ...extra }, showIndex: true },
      { type: 'array', id: 'p', label: `path（已选 ${path.length}/${n}）`, values: [...path], indexLabels: path.map((_, i) => `位${i}`) },
      { type: 'map', id: 'r', label: '答案 ans', headers: ['#', '排列'], entries: ans.length ? ans.map((x, i) => [i + 1, `[${x.join(',')}]`]) : [['∅', '']] },
    ];
    rec.step(3, '从空路径开始 DFS。每一层都尝试所有还没用的数。', scene());
    const dfs = () => {
      if (path.length === n) {
        ans.push([...path]);
        rec.step([4, 5], `path = <code>[${path.join(',')}]</code> 长度已达 ${n} → 收进答案，回溯返回。`, scene());
        return;
      }
      for (let i = 0; i < n; i++) {
        if (used[i]) {
          rec.step([7, 9], `<code>nums[${i}] = ${nums[i]}</code> 已在 path 里（used），跳过。`, scene({ [i]: 'dim' }));
          continue;
        }
        used[i] = true; path.push(nums[i]);
        rec.step([10, 11], `选 <code>${nums[i]}</code>：used[${i}]=True，path = <code>[${path.join(',')}]</code>，进入下一层。`, scene({ [i]: 'cur' }));
        dfs();
        path.pop(); used[i] = false;
        rec.step([13, 14], `撤销：path 弹掉 ${nums[i]}，used[${i}]=False，恢复现场，换下一个候选。`, scene({ [i]: 'cmp' }));
      }
    };
    dfs();
    rec.step(16, `DFS 结束，共 <code>${ans.length}</code> 个排列。`, scene());
    const cmp = (x, y) => { for (let k = 0; k < n; k++) if (x[k] !== y[k]) return x[k] - y[k]; return 0; };
    return { steps: rec.steps, result: [...ans].sort(cmp) };
  },
  solve({ nums }) {
    // independent: itertools-style generation via insertion
    let res = [[]];
    for (const x of nums) {
      const next = [];
      for (const p of res) for (let i = 0; i <= p.length; i++) next.push([...p.slice(0, i), x, ...p.slice(i)]);
      res = next;
    }
    return res.sort((x, y) => { for (let k = 0; k < x.length; k++) if (x[k] !== y[k]) return x[k] - y[k]; return 0; });
  },
};
