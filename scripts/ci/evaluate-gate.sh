#!/usr/bin/env bash
# 汇总 CI 门禁各 job 的结果。由 .github/workflows/ci.yml 的 gate job 调用。
#
# 用法：evaluate-gate.sh "<job名>:<结果>" ...
#
# 判定：
#   success / skipped → 通过（skipped 是 path-filter 正常跳过，不是失败）
#   其余（failure / cancelled / 空）→ 不通过
#   例外：MUST_RUN 里的 job 必须 success，skipped 与缺参数都拦（理由见下）
#
# 逻辑放脚本而非内联 YAML，为的是本地可测（scripts/ci/gate-test.sh）。
# 刻意不用关联数组：macOS 自带 bash 3.2 不支持，那会让本地无法验证门禁逻辑。
set -uo pipefail

[ $# -gt 0 ] || { echo "用法：$0 \"<job>:<result>\" ..." >&2; exit 2; }

# 无条件运行的 job，**不允许 skipped，也不允许缺参数**：
#   changes     —— 路径探测。它跳过意味着无法判定受影响范围，
#                  此时其余 job 的 skipped 全都不可信。
#   secret-scan —— secret 可能出现在任何文件，刻意不做 path 过滤；
#                  它跳过就等于这次改动根本没扫过 secret。
MUST_RUN="changes secret-scan"

failed=0
seen_names=""
bad_must_run=""

for item in "$@"; do
  name="${item%%:*}"
  result="${item#*:}"

  seen_names="$seen_names $name"

  # 必跑 job 的状态必须是 success
  for must in $MUST_RUN; do
    if [ "$name" = "$must" ] && [ "$result" != "success" ]; then
      bad_must_run="$bad_must_run $must=${result:-<空>}"
    fi
  done

  case "$result" in
    success | skipped) printf '  ok    %-18s %s\n' "$name" "$result" ;;
    *)
      printf '  FAIL  %-18s %s\n' "$name" "${result:-<空>}"
      failed=1
      ;;
  esac
done

# 必跑 job 完全没出现在参数里，同样要拦——漏传一个 job 名没有任何症状
for must in $MUST_RUN; do
  case " $seen_names " in
    *" $must "*) ;;
    *) bad_must_run="$bad_must_run $must=<缺失>" ;;
  esac
done

if [ -n "$bad_must_run" ]; then
  echo "必跑 job 状态异常：${bad_must_run# }" >&2
  echo "  这些 job 不做 path 过滤，skipped/缺失都意味着该检查没有真正执行" >&2
  failed=1
fi

if [ "$failed" -ne 0 ]; then
  echo "门禁未通过" >&2
  exit 1
fi

echo "门禁通过"
