import { recorder, parseTree, treeLayer } from '../../js/util.js';

const code = `from collections import deque

def levelOrder(root):
    if not root:
        return []
    ans = []
    q = deque([root])
    while q:
        level = []
        for _ in range(len(q)):   # 锁死本层节点数
            node = q.popleft()
            level.append(node.val)
            if node.left:
                q.append(node.left)
            if node.right:
                q.append(node.right)
        ans.append(level)
    return ans`;

export default {
  id: 'lc-102', track: 'algo', num: 102, slug: 'binary-tree-level-order-traversal', title: '二叉树的层序遍历', category: '二叉树', difficulty: '中等',
  code,
  oneLine: 'BFS + 按层切块：每轮先锁死队列长度',
  summary: '给定二叉树根节点，返回节点值按层分组的列表（从上到下、每层从左到右）。',
  ideas: [
    '普通 BFS 用队列；按层输出的关键是<b>每轮循环前固定队列长度 len(q)</b>——这就是当前层的节点数。',
    '这一轮恰好弹出这么多节点（本层），同时把它们的子节点（下一层）从右边入队。',
    '一层弹完，level 收集完毕加入答案，队列里剩下的正好全是下一层。',
  ],
  complexity: '时间 O(n)，空间 O(n)',
  presets: [
    { name: '示例 1', input: { root: [3, 9, 20, null, null, 15, 7] } },
    { name: '示例 2（不平衡）', input: { root: [1, 2, 3, 4, null, null, 5] } },
  ],
  validate(inp) {
    if (!Array.isArray(inp.root) || !inp.root.length) return 'root 需要是层序数组';
    if (inp.root.length > 15) return '为了动画清晰，最多 15 个节点';
    if (inp.root.some((x) => x !== null && !Number.isInteger(x))) return '节点值需要是整数或 null';
    return null;
  },
  run({ root }) {
    const rec = recorder();
    const { nodes } = parseTree(root);
    const ans = [];
    const queue = [0];
    const done = new Set();
    const curLevel = new Set();
    const scene = (extra = {}, vars = {}) => [
      treeLayer('t', '二叉树（绿色=已输出，蓝色=当前层）', nodes, {
        colors: { ...Object.fromEntries([...done].map((x) => [x, 'ok'])), ...Object.fromEntries([...curLevel].map((x) => [x, 'win'])), ...extra },
      }),
      { type: 'array', id: 'q', label: '队列 q（存节点值）', values: queue.map((i) => nodes.find((n) => n.id === i)?.val) },
      { type: 'map', id: 'a', label: '答案（按层）', headers: ['层', '节点'], entries: ans.length ? ans.map((lv, i) => [i, `[${lv.join(', ')}]`]) : [['∅', '']] },
      { type: 'vars', id: 'v', items: vars },
    ];
    rec.step(4, '根节点入队。队列里存的是待访问节点；每轮外循环处理一层。', scene());
    while (queue.length) {
      const sz = queue.length;
      curLevel.clear(); queue.forEach((x) => curLevel.add(x));
      rec.step([9, 10], `新一轮：当前队列长度 = <code>${sz}</code>，说明这一层有 ${sz} 个节点。先把长度记下来——接下来会一边弹一边把下一层入队，如果不锁死长度就会混层。`, scene());
      const level = [];
      for (let k = 0; k < sz; k++) {
        const id = queue.shift();
        curLevel.delete(id); done.add(id);
        level.push(nodes.find((n) => n.id === id).val);
        rec.step([11, 12], `弹出节点 <code>${nodes.find((n) => n.id === id).val}</code>（本层第 ${k + 1}/${sz} 个），加入当前层结果。`, scene({ [id]: 'cur' }));
        const node = nodes.find((n) => n.id === id);
        const kids = [node.left, node.right].filter(Boolean);
        for (const ch of kids) queue.push(ch.id);
        if (kids.length) rec.step([13, 16], `把 ${node.val} 的子节点 ${kids.map((c) => c.val).join('、')} 入队——它们属于<b>下一层</b>，排在队尾不会干扰本层计数。`, scene({ [id]: 'cur', ...Object.fromEntries(kids.map((c) => [c.id, 'cmp'])) }));
      }
      ans.push(level);
      rec.step(17, `第 ${ans.length} 层遍历完：<code>[${level.join(', ')}]</code> 加入答案。队列里现在全是下一层节点。`, scene());
    }
    rec.step(18, `队列为空，遍历结束。答案 = <code>${JSON.stringify(ans)}</code>。`, scene());
    return { steps: rec.steps, result: ans };
  },
  solve({ root }) {
    // independent: depth-first collecting by depth
    const { root: r } = parseTree(root);
    const ans = [];
    (function dfs(n, d) {
      if (!n) return;
      (ans[d] = ans[d] || []).push(n.val);
      dfs(n.left, d + 1); dfs(n.right, d + 1);
    })(r, 0);
    return ans;
  },
};
