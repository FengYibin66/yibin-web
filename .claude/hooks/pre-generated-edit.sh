#!/usr/bin/env bash
# H4: 禁止手改生成物 / 派生产物。
#
# 拦截必须 exit 2；任何异常路径走 block()（见 .claude/hooks/AGENTS.md）。
#
# 覆盖边界：只看 Edit/Write 的 file_path。经 Bash（sed -i、> 重定向、mv）改写
# 的不拦——CI 用 `gen_docs_index.py --check` 校验索引同步，那才是最终防线。

block() {
  echo "[BLOCKED] $1" >&2
  exit 2
}

input=$(cat 2>/dev/null) || block "读取 hook 输入失败（守卫异常，按拦截处理）"

file_path=$(printf '%s' "$input" | python3 -c \
  'import sys,json; print(json.load(sys.stdin).get("tool_input",{}).get("file_path",""))' 2>/dev/null) \
  || block "解析 hook 输入失败（守卫异常，按拦截处理）"

[ -n "$file_path" ] || exit 0

# 归一化在匹配之前：./ 与重复斜杠会让朴素正则漏掉指向同一文件的写法
norm=$(printf '%s' "$file_path" | sed -e 's#/\./#/#g' -e 's#//*#/#g')

case "$norm" in
  docs/adr/AGENTS.md|*/docs/adr/AGENTS.md)
    block "docs/adr/AGENTS.md 的索引表是生成物。
  改对应 ADR 头部的 \`- 状态：\` / \`- 索引：\` 字段，然后运行：
      python3 scripts/docs/gen_docs_index.py"
    ;;
esac

# 通用生成物命名约定
if printf '%s' "$norm" | grep -qE '(/generated/|\.gen\.(ts|tsx|go|py)$|_gen\.(ts|go)$)'; then
  block "禁止手改生成代码：$(basename "$norm")
  请改生成来源后重新生成。"
fi

# Next.js 自动注入块所在文件的整体覆盖不拦（块内内容由工具维护，见该文件顶部说明），
# 但提醒：apps/resume/AGENTS.md 的 nextjs-agent-rules 块不要手改。

exit 0
