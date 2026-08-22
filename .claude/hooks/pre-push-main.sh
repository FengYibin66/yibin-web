#!/usr/bin/env bash
# H1: 禁止直接 push 到 main —— main 是唯一发布分支，一律走 PR。
#
# PreToolUse 语义：拦截必须 exit 2。其余非零退出码被当作「脚本自身失败」并放行，
# 所以本脚本任何异常路径都必须走 block()（见 .claude/hooks/AGENTS.md）。
#
# ## 判定走单一路径：切段 → token 规范化 → 比对
#
# 早期版本用三条彼此独立的 grep（裸 main / 冒号 refspec / 裸 push），缝隙里漏掉了
# 四种**普通、非混淆**的形态，实测全部放行：
#   git push origin refs/heads/main   全路径：无冒号、token 不是被空格包围的 main，
#                                     反而命中「有显式 refspec」分支被判为非 main
#   git push origin +main             强推：+ 前缀不是空格
#   git push origin "main"            带引号：前导字符是 "
#   bash -c "git push origin main"    嵌套 shell
# 守卫自己的测试恰好只覆盖 `origin main` / `HEAD:main`，绕开了以上全部——
# 测试绿不等于守卫有效。
#
# 现在改为：切出 push 片段 → 逐 token 规范化（去引号、去 `+` 强推前缀、
# 取 refspec 的**目标端**、剥 refs/heads/）→ 与 main/master 统一比对。
# 判定逻辑集中在一处 python 里，只有一条路径，没有缝。
#
# 覆盖边界：只看 Bash 工具的命令字符串。经 shell 变量间接构造的分支名
# （如 B=main; git push origin $B）不拦——远端分支保护才是最终防线。

block() {
  echo "[BLOCKED] $1" >&2
  echo "  main 是唯一发布分支，请走 PR：git push origin <feat|fix>/<scope>-<desc>" >&2
  exit 2
}

input=$(cat 2>/dev/null) || block "读取 hook 输入失败（守卫异常，按拦截处理）"

cmd=$(printf '%s' "$input" | python3 -c \
  'import sys,json; print(json.load(sys.stdin).get("tool_input",{}).get("command",""))' 2>/dev/null) \
  || block "解析 hook 输入失败（守卫异常，按拦截处理）"

# 命令里没有 push 就与本守卫无关，避免为无关命令付一次 git 调用
printf '%s' "$cmd" | grep -qE '(^|[;&|[:space:]])push([[:space:]]|$)' || exit 0

# 当前分支：`git push` 不带 refspec 时推的就是它。命令串里看不出来，只能问 git。
# 取不到时留空，python 侧按「未知」处理（不因此放行 main）。
current_branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo '')

# 判定全部在 python 内完成，输出 ALLOW 或 BLOCK<TAB>原因。
# 刻意不用 sed/grep 做解析：macOS 自带 BSD sed 不支持 \b，同一表达式在本机
# 静默不匹配、在 CI 的 GNU sed 上却正常——这种本地/CI 分裂比明确失败难查得多。
verdict=$(CURRENT_BRANCH="$current_branch" printf '%s' "$cmd" | CURRENT_BRANCH="$current_branch" python3 -c '
import os, re, sys

PROTECTED = {"main", "master"}
text = sys.stdin.read()
current = os.environ.get("CURRENT_BRANCH", "").strip()

# 允许 `git push`、`git -C dir push`、`FOO=1 git push`、`bash -c "git push ..."` 等前缀形态。
# 片段在换行与 shell 分隔符处截断，所以 heredoc 正文、commit message、
# 前后的其他子命令都不会被误当成 push 的参数。
segment = re.compile(r"\bgit\b[^\n;&|]*?\bpush\b[^\n;&|]*")


def normalize(token: str) -> str:
    """把一个 push 目标 token 归一成裸分支名。"""
    t = token.strip().strip("\"\x27")        # 去成对/残留的引号
    if ":" in t:
        t = t.split(":", 1)[1]               # refspec src:dst —— 只有目标端决定推到哪
    t = t.lstrip("+")                        # +branch 是强推前缀
    t = t.strip().strip("\"\x27")
    if t.startswith("refs/heads/"):
        t = t[len("refs/heads/"):]
    elif t.startswith("refs/"):              # refs/remotes/... 之类不是分支推送目标
        return ""
    return t


for m in segment.finditer(text):
    seg = m.group(0)
    hit = re.search(r"\bpush\b", seg)
    after = seg[hit.end():] if hit else ""

    tokens = after.split()
    # --all / --mirror 会推送全部 ref，必然包含 main
    for tok in tokens:
        bare = tok.strip("\"\x27")
        if bare in ("--all", "--mirror"):
            print(f"BLOCK\t{bare} 会推送全部分支（含 main）：{seg.strip()}")
            sys.exit(0)

    positional = [t for t in tokens if not t.strip("\"\x27").startswith("-")]

    # 第一个位置参数是 remote，其余才是 refspec
    refspecs = positional[1:] if len(positional) >= 1 else []

    if not refspecs:
        # 没写 refspec → 推当前分支
        if current in PROTECTED:
            print(f"BLOCK\t当前在 {current} 上，不带分支名的 push 会直接推它：{seg.strip()}")
            sys.exit(0)
        continue

    for spec in refspecs:
        target = normalize(spec)
        if target in PROTECTED:
            print(f"BLOCK\t禁止 push 到 {target}：{seg.strip()}")
            sys.exit(0)
        # `git push origin HEAD` 推的是当前分支
        if target == "HEAD" and current in PROTECTED:
            print(f"BLOCK\tHEAD 当前指向 {current}：{seg.strip()}")
            sys.exit(0)

print("ALLOW")
' 2>/dev/null) || block "判定 push 目标失败（守卫异常，按拦截处理）"

# 空输出说明 python 没跑到最后 —— 按异常处理，不放行
[ -n "$verdict" ] || block "判定结果为空（守卫异常，按拦截处理）"

case "$verdict" in
  ALLOW) exit 0 ;;
  BLOCK*)
    # 去掉 BLOCK<TAB> 前缀后作为原因
    block "$(printf '%s' "$verdict" | cut -f2-)"
    ;;
  *) block "判定结果无法识别（守卫异常，按拦截处理）：$verdict" ;;
esac
