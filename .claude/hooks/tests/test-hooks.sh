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
expect 0 pre-push-main.sh "$(bash_in 'git push origin HEAD:feat/x')"          "放行 refspec 指向 feature"
expect 0 pre-push-main.sh "$(bash_in 'git push -u origin worktree-x')"        "放行带 -u 的 feature 分支"

# 绕过回归：以下四种都是普通、非混淆的写法，早期版本（三条独立 grep）全部放行。
# 守卫自己的测试当时恰好只覆盖 `origin main` / `HEAD:main`，绕开了它们——
# 所以这几条是「测试绿≠守卫有效」的直接教训，不许删。
expect 2 pre-push-main.sh "$(bash_in 'git push origin refs/heads/main')" \
  "拦截全路径 refs/heads/main（无冒号）"
expect 2 pre-push-main.sh "$(bash_in 'git push origin refs/heads/master')" \
  "拦截全路径 refs/heads/master"
expect 2 pre-push-main.sh "$(bash_in 'git push origin +main')" \
  "拦截强推前缀 +main"
expect 2 pre-push-main.sh "$(bash_in 'git push --force-with-lease origin main')" \
  "拦截 --force-with-lease origin main"
expect 2 pre-push-main.sh "$(bash_in 'git push origin "main"')" \
  "拦截带引号的 \"main\""
expect 2 pre-push-main.sh "$(bash_in 'bash -c "git push origin main"')" \
  "拦截嵌套 bash -c 里的 push main"
expect 2 pre-push-main.sh "$(bash_in 'git push . HEAD:main')" \
  "拦截 remote 为 . 的 HEAD:main"
expect 2 pre-push-main.sh "$(bash_in 'git push origin :main')" \
  "拦截删除 main 分支（空源 refspec）"
expect 2 pre-push-main.sh "$(bash_in 'git push origin --delete main')" \
  "拦截 --delete main"
expect 2 pre-push-main.sh "$(bash_in 'git push --all origin')" \
  "拦截 --all（推送全部分支含 main）"
expect 2 pre-push-main.sh "$(bash_in 'git push --mirror origin')" \
  "拦截 --mirror"
expect 2 pre-push-main.sh "$(bash_in 'git push origin feat/x main')" \
  "拦截多 refspec 中夹带 main"

# 规范化不该误伤这些合法目标
expect 0 pre-push-main.sh "$(bash_in 'git push origin refs/heads/feat/x')" \
  "放行全路径的 feature 分支"
expect 0 pre-push-main.sh "$(bash_in 'git push origin +feat/x')" \
  "放行强推 feature 分支"
expect 0 pre-push-main.sh "$(bash_in 'git push origin main:feat/x')" \
  "放行把 main 内容推到 feature（目标端不是 main）"
expect 0 pre-push-main.sh "$(bash_in 'git push origin mainline')" \
  "放行 mainline（不是 main）"
expect 0 pre-push-main.sh "$(bash_in 'git push origin master-notes')" \
  "放行 master-notes（不是 master）"

# 误报回归：早期版本扫整条命令串，导致 commit message 里出现 "main" 就被拦。
# 误报会训练人绕过守卫，比漏报更伤——所以只检查 git push 那一段。
expect 0 pre-push-main.sh "$(bash_in "$(printf 'git commit -m "fix: 在 main 尚未 fetch 时探测"\ngit push origin feat/x')")" \
  "commit message 含 main 但 push 指向 feature → 放行"
expect 0 pre-push-main.sh "$(bash_in "$(printf 'git commit -F - <<MSG\n讲 main 分支的事\nMSG\ngit push')")" \
  "heredoc 正文含 main 且裸 push（当前非 main）→ 放行"
expect 0 pre-push-main.sh "$(bash_in 'git push origin feat/x && echo "已推到 main 之外"')" \
  "push 之后的其他子命令含 main → 放行"
expect 0 pre-push-main.sh "$(bash_in 'echo "main" && git push origin feat/x')" \
  "push 之前的其他子命令含 main → 放行"
# 但复合命令里真的 push main 仍必须拦
expect 2 pre-push-main.sh "$(bash_in 'git add -A && git push origin main')" \
  "复合命令里 push main → 拦下"
expect 2 pre-push-main.sh "$(bash_in "$(printf 'git commit -m x\ngit push origin main')")" \
  "多行命令里 push main → 拦下"
expect 2 pre-push-main.sh "$(bash_in 'git push origin feat/x; git push origin main')" \
  "第二个 push 指向 main → 拦下"

# 不带分支名的 push 会推当前分支——命令字符串里看不出目标，守卫须查 HEAD。
# 本测试运行在 worktree 分支上，所以这些应放行；在 main 上则应拦（见下一组）。
expect 0 pre-push-main.sh "$(bash_in 'git push')"                            "非 main 分支上裸 push 放行"
expect 0 pre-push-main.sh "$(bash_in 'git push origin')"                     "非 main 分支上 push origin 放行"

