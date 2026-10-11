import { recorder } from '../../js/util.js';

const code = `def detectCycle(head):
    slow = fast = head
    # 第一阶段：快慢指针找相遇点
    while fast and fast.next:
        slow = slow.next          # 慢指针走 1 步
        fast = fast.next.next     # 快指针走 2 步
        if slow is fast:
            break
    else:
        return None               # 无环
    # 第二阶段：一个指针回头部，同速走
    slow = head
    while slow is not fast:
        slow = slow.next
        fast = fast.next
    return slow                   # 环的入口`;

export default {
  id: 'lc-142', track: 'algo', num: 142, slug: 'linked-list-cycle-ii', title: '环形链表 II', category: '链表', difficulty: '中等',
  code,
  oneLine: '快慢指针找相遇点，再一指针回头部同速走到入口',
  summary: '给定可能有环的链表，返回环的入口节点；无环返回 None。',
  ideas: [
    '慢指针走 1 步、快指针走 2 步；若有环，快指针必在环内追上慢指针。',
    '设头到入口距离 a、入口到相遇点 b、环周长 c。相遇时快指针走了 2(a+b) = a+b+kc，化简得 <b>a = c − b + (k−1)c</b>。',
    '所以第二阶段：一个指针回到头部与慢指针<b>同速</b>走，二者恰好都走 a 步后在入口相遇。',
  ],
  complexity: '时间 O(n)，空间 O(1)',
  presets: [
    { name: '入口在下标 1', input: { vals: [3, 2, 0, -4], pos: 1 } },
    { name: '入口在下标 0', input: { vals: [1, 2], pos: 0 } },
  ],
  validate(inp) {
    if (!Array.isArray(inp.vals) || !inp.vals.length || inp.vals.some((x) => !Number.isInteger(x))) return 'vals 需要是整数数组';
    if (inp.vals.length > 8) return '为了动画清晰，最多 8 个节点';
    if (inp.pos !== -1 && (!Number.isInteger(inp.pos) || inp.pos < 0 || inp.pos >= inp.vals.length)) return 'pos 取 -1（无环）或 0 ~ len-1';
    return null;
  },
  run({ vals, pos }) {
    const rec = recorder();
    const n = vals.length;
    const nodes = vals.map((v, i) => ({ id: i, val: v }));
    const next = {};
    for (let i = 0; i < n - 1; i++) next[i] = i + 1;
    next[n - 1] = pos === -1 ? null : pos;
    let slow = 0, fast = 0;
    const scene = (extra = {}, vars = {}) => [
      { type: 'list', id: 'l', label: `链表（尾节点 → ${pos === -1 ? 'null' : '下标 ' + pos}）`, nodes, next: { ...next }, colors: extra, pointers: { slow, fast }, nullTail: pos === -1 },
      { type: 'vars', id: 'v', items: { slow, fast, ...vars } },
    ];
    rec.step(2, 'slow、fast 都从头节点出发。第一阶段：慢走 1 步、快走 2 步，看能否相遇。', scene());
    let met = false, guard = 0;
    while (fast !== null && next[fast] !== null && guard < 50) {
      guard++;
      slow = next[slow];
      fast = next[fast] === null ? null : next[next[fast]];
      rec.step([5, 6], `<code>slow</code> 走 1 步到下标 ${slow}，<code>fast</code> 走 2 步到下标 ${fast === null ? 'None（无环）' : fast}。`, scene({ [slow]: 'cur', ...(fast !== null ? { [fast]: 'hl' } : {}) }));
      if (fast === null) break;
      if (slow === fast) {
        met = true;
        rec.step([7, 8], `<code>slow === fast</code>，在下标 ${slow} 相遇 → 链表<b>有环</b>。`, scene({ [slow]: 'ok' }));
        break;
      }
    }
    if (!met) {
      rec.step([9, 10], 'fast 走到 None，链表无环，返回 None。', scene());
      return { steps: rec.steps, result: null };
    }
    slow = 0;
    rec.step(12, '第二阶段：<code>slow</code> 回到头部，fast 留在相遇点。两者<b>同速</b>各走 1 步——因为 a = c − b + (k−1)c，它们必在入口相遇。', scene({ [slow]: 'cur', [fast]: 'hl' }));
    while (slow !== fast) {
      slow = next[slow]; fast = next[fast];
      rec.step([15, 16], `slow → 下标 ${slow}，fast → 下标 ${fast}。`, scene({ [slow]: 'cur', [fast]: 'hl' }));
    }
    rec.step(16, `<code>slow === fast</code> 于下标 <code>${slow}</code>（值 ${vals[slow]}）——这就是环的入口。`, scene({ [slow]: 'ok' }));
    return { steps: rec.steps, result: slow };
  },
  solve({ vals, pos }) {
    // independent: visited set walk
    let cur = 0;
    const seen = new Set();
    while (cur !== null) {
      if (seen.has(cur)) return cur;
      seen.add(cur);
      cur = cur === vals.length - 1 ? (pos === -1 ? null : pos) : cur + 1;
    }
    return null;
  },
};
