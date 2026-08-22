#!/usr/bin/env bash
# H2: 禁止跳过 git 钩子校验 —— 绕过本地检查等于取消门禁。
#
# 拦截必须 exit 2；任何异常路径走 block()（见 .claude/hooks/AGENTS.md）。
#
# ## `-n` 只对 commit 是 --no-verify
#
# 早期版本的注释声称覆盖「`-n`（commit/push 的短形式）」，但代码只匹配
# `--no-verify`，于是最常见的绕法 `git commit -n` 直接放行；而且那句注释本身也错：
#
#   git commit -n   → --no-verify   （跳过 pre-commit / commit-msg 钩子，要拦）
#   git push   -n   → --dry-run     （只演练不推送，无害，不能拦）
#   git add    -n   → --dry-run     （无害）
#   git log -n 5    → 条数限制      （无害）
#
# 所以 `-n` 必须**按子命令**判定，只在 commit 下视为 --no-verify。
# 长形式 `--no-verify` 对 commit 与 push 都有效，一律拦。
#
# 覆盖边界：只看命令字符串字面量。变量拼接、alias、包在脚本里的不拦。

block() {
  echo "[BLOCKED] $1" >&2
  echo "  跳过校验会让门禁形同虚设。若检查本身有问题，修检查，不要绕过它。" >&2
  exit 2
}

input=$(cat 2>/dev/null) || block "读取 hook 输入失败（守卫异常，按拦截处理）"

cmd=$(printf '%s' "$input" | python3 -c \
  'import sys,json; print(json.load(sys.stdin).get("tool_input",{}).get("command",""))' 2>/dev/null) \
  || block "解析 hook 输入失败（守卫异常，按拦截处理）"

# 只管 git 命令（含 FOO=1 git … 这类环境变量前缀形态）
printf '%s' "$cmd" | grep -qE '(^|[;&|[:space:]])git([[:space:]]|$)' || exit 0

verdict=$(printf '%s' "$cmd" | python3 -c '
import re, sys

text = sys.stdin.read()

# 逐个 git 子命令片段判定（在换行与 shell 分隔符处截断，避免把
# commit message 或其他子命令的参数算进来）
segment = re.compile(r"\bgit\b[^\n;&|]*")

# git 自身的选项里带值的那些，跟在后面的 token 不是子命令
GIT_OPTS_WITH_VALUE = {"-c", "-C", "--git-dir", "--work-tree", "--namespace", "--exec-path"}


def subcommand(tokens: list[str]) -> str:
    """跳过 git 级别的选项，取出真正的子命令。"""
    i = 0
    while i < len(tokens):
        t = tokens[i].strip("\"\x27")
        if t in GIT_OPTS_WITH_VALUE:
            i += 2                      # 跳过选项及其值
            continue
        if t.startswith("-"):
            i += 1                      # 无值选项，如 --no-pager
            continue
        return t
    return ""


for m in segment.finditer(text):
    seg = m.group(0)
    hit = re.search(r"\bgit\b", seg)
    tokens = seg[hit.end():].split() if hit else []

    # 长形式对 commit / push 都有效，一律拦
    if any(t.strip("\"\x27") == "--no-verify" for t in tokens):
        print(f"BLOCK\t禁止使用 --no-verify：{seg.strip()}")
        sys.exit(0)

    if subcommand(tokens) != "commit":
        continue                        # 只有 commit 的 -n 是 --no-verify

    for tok in tokens:
        t = tok.strip("\"\x27")
        # 短选项聚合形态：-n、-nm、-an … （不含 --long）
        if re.fullmatch(r"-[A-Za-z]+", t) and "n" in t:
            print(f"BLOCK\tgit commit 的 -n 即 --no-verify：{seg.strip()}")
            sys.exit(0)

print("ALLOW")
' 2>/dev/null) || block "判定 no-verify 失败（守卫异常，按拦截处理）"

[ -n "$verdict" ] || block "判定结果为空（守卫异常，按拦截处理）"

case "$verdict" in
  ALLOW) exit 0 ;;
  BLOCK*) block "$(printf '%s' "$verdict" | cut -f2-)" ;;
  *) block "判定结果无法识别（守卫异常，按拦截处理）：$verdict" ;;
esac
