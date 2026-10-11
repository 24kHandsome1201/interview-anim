import { recorder } from '../../js/util.js';

const code = `def lengthOfLongestSubstring(s):
    last = {}            # 字符 -> 上次出现的下标
    start = best = 0
    for i, ch in enumerate(s):
        if ch in last and last[ch] >= start:
            start = last[ch] + 1
        last[ch] = i
        best = max(best, i - start + 1)
    return best`;

export default {
  id: 'lc-3', track: 'algo', num: 3, slug: 'longest-substring-without-repeating-characters', title: '无重复字符的最长子串', category: '滑动窗口', difficulty: '中等',
  code,
  oneLine: '滑动窗口 + 哈希表记每个字符上次出现的位置',
  summary: '给定字符串 s，求不含重复字符的最长子串长度。',
  ideas: [
    '维护窗口 <code>[start, i]</code>，要求窗口内字符互不相同。',
    '用哈希表记<b>每个字符上次出现的下标</b>。遇到重复字符时，窗口左端直接跳到 <code>last[ch] + 1</code>，不用一格一格挪。',
    '只有当重复位置还落在当前窗口内（<code>last[ch] ≥ start</code>）才需要跳；每步更新最长长度。',
  ],
  complexity: '时间 O(n)，空间 O(字符集)',
  presets: [
    { name: 'abcabcbb', input: { s: 'abcabcbb' } },
    { name: 'pwwkew', input: { s: 'pwwkew' } },
  ],
  validate(inp) {
    if (typeof inp.s !== 'string') return 's 需要是字符串';
    if (inp.s.length > 16) return '为了动画清晰，最多 16 个字符';
    if (!/^[a-z]+$/.test(inp.s)) return '请只使用小写字母 a-z';
    return null;
  },
  run({ s }) {
    const rec = recorder();
    const n = s.length;
    const last = new Map();
    let start = 0, best = 0;
    const winColors = () => {
      const c = {};
      for (let j = start; j <= (scene_i ?? -1); j++) c[j] = 'win';
      return c;
    };
    let scene_i = -1;
    const scene = (extra = {}, mapHl = {}) => [
      { type: 'array', id: 'a', label: `s（窗口 [${start}, ${scene_i}]，蓝色底）`, values: s.split(''), colors: { ...winColors(), ...extra }, pointers: { start, i: scene_i } },
      { type: 'map', id: 'm', label: 'last（字符 → 上次下标）', headers: ['字符', '下标'], entries: [...last.entries()].sort((a, b) => a[0] < b[0] ? -1 : 1), colors: mapHl },
      { type: 'vars', id: 'v', items: { start, i: scene_i, '当前长度': scene_i >= 0 ? scene_i - start + 1 : 0, best } },
    ];
    rec.step(2, '初始化：<code>last = {}</code> 记每个字符上次出现的下标，<code>start = 0</code> 是窗口左端。', scene());
    for (let i = 0; i < n; i++) {
      scene_i = i;
      const ch = s[i];
      const prev = last.get(ch);
      const inWin = prev !== undefined && prev >= start;
      rec.step(4, `i = ${i}，<code>ch = '${ch}'</code>。它上次出现在下标 <code>${prev === undefined ? '无' : prev}</code>${inWin ? `，落在窗口 [${start}, ${i}] 内，必须收缩` : '，不在窗口内，可以直接扩进窗口'}。`, scene({ [i]: 'cur' }, { [ch]: inWin ? 'bad' : '' }));
      if (inWin) {
        start = prev + 1;
        rec.step([5, 6], `窗口左端跳到 <code>start = ${prev} + 1 = ${start}</code>，把上次那个 '${ch}' 排除在窗口外。`, scene({ [i]: 'cur', [prev]: 'bad' }));
      }
      last.set(ch, i);
      rec.step(7, `更新 <code>last['${ch}'] = ${i}</code>。当前窗口 = <code>'${s.slice(start, i + 1)}'</code>。`, scene({ [i]: 'win' }, { [ch]: 'hl' }));
      const len = i - start + 1;
      if (len > best) {
        best = len;
        rec.step(8, `窗口长度 ${len} > best，更新 <code>best = ${best}</code>。`, scene({ [i]: 'ok' }));
      } else {
        rec.step(8, `窗口长度 ${len}，不超过 best = ${best}，保持。`, scene());
      }
    }
    rec.step(9, `结束。最长无重复子串长度 = <code>${best}</code>。`, scene());
    return { steps: rec.steps, result: best };
  },
  solve({ s }) {
    let best = 0;
    for (let i = 0; i < s.length; i++)
      for (let j = i; j < s.length; j++) {
        if (new Set(s.slice(i, j + 1)).size === j - i + 1) best = Math.max(best, j - i + 1);
        else break;
      }
    return best;
  },
};
