#!/usr/bin/env bash
# H5: `git push` 前，任一媒体流水线的指纹过期就拦下。
#
# 拦截必须 exit 2；其余非零退出码被 Claude Code 当作「脚本自身失败」并**放行**。
# 所以本脚本的异常路径分两类，刻意不同处理（见下「误报比漏报更伤」）。
#
# ## 为什么有这个 hook
#
# `apps/resume` 的九条派生流水线（音频编码 / 门贴纸 / 纹理 / 证书图 / 字体子集 /
# 合成音效 / 活物部件 / 入口首帧 / 预载表）各有一个指纹戳。**字体子集那条扫的是
# 源码字节，中文注释也算字符集的一部分**——写一句中文注释就会让它过期。
#
# `ci.yml` 会抓，但那要等十几分钟。`apps/resume/AGENTS.md` 里记着前人「同一天踩了
# 三次」；2026-09-09 我又踩了第四次：跑过一次重新生成、之后又写了四处中文注释、
# 忘了再跑，CI 十分钟后红，又推一次修。**本地一秒，CI 十分钟——反馈该提前。**
#
# ## 为什么挂在 push 而不是 commit
#
# commit 是高频动作（一次改动可能提交五次），每次付 0.9 s 并可能被打断，会训练人
# 关掉守卫。push 是「交出去」的时刻，一次改动只有一两次，此时统一过一遍代价最低。
# 这是与用户明确对齐过的选择（2026-09-09）。
#
# ## 误报比漏报更伤（AGENTS.md 的第一条教训，这里的具体落法）
#
# 「检查跑不起来」和「产物真的过期」是两回事，必须分开：
#
#   产物过期      → 脚本 exit != 0 且输出含 `[待处理]`  → **拦**，并回显该跑哪条命令
#   检查跑不起来  → 缺 node / python3 / fontTools、脚本不存在、语法炸  → **放行 + 警告**
#
# 后者放行是刻意的：一个在「本机没装 fontTools」时就拦住所有 push 的守卫，第一天
# 就会被关掉，而关掉之后连真拦截也没有了。CI 始终是最终防线。
#
# 顺带一个好性质：本 hook **只在真有产物过期时才拦**。即使命令识别误判（比如
# commit message 正文里出现 "git push"），代价也只是多花 0.9 s 跑一遍检查后放行。
#
# ## 覆盖边界（刻意不管的）
#
# - **只看命令字符串字面量**。`B=push; git $B`、alias、包在脚本里的 push 不拦。
#   与 H1/H2 同一边界，远端与 CI 才是最终防线。
# - **`git push -n`（--dry-run）不拦**：它不交出任何东西。这是 H2 踩过的坑——
#   `-n` 的含义按子命令不同（commit 下是 --no-verify，push 下是 --dry-run）。
# - **不管 `apps/resume` 之外的东西**。portal 与 auto-wechat 没有派生媒体流水线。
# - **流水线清单在运行时派生，不写死**。写死的清单会在新增第十条流水线时静默
#   少守一条——而少守一条没有任何症状。见下面 `--check` 的判定。

block() {
  echo "[BLOCKED] $1" >&2
  exit 2
}

warn() {
  # 放行路径：只提示，不拦。exit 0 而不是 exit 1——非零会被当成守卫自身失败。
  echo "[跳过 H5] $1" >&2
  exit 0
}

input=$(cat 2>/dev/null) || block "读取 hook 输入失败（守卫异常，按拦截处理）"

cmd=$(printf '%s' "$input" | python3 -c \
  'import sys,json; print(json.load(sys.stdin).get("tool_input",{}).get("command",""))' 2>/dev/null) \
  || block "解析 hook 输入失败（守卫异常，按拦截处理）"

# 命令里没有 push 就与本守卫无关，避免为无关命令付一次进程启动
printf '%s' "$cmd" | grep -qE '(^|[;&|[:space:]])push([[:space:]]|$)' || exit 0

