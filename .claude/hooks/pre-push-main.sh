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

# 没写分支名的 push（`git push`、`git push origin`、`git push -u origin`）会推当前分支。
# 命令字符串里看不出目标，必须查 HEAD——这是本守卫最容易被绕过的形态，
# 也是日常最可能误触的一种。
if ! printf '%s' "$cmd" | grep -qE '(^|[[:space:]])(HEAD|refs/|[A-Za-z0-9._/-]+:)'; then
  # 取出 push 之后的非 flag 参数：第一个是 remote，第二个才是 refspec
  args_after_push=$(printf '%s' "$cmd" \
    | sed -E 's/.*(^|[;&|[:space:]])git[[:space:]]+//' \
    | sed -E 's/(^|[[:space:]])push([[:space:]]|$)/ /' \
    | tr ' ' '\n' \
    | grep -vE '^-' \
    | grep -vE '^$' \
    | grep -vE '^(push|git)$')
  refspec_count=$(printf '%s\n' "$args_after_push" | grep -cvE '^$')

  # 0 个参数 = `git push`；1 个 = `git push <remote>`。两者都推当前分支。
  if [ "$refspec_count" -le 1 ]; then
    current_branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo '')
    case "$current_branch" in
      main|master)
        # 注意：消息里不要用反引号——双引号内的反引号会触发命令替换，
        # 那会让这个守卫**真的执行 git push**。用单引号包字面量。
        block "当前在 $current_branch 上，不带分支名的 'git push' 会直接推它：$cmd"
        ;;
    esac
  fi
fi

exit 0
