import { recorder } from '../../js/util.js';

const code = `def numIslands(grid):
    count = 0
    for i in range(len(grid)):
        for j in range(len(grid[0])):
            if grid[i][j] == '1':
                count += 1
                dfs(grid, i, j)   # 把整座岛染成 '0'
    return count

def dfs(g, i, j):
    if (i < 0 or i >= len(g) or j < 0 or j >= len(g[0])
            or g[i][j] != '1'):
        return
    g[i][j] = '0'                 # 染色 = 标记访问过
    dfs(g, i + 1, j)
    dfs(g, i - 1, j)
    dfs(g, i, j + 1)
    dfs(g, i, j - 1)`;

export default {
  id: 'lc-200', track: 'algo', num: 200, slug: 'number-of-islands', title: '岛屿数量', category: '图论', difficulty: '中等',
  code,
  oneLine: '每发现一块陆地就计数 +1，并把整座岛淹没（染成水）',
  summary: '二维网格中 1 为陆地、0 为水，上下左右相连的 1 算一座岛，数一共有多少座。',
  ideas: [
    '扫描每个格子：遇到 <code>1</code> 说明发现<b>一座新岛</b>，计数 +1。',
    '然后用 DFS（或 BFS）从这个格子出发，把上下左右所有相连的 1 全部染成 0——相当于「淹没」整座岛，防止重复计数。',
    '染色同时充当访问标记，不需要额外的 visited 数组。',
  ],
  complexity: '时间 O(m·n)，空间 O(m·n)（递归最坏）',
  presets: [
    { name: '三座岛', input: { grid: [['1', '1', '0', '0'], ['1', '0', '0', '1'], ['0', '0', '1', '1'], ['1', '0', '0', '0']] } },
    { name: '一座大岛', input: { grid: [['1', '1', '0'], ['0', '1', '0'], ['0', '1', '1']] } },
  ],
  validate(inp) {
    if (!Array.isArray(inp.grid) || !inp.grid.length || !Array.isArray(inp.grid[0])) return 'grid 需要是二维数组';
    if (inp.grid.length > 6 || inp.grid[0].length > 6) return '为了动画清晰，网格最大 6×6';
    if (inp.grid.some((r) => r.length !== inp.grid[0].length || r.some((x) => !['0', '1', 0, 1].includes(x)))) return "格子只能是 '0'/'1' 且每行等长";
    return null;
  },
  run({ grid }) {
    const rec = recorder();
    const R = grid.length, C = grid[0].length;
    const g = grid.map((r) => r.map(String));
    const colors = {};
    const ISL = ['ok', 'hl', 'cur', 'cmp', 'win', 'bad'];
    let count = 0;
    const scene = (extra = {}, vars = {}) => [
      { type: 'matrix', id: 'g', label: 'grid（不同颜色 = 不同的岛）', values: g.map((r) => r.map(String)), colors },
      { type: 'vars', id: 'v', items: { 岛屿数: count, ...vars } },
    ];
    rec.step(2, '从上到下、从左到右扫描。遇到还没染色的 1 就发现一座新岛。', scene());
    const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (let i = 0; i < R; i++) {
      for (let j = 0; j < C; j++) {
        if (g[i][j] !== '1') {
          if (g[i][j] === '0' && !colors[`${i},${j}`]) colors[`${i},${j}`] = '';
          continue;
        }
        count++;
        const cls = ISL[(count - 1) % ISL.length];
        rec.step([5, 6, 7], `<code>grid[${i}][${j}] = '1'</code> 且未访问——发现第 <code>${count}</code> 座岛！计数 +1，随后 DFS 把整座岛染色。`, scene({ [`${i},${j}`]: 'cur' }));
        // iterative DFS to emit steps
        const stack = [[i, j]];
        g[i][j] = '0'; colors[`${i},${j}`] = cls;
        while (stack.length) {
          const [x, y] = stack.pop();
          rec.step(14, `染色 <code>(${x}, ${y})</code>：1 → 0，表示这块陆地已属于第 ${count} 座岛。`, scene({ [`${x},${y}`]: cls }));
          const inside = [];
          for (const [dx, dy] of DIRS) {
            const nx = x + dx, ny = y + dy;
            if (nx >= 0 && nx < R && ny >= 0 && ny < C && g[nx][ny] === '1') { g[nx][ny] = '0'; colors[`${nx},${ny}`] = 'cur'; inside.push([nx, ny]); stack.push([nx, ny]); }
          }
          if (inside.length) rec.step([15, 18], `(${x}, ${y}) 的相邻陆地 ${inside.map(([a, b]) => `(${a},${b})`).join('、')} 也属于同一座岛，继续染色。`, scene());
          for (const [a, b] of inside) colors[`${a},${b}`] = cls;
        }
        rec.step(7, `第 ${count} 座岛全部染完。继续扫描，剩余的 1 都属于别的岛。`, scene());
      }
    }
    rec.step(8, `扫描结束，共 <code>${count}</code> 座岛。`, scene());
    return { steps: rec.steps, result: count };
  },
  solve({ grid }) {
    // independent: union-find
    const R = grid.length, C = grid[0].length;
    const g = grid.map((r) => r.map(String));
    const id = (i, j) => i * C + j;
    const par = Array.from({ length: R * C }, (_, i) => i);
    const find = (x) => (par[x] === x ? x : (par[x] = find(par[x])));
    const uni = (a, b) => { par[find(a)] = find(b); };
    for (let i = 0; i < R; i++) for (let j = 0; j < C; j++) {
      if (g[i][j] !== '1') continue;
      if (i + 1 < R && g[i + 1][j] === '1') uni(id(i, j), id(i + 1, j));
      if (j + 1 < C && g[i][j + 1] === '1') uni(id(i, j), id(i, j + 1));
    }
    const roots = new Set();
    for (let i = 0; i < R; i++) for (let j = 0; j < C; j++) if (g[i][j] === '1') roots.add(find(id(i, j)));
    return roots.size;
  },
};
