import { recorder } from '../../js/util.js';

const code = `from collections import deque

def canFinish(numCourses, prerequisites):
    g = [[] for _ in range(numCourses)]
    indeg = [0] * numCourses
    for a, b in prerequisites:      # 先修 b 才能修 a：b -> a
        g[b].append(a)
        indeg[a] += 1
    q = deque(i for i in range(numCourses) if indeg[i] == 0)
    done = 0
    while q:
        u = q.popleft()
        done += 1
        for v in g[u]:
            indeg[v] -= 1
            if indeg[v] == 0:
                q.append(v)
    return done == numCourses`;

export default {
  id: 'lc-207', track: 'algo', num: 207, slug: 'course-schedule', title: '课程表', category: '图论', difficulty: '中等',
  code,
  oneLine: '拓扑排序（Kahn BFS）：不断摘走入度为 0 的课',
  summary: 'numCourses 门课，prerequisites 里 [a,b] 表示修 a 前必须先修 b。判断能否修完所有课（即有向图无环）。',
  ideas: [
    '把先修关系建成<b>有向图</b>：b→a。能修完 ⟺ 图无环 ⟺ 存在拓扑序。',
    'Kahn 算法：先把<b>入度为 0</b> 的课入队；每弹出一门，把它指向的课入度 −1，减到 0 就入队。',
    '最后处理过的课程数 <code>done == numCourses</code> 说明无环；卡在中间说明有环互相依赖。',
  ],
  complexity: '时间 O(V+E)，空间 O(V+E)',
  presets: [
    { name: '可以完成', input: { n: 4, pre: [[1, 0], [2, 0], [3, 1], [3, 2]] } },
    { name: '有环', input: { n: 3, pre: [[1, 0], [0, 1], [2, 1]] } },
  ],
  validate(inp) {
    if (!Number.isInteger(inp.n) || inp.n < 2 || inp.n > 8) return '课程数 n 取 2~8';
    if (!Array.isArray(inp.pre)) return 'pre 需要是边数组';
    if (inp.pre.length > 10) return '最多 10 条先修关系';
    for (const e of inp.pre) if (!Array.isArray(e) || e.length !== 2 || e.some((x) => !Number.isInteger(x) || x < 0 || x >= inp.n)) return '每条边形如 [a,b]，0 ≤ a,b < n';
    return null;
  },
  run({ n, pre }) {
    const rec = recorder();
    const g = Array.from({ length: n }, () => []);
    const indeg = Array(n).fill(0);
    const POS = Array.from({ length: n }, (_, i) => ({ x: 0.5 + 0.45 * Math.cos((2 * Math.PI * i) / n - Math.PI / 2), y: 0.5 + 0.4 * Math.sin((2 * Math.PI * i) / n - Math.PI / 2) }));
    for (const [a, b] of pre) { g[b].push(a); indeg[a]++; }
    const gnodes = () => POS.map((p, i) => ({ id: i, label: i, x: p.x, y: p.y }));
    const edges = pre.map(([a, b]) => ({ from: b, to: a }));
    const doneSet = new Set();
    const queue = [];
    let done = 0;
    const scene = (extra = {}, ecol = null, vars = {}) => [
      { type: 'graph', id: 'g', label: '先修图（b → a 表示先修 b 再修 a；下方数字为入度）', nodes: gnodes(), edges: edges.map((e, i) => ({ ...e, color: ecol?.[i] })), directed: true, width: 380, height: 240, colors: { ...Object.fromEntries([...doneSet].map((x) => [x, 'ok'])), ...extra }, sub: Object.fromEntries(indeg.map((d, i) => [i, `入度${d}`])) },
      { type: 'array', id: 'q', label: '队列 q（入度为 0 的课）', values: [...queue] },
      { type: 'vars', id: 'v', items: { '已修 done': done, '总课数': n, ...vars } },
    ];
    rec.step([4, 8], `建图并统计入度：${pre.length ? pre.map(([a, b]) => `${b}→${a}`).join('，') : '无边'}。`, scene());
    for (let i = 0; i < n; i++) if (indeg[i] === 0) queue.push(i);
    rec.step(9, `入度为 0 的课可以直接修：入队 <code>[${queue.join(', ')}]</code>。`, scene(Object.fromEntries(queue.map((x) => [x, 'cur']))));
    while (queue.length) {
      const u = queue.shift();
      done++; doneSet.add(u);
      rec.step([11, 12, 13], `出队课程 <code>${u}</code>（可修），done = ${done}。`, scene({ [u]: 'ok' }));
      for (const v of g[u]) {
        indeg[v]--;
        const ei = pre.findIndex(([a, b]) => a === v && b === u);
        rec.step([14, 15], `删掉边 ${u}→${v}：<code>indeg[${v}]</code> 减为 ${indeg[v]}${indeg[v] === 0 ? '，降为 0 → 入队' : ''}。`, scene({ [u]: 'ok', [v]: indeg[v] === 0 ? 'cur' : 'cmp' }, ei >= 0 ? { [ei]: 'bad' } : null));
        if (indeg[v] === 0) queue.push(v);
      }
    }
    const ok = done === n;
    rec.step(18, ok ? `done = ${done} = n，所有课都能修完（图无环），返回 <code>True</code>。` : `done = ${done} < ${n}：剩下的课入度都不为 0，它们构成<b>环</b>互相等待，永远修不完 → 返回 <code>False</code>。`, scene());
    return { steps: rec.steps, result: ok };
  },
  solve({ n, pre }) {
    // independent: DFS cycle detection (white/gray/black)
    const g = Array.from({ length: n }, () => []);
    for (const [a, b] of pre) g[b].push(a);
    const state = Array(n).fill(0);
    const dfs = (u) => {
      state[u] = 1;
      for (const v of g[u]) {
        if (state[v] === 1) return true;
        if (state[v] === 0 && dfs(v)) return true;
      }
      state[u] = 2;
      return false;
    };
    for (let i = 0; i < n; i++) if (state[i] === 0 && dfs(i)) return false;
    return true;
  },
};
