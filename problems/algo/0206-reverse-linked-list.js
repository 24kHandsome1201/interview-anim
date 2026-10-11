import { recorder } from '../../js/util.js';

const code = `def reverseList(head):
    prev = None
    cur = head
    while cur:
        nxt = cur.next      # 先记住后继
        cur.next = prev     # 掉头
        prev = cur          # prev 前进
        cur = nxt           # cur 前进
    return prev             # 新头节点`;

export default {
  id: 'lc-206', track: 'algo', num: 206, slug: 'reverse-linked-list', title: '反转链表', category: '链表', difficulty: '简单',
  code,
  oneLine: '三指针原地掉头：prev / cur / nxt',
  summary: '给定单链表头节点，反转链表并返回新的头节点。',
  ideas: [
    '每个节点只做一件事：把 <code>next</code> 从「指向下一个」改成「指向前一个」。',
    '改向之前必须先用 <code>nxt</code> 暂存后继，否则改完就找不到后面的节点了。',
    '<code>prev</code> 初值是 None，正好是反转后链表的尾巴；循环结束时 <code>prev</code> 就是新头。',
  ],
  complexity: '时间 O(n)，空间 O(1)',
  presets: [
    { name: '示例 1', input: { vals: [1, 2, 3, 4, 5] } },
    { name: '示例 2', input: { vals: [1, 2] } },
  ],
  validate(inp) {
    if (!Array.isArray(inp.vals) || !inp.vals.length || inp.vals.some((x) => !Number.isInteger(x))) return 'vals 需要是整数数组';
    if (inp.vals.length > 8) return '为了动画清晰，最多 8 个节点';
    return null;
  },
  run({ vals }) {
    const rec = recorder();
    const n = vals.length;
    const nodes = vals.map((v, i) => ({ id: i, val: v }));
    const next = {};
    for (let i = 0; i < n - 1; i++) next[i] = i + 1;
    next[n - 1] = null;
    let prev = null, cur = 0;
    const done = new Set();
    const scene = (extra = {}, ecol = {}) => [
      { type: 'list', id: 'l', label: '链表', nodes, next: { ...next }, colors: { ...Object.fromEntries([...done].map((x) => [x, 'ok'])), ...extra }, edgeColors: ecol, pointers: { prev, cur, nxt: scene.nxt } },
      { type: 'vars', id: 'v', items: { prev: prev === null ? 'None' : vals[prev], cur: cur === null ? 'None' : vals[cur], nxt: scene.nxt == null ? 'None' : vals[scene.nxt] } },
    ];
    scene.nxt = null;
    rec.step(2, '<code>prev = None</code>：它是反转后链表的结尾；<code>cur</code> 指向头节点。', scene());
    while (cur !== null) {
      scene.nxt = next[cur];
      rec.step(5, `先用 <code>nxt</code> 记住 <code>cur.next</code>（节点 ${next[cur] === null ? 'None' : vals[next[cur]]}），因为马上要把这条边改向。`, scene({ [cur]: 'cur', ...(next[cur] !== null ? { [next[cur]]: 'cmp' } : {}) }));
      next[cur] = prev;
      rec.step(6, `<code>cur.next = prev</code>：节点 ${vals[cur]} 的箭头掉头，指向 ${prev === null ? 'None' : vals[prev]}。`, scene({ [cur]: 'cur', ...(prev !== null ? { [prev]: 'ok' } : {}) }, { [cur]: 'hl' }));
      prev = cur;
      rec.step(7, `<code>prev</code> 前进到节点 ${vals[cur]}。`, scene({ [cur]: 'hl' }));
      done.add(cur);
      cur = scene.nxt;
      rec.step(8, `<code>cur</code> 前进到 ${cur === null ? 'None' : '节点 ' + vals[cur]}${cur === null ? '，循环结束' : ''}。`, scene(cur !== null ? { [cur]: 'cur' } : {}));
      scene.nxt = null;
    }
    rec.step(9, `<code>return prev</code>：新头节点是 ${vals[prev]}，整条链表已经 ${vals.join('→')} 变成 ${[...vals].reverse().join('→')}。`, scene());
    return { steps: rec.steps, result: [...vals].reverse() };
  },
  solve({ vals }) {
    return [...vals].reverse();
  },
};
