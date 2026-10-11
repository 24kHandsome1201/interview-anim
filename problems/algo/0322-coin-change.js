import { recorder } from '../../js/util.js';

const code = `def coinChange(coins, amount):
    INF = float('inf')
    dp = [INF] * (amount + 1)
    dp[0] = 0                  # 凑 0 元要 0 枚
    for i in range(1, amount + 1):
        for c in coins:
            if c <= i:
                dp[i] = min(dp[i], dp[i - c] + 1)
    return -1 if dp[amount] == INF else dp[amount]`;

export default {
  id: 'lc-322', track: 'algo', num: 322, slug: 'coin-change', title: '零钱兑换', category: '动态规划', difficulty: '中等',
  code,
  oneLine: 'dp[i] = min(dp[i−c] + 1)：凑 i 元的最少硬币数',
  summary: '给定硬币面额 coins 和总金额 amount，求凑出 amount 的最少硬币数，凑不出返回 -1。',
  ideas: [
    '<b>子问题</b>：dp[i] = 凑 i 元最少几枚。最后一枚若是 c，则 dp[i] = dp[i−c] + 1。',
    '对每种面额 c ≤ i 取最小：<code>dp[i] = min(dp[i−c]+1)</code>。初始全设 ∞，表示暂时凑不出。',
    '<code>dp[0] = 0</code> 是地基：凑 0 元不需要硬币。最终 dp[amount] 还是 ∞ 就返回 −1。',
  ],
  complexity: '时间 O(amount × 硬币种数)，空间 O(amount)',
  presets: [
    { name: '示例 1', input: { coins: [1, 2, 5], amount: 11 } },
    { name: '凑不出', input: { coins: [2, 4], amount: 7 } },
  ],
  validate(inp) {
    if (!Array.isArray(inp.coins) || !inp.coins.length || inp.coins.some((x) => !Number.isInteger(x) || x <= 0)) return 'coins 需要是正整数数组';
    if (inp.coins.length > 5) return '最多 5 种面额';
    if (!Number.isInteger(inp.amount) || inp.amount < 0 || inp.amount > 20) return 'amount 取 0~20';
    return null;
  },
  run({ coins, amount }) {
    const rec = recorder();
    const INF = '∞';
    const dp = Array(amount + 1).fill(Infinity);
    dp[0] = 0;
    const show = (x) => (x === Infinity ? INF : x);
    const scene = (extra = {}, vars = {}) => [
      { type: 'array', id: 'd', label: 'dp[i] = 凑 i 元的最少硬币数', values: dp.map(show), colors: { ...extra }, indexLabels: dp.map((_, i) => i) },
      { type: 'vars', id: 'v', items: { coins: `[${coins.join(', ')}]`, ...vars } },
    ];
    rec.step([3, 4], `初始化 dp 全为 ∞（凑不出），<code>dp[0] = 0</code>——凑 0 元不需要硬币。`, scene({ 0: 'ok' }));
    for (let i = 1; i <= amount; i++) {
      rec.step(5, `计算 <code>dp[${i}]</code>：尝试每种面额作为「最后一枚硬币」。`, scene({ [i]: 'cur' }, { i }));
      for (const c of coins) {
        if (c <= i) {
          const cand = dp[i - c] + 1;
          const better = cand < dp[i];
          if (better) dp[i] = cand;
          rec.step([6, 7, 8], `面额 ${c}：<code>dp[${i} − ${c}] + 1 = dp[${i - c}] + 1 = ${show(dp[i - c]) === INF ? '∞' : dp[i - c] + 1}</code>。${better ? `比当前 dp[${i}] 更小 → 更新为 <code>${dp[i]}</code>。` : '不比当前值小，跳过。'}`,
            scene({ [i]: 'cur', [i - c]: 'cmp' }, { i, c, 候选: show(dp[i - c]) === INF ? '∞' : cand }));
        } else {
          rec.step([6, 7], `面额 ${c} > ${i}，用不了，跳过。`, scene({ [i]: 'cur' }, { i, c }));
        }
      }
      rec.step(8, `<code>dp[${i}] = ${show(dp[i])}</code>${dp[i] === Infinity ? '——所有面额都凑不出这个金额' : ''}。`, scene({ [i]: dp[i] === Infinity ? 'bad' : 'ok' }));
    }
    const ret = dp[amount] === Infinity ? -1 : dp[amount];
    rec.step(9, ret === -1 ? `dp[${amount}] 还是 ∞ → 返回 <code>-1</code>。` : `dp[${amount}] = <code>${ret}</code>：最少 ${ret} 枚硬币能凑出 ${amount}。`, scene({ [amount]: ret === -1 ? 'bad' : 'ok' }));
    return { steps: rec.steps, result: ret };
  },
  solve({ coins, amount }) {
    // independent: BFS over reachable amounts
    const dist = new Map([[0, 0]]);
    const q = [0];
    while (q.length) {
      const u = q.shift();
      for (const c of coins) {
        const v = u + c;
        if (v <= amount && !dist.has(v)) { dist.set(v, dist.get(u) + 1); q.push(v); }
      }
    }
    return dist.has(amount) ? dist.get(amount) : -1;
  },
};
