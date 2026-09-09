#!/usr/bin/env bash
# 线上路由探针：断言一组 URL 的 HTTP 状态码与内容类型。
#
# ## 为什么有这个脚本
#
# 2026-09-09 上线后验收，发现两个存在已久、CI 完全看不到的缺陷：
#
#   /classic/experience/   → 403（目录存在但没有 index.html，nginx 吐裸错误页）
#   /this-does-not-exist/  → 200 + 首页（软 404，对 SEO 有害、对访客困惑）
#
# 两者都不是构建产物的问题——`out/` 里一切正常——而是 **nginx 的 try_files 规则**
# 与 Next.js `output: 'export'` 的形态不匹配。这类缺陷单测和 E2E 都测不到：
# Playwright 跑的是自己的静态服务器，不经过 nginx；而 CI 不部署，也就没有 nginx。
#
# 唯一能发现它的时机是「对着真实部署发请求」。所以把它固化成脚本，而不是
# 某次排查时手敲的一串 curl。
#
# ## 用法
#
#   ./scripts/probe-routes.sh                              # 探生产
#   ./scripts/probe-routes.sh https://resume.yibinfeng.com  # 显式指定
#   ./scripts/probe-routes.sh http://localhost:8080         # 探本地 compose
#
# 任一条不符即以非零退出——它是给 CD 用的门，不是给人看的报告
# （平台路线图计划 A 第 1 期要把它接到部署之后）。
set -euo pipefail

BASE="${1:-https://resume.yibinfeng.com}"
BASE="${BASE%/}"

# 期望表：路径 | 期望状态码 | 期望 content-type 子串（`-` = 不检查）
#
# 每一行都要能说出「为什么是这个码」，否则它迟早被改成「实际是什么就写什么」，
# 那时探针就从「守规格」退化成「记录现状」，不再能发现回归。
PROBES=(
  "/|200|text/html"                                  # 首页
  "/classic/|200|text/html"                          # Classic 形态入口
  "/lab/|200|text/html"                              # Lab 形态入口
  "/classic/experience/mcallister/|200|text/html"    # 动态段导出的详情页
  "/classic/experience/|404|text/html"               # 目录存在但无页面 → 404，不是 403
  "/classic/publications/|404|text/html"             # 同上
  "/textures/|404|-"                                 # 资源目录不对外列目录
  "/this-does-not-exist/|404|text/html"              # 未知路径要真 404，不是 200 首页
  "/404.html|200|text/html"                          # 直接请求这个真实存在的文件 → 200 是对的；
                                                     # 404 状态由 error_page 的内部跳转赋予，
                                                     # 上面那两条未知路径才是在守这件事
  "/textures/corridor/companion/dog_body.webp|200|image/webp"  # 走廊活物贴图
  "/sounds/dog_bark.m4a|200|-"                       # 离线合成的音效
)

pass=0
fail=0

for probe in "${PROBES[@]}"; do
  IFS='|' read -r path want_code want_type <<<"$probe"

  # 单独取状态码与内容类型；--max-time 防止探针本身把 CD 挂住
  read -r got_code got_type <<<"$(curl -sS -o /dev/null \
    -w '%{http_code} %{content_type}' --max-time 20 "$BASE$path" || echo "000 -")"

  problem=""
  [ "$got_code" = "$want_code" ] || problem="状态码 期望 $want_code 实际 $got_code"
  if [ -z "$problem" ] && [ "$want_type" != "-" ]; then
    case "$got_type" in
      *"$want_type"*) ;;
      *) problem="内容类型 期望含 $want_type 实际 $got_type" ;;
    esac
  fi

  if [ -z "$problem" ]; then
    printf '  ✓ %-46s %s\n' "$path" "$got_code"
    pass=$((pass + 1))
  else
    printf '  ✗ %-46s %s\n' "$path" "$problem"
    fail=$((fail + 1))
  fi
done

echo
echo "$BASE — 通过 $pass / 失败 $fail"
[ "$fail" -eq 0 ] || exit 1
