# scripts/

仓库级自动化脚本。

| 脚本 | 用途 |
|------|------|
| `env-build.sh` | 合并 `config/env.shared.*` + `config/env.<env>.*` 生成 `.env.<env>`。`--check` 只校验完整性不写文件 |
| `env-migrate-legacy.sh` | 旧环境变量格式迁移 |
| `build-prod-assets.sh` | 构建 portal / resume / auto-wechat 前端静态产物 |
| `deploy-prod.sh` | 生产部署（构建 + compose 重建） |
| `ssl-renew.sh` | Let's Encrypt 零停机续期（webroot 模式），配 cron 使用 |
| `verify-local.sh` / `verify-local-compose.sh` / `verify-local-complete.sh` | 本地验证（渐进三档） |
| `docs/gen_docs_index.py` | 生成 `docs/adr/AGENTS.md` 的 ADR 索引表（单测：`docs/test_gen_docs_index.py`） |
| `ci/evaluate-gate.sh` | 汇总 CI 各 job 结果（单测：`ci/gate-test.sh`） |
| `ci/lint-workflows.py` | 校验 workflow **接线**（自测：`--self-test`） |

## workflow 接线：把逻辑抽成脚本时，记得补 checkout

`ci/lint-workflows.py` 的存在有个具体缘由。`gate` job 原先把汇总逻辑内联在 YAML 里，
后来抽成 `ci/evaluate-gate.sh` 以便本地可测——但**没补 `actions/checkout`**。
内联时不需要 checkout，抽成文件后才需要。结果 CI 上：

```
bash: scripts/ci/evaluate-gate.sh: No such file or directory
exit code 127
```

8 个真实 job 全部通过，只有汇总门挂了。`gate-test.sh` 测的是**脚本逻辑**，
测不到**接线**——这是两层不同的东西，缺的是后者。

现在 lint 覆盖三类接线错误：

| | 检查 |
|---|---|
| C1 | job 的 `run` 引用了仓库文件但没有 checkout 步骤 |
| C2 | gate 的 `needs` 与实际传给 `evaluate-gate.sh` 的 job 名不一致（漏传 = 那个 job 失败也不拦） |
| C3 | 引用的脚本路径在仓库里不存在（改名后忘同步） |

C2 尤其值得有：漏传一个 job 名**没有任何症状**——门禁照样绿，只是不再守那个 job。

## 写脚本的约定

- **`set -euo pipefail`**：静默失败的部署脚本比没有脚本更危险
- **幂等**：可安全重复执行。`ssl-renew.sh` 在证书剩余 >30 天时自动跳过就是这个意思
- **顶部注释写清「为什么」而非只写「做什么」**。反例参考：`ssl-renew.sh` 开头解释了为什么不能用 `--standalone`（要独占 80 端口、与常驻 nginx 冲突、导致无人值守续期静默失败）——这个"为什么"比命令本身重要，缺了它下一个人会改回去
- **不在脚本里硬编码 secret**，从 `.env.*` 或环境变量读

## 生成物纪律

`docs/gen_docs_index.py` 的产物（`docs/adr/AGENTS.md` 的表体）**不要手改**。改完 ADR 头部字段后跑生成器。CI 用 `--check` 校验同步。

手维护的索引在文档超过十几份后必然脱节，而**脱节的索引比没有索引更糟**——它会让人停止怀疑。
