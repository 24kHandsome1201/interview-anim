#!/usr/bin/env python3
# Execute each problem's displayed Python `code` for real and compare against
# the JS animation's expected result (tests/cases.json, made by export_cases.mjs).
# Run with the torch venv: ~/tools/pyenv/bin/python tests/py_check.py
import json, math, re, sys
from collections import deque
from pathlib import Path

import torch

CASES = json.loads(Path(__file__).with_name('cases.json').read_text())
TOL = 1e-3

def t(x):
    return torch.tensor(x, dtype=torch.float64)

def tl(x):
    if isinstance(x, torch.Tensor):
        return x.detach().cpu().tolist()
    return x

def flat(x):
    if isinstance(x, (list, tuple)):
        out = []
        for v in x:
            out += flat(v)
        return out
    return [x]

def close(a, b, tol=TOL):
    if isinstance(a, bool) or isinstance(b, bool):
        return a == b
    if isinstance(a, (int, float)) and isinstance(b, (int, float)):
        return abs(a - b) < tol
    if isinstance(a, (list, tuple)) and isinstance(b, (list, tuple)):
        return len(a) == len(b) and all(close(x, y) for x, y in zip(a, b))
    if isinstance(a, dict) and isinstance(b, dict):
        return a.keys() == b.keys() and all(close(a[k], b[k]) for k in a)
    return a == b

# ---- data-structure helpers for the tree/list problems ----
class ListNode:
    def __init__(self, val):
        self.val = val
        self.next = None

def linked(vals):
    nodes = [ListNode(v) for v in vals]
    for a, b in zip(nodes, nodes[1:]):
        a.next = b
    return (nodes[0] if nodes else None), nodes

class TreeNode:
    def __init__(self, val):
        self.val = val
        self.left = self.right = None

def tree(arr):
    if not arr or arr[0] is None:
        return None, []
    nodes = {}
    def mk(i):
        nodes[i] = TreeNode(arr[i])
        return nodes[i]
    root = mk(0)
    q = deque([root])
    i = 1
    while q and i < len(arr):
        cur = q.popleft()
        if arr[i] is not None:
            cur.left = mk(i); q.append(cur.left)
        i += 1
        if i < len(arr) and arr[i] is not None:
            cur.right = mk(i); q.append(cur.right)
        i += 1
    return root, nodes

def canon(m):
    return sorted(tuple(sorted(r)) for r in m)

# ---- per-id adapters: (ns, case) -> python result to compare ----
def algo_default(fn):
    return lambda ns, c: tl(ns[fn](**c['input']))

ADAPT = {
    'lc-1':  lambda ns, c: sorted(ns['twoSum'](**c['input'])),
    'lc-15': lambda ns, c: canon(ns['threeSum'](**c['input'])),
    'lc-46': lambda ns, c: canon(ns['permute'](**c['input'])),
    'lc-206': lambda ns, c: (lambda head: [v for v in iter_list(head)])(ns['reverseList'](linked(c['input']['vals'])[0])),
    'lc-142': lambda ns, c: detect_cycle_idx(ns, c['input']),
    'lc-146': lambda ns, c: replay_lru(ns, c['input']),
    'lc-102': lambda ns, c: ns['levelOrder'](tree(c['input']['root'])[0]),
    'lc-236': lambda ns, c: lca_val(ns, c['input']),
    'lc-207': lambda ns, c: ns['canFinish'](c['input']['n'], c['input']['pre']),
    'lc-912': lambda ns, c: sort_in_place(ns, c['input']['nums']),
}

def iter_list(head):
    while head is not None:
        yield head.val
        head = head.next

def detect_cycle_idx(ns, inp):
    head, nodes = linked(inp['vals'])
    if inp['pos'] >= 0:
        nodes[-1].next = nodes[inp['pos']]
    node = ns['detectCycle'](head)
    return next(i for i, n in enumerate(nodes) if n is node)

def replay_lru(ns, inp):
    cache = ns['LRUCache'](inp['cap'])
    out = []
    for op in inp['ops']:
        if op[0] == 'get':
            out.append(cache.get(op[1]))
        else:
            cache.put(op[1], op[2])
            out.append(None)
    return out

def lca_val(ns, inp):
    root, nodes = tree(inp['root'])
    p = next(n for n in nodes.values() if n.val == inp['p'])
    q = next(n for n in nodes.values() if n.val == inp['q'])
    return ns['lowestCommonAncestor'](root, p, q).val

def sort_in_place(ns, nums):
    nums = list(nums)
    r = ns['sortArray'](nums)
    return r if r is not None else nums

# ---- BPE helpers referenced by the displayed code ----
def count_pairs(words):
    c = {}
    for w, n in words.items():
        for i in range(len(w) - 1):
            pair = (w[i], w[i + 1])
            c[pair] = c.get(pair, 0) + n
    return c

def merge_pair(words, best):
    out = {}
    for w, n in words.items():
        nw = []
        i = 0
        while i < len(w):
            if i + 1 < len(w) and w[i] == best[0] and w[i + 1] == best[1]:
                nw.append(''.join(best)); i += 2
            else:
                nw.append(w[i]); i += 1
        out[tuple(nw)] = n
    return out

TOK = ['的', '是', '在', '我', '了', '和', '有', '不']

def llm_args(c):
    a = c['pyArgs'] if c['pyArgs'] is not None else c['input']
    return a

def llm_call(fn):
    def go(ns, c):
        a = llm_args(c)
        if isinstance(a, dict):
            return tl(ns[fn](**{k: t(v) if isinstance(v, list) else v for k, v in a.items()}))
        args = [t(x) if isinstance(x, list) else x for x in a]
        return tl(ns[fn](*args))
    return go

