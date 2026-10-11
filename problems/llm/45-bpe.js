import { recorder } from '../../js/util.js';

const code = `def bpe_train(corpus, num_merges):
    # corpus: {word: count}，先拆成单字符
    words = {tuple(w): c for w, c in corpus.items()}
    merges = []
    for _ in range(num_merges):
        pairs = count_pairs(words)      # 统计相邻对频次（按词频加权）
        best = max(pairs, key=pairs.get)
        words = merge(words, best)      # 所有相邻的 best 都合并
        merges.append(best)
    return merges`;

export default {
  id: 'llm-45', track: 'llm', num: 45, title: 'BPE 训练', category: 'Tokenizer',
  code,
  oneLine: '每轮统计最频繁的相邻 token 对，全语料合并，词表 +1',
  summary: '训练 BPE tokenizer：把语料先拆成字符，反复合并出现频率最高的相邻 token 对，得到子词词表。',
  ideas: [
    '初始词表 = 所有单个字符；每个词先拆成字符序列。',
    '每轮：统计所有<b>相邻 token 对</b>的加权频次（乘词频），取最高的一对合并成新 token，语料中所有相邻的该对都替换。',
    '合 N 轮得到 N 条 merge 规则；编码新文本时按同样顺序应用这些规则即可。常见子词（th、ing、</w>）自然浮出。',
  ],
  complexity: '每轮 O(语料总长)；merge 数 = 词表增量',
  presets: [
    { name: '经典例子', input: { corpus: { low: 5, lower: 2, lowest: 2, wider: 3 }, merges: 4 } },
    { name: '短一点', input: { corpus: { hug: 3, pug: 2, pun: 2, bun: 4 }, merges: 3 } },
  ],
  validate(inp) {
    if (!inp.corpus || typeof inp.corpus !== 'object') return 'corpus 需要是 {词: 频次} 对象';
    const ks = Object.keys(inp.corpus);
    if (!ks.length || ks.length > 8) return '1~8 个词';
    if (ks.some((w) => !/^[a-z]+$/.test(w) || w.length > 8)) return '词只需小写字母且 ≤8 字符';
    if (ks.some((w) => !Number.isInteger(inp.corpus[w]) || inp.corpus[w] < 1)) return '频次需要正整数';
    if (!Number.isInteger(inp.merges) || inp.merges < 1 || inp.merges > 8) return 'merges 取 1~8';
    return null;
  },
  run({ corpus, merges: NM }) {
    const rec = recorder();
    let words = Object.entries(corpus).map(([w, c]) => [w.split(''), c]);
    const vocab = [...new Set(words.flatMap(([w]) => w))];
    const merges = [];
    const fmtWords = () => words.map(([w, c]) => `${w.join(' ')} ×${c}`).join('\n');
    const scene = (pairs = null, hl = '', extra = '') => [
      { type: 'text', id: 'w', label: '语料（token 序列 ×词频）', text: fmtWords() + extra },
      { type: 'map', id: 'p', label: '相邻对频次', headers: ['token 对', '频次'], entries: pairs ? [...pairs.entries()].sort((a, b) => b[1] - a[1]) : [['∅', '']], colors: hl ? { [hl]: 'ok' } : {} },
      { type: 'map', id: 'v', label: `merge 规则（按顺序应用）· 词表大小 ${vocab.length}`, headers: ['#', 'merge'], entries: merges.length ? merges.map((m, i) => [i + 1, m.join(' + ')]) : [['∅', '']] },
    ];
    rec.step([2, 3], `语料拆成字符：${Object.entries(corpus).map(([w, c]) => `"${w}"×${c}`).join('，')}。初始词表 = ${vocab.length} 个单字符。`, scene());
    for (let it = 0; it < NM; it++) {
      const pairs = new Map();
      for (const [w, c] of words) for (let j = 0; j + 1 < w.length; j++) {
        const key = `${w[j]} ${w[j + 1]}`;
        pairs.set(key, (pairs.get(key) || 0) + c);
      }
      if (!pairs.size) break;
      const top = [...pairs.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0];
      rec.step(6, `第 ${it + 1} 轮：统计所有相邻 token 对的频次（词频加权）。最高：<code>${top.join(' → ')}</code>。`, scene(pairs));
      const best = top[0].split(' ');
      merges.push(best);
      const nt = best.join('');
      vocab.push(nt);
      let cnt = 0;
      words = words.map(([w, c]) => {
        const nw = [];
        for (let j = 0; j < w.length; j++) {
          if (j + 1 < w.length && w[j] === best[0] && w[j + 1] === best[1]) { nw.push(nt); j++; cnt += c; }
          else nw.push(w[j]);
        }
        return [nw, c];
      });
      rec.step([7, 8], `合并 <code>'${best[0]}' + '${best[1]}' → '${nt}'</code>（出现 ${pairs.get(best.join(' '))} 次）。全语料中所有相邻的该对都替换，词表 +1（现 ${vocab.length}）。`, scene(null, '', `\n本轮合并：${best.join(' + ')} → ${nt}`));
    }
    rec.step(9, `训练完成。merge 规则共 ${merges.length} 条；编码新词时按相同顺序应用即可（如 "lowest" → ${(() => { let w = 'lowest'.split(''); for (const [a, b] of merges) { const nw = []; for (let j = 0; j < w.length; j++) { if (j + 1 < w.length && w[j] === a && w[j + 1] === b) { nw.push(a + b); j++; } else nw.push(w[j]); } w = nw; } return w.join(' '); })()}）。`, scene());
    return { steps: rec.steps, result: merges.map((m) => m.join('')) };
  },
  solve({ corpus, merges: NM }) {
    // independent: same algorithm recomputed via strings
    let words = Object.entries(corpus).map(([w, c]) => [w.split(''), c]);
    const out = [];
    for (let it = 0; it < NM; it++) {
      const cnt = {};
      for (const [w, c] of words) for (let j = 0; j + 1 < w.length; j++) {
        const k = w[j] + '|' + w[j + 1];
        cnt[k] = (cnt[k] || 0) + c;
      }
      const best = Object.entries(cnt).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0];
      if (!best) break;
      const [a, b] = best[0].split('|');
      out.push(a + b);
      words = words.map(([w, c]) => {
        const nw = [];
        for (let j = 0; j < w.length; j++) {
          if (j + 1 < w.length && w[j] === a && w[j + 1] === b) { nw.push(a + b); j++; }
          else nw.push(w[j]);
        }
        return [nw, c];
      });
    }
    return out;
  },
};
