#!/usr/bin/env bash
# PreToolUse hook 回归测试。
#
# 断言口径：exit 2 = 拦截，exit 0 = 放行。其余退出码视为失败——因为 Claude Code
# 会把非 2 的非零码当作「脚本自身失败」而放行，那等于守卫失效。
#
# 用法：bash .claude/hooks/tests/test-hooks.sh

set -uo pipefail

HOOKS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
pass=0
fail=0

# expect <期望码> <脚本> <JSON输入> <用例名>
expect() {
  local want="$1" script="$2" payload="$3" name="$4"
  local got
  printf '%s' "$payload" | bash "$HOOKS_DIR/$script" >/dev/null 2>&1
  got=$?
  if [ "$got" = "$want" ]; then
    printf '  ✅ %s\n' "$name"
    pass=$((pass + 1))
  else
    printf '  ❌ %s — 期望 exit %s，实际 exit %s\n' "$name" "$want" "$got"
    fail=$((fail + 1))
  fi
}

bash_in()  { printf '{"tool_input":{"command":%s}}' "$(printf '%s' "$1" | python3 -c 'import sys,json;print(json.dumps(sys.stdin.read()))')"; }
write_in() { printf '{"tool_input":{"file_path":%s,"content":%s}}' \
  "$(printf '%s' "$1" | python3 -c 'import sys,json;print(json.dumps(sys.stdin.read()))')" \
  "$(printf '%s' "${2:-}" | python3 -c 'import sys,json;print(json.dumps(sys.stdin.read()))')"; }
edit_in()  { printf '{"tool_input":{"file_path":%s,"new_string":%s}}' \
  "$(printf '%s' "$1" | python3 -c 'import sys,json;print(json.dumps(sys.stdin.read()))')" \
  "$(printf '%s' "${2:-}" | python3 -c 'import sys,json;print(json.dumps(sys.stdin.read()))')"; }

echo "H1 pre-push-main.sh"
expect 2 pre-push-main.sh "$(bash_in 'git push origin main')"                  "拦截 push origin main"
expect 2 pre-push-main.sh "$(bash_in 'git push origin master')"                "拦截 push origin master"
expect 2 pre-push-main.sh "$(bash_in 'git push origin HEAD:main')"             "拦截 refspec HEAD:main"
expect 2 pre-push-main.sh "$(bash_in 'git push origin HEAD:refs/heads/main')"  "拦截 refs/heads/main"
expect 0 pre-push-main.sh "$(bash_in 'git push origin feat/x-y')"              "放行 feature 分支"
expect 0 pre-push-main.sh "$(bash_in 'git status')"                            "放行非 push git 命令"
expect 0 pre-push-main.sh "$(bash_in 'ls main')"                               "放行非 git 命令"
expect 0 pre-push-main.sh "$(bash_in 'git log --oneline maintenance')"         "放行含 main 子串的分支名"

echo "H2 pre-no-verify.sh"
expect 2 pre-no-verify.sh "$(bash_in 'git commit --no-verify -m x')"           "拦截 commit --no-verify"
expect 2 pre-no-verify.sh "$(bash_in 'FOO=1 git push --no-verify')"            "拦截环境变量前缀形态"
expect 0 pre-no-verify.sh "$(bash_in 'git commit -m x')"                       "放行正常 commit"
expect 0 pre-no-verify.sh "$(bash_in 'npm test --no-verify')"                   "放行非 git 命令的同名 flag"

echo "H3 pre-secret-scan.sh"
expect 2 pre-secret-scan.sh "$(write_in 'a.ts' 'const k = "sk-abcdefghijklmnopqrstuvwxyz123"')" "拦截 sk- 形态"
expect 2 pre-secret-scan.sh "$(write_in 'a.ts' 'AKIAIOSFODNN7EXAMPLE')"                          "拦截 AWS key id"
expect 2 pre-secret-scan.sh "$(write_in 'a.ts' 'ghp_012345678901234567890123456789012345')"      "拦截 GitHub PAT（36 位）"
expect 0 pre-secret-scan.sh "$(write_in 'a.ts' 'ghp_short')"                                      "放行 ghp_ 但长度不足（不误报）"
expect 2 pre-secret-scan.sh "$(write_in 'k.pem' '-----BEGIN RSA PRIVATE KEY-----')"              "拦截私钥 PEM"
expect 2 pre-secret-scan.sh "$(edit_in  'a.ts' 'sk_live_0123456789abcdef')"                      "拦截 Edit 路径的 Stripe live"
expect 0 pre-secret-scan.sh "$(write_in 'a.ts' 'const name = "hello world"')"                    "放行普通内容"
expect 0 pre-secret-scan.sh "$(write_in 'a.ts' 'process.env.API_KEY')"                           "放行环境变量引用"

echo "H4 pre-generated-edit.sh"
expect 2 pre-generated-edit.sh "$(write_in 'docs/adr/AGENTS.md' 'x')"          "拦截 ADR 索引表"
expect 2 pre-generated-edit.sh "$(write_in './docs/./adr//AGENTS.md' 'x')"     "拦截路径变体（归一化生效）"
expect 2 pre-generated-edit.sh "$(write_in 'src/api.gen.ts' 'x')"              "拦截 .gen.ts"
expect 2 pre-generated-edit.sh "$(write_in 'src/generated/types.ts' 'x')"      "拦截 /generated/ 目录"
expect 0 pre-generated-edit.sh "$(write_in 'docs/adr/TEMPLATE.md' 'x')"        "放行 ADR 模板"
expect 0 pre-generated-edit.sh "$(write_in 'docs/AGENTS.md' 'x')"             "放行非 adr 的 AGENTS.md"
expect 0 pre-generated-edit.sh "$(write_in 'src/api.ts' 'x')"                  "放行普通源文件"

echo "fail-closed：守卫收到坏输入必须拦截而非放行"
for s in pre-push-main.sh pre-no-verify.sh pre-secret-scan.sh pre-generated-edit.sh; do
  expect 2 "$s" 'not json at all' "$s 遇非法 JSON 拦截"
done

echo
echo "通过 $pass / 失败 $fail"
[ "$fail" -eq 0 ]
