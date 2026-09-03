#!/usr/bin/env bash
# evaluate-gate.sh 的回归测试。可在 macOS 自带 bash 3.2 上运行。
#
# 用法：bash scripts/ci/gate-test.sh
set -uo pipefail

GATE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/evaluate-gate.sh"
pass=0
fail=0

# expect <期望码> <用例名> <参数...>
expect() {
  want="$1"; name="$2"; shift 2
  bash "$GATE" "$@" >/dev/null 2>&1
  got=$?
  if [ "$got" = "$want" ]; then
    printf '  ✅ %s\n' "$name"; pass=$((pass + 1))
  else
    printf '  ❌ %s — 期望 exit %s，实际 %s\n' "$name" "$want" "$got"; fail=$((fail + 1))
  fi
}

echo "evaluate-gate.sh"

# 只改了 README：全部 path-filter 跳过，应通过
expect 0 "全跳过（只改文档）通过" \
  changes:success secret-scan:success docs-index:skipped hooks-test:skipped resume:skipped resume-e2e:skipped \
  portal:skipped wechat-frontend:skipped wechat-backend:skipped

# 全部跑且全过
expect 0 "全成功通过" \
  changes:success secret-scan:success docs-index:success hooks-test:success resume:success resume-e2e:success \
  portal:success wechat-frontend:success wechat-backend:success

# 单个 job 失败必须拦
expect 1 "resume 失败被拦" \
  changes:success secret-scan:success docs-index:skipped hooks-test:skipped resume:failure resume-e2e:skipped \
  portal:skipped wechat-frontend:skipped wechat-backend:skipped

expect 1 "go test 失败被拦" \
  changes:success secret-scan:success docs-index:skipped hooks-test:skipped resume:skipped resume-e2e:skipped \
  portal:skipped wechat-frontend:skipped wechat-backend:failure

# E2E 失败必须拦——单测过了不代表页面能用
expect 1 "E2E 失败被拦（单测通过也不放行）" \
  changes:success secret-scan:success docs-index:skipped hooks-test:skipped resume:success resume-e2e:failure \
  portal:skipped wechat-frontend:skipped wechat-backend:skipped

# cancelled 不等于通过
expect 1 "cancelled 被拦" \
  changes:success secret-scan:success docs-index:skipped hooks-test:skipped resume:cancelled resume-e2e:skipped \
  portal:skipped wechat-frontend:skipped wechat-backend:skipped

# changes 自身跳过/失败：无法判定范围，必须拦（否则一堆 skipped 会伪装成通过）
expect 1 "changes 跳过被拦" \
  changes:skipped secret-scan:success docs-index:skipped hooks-test:skipped resume:skipped resume-e2e:skipped \
  portal:skipped wechat-frontend:skipped wechat-backend:skipped

expect 1 "changes 失败被拦" \
  changes:failure secret-scan:success docs-index:skipped hooks-test:skipped resume:skipped resume-e2e:skipped \
  portal:skipped wechat-frontend:skipped wechat-backend:skipped

# 结果为空串（表达式未求值）不能当通过
expect 1 "空结果被拦" \
  changes:success secret-scan:success docs-index:skipped hooks-test:skipped resume: \
  portal:skipped wechat-frontend:skipped wechat-backend:skipped

# changes 缺失（参数没传）必须拦
expect 1 "changes 缺失被拦" \
  docs-index:skipped resume:success

# secret-scan 不做 path 过滤，所以它 skipped/失败/缺失都必须拦——
# 「这次改动没扫过 secret」不能表现为门禁通过。
expect 1 "secret-scan 跳过被拦（它不该被 path 过滤跳过）" \
  changes:success secret-scan:skipped docs-index:skipped hooks-test:skipped resume:skipped resume-e2e:skipped \
  portal:skipped wechat-frontend:skipped wechat-backend:skipped

expect 1 "secret-scan 失败被拦" \
  changes:success secret-scan:failure docs-index:skipped hooks-test:skipped resume:skipped resume-e2e:skipped \
  portal:skipped wechat-frontend:skipped wechat-backend:skipped

expect 1 "secret-scan 缺失被拦（漏传 job 名没有症状，必须显式检查）" \
  changes:success docs-index:skipped hooks-test:skipped resume:skipped resume-e2e:skipped \
  portal:skipped wechat-frontend:skipped wechat-backend:skipped

# 无参数是调用错误，非门禁结论
expect 2 "无参数报用法错误"

echo
echo "通过 $pass / 失败 $fail"
[ "$fail" -eq 0 ]
