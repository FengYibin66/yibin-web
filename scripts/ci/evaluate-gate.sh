#!/usr/bin/env bash
# 汇总 CI 门禁各 job 的结果。由 .github/workflows/ci.yml 的 gate job 调用。
#
# 用法：evaluate-gate.sh "<job名>:<结果>" ...
#
# 判定：
#   success / skipped → 通过（skipped 是 path-filter 正常跳过，不是失败）
#   其余（failure / cancelled / 空）→ 不通过
#   特例：changes 是路径探测，必须 success——它跳过意味着无法判定受影响范围，
#         此时其余 job 的 skipped 不可信，必须拦。
#
# 逻辑放脚本而非内联 YAML，为的是本地可测（scripts/ci/gate-test.sh）。
# 刻意不用关联数组：macOS 自带 bash 3.2 不支持，那会让本地无法验证门禁逻辑。
set -uo pipefail

[ $# -gt 0 ] || { echo "用法：$0 \"<job>:<result>\" ..." >&2; exit 2; }

failed=0
changes_result=""

for item in "$@"; do
  name="${item%%:*}"
  result="${item#*:}"

  [ "$name" = "changes" ] && changes_result="$result"

  case "$result" in
    success|skipped) printf '  ok    %-18s %s\n' "$name" "$result" ;;
    *)               printf '  FAIL  %-18s %s\n' "$name" "${result:-<空>}"; failed=1 ;;
  esac
done

if [ "$changes_result" != "success" ]; then
  echo "changes job 未成功（${changes_result:-<缺失>}）——无法判定受影响范围，其余 job 的 skipped 不可信" >&2
  failed=1
fi

if [ "$failed" -ne 0 ]; then
  echo "门禁未通过" >&2
  exit 1
fi

echo "门禁通过"
