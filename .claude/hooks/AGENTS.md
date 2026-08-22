# .claude/hooks/

Claude Code PreToolUse 拦截脚本。制度与设计约束见 ADR 20260822120809。

**拦截必须 `exit 2`。** 其余非零退出码被 Claude Code 当作「脚本自身失败」并**放行**。这就是为什么每个脚本的所有异常路径（读输入失败、解析 JSON 失败）都走 `block()` 而不是直接 `exit 1`——否则「守卫坏了」会静默变成「放行」，而放行是没有症状的。

| 编号 | 脚本 | 触发工具 | 规则 |
|------|------|----------|------|
| H1 | `pre-push-main.sh` | Bash | 禁止 `git push` 到 main/master |
| H2 | `pre-no-verify.sh` | Bash | 禁止 git 命令用 `--no-verify` |
| H3 | `pre-secret-scan.sh` | Edit / Write | 禁止写入疑似硬编码 secret |
| H4 | `pre-generated-edit.sh` | Edit / Write | 禁止手改生成物（ADR 索引表、`*.gen.*`、`/generated/`） |

配置入口：`.claude/settings.json`（**入库**，区别于 `settings.local.json` 的本机配置）。

## 误报比漏报更伤（H1 的两次教训）

**1. 只检查 `git push` 那一段，不扫整条命令串。**

早期 H1 扫整串，于是这条完全正常的命令被拦：

```bash
git commit -F - <<'MSG'
... 在 main 尚未 fetch 时探测 ...
MSG
git push
```

commit message 正文里出现「main」就命中了。守卫看不到 heredoc 边界，只能看到一整串文本。现在先用 python 切出 `git push ...` 片段（到行尾或 `; & |` 为止），再在片段内判断。

**误报会训练人绕过守卫，那比漏报更危险**——一个总是错拦的守卫最终会被关掉，而关掉之后连真拦截也没有了。

**2. 解析逻辑不用 sed，用 python。**

macOS 自带的 BSD sed **不支持 `\b` 词边界**。写了它的表达式在本机静默不匹配、在 CI 的 GNU sed 上却正常——这种「本地绿 CI 红」或反之的分裂行为，比明确的失败难查得多。同类坑本仓库还踩过两次（`go.mod` 声明版本低于实际所需；关联数组在 bash 3.2 不可用）。

判据：**守卫的解析逻辑必须在开发机与 CI 上行为一致**，否则它保护的是哪一边都说不清。

## 覆盖边界（刻意不覆盖的部分）

> **每条 hook 都必须声明自己不管什么。** 挡住三五种绕过形态会制造虚假安全感，比明说「本侧不管、CI 才是防线」更危险。

- **H1 / H2 只看命令字符串字面量。** 经 shell 变量间接构造的（`B=main; git push origin $B`）、alias、或包在脚本里的不拦。远端分支保护与 CI 才是最终防线。
- **H3 / H4 只挂在 Edit / Write 上。** `sed -i`、`>` 重定向、`cat <<EOF`、`rm`、`mv` 全部走 Bash，而 Bash 那一档只注册了 H1 / H2。**这是刻意的**：Bash 的改写形态漏不完（`python -c`、`perl -i`、`awk > tmp && mv` …），试图解析只会给出虚假保证。
- **H3 只匹配有明确前缀特征的凭据**（`sk-`、`AKIA`、`ghp_`、PEM 头等），不做通用高熵检测。误报会让人关掉守卫，那比漏报更糟。

**最终防线始终是 CI**：`ci.yml` 跑 `gen_docs_index.py --check` 校验索引同步。hooks 的作用是把反馈从 CI 提前到工具调用时刻，不是替代 CI。

## 测试

```bash
bash .claude/hooks/tests/test-hooks.sh
```

门禁脚本是生产代码：静默失效时没有任何症状，只有下一次事故。改任何 hook 都要跑这个。
