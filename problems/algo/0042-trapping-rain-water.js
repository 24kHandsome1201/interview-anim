import { recorder } from '../../js/util.js';

const code = `def trap(height):
    left, right = 0, len(height) - 1
    l_max = r_max = 0
    ans = 0
    while left < right:
        if height[left] < height[right]:
            l_max = max(l_max, height[left])
            ans += l_max - height[left]
            left += 1
        else:
            r_max = max(r_max, height[right])
            ans += r_max - height[right]
            right -= 1
    return ans`;

export default {
  id: 'lc-42', track: 'algo', num: 42, slug: 'trapping-rain-water', title: '接雨水', category: '双指针', difficulty: '困难',
  code,
  oneLine: '左右双指针，矮的一侧先结算',
  summary: '给定 n 个非负整数表示每个宽度为 1 的柱子的高度，计算下雨之后能接多少雨水。',
  ideas: [
    '位置 i 能接的水 = <b>min(左边最高, 右边最高) − height[i]</b>。',
    '左右各放一个指针。哪边柱子矮，哪边的水位就由它自己那一侧的最高值决定，因为另一侧一定有更高的柱子挡着。',
    '所以每次移动矮的那一侧，边走边更新最高值并累加水量，一趟扫完。',
  ],
  complexity: '时间 O(n)，空间 O(1)',
  presets: [
    { name: '示例 1', input: { height: [0, 1, 0, 2, 1, 0, 1, 3, 2, 1, 2, 1] } },
    { name: '示例 2', input: { height: [4, 2, 0, 3, 2, 5] } },
  ],
  validate(inp) {
    if (!Array.isArray(inp.height) || inp.height.some((x) => !Number.isInteger(x) || x < 0)) return 'height 需要是非负整数数组';
    if (inp.height.length > 20) return '为了动画清晰，最多 20 根柱子';
    return null;
  },
  run({ height }) {
    const rec = recorder();
    const n = height.length;
    const water = Array(n).fill(0);
    const colors = {};
    let left = 0, right = n - 1, leftMax = 0, rightMax = 0, ans = 0;
    const scene = (extra = {}) => [
      { type: 'bars', id: 'h', label: 'height（蓝色为已结算的水）', values: height, water: [...water], colors: { ...colors, ...extra }, pointers: { left, right } },
      { type: 'vars', id: 'v', items: { left_max: leftMax, right_max: rightMax, ans } },
    ];
    rec.step(2, `初始化：<code>left = 0</code>，<code>right = ${n - 1}</code>。两个指针从两端往中间走。`, scene());
    while (left < right) {
      rec.step(6, `比较 <code>height[${left}] = ${height[left]}</code> 和 <code>height[${right}] = ${height[right]}</code>：${height[left] < height[right] ? '左边更矮，结算左边' : '右边不比左边矮，结算右边'}。`, scene({ [left]: 'cmp', [right]: 'cmp' }));
      if (height[left] < height[right]) {
        leftMax = Math.max(leftMax, height[left]);
        const w = leftMax - height[left];
        ans += w; water[left] = w; colors[left] = 'ok';
        rec.step([7, 8], `<code>left_max = ${leftMax}</code>。右边有更高的柱子挡着，所以位置 ${left} 的水位就是 left_max，这里接 <code>${leftMax} − ${height[left]} = ${w}</code> 格水。`, scene({ [left]: 'cur' }));
        left++;
        rec.step(9, `<code>left</code> 右移到 ${left}。`, scene());
      } else {
        rightMax = Math.max(rightMax, height[right]);
        const w = rightMax - height[right];
        ans += w; water[right] = w; colors[right] = 'ok';
        rec.step([11, 12], `<code>right_max = ${rightMax}</code>。左边有不矮于它的柱子，所以位置 ${right} 的水位就是 right_max，这里接 <code>${rightMax} − ${height[right]} = ${w}</code> 格水。`, scene({ [right]: 'cur' }));
        right--;
        rec.step(13, `<code>right</code> 左移到 ${right}。`, scene());
      }
    }
    rec.step(14, `两指针相遇，循环结束。总共能接 <code>${ans}</code> 格雨水。`, scene());
    return { steps: rec.steps, result: ans };
  },
  solve({ height }) {
    let s = 0;
    for (let i = 0; i < height.length; i++) {
      const l = Math.max(...height.slice(0, i + 1)), r = Math.max(...height.slice(i));
      s += Math.min(l, r) - height[i];
    }
    return s;
  },
};