# 判定用 python 而非 sed：macOS 的 BSD sed 不支持 `\b`，同一表达式在本机与 CI 上
# 行为会分裂（AGENTS.md 的第二条教训）。
is_push=$(printf '%s' "$cmd" | python3 -c '
import re, sys
text = sys.stdin.read()
# 切出 git … push … 片段，到行尾或 shell 分隔符为止；heredoc 正文与其他子命令
# 因此不会被误当成 push 的参数。
seg = re.compile(r"\bgit\b[^\n;&|]*?\bpush\b[^\n;&|]*")
for m in seg.finditer(text):
    s = m.group(0)
    # --dry-run / -n 只是演练，不交出任何东西 → 与本守卫无关
    if re.search(r"(^|\s)(--dry-run|-n)(\s|$)", s):
        continue
    print("yes")
    break
else:
    print("no")
' 2>/dev/null) || block "判定 push 失败（守卫异常，按拦截处理）"

[ "$is_push" = "yes" ] || exit 0

root=$(git rev-parse --show-toplevel 2>/dev/null) || warn "不在 git 仓库里，无从判断产物"
resume="$root/apps/resume"
[ -d "$resume" ] || exit 0   # 本仓库之外，或 resume 不存在 → 与本守卫无关

command -v node >/dev/null 2>&1 || warn "没有 node，跳过媒体指纹检查（CI 仍会校验）"

# ── 流水线清单：运行时派生，不写死 ────────────────────────────────────────────
# 判据是「**处理** --check」——同一行里 argv 与 --check 同时出现。
# 「提到 --check」不算：`media/freshness.mjs` 是被 import 的库，只在注释里提它。
#
# 判据必须与引号风格无关。本脚本第一版按字面量列了三种写法
# （`argv.includes('--check')` / `argv.includes("--check")` / `'--check' in sys.argv`），
# 结果**恰好漏掉了 subset-fonts.py**——它写的是 `"--check" in sys.argv`（双引号），
# 而我列的 python 形态是单引号。于是门禁少守一条，而那一条正是唯一真正咬过人的
# （字体子集的字符集指纹）。「至少 5 条」的兜底也没能发现：8 ≥ 5。
# 这就是 ADR 里说的「门禁静默少守一条没有任何症状」，我自己第一版就犯了。
# 用 `.*` 而不是 `[^\n]*`：grep 本来就是逐行匹配，`.` 不会跨行；而
# `[^\n]` 在 POSIX ERE 的括号表达式里是「非反斜杠且非字母 n」，
# `process.argv.includes('--check')` 中间的 `includes` 含字母 n，直接匹配不上。
# 第二版就是这么派生出 0 条的（兜底断言抓住了，没有静默放行）。
scripts=$(cd "$resume" && grep -rlE 'argv.*--check|--check.*argv' \
  scripts/media scripts/lab 2>/dev/null | sort)

[ -n "$scripts" ] && [ "$(printf '%s\n' "$scripts" | wc -l | tr -d ' ')" -ge 5 ] \
  || warn "派生出的流水线清单只有 $(printf '%s\n' "$scripts" | grep -c . || echo 0) 条，疑似判据失效——放行并提示（清单静默变空是本守卫最容易的假绿方式）"

stale=""
broken=""
for s in $scripts; do
  case "$s" in
    *.py) out=$(cd "$resume" && python3 "$s" --check 2>&1); rc=$? ;;
    *)    out=$(cd "$resume" && node    "$s" --check 2>&1); rc=$? ;;
  esac
  [ "$rc" -eq 0 ] && continue
  if printf '%s' "$out" | grep -q '\[待处理\]'; then
    # 脚本自己就打印了该跑哪条命令，直接转达，不自己拼
    fix=$(printf '%s' "$out" | grep -o '\[待处理\].*' | tail -1)
    stale="${stale}
  · ${s}
    ${fix}"
  else
    broken="${broken}
  · ${s}（rc=${rc}）：$(printf '%s' "$out" | tail -1 | head -c 120)"
  fi
done

if [ -n "$broken" ]; then
  # 跑不起来 ≠ 过期。只警告，不拦。
  echo "[H5 提示] 以下检查无法运行（不是产物过期，已放行；CI 仍会校验）：$broken" >&2
fi

if [ -n "$stale" ]; then
  block "有派生产物的指纹过期，先重新生成再 push：$stale

  为什么会过期：字体子集那条的指纹是对**源码里出现过的字符集合**求的（扫
  app/components/lib/hooks/context 下所有 .ts/.tsx/.css），所以写下一个**此前没出现过的字**
  就会让它过期——常见汉字不会。其余几条是对流水线的输入文件内容求指纹。
  为什么拦在这里：CI 也会抓，但要等十几分钟；本地重新生成通常一秒。"
fi

exit 0
