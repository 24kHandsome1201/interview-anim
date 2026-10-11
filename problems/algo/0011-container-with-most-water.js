import { recorder } from '../../js/util.js';

const code = `def maxArea(height):
    left, right = 0, len(height) - 1
    best = 0
    while left < right:
        h = min(height[left], height[right])
        area = h * (right - left)
        best = max(best, area)
        if height[left] < height[right]:
            left += 1
        else:
            right -= 1
    return best`;

export default {
  id: 'lc-11', track: 'algo', num: 11, slug: 'container-with-most-water', title: '盛最多水的容器', category: '双指针', difficulty: '中等',
  code,
  oneLine: '左右双指针，每次移动较矮的那根板',
  summary: 'n 根竖板，选两根与 x 轴围成容器盛水，求最大水量。水量 = min(两板高) × 间距。',
  ideas: [
    '水量由<b>较矮的板</b>决定：min(h[l], h[r]) × (r − l)。',
    '从两端开始，宽度最大。若移动<b>较高</b>的板，宽度变小而高度上限不变，水量只会更小——所以只移动较矮的板才有可能变大。',
    '每步算一次面积、更新最大值，然后把矮的一侧往中间挪一格。',
  ],
  complexity: '时间 O(n)，空间 O(1)',
  presets: [
    { name: '示例 1', input: { height: [1, 8, 6, 2, 5, 4, 8, 3, 7] } },
    { name: '示例 2', input: { height: [2, 3, 4, 5, 18, 17, 6] } },
  ],
  validate(inp) {
    if (!Array.isArray(inp.height) || inp.height.some((x) => !Number.isInteger(x) || x < 0)) return 'height 需要是非负整数数组';
    if (inp.height.length < 2 || inp.height.length > 14) return '数组长度 2~14';
    return null;
  },
  run({ height }) {
    const rec = recorder();
    const n = height.length;
    let left = 0, right = n - 1, best = 0;
    const done = {};
    const scene = (extra = {}, vars = {}) => [
      { type: 'bars', id: 'h', label: 'height', values: height, colors: { ...done, ...extra }, pointers: { left, right } },
      { type: 'vars', id: 'v', items: { '宽 r−l': right - left, '高 min(h)': Math.min(height[left], height[right]), 面积: (right - left) * Math.min(height[left], height[right]), best, ...vars } },
    ];
    rec.step(2, `<code>left = 0, right = ${n - 1}</code>：先取最宽的一对。之后宽度只会变小，只能靠更高的矮板来补偿。`, scene());
    while (left < right) {
      const h = Math.min(height[left], height[right]);
      const area = h * (right - left);
      const moveLeft = height[left] < height[right];
      rec.step([5, 6], `当前容器：高 = min(${height[left]}, ${height[right]}) = <code>${h}</code>，宽 = ${right - left}，面积 = <code>${h} × ${right - left} = ${area}</code>。`, scene({ [left]: 'cmp', [right]: 'cmp' }));
      best = Math.max(best, area);
      rec.step(7, `更新 best = <code>${best}</code>。`, scene({ [left]: 'cmp', [right]: 'cmp' }));
      if (moveLeft) {
        rec.step([8, 9], `左板更矮（${height[left]} < ${height[right]}）：移动左板才可能遇到更高的板；移动右板面积只会变小。<code>left → ${left + 1}</code>。`, scene({ [left]: 'cur' }));
        done[left] = 'dim'; left++;
      } else {
        rec.step([10, 11], `右板不比左板高（${height[right]} ≤ ${height[left]}）：移动右板。<code>right → ${right - 1}</code>。`, scene({ [right]: 'cur' }));
        done[right] = 'dim'; right--;
      }
    }
    rec.step(12, `两指针相遇，所有有意义的容器都考虑过了。最大水量 = <code>${best}</code>。`, scene());
    return { steps: rec.steps, result: best };
  },
  solve({ height }) {
    let best = 0;
    for (let i = 0; i < height.length; i++)
      for (let j = i + 1; j < height.length; j++)
        best = Math.max(best, Math.min(height[i], height[j]) * (j - i));
    return best;
  },
};