# 模拟处于 main：用一个临时 git 仓库把 HEAD 指向 main，验证裸 push 被拦。
echo "H1 裸 push 在 main 上必须被拦（临时仓库）"
tmp_repo=$(mktemp -d)
(
  cd "$tmp_repo" || exit 1
  git init -q -b main . >/dev/null 2>&1
  git -c user.email=t@t -c user.name=t commit -q --allow-empty -m init >/dev/null 2>&1
  for c in 'git push' 'git push origin' 'git push -u origin' 'git push --force'; do
    got=$(printf '{"tool_input":{"command":"%s"}}' "$c" \
      | bash "$HOOKS_DIR/pre-push-main.sh" >/dev/null 2>&1; echo $?)
    if [ "$got" = 2 ]; then
      printf '  ✅ 在 main 上拦截 %s\n' "$c"
    else
      printf '  ❌ 在 main 上未拦截 %s（exit %s）\n' "$c" "$got"
      exit 1
    fi
  done
) && pass=$((pass + 4)) || fail=$((fail + 1))
rm -rf "$tmp_repo"

# 副作用检查：守卫自身绝不能执行 git push（曾因拦截消息里用反引号而真的触发过命令替换）
echo "H1 守卫不得产生副作用"
side_repo=$(mktemp -d)
(
  cd "$side_repo" || exit 1
  git init -q -b main . >/dev/null 2>&1
  git -c user.email=t@t -c user.name=t commit -q --allow-empty -m init >/dev/null 2>&1
  # 指向一个不存在的路径作为 remote：真的执行 push 会在 stderr 留下痕迹
  git remote add origin /nonexistent/repo.git
  out=$(printf '{"tool_input":{"command":"git push"}}' \
    | bash "$HOOKS_DIR/pre-push-main.sh" 2>&1)
  if printf '%s' "$out" | grep -qiE "does not appear to be a git repository|Could not read from remote"; then
    printf '  ❌ 守卫执行了真实的 git push\n'
    exit 1
  fi
  printf '  ✅ 守卫未执行 git push\n'
) && pass=$((pass + 1)) || fail=$((fail + 1))
rm -rf "$side_repo"

echo "H2 pre-no-verify.sh"
expect 2 pre-no-verify.sh "$(bash_in 'git commit --no-verify -m x')"           "拦截 commit --no-verify"
expect 2 pre-no-verify.sh "$(bash_in 'FOO=1 git push --no-verify')"            "拦截环境变量前缀形态"
expect 0 pre-no-verify.sh "$(bash_in 'git commit -m x')"                       "放行正常 commit"
expect 0 pre-no-verify.sh "$(bash_in 'npm test --no-verify')"                   "放行非 git 命令的同名 flag"

# -n 的语义按子命令区分：只有 commit 的 -n 才是 --no-verify。
# 早期版本注释声称覆盖 -n 但代码没实现，最常见的绕法反而放行。
expect 2 pre-no-verify.sh "$(bash_in 'git commit -n -m x')"                    "拦截 commit -n"
expect 2 pre-no-verify.sh "$(bash_in 'git commit -nm wip')"                    "拦截聚合短选项 -nm"
expect 2 pre-no-verify.sh "$(bash_in 'git commit -m x -n')"                    "拦截 -n 在末尾"
expect 2 pre-no-verify.sh "$(bash_in 'git -c user.name=x commit -n -m y')"     "拦截 git 级选项后的 commit -n"
expect 2 pre-no-verify.sh "$(bash_in 'git -C /tmp/repo commit -n -m y')"       "拦截 -C dir 后的 commit -n"
# 这些 -n 不是 --no-verify，拦了就是误报
expect 0 pre-no-verify.sh "$(bash_in 'git push -n')"                           "放行 push -n（是 --dry-run）"
expect 0 pre-no-verify.sh "$(bash_in 'git push -n origin feat/x')"             "放行 push --dry-run 带参"
expect 0 pre-no-verify.sh "$(bash_in 'git add -n .')"                          "放行 add -n（是 --dry-run）"
expect 0 pre-no-verify.sh "$(bash_in 'git log -n 5')"                          "放行 log -n（是条数）"
expect 0 pre-no-verify.sh "$(bash_in 'git commit -am wip')"                    "放行 -am（不含 n）"
expect 0 pre-no-verify.sh "$(bash_in 'git status -n')"                         "放行其他子命令的 -n"

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

echo "H5 pre-stale-media.sh"
#
# H5 与 H1–H4 不同：它跑真实的 `--check`，所以结论依赖仓库当前状态。
# 因此先断言前置条件（当前树的指纹是最新的），否则后面的「放行」用例毫无意义。
#
# `--check` 只报告不写文件，所以「造一个过期条件 → 断言拦截 → 删掉」不留痕迹。

