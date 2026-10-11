import { recorder, parseTree, treeLayer } from '../../js/util.js';

const code = `def lowestCommonAncestor(root, p, q):
    if root in (None, p, q):
        return root              # 空 / 命中目标节点，直接上报
    left = lowestCommonAncestor(root.left, p, q)
    right = lowestCommonAncestor(root.right, p, q)
    if left and right:
        return root              # p、q 分处两侧 -> 当前节点即 LCA
    return left or right         # 把非空的一边继续上报`;

export default {
  id: 'lc-236', track: 'algo', num: 236, slug: 'lowest-common-ancestor-of-a-binary-tree', title: '二叉树的最近公共祖先', category: '二叉树', difficulty: '中等',
  code,
  oneLine: '后序遍历：左右子树各带回信息，分叉点就是答案',
  summary: '给定二叉树（p、q 一定存在且互不相同），返回 p 和 q 的最近公共祖先。',
  ideas: [
    '递归语义：「以 root 为根的子树里，找到 p/q/LCA 就<b>向上返回</b>」。',
    '若 root 是 None、p 或 q，直接返回 root——不用继续往下找，把信息交给父节点判断。',
    '左右子树<b>都返回非空</b>，说明 p、q 分居两侧 → 当前节点就是 LCA；否则把非空那侧的结果继续上报。',
  ],
  complexity: '时间 O(n)，空间 O(h)（递归栈）',
  presets: [
    { name: '示例 1', input: { root: [3, 5, 1, 6, 2, 0, 8, null, null, 7, 4], p: 5, q: 1 } },
    { name: 'p 是 q 的祖先', input: { root: [3, 5, 1, 6, 2, 0, 8, null, null, 7, 4], p: 5, q: 4 } },
  ],
  validate(inp) {
    if (!Array.isArray(inp.root) || !inp.root.length) return 'root 需要是层序数组';
    if (inp.root.length > 15) return '为了动画清晰，最多 15 个节点';
    if (!inp.root.includes(inp.p) || !inp.root.includes(inp.q)) return 'p、q 必须是树中的值';
    if (inp.p === inp.q) return 'p、q 需不同';
    return null;
  },
  run({ root, p, q }) {
    const rec = recorder();
    const { root: r, nodes } = parseTree(root);
    const sub = {};          // node.id -> 显示在节点下的返回值
    const done = new Set();
    const pId = nodes.find((n) => n.val === p)?.id, qId = nodes.find((n) => n.val === q)?.id;
    let answer = null;
    const fmtRet = (x) => (x === null ? 'None' : x.val);
    const scene = (extra = {}) => [
      treeLayer('t', `二叉树（p=${p} 橙色，q=${q} 紫色；节点下方为递归返回值）`, nodes, {
        colors: { [pId]: 'cmp', [qId]: 'hl', ...Object.fromEntries([...done].map((x) => [x, 'dim'])), ...(answer !== null ? { [answer]: 'ok' } : {}), ...extra },
        sub: { ...sub },
      }),
    ];
    rec.step(2, `目标：找 <code>p = ${p}</code> 和 <code>q = ${q}</code> 的最近公共祖先。函数语义：返回这棵子树下找到的 p / q / LCA。`, scene());
    const solve = (node) => {
      if (!node) return null;
      if (node.val === p || node.val === q) {
        rec.step([2, 3], `访问节点 ${node.val}：它就是 ${node.val === p ? 'p' : 'q'}，直接把自己返回，不再向下递归。`, scene({ [node.id]: 'cur' }));
        sub[node.id] = `→${node.val}`; done.add(node.id);
        return node;
      }
      rec.step(4, `访问节点 ${node.val}：不是目标，先递归<b>左子树</b>。`, scene({ [node.id]: 'cur' }));
      const left = solve(node.left);
      sub[node.id] = `左=${fmtRet(left)}`;
      rec.step(5, `节点 ${node.val} 的左子树返回 <code>${fmtRet(left)}</code>，再递归<b>右子树</b>。`, scene({ [node.id]: 'cur' }));
      const right = solve(node.right);
      sub[node.id] = `左=${fmtRet(left)} 右=${fmtRet(right)}`;
      rec.step(6, `节点 ${node.val} 的右子树返回 <code>${fmtRet(right)}</code>。`, scene({ [node.id]: 'cur' }));
      let ret;
      if (left && right) {
        ret = node; answer = node.id;
        rec.step([6, 7], `节点 ${node.val} 左右都非空（${fmtRet(left)}、${fmtRet(right)}）——p、q 分居两侧，<b>${node.val} 就是最近公共祖先</b>。`, scene({ [node.id]: 'ok' }));
      } else {
        ret = left || right;
        rec.step(8, `节点 ${node.val} 只有一边有结果，把 <code>${fmtRet(ret)}</code> 继续上报给父节点。`, scene({ [node.id]: 'dim' }));
      }
      sub[node.id] = `→${fmtRet(ret)}`; done.add(node.id);
      return ret;
    };
    const ans = solve(r);
    rec.step(8, `递归结束。最近公共祖先 = 节点 <code>${ans.val}</code>。`, scene());
    return { steps: rec.steps, result: ans.val };
  },
  solve({ root, p, q }) {
    // independent: find paths from root to p and q, take last common node
    const { root: r } = parseTree(root);
    const pathTo = (node, target, path = []) => {
      if (!node) return null;
      path.push(node.val);
      if (node.val === target) return [...path];
      return pathTo(node.left, target, path) || pathTo(node.right, target, path) || (path.pop(), null);
    };
    const pp = pathTo(r, p), pq = pathTo(r, q);
    let i = 0;
    while (i < pp.length && i < pq.length && pp[i] === pq[i]) i++;
    return pp[i - 1];
  },
};
