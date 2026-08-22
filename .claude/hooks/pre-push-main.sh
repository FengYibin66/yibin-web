#!/usr/bin/env bash
# H1: 禁止直接 push 到 main —— main 是唯一发布分支，一律走 PR。
#
# PreToolUse 语义：拦截必须 exit 2。其余非零退出码被当作「脚本自身失败」并放行，
# 所以本脚本任何异常路径都必须走 block()（见 .claude/hooks/AGENTS.md）。
#
# **只检查 `git push` 那一段命令，不扫整条命令串。**
# 早期版本扫整串，于是这条完全正常的命令被误拦：
#     git commit -F - <<'MSG' ... 在 main 尚未 fetch 时 ... MSG
#     git push
# commit message 正文里出现「main」就命中了。误报会训练人绕过守卫，
# 比漏报更伤——所以先切出 push 子命令，再在其中判断。
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

# 切出所有 `git push ...` 片段：从 git push 起，到行尾或 shell 分隔符（; & | 换行）为止。
# heredoc 正文、commit message、其他子命令都被排除在外。
#
# 解析全部放在 python 里，**刻意不用 sed**：macOS 自带的 BSD sed 不支持 `\b`
# 词边界，写了它的表达式在本机静默不匹配、在 CI 的 GNU sed 上却正常——
# 这种「本地与 CI 行为分裂」的守卫比没有守卫更危险（已踩过一次）。
#
# 每行输出：<push 之后的非 flag 参数个数><TAB><片段原文>
push_segments=$(printf '%s' "$cmd" | python3 -c '
import re, sys

text = sys.stdin.read()
# 允许 `git push`、`git -C dir push`、`FOO=1 git push` 等前缀形态
pattern = re.compile(r"\bgit\b[^\n;&|]*?\bpush\b[^\n;&|]*")

for m in pattern.finditer(text):
    seg = m.group(0)
    # 注意用 re.search 而非 m.re.search：m.re 是外层已编译的 pattern，
    # 它的 .search(str) 第一个参数是待搜索字符串，不是新正则。
    hit = re.search(r"\bpush\b", seg)
    after = seg[hit.end():] if hit else ""
    args = [a for a in after.split() if not a.startswith("-")]
    print(f"{len(args)}\t{seg}")
' 2>/dev/null) || block "切分 push 子命令失败（守卫异常，按拦截处理）"

# 没有 push 子命令 → 与本守卫无关
[ -n "$push_segments" ] || exit 0

while IFS=$'\t' read -r arg_count seg; do
  [ -n "$seg" ] || continue

  # 显式写了 main / master 作为参数或 refspec
  if printf '%s' "$seg" | grep -qE '(^|[[:space:]])(main|master)([[:space:]]|$)'; then
    block "禁止直接 push 到 main/master：$seg"
  fi
  if printf '%s' "$seg" | grep -qE ':(refs/heads/)?(main|master)([[:space:]]|$)'; then
    block "禁止 push 到 main/master 的 refspec：$seg"
  fi

  # 没写分支名的 push（`git push`、`git push origin`、`git push -u origin`）会推当前分支。
  # 命令里看不出目标，必须查 HEAD——这是最容易被绕过、也最容易误触的形态。
  if printf '%s' "$seg" | grep -qE '(^|[[:space:]])(HEAD|refs/|[A-Za-z0-9._/-]+:)'; then
    continue # 有显式 refspec 且上面没命中 main → 目标不是 main
  fi

  # arg_count 由上面的 python 算出（push 之后的非 flag 参数个数）。
  # 0 个 = `git push`；1 个 = `git push <remote>`。两者都推当前分支。
  if [ "${arg_count:-9}" -le 1 ]; then
    current_branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo '')
    case "$current_branch" in
      main | master)
        # 注意：消息里不要用反引号——双引号内的反引号会触发命令替换，
        # 那会让这个守卫**真的执行 git push**。用单引号包字面量。
        block "当前在 $current_branch 上，不带分支名的 'git push' 会直接推它：$seg"
        ;;
    esac
  fi
done <<EOF
$push_segments
EOF

exit 0