def gqa(ns, c):
    a = c['pyArgs']
    out = ns['gqa'](t(a['Q']), t(a['K']), t(a['V']), a['h_q'], a['h_kv'])
    return tl(out.reshape(-1, out.shape[-1]))

def kvcache(ns, c):
    a = c['pyArgs']
    Kc, Vc = t(a['K']), t(a['V'])
    outs = []
    for s in a['steps']:
        o, Kc, Vc = ns['generate'](Kc, Vc, t(s['q']), t(s['k']), t(s['v']))
        outs.append(tl(o[0] if o.dim() > 1 else o))
    return outs

def moe(ns, c):
    a = c['pyArgs']
    experts = [(lambda v, W=t(Wm): v @ W) for Wm in a['experts']]
    return tl(ns['moe_forward'](t(a['x']), t(a['Wg']), experts, a['k']))

def bpe(ns, c):
    m = ns['bpe_train'](c['input']['corpus'], c['input']['merges'])
    return [''.join(p) for p in m]

def temperature(ns, c):
    i = c['input']
    out = {}
    for T in [0.5, 1, 2]:
        idx = int(ns['sample'](t(i['logits']), T, i['u']))
        out[str(T).replace('.0', '')] = TOK[idx]
    return out

def beam(ns, c):
    a = c['pyArgs']
    table = a['table']
    logp = lambda seq: table[','.join(map(str, seq))]
    return list(ns['beam_search'](logp, a['beam'], a['len']))

def lora(ns, c):
    a = c['pyArgs']
    m = ns['LoRALinear'](t(a['W']), a['r'], a['alpha'])
    m.A.data = t(a['A'])
    m.B.data = t(a['Bt'])
    y = tl(m(t(a['x'])).reshape(-1))
    # also sanity: merged weight gives the same forward
    merged = m.merge()
    y2 = tl((t(a['x']) @ merged.t()).reshape(-1))
    assert close(y, y2), 'merged forward != lora forward'
    return y

def grpo(ns, c):
    i = c['input']
    adv, loss = ns['grpo'](t(i['rewards']), t(i['lp_new']), t(i['lp_old']), t(i['lp_ref']), i.get('eps', 0.2), i.get('beta', 0.04))
    return {'adv': tl(adv), 'loss': tl(loss)}

LLM = {
    'llm-7':  llm_call('layer_norm'),
    'llm-9':  llm_call('rms_norm'),
    'llm-11': lambda ns, c: tl(ns['attention'](*([t(x) if isinstance(x, list) else x for x in c['pyArgs'][:3]] + [t(c['pyArgs'][3]) if c['pyArgs'][3] is not None else None]))),
    'llm-12': llm_call('causal_attention'),
    'llm-15': lambda ns, c: tl(ns['mha'](*[t(x) for x in c['pyArgs'][:5]], c['pyArgs'][5])[0]),
    'llm-18': gqa,
    'llm-20': kvcache,
    'llm-23': llm_call('flash_row'),
    'llm-27': lambda ns, c: tl(ns['sinusoidal_pe'](c['input']['T'], c['input']['d'])),
    'llm-29': llm_call('rope'),
    'llm-35': moe,
    'llm-45': bpe,
    'llm-51': temperature,
    'llm-53': lambda ns, c: int(tl(ns['top_p_sample'](t(c['input']['logits']), c['input']['p'], c['input']['u']))),
    'llm-56': beam,
    'llm-74': lora,
    'llm-82': lambda ns, c: float(ns['dpo_loss'](t(c['input']['lp_pol_c']), t(c['input']['lp_pol_r']), t(c['input']['lp_ref_c']), t(c['input']['lp_ref_r']), c['input']['beta'])),
    'llm-85': lambda ns, c: float(ns['ppo_clip_loss'](t(c['input']['lp_new']), t(c['input']['lp_old']), t(c['input']['adv']), c['input']['eps'])),
    'llm-89': grpo,
}
LLM['llm-1'] = llm_call('softmax')

def canon_expected(e):
    return canon(e)

def expected_cmp(id_, expected, got):
    if id_ == 'lc-1':
        return close(sorted(expected), got)
    if id_ in ('lc-15', 'lc-46'):
        return close(canon(expected), got)
    return close(expected, got)

fails = 0
total = 0
for pid, prob in CASES.items():
    ns = {'torch': torch, 'math': math, 'deque': deque,
          'count_pairs': count_pairs, 'merge': merge_pair,
          'ListNode': ListNode, 'TreeNode': TreeNode}
    try:
        exec(prob['code'], ns)
    except Exception as e:
        print(f'FAIL {pid}: code does not exec: {e}')
        fails += len(prob['cases']); total += len(prob['cases']); continue
    if prob['track'] == 'llm':
        call = LLM.get(pid)
        if call is None:
            print(f'FAIL {pid}: no adapter'); fails += len(prob['cases']); total += len(prob['cases']); continue
    else:
        call = ADAPT.get(pid)
        if call is None:
            fn = re.search(r'^def (\w+)', prob['code'], re.M).group(1)
            call = algo_default(fn)
    for c in prob['cases']:
        total += 1
        try:
            got = call(ns, c)
        except Exception as e:
            print(f'FAIL {pid} [{c["name"]}]: call raised {type(e).__name__}: {e}')
            fails += 1; continue
        if not expected_cmp(pid, c['expected'], got):
            print(f'FAIL {pid} [{c["name"]}]: py={json.dumps(got, ensure_ascii=False)[:120]} expected={json.dumps(c["expected"], ensure_ascii=False)[:120]}')
            fails += 1
        else:
            print(f'ok   {pid} [{c["name"]}]')

print(f'\n{total - fails}/{total} python cases passed')
sys.exit(1 if fails else 0)
