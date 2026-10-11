// Shared helpers for problem modules.

// Parse LeetCode level-order array into nodes. Node id = index in the input array.
export function parseTree(arr) {
  const nodes = [];
  if (!arr.length || arr[0] == null) return { root: null, nodes };
  const mk = (i) => { const n = { id: i, val: arr[i], left: null, right: null }; nodes.push(n); return n; };
  const root = mk(0);
  const q = [root];
  let i = 1;
  while (q.length && i < arr.length) {
    const cur = q.shift();
    if (i < arr.length && arr[i] != null) { cur.left = mk(i); q.push(cur.left); }
    i++;
    if (i < arr.length && arr[i] != null) { cur.right = mk(i); q.push(cur.right); }
    i++;
  }
  return { root, nodes };
}

// Tree layer helper: build a renderer-ready tree layer from parsed nodes.
export function treeLayer(id, label, nodes, extra = {}) {
  return {
    type: 'tree', id, label,
    nodes: nodes.map((n) => ({ id: n.id, val: n.val, left: n.left ? n.left.id : null, right: n.right ? n.right.id : null })),
    ...extra,
  };
}

export const round = (x, d = 2) => {
  if (typeof x !== 'number' || !isFinite(x)) return x;
  const p = 10 ** d;
  return Math.round(x * p) / p;
};
export const roundM = (m, d = 2) => m.map((r) => r.map((x) => round(x, d)));

export function softmax(v) {
  const m = Math.max(...v);
  const e = v.map((x) => Math.exp(x - m));
  const s = e.reduce((a, b) => a + b, 0);
  return e.map((x) => x / s);
}
export function matmul(A, B) {
  return A.map((row) => B[0].map((_, j) => row.reduce((s, a, k) => s + a * B[k][j], 0)));
}
export const transpose = (A) => A[0].map((_, j) => A.map((r) => r[j]));

// Deterministic PRNG so presets render identically every time.
export function rng(seed = 42) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}
export function randMatrix(r, c, seed = 1, scale = 1) {
  const g = rng(seed);
  return Array.from({ length: r }, () => Array.from({ length: c }, () => round((g() * 2 - 1) * scale, 2)));
}

// Deep clone for snapshotting state into steps.
export const clone = (x) => (x === undefined ? x : JSON.parse(JSON.stringify(x)));

// Step recorder: rec.step(line, text, scene). `line` is 1-based (number or [from, to]).
export function recorder() {
  const steps = [];
  return {
    steps,
    step(line, text, scene) { steps.push({ line, text, scene: clone(scene) }); },
  };
}
