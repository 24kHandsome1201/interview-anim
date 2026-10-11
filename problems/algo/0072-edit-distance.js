import { recorder } from '../../js/util.js';

const code = `def minDistance(w1, w2):
    m, n = len(w1), len(w2)
    dp = [[0] * (n + 1) for _ in range(m + 1)]
    for i in range(m + 1):
        dp[i][0] = i            # w1 前 i 个全删
    for j in range(n + 1):
        dp[0][j] = j            # 全插成 w2 前 j 个
    for i in range(1, m + 1):
        for j in range(1, n + 1):
            if w1[i - 1] == w2[j - 1]:
                dp[i][j] = dp[i - 1][j - 1]        # 字符相同白嫖
            else:
                dp[i][j] = 1 + min(
                    dp[i - 1][j],      # 删
                    dp[i][j - 1],      # 插
                    dp[i - 1][j - 1])  # 换
    return dp[m][n]`;

export default {
  id: 'lc-72', track: 'algo', num: 72, slug: 'edit-distance', title: '编辑距离', category: '动态规划', difficulty: '中等',
  code,
  oneLine: '二维 DP：字符相同抄左上角，不同则删/插/换三选一 +1',
  summary: '把单词 w1 变成 w2，每步可插入、删除、替换一个字符，求最少操作数。',
  ideas: [
    '<b>子问题</b>：dp[i][j] = w1 前 i 个字符 → w2 前 j 个字符的最少操作数。',
    '<code>w1[i−1] == w2[j−1]</code> 时不用操作，<code>dp[i][j] = dp[i−1][j−1]</code>。',
    '否则三种操作各试一次：删（上）、插（左）、换（左上），取最小 +1。',
  ],
  complexity: '时间 O(m·n)，空间 O(m·n)',
  presets: [
    { name: 'horse → ros', input: { w1: 'horse', w2: 'ros' } },
    { name: 'intention → execution 的前缀', input: { w1: 'int', w2: 'ex' } },
  ],
  validate(inp) {
    if (typeof inp.w1 !== 'string' || typeof inp.w2 !== 'string') return 'w1、w2 需要是字符串';
    if (!/^[a-z]*$/.test(inp.w1) || !/^[a-z]*$/.test(inp.w2)) return '请只使用小写字母';
    if (inp.w1.length > 6 || inp.w2.length > 6) return '为了动画清晰，单词最长 6';
    return null;
  },
  run({ w1, w2 }) {
    const rec = recorder();
    const m = w1.length, n = w2.length;
    const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(''));
    const rowL = ['ε', ...w1.split('')];
    const colL = ['ε', ...w2.split('')];
    const mat = (colors = {}) => ({ type: 'matrix', id: 'd', label: 'dp[i][j] = w1 前 i 个 → w2 前 j 个的最少操作', values: dp.map((r) => [...r]), rowLabels: rowL, colLabels: colL, colors });
    const scene = (colors = {}, vars = {}) => [mat(colors), { type: 'vars', id: 'v', items: vars }];
    rec.step(3, `建 (m+1)×(n+1) 的 dp 表。空串 ε 表示「前 0 个字符」。`, scene());
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    rec.step([4, 7], `边界初始化：第一列 dp[i][0] = i（w1 前 i 个全删掉），第一行 dp[0][j] = j（从空串逐个插入）。`, scene(Object.fromEntries([...Array(m + 1).keys()].map((i) => [`${i},0`, 'ok']).concat([...Array(n + 1).keys()].map((j) => [`0,${j}`, 'ok'])))));
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        const a = w1[i - 1], b = w2[j - 1];
        const src = { [`${i - 1},${j}`]: 'cmp', [`${i},${j - 1}`]: 'cmp', [`${i - 1},${j - 1}`]: 'cmp', [`${i},${j}`]: 'cur' };
        if (a === b) {
          dp[i][j] = dp[i - 1][j - 1];
          rec.step([10, 11], `<code>w1[${i - 1}] = '${a}' == w2[${j - 1}] = '${b}'</code>：最后一字符本来就相同，不用操作 → 抄左上角 <code>dp[${i - 1}][${j - 1}] = ${dp[i][j]}</code>。`, scene(src, { i, j, 'w1 字符': a, 'w2 字符': b }));
        } else {
          const del = dp[i - 1][j], ins = dp[i][j - 1], rep = dp[i - 1][j - 1];
          dp[i][j] = 1 + Math.min(del, ins, rep);
          const which = dp[i][j] - 1 === del ? '删' : dp[i][j] - 1 === ins ? '插' : '换';
          rec.step([12, 16], `'${a}' ≠ '${b}'，三种操作取最小：删 ${del}、插 ${ins}、换 ${rep} → <code>dp[${i}][${j}] = 1 + min = ${dp[i][j]}</code>（最优：${which}）。`, scene(src, { i, j, 'w1 字符': a, 'w2 字符': b }));
        }
      }
    }
    rec.step(17, `右下角 <code>dp[${m}][${n}] = ${dp[m][n]}</code>：把 "${w1}" 编辑成 "${w2}" 最少需要 ${dp[m][n]} 步。`, scene({ [`${m},${n}`]: 'ok' }));
    return { steps: rec.steps, result: dp[m][n] };
  },
  solve({ w1, w2 }) {
    // independent: memoized recursion
    const memo = new Map();
    const f = (i, j) => {
      if (i === 0) return j;
      if (j === 0) return i;
      const key = `${i},${j}`;
      if (memo.has(key)) return memo.get(key);
      const v = w1[i - 1] === w2[j - 1] ? f(i - 1, j - 1) : 1 + Math.min(f(i - 1, j), f(i, j - 1), f(i - 1, j - 1));
      memo.set(key, v);
      return v;
    };
    return f(w1.length, w2.length);
  },
};
