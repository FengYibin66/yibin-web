#!/usr/bin/env bash
# H1: 禁止直接 push 到 main —— main 是唯一发布分支，一律走 PR。
#
# PreToolUse 语义：拦截必须 exit 2。其余非零退出码被当作「脚本自身失败」并放行，
# 所以本脚本任何异常路径都必须走 block()（见 .claude/hooks/AGENTS.md）。
#
# 覆盖边界：只看 Bash 工具的命令字符串。经 shell 变量间接构造的分支名
# （如 B=main; git push origin $B）不拦——CI 的分支保护才是最终防线。

block() {
  echo "[BLOCKED] $1" >&2
  echo "  main 是唯一发布分支，请走 PR：git push origin <feat|fix>/<scope>-<desc>" >&2
  exit 2
}

input=$(cat 2>/dev/null) || block "读取 hook 输入失败（守卫异常，按拦截处理）"

cmd=$(printf '%s' "$input" | python3 -c \
  'import sys,json; print(json.load(sys.stdin).get("tool_input",{}).get("command",""))' 2>/dev/null) \
  || block "解析 hook 输入失败（守卫异常，按拦截处理）"

# 非 git push 命令直接放行
printf '%s' "$cmd" | grep -qE '(^|[;&|[:space:]])git([[:space:]]|$)' || exit 0
printf '%s' "$cmd" | grep -qE '(^|[;&|[:space:]])push([[:space:]]|$)' || exit 0

# 命中形态：git push [remote] main / master、HEAD:main、--all 等
if printf '%s' "$cmd" | grep -qE '(^|[[:space:]])(main|master)([[:space:]]|$)'; then
  block "禁止直接 push 到 main/master：$cmd"
fi
if printf '%s' "$cmd" | grep -qE ':(refs/heads/)?(main|master)([[:space:]]|$)'; then
  block "禁止 push 到 main/master 的 refspec：$cmd"
fi

exit 0
