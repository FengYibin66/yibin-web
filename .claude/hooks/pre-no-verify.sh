#!/usr/bin/env bash
# H2: 禁止 git 命令使用 --no-verify —— 绕过本地检查等于取消门禁。
#
# 拦截必须 exit 2；任何异常路径走 block()（见 .claude/hooks/AGENTS.md）。
#
# 覆盖边界：只看命令字符串里的字面 --no-verify / -n（commit/push 的短形式）。
# 通过变量拼接或 alias 绕过的不拦——CI 是最终防线。

block() {
  echo "[BLOCKED] $1" >&2
  echo "  --no-verify 会跳过 pre-commit 检查。若检查本身有问题，修检查，不要绕过它。" >&2
  exit 2
}

input=$(cat 2>/dev/null) || block "读取 hook 输入失败（守卫异常，按拦截处理）"

cmd=$(printf '%s' "$input" | python3 -c \
  'import sys,json; print(json.load(sys.stdin).get("tool_input",{}).get("command",""))' 2>/dev/null) \
  || block "解析 hook 输入失败（守卫异常，按拦截处理）"

# 只管 git 命令（含 FOO=1 git … 这类环境变量前缀形态）
printf '%s' "$cmd" | grep -qE '(^|[;&|[:space:]])git([[:space:]]|$)' || exit 0

if printf '%s' "$cmd" | grep -q -- '--no-verify'; then
  block "禁止使用 --no-verify：$cmd"
fi

exit 0
