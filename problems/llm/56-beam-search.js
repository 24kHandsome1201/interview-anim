import { recorder, round } from '../../js/util.js';

const code = `import math
import torch

def beam_search(logp_fn, beam_size, max_len):
    beams = [([], 0.0)]              # (已选 token, 累积 log 概率)
    for _ in range(max_len):
        cand = []
        for seq, s in beams:
            for tok, lp in enumerate(logp_fn(seq)):
                cand.append((seq + [tok], s + lp))
        cand.sort(key=lambda x: x[1], reverse=True)
        beams = cand[:beam_size]     # 只留 top-k 个前缀
    return max(beams, key=lambda x: x[1])[0]`;

const TOK = ['我', '爱', '学', '习', 'AI', '。'];

// deterministic pseudo log-prob: function of (prefix signature, token) only
const lp = (seq, tok, seed) => {
  let h = seed >>> 0;
  for (const t of seq) h = (h * 31 + t + 1) >>> 0;
  h = (h * 31 + tok + 7) >>> 0;
  return -(((h % 1000) / 1000) * 4 + 0.1);
};

export default {
  id: 'llm-56', track: 'llm', num: 56, title: 'Beam Search', category: '解码采样',
  code,
  oneLine: '每步保留累积 log 概率最高的 k 条前缀，贪心与穷举的折中',
  summary: 'Beam search：不采单个 token，而是维护 beam_size 条最优前缀，每步全部扩展后只留 top-k。贪心是 k=1 的特例。',
  ideas: [
    '贪心每步只取当前最大，可能早早锁死在局部最优；穷举所有序列是指数爆炸（v^T）。',
    'Beam search 折中：每步把 k 条前缀各扩 v 个候选（共 k·v 个），按<b>累积 log 概率</b>留前 k。',
    'log 概率累加让长序列天然被惩罚；实际实现还常加 length penalty 并按 EOS 终止。',
  ],
  complexity: '时间 O(T·k·v)，空间 O(k·T)',
  presets: [
    { name: 'beam=2, 3 步', input: { V: 5, beam: 2, len: 3, seed: 19 } },
    { name: 'beam=1（=贪心）', input: { V: 5, beam: 1, len: 3, seed: 19 } },
  ],
  validate(inp) {
    if (!Number.isInteger(inp.V) || inp.V < 2 || inp.V > 6) return '词表大小 V 取 2~6';
    if (!Number.isInteger(inp.beam) || inp.beam < 1 || inp.beam > 3) return 'beam 取 1~3';
    if (!Number.isInteger(inp.len) || inp.len < 1 || inp.len > 4) return 'len 取 1~4';
    return null;
  },
  run({ V, beam, len, seed = 3 }) {
    const rec = recorder();
    const tk = TOK.slice(0, V);
    const logp = (seq) => Array.from({ length: V }, (_, t) => lp(seq, t, seed));
    let beams = [[[], 0]];
    const fmtSeq = (s) => (s.length ? s.map((t) => tk[t]).join('') : '⟨空⟩');
    const beamLayer = (bs, hl = -1) => ({ type: 'map', id: 'b', label: `beam（保留 ${beam} 条最优前缀）`, headers: ['前缀', 'Σlogp'], entries: bs.map(([s, v]) => [fmtSeq(s), round(v, 3)]), colors: hl >= 0 ? { [fmtSeq(bs[hl][0])]: 'ok' } : {} });
    rec.step(4, `词表 ${tk.join('、')}，beam = ${beam}，生成 ${len} 步。初始只有空前缀，分数 0。`, [beamLayer(beams)]);
    for (let t = 0; t < len; t++) {
      const cand = [];
      for (const [seq, s] of beams) {
        const lps = logp(seq);
        lps.forEach((v, tok) => cand.push([[...seq, tok], s + v]));
      }
      rec.step([6, 7, 8], `第 ${t + 1} 步：把 ${beams.length} 条前缀各扩展 ${V} 个 token，共 ${cand.length} 个候选（分数 = 前缀分 + 本步 logp）。`,
        [beamLayer(beams), { type: 'text', id: 'c', label: '全部候选（前缀 + 候选token → 分数）', text: cand.map(([s, v]) => `${fmtSeq(s.slice(0, -1))} + ${tk[s[s.length - 1]]} → ${round(v, 2)}`).join('\n') }]);
      cand.sort((a, b) => b[1] - a[1]);
      const dropped = cand.slice(beam);
      beams = cand.slice(0, beam);
      rec.step([9, 10], `按累积分数留 top-${beam}：${beams.map(([s, v]) => `"${fmtSeq(s)}" (${round(v, 2)})`).join('、')}；剪掉 ${dropped.length} 条较差前缀。`,
        [beamLayer(beams)]);
    }
    const best = beams.reduce((a, b) => (b[1] > a[1] ? b : a));
    rec.step(11, `结束。最优序列 = <code>"${fmtSeq(best[0])}"</code>，累积 log 概率 ${round(best[1], 3)}。beam=1 时就是贪心；beam 越大越接近全局最优但越贵。`,
      [beamLayer(beams, 0)]);
    return { steps: rec.steps, result: best[0] };
  },
  solve({ V, beam, len, seed = 3 }) {
    // independent: exhaustive DFS over all V^len sequences, take best
    const logp = (seq) => Array.from({ length: V }, (_, t) => lp(seq, t, seed));
    let best = { seq: null, s: -Infinity };
    const dfs = (seq, s) => {
      if (seq.length === len) { if (s > best.s) best = { seq, s }; return; }
      logp(seq).forEach((v, t) => dfs([...seq, t], s + v));
    };
    dfs([], 0);
    return best.seq;
  },
};
