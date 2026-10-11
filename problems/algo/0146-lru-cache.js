import { recorder } from '../../js/util.js';

const code = `class Node:
    def __init__(self, key, val):
        self.key, self.val = key, val
        self.prev = self.next = None

class LRUCache:
    def __init__(self, capacity):
        self.cap = capacity
        self.d = {}                    # key -> node
        # 头尾哨兵：head.next 最近用，tail.prev 最久未用
        self.head = Node(-1, -1)
        self.tail = Node(-1, -1)
        self.head.next = self.tail
        self.tail.prev = self.head
    def _remove(self, node):
        node.prev.next = node.next
        node.next.prev = node.prev
    def _add_front(self, node):
        node.prev = self.head
        node.next = self.head.next
        node.next.prev = self.head.next = node
    def get(self, key):
        if key not in self.d:
            return -1
        node = self.d[key]
        self._remove(node); self._add_front(node)
        return node.val
    def put(self, key, value):
        if key in self.d:
            self._remove(self.d[key])
        node = Node(key, value)
        self.d[key] = node
        self._add_front(node)
        if len(self.d) > self.cap:
            old = self.tail.prev       # 最久未用
            self._remove(old)
            del self.d[old.key]`;

export default {
  id: 'lc-146', track: 'algo', num: 146, slug: 'lru-cache', title: 'LRU 缓存', category: '链表', difficulty: '中等',
  code,
  oneLine: '哈希表 + 双向链表：O(1) 找到、移到队首、淘汰队尾',
  summary: '设计满足 O(1) get/put 的最近最少使用（LRU）缓存：容量满时淘汰最久未使用的键。',
  ideas: [
    '<b>哈希表</b>负责 O(1) 按键找节点；<b>双向链表</b>负责 O(1) 维护「新旧顺序」——头部最近、尾部最旧。',
    '每次 get / put 命中都把节点<b>摘下再插到最前</b>，它就是最新的。',
    '容量超了直接删<b>尾节点</b>（哨兵 tail.prev），并把它的 key 从表里删掉。哨兵节点省去大量空指针判断。',
  ],
  complexity: 'get / put 均 O(1)，空间 O(capacity)',
  presets: [
    { name: '力扣示例', input: { cap: 2, ops: [['put', 1, 1], ['put', 2, 2], ['get', 1], ['put', 3, 3], ['get', 2], ['put', 4, 4], ['get', 1], ['get', 3], ['get', 4]] } },
    { name: '更新已有 key', input: { cap: 2, ops: [['put', 2, 1], ['put', 2, 2], ['get', 2], ['put', 1, 1], ['put', 4, 1], ['get', 2]] } },
  ],
  validate(inp) {
    if (!Number.isInteger(inp.cap) || inp.cap < 1 || inp.cap > 6) return 'cap 取 1~6';
    if (!Array.isArray(inp.ops) || !inp.ops.length) return 'ops 需要是操作数组';
    if (inp.ops.length > 12) return '为了动画清晰，最多 12 个操作';
    for (const op of inp.ops) {
      if (!Array.isArray(op) || !['get', 'put'].includes(op[0])) return '操作必须是 ["get",k] 或 ["put",k,v]';
      if (op[0] === 'get' && op.length !== 2) return 'get 操作形如 ["get",k]';
      if (op[0] === 'put' && op.length !== 3) return 'put 操作形如 ["put",k,v]';
    }
    return null;
  },
  run({ cap, ops }) {
    const rec = recorder();
    // list order: MRU -> LRU (index 0 = most recently used)
    const order = [];           // keys, MRU first
    const d = new Map();        // key -> value
    const outputs = [];
    const touch = (k) => { order.splice(order.indexOf(k), 1); order.unshift(k); };
    const evict = () => { const k = order.pop(); d.delete(k); return k; };
    const nodes = () => order.map((k) => ({ id: k, val: `${k}:${d.get(k)}` }));
    const nextOf = () => Object.fromEntries(order.map((k, i) => [k, order[i + 1] ?? null]));
    const scene = (hl = {}, txt = '') => [
      { type: 'list', id: 'l', label: `双向链表（左=最近使用 MRU，右=最久未用 LRU，容量 ${cap}）`, nodes: nodes(), next: nextOf(), colors: hl, nullTail: true },
      { type: 'map', id: 'm', label: '哈希表 d（key → value）', headers: ['key', 'value'], entries: [...d.entries()] },
      { type: 'array', id: 'o', label: '输出（每个操作的返回值）', values: outputs.map((x) => (x === null ? 'null' : x)), showIndex: false },
      ...(txt ? [{ type: 'text', id: 't', label: '当前操作', text: txt }] : []),
    ];
    rec.step([8, 14], `初始化容量 ${cap} 的缓存：哈希表 + 双向链表（代码里用 head/tail 哨兵省掉边界判断）。`, scene());
    for (const op of ops) {
      const opStr = op[0] === 'get' ? `get(${op[1]})` : `put(${op[1]}, ${op[2]})`;
      if (op[0] === 'get') {
        const k = op[1];
        rec.step(23, `执行 <code>${opStr}</code>：查哈希表 ${k} 在不在。`, scene({ [k]: 'cmp' }, opStr));
        if (!d.has(k)) {
          outputs.push(-1);
          rec.step(24, `${k} 不在缓存里，返回 <code>-1</code>。`, scene({}, opStr));
        } else {
          touch(k);
          const v = d.get(k);
          outputs.push(v);
          rec.step([25, 26, 27], `命中 ${k}（值 ${v}）：把它从链表摘下插到最前，表示「刚用过」，返回 <code>${v}</code>。`, scene({ [k]: 'ok' }, opStr));
        }
      } else {
        const [, k, v] = op;
        if (d.has(k)) {
          d.set(k, v);
          touch(k);
          outputs.push(null);
          rec.step([29, 30], `执行 <code>${opStr}</code>：key ${k} 已存在，先删旧节点（值更新为 ${v}），再插到最前。`, scene({ [k]: 'hl' }, opStr));
        } else {
          d.set(k, v);
          order.unshift(k);
          outputs.push(null);
          rec.step([31, 32, 33], `执行 <code>${opStr}</code>：新建节点 (${k}, ${v}) 入表并插到最前。`, scene({ [k]: 'hl' }, opStr));
        }
        if (d.size > cap) {
          const old = evict();
          rec.step([34, 35, 36, 37], `大小 ${d.size + 1} > 容量 ${cap}：尾部节点 <code>${old}</code> 最久未用，摘下并从哈希表删除。`, scene({ [k]: 'hl' }, `淘汰最久未用的 key = ${old}`));
        }
      }
    }
    rec.step(1, `所有操作完成。输出序列 = <code>[${outputs.map((x) => (x === null ? 'null' : x)).join(', ')}]</code>。`, scene());
    return { steps: rec.steps, result: outputs };
  },
  solve({ cap, ops }) {
    // independent reference: keep an array of keys, index 0 = oldest
    const d = new Map();
    const use = [];           // index 0 = oldest, last = newest
    const out = [];
    for (const op of ops) {
      if (op[0] === 'get') {
        const k = op[1];
        if (!d.has(k)) { out.push(-1); continue; }
        use.splice(use.indexOf(k), 1); use.push(k);
        out.push(d.get(k));
      } else {
        const [, k, v] = op;
        if (d.has(k)) use.splice(use.indexOf(k), 1);
        d.set(k, v); use.push(k);
        if (use.length > cap) { const old = use.shift(); d.delete(old); }
        out.push(null);
      }
    }
    return out;
  },
};