H5_ROOT="$(cd "$HOOKS_DIR/../.." && pwd)"
H5_PROBE="$H5_ROOT/apps/resume/lib/__h5_probe__.ts"
# 生僻字：字体子集的指纹是对**出现过的字符集合**求的，常见汉字不会让它过期。
#
# 直接写字面量，不用 `printf '\uHHHH'`——**macOS 自带 bash 是 3.2.57，
# printf 的 \u 转义要 bash 4.2+**，3.2 下会原样输出 `\u9f98`（全是 ASCII、
# 本来就在字符集里），于是「造过期条件」这一步静默失效、拦截用例假绿。
# 这是本仓库 AGENTS.md 记过的 bash 3.2 陷阱的同一类。
#
# 把字面量写在本文件里是安全的：字体子集只扫 apps/resume 下
# {app,components,lib,hooks,context} 里的 .ts/.tsx/.css，本文件都不在其中。
H5_RARE='龘'

cleanup_h5() { rm -f "$H5_PROBE"; }
trap cleanup_h5 EXIT

if printf '%s' "$(bash_in 'git push origin feat/probe')" \
   | bash "$HOOKS_DIR/pre-stale-media.sh" >/dev/null 2>&1; then
  # 前置条件满足：当前树没有过期指纹
  expect 0 pre-stale-media.sh "$(bash_in 'git status')"                   "放行非 push 命令"
  expect 0 pre-stale-media.sh "$(bash_in 'git commit -m x')"              "放行 commit（H5 只管 push）"
  expect 0 pre-stale-media.sh "$(bash_in 'git push --dry-run origin x')"      "放行 --dry-run（不交出任何东西）"
  expect 0 pre-stale-media.sh "$(bash_in 'git push -n origin x')"             "放行 -n（push 下是 dry-run，不是 no-verify）"
  expect 0 pre-stale-media.sh "$(bash_in 'ls push')"                      "放行非 git 命令"
  expect 0 pre-stale-media.sh "$(bash_in 'git push origin feat/x')"           "指纹最新时放行"

  # 拦截路径：造一个真实的过期条件（引入一个此前没出现过的字符）
  printf '// %s\n' "$H5_RARE" > "$H5_PROBE"
  expect 2 pre-stale-media.sh "$(bash_in 'git push origin feat/x')"           "指纹过期时拦截"
  expect 0 pre-stale-media.sh "$(bash_in 'git push --dry-run origin x')"      "过期但 --dry-run 仍放行"
  cleanup_h5
  expect 0 pre-stale-media.sh "$(bash_in 'git push origin feat/x')"           "删掉过期来源后恢复放行"
else
  printf '  ❌ H5 前置条件不满足：当前工作树已有指纹过期，无法验证「放行」路径。\n'
  printf '     先按拦截信息里的命令重新生成，再跑本测试。\n'
  fail=$((fail + 1))
fi

# 少守一条没有任何症状 —— 这两条守的是**派生逻辑本身**。
# 本 hook 第一版按字面量列了三种 `--check` 写法，恰好漏掉 subset-fonts.py
# （它写的是双引号 `"--check" in sys.argv`），于是唯一真正咬过人的那条流水线没被守。
# 第二版把 `.*` 写成 `[^\n]*`——POSIX ERE 的括号表达式里那是「非反斜杠且非字母 n」，
# 而 `argv.includes` 含字母 n，于是派生成 0 条。
# 两次错误都不会让任何 exit-code 用例变红，只有直接断言清单内容才抓得到。
echo "H5 派生逻辑：清单必须覆盖到会咬人的那条"
h5_derived=$(cd "$H5_ROOT/apps/resume" && grep -rlE 'argv.*--check|--check.*argv' scripts/media scripts/lab 2>/dev/null | sort)
h5_count=$(printf '%s\n' "$h5_derived" | grep -c . )
if printf '%s\n' "$h5_derived" | grep -q 'subset-fonts\.py'; then
  printf '  ✅ 派生清单含 subset-fonts.py（共 %s 条）\n' "$h5_count"
  pass=$((pass + 1))
else
  printf '  ❌ 派生清单**不含** subset-fonts.py（共 %s 条）——会静默少守字体子集那条\n' "$h5_count"
  fail=$((fail + 1))
fi
if printf '%s\n' "$h5_derived" | grep -q 'freshness\.mjs'; then
  printf '  ❌ 派生清单误纳 freshness.mjs（它是被 import 的库，不是可执行检查）\n'
  fail=$((fail + 1))
else
  printf '  ✅ 派生清单未误纳 freshness.mjs\n'
  pass=$((pass + 1))
fi

echo "fail-closed：守卫收到坏输入必须拦截而非放行"
for s in pre-push-main.sh pre-no-verify.sh pre-secret-scan.sh pre-generated-edit.sh pre-stale-media.sh; do
  expect 2 "$s" 'not json at all' "$s 遇非法 JSON 拦截"
done

echo
echo "通过 $pass / 失败 $fail"
[ "$fail" -eq 0 ]
