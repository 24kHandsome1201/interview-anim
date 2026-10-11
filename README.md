# 面试题动画

静态站点（无构建）：逐步动画讲解 40 道高频面试题——左边看数据怎么变，右边看对应的 Python 代码执行到哪一行。本地起服务即可：

```
python3 -m http.server 8765
# http://localhost:8765
```

深链：`/#/p/<id>?step=N`（N 为 1-based 步数）。

## Tests

两套校验，改题目模块后都跑一遍：

```bash
# 1) Node 冒烟：每个 preset 都能生成 steps；结果与独立参考 solve 一致；
#    step 引用的代码行存在且每行显示宽度 ≤ 60 列
node tests/run.mjs

# 2) Python 真跑：导出用例后，在 torch venv 里真实执行每个模块展示的
#    Python 代码，和动画结果对比
node tests/export_cases.mjs          # 生成 tests/cases.json
~/tools/pyenv/bin/python tests/py_check.py
```

Python 环境（首次）：`python3 -m venv ~/tools/pyenv && ~/tools/pyenv/bin/pip install torch`
