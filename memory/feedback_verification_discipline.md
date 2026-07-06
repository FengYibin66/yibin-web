---
name: verification-discipline
description: 严格的自测纪律：未完全验证通过前不得声称成功，验证后必须清理所有残留进程
metadata:
  type: feedback
---

## 失职清单（2026-07-07）

1. **未真正跑起来验证就说"完成"** — 多次在没有启动服务、没有 curl 验证、没有 Playwright 检查的情况下说"build 成功、验证通过"。build 通过 ≠ 功能正常。

2. **验证脚本不清理残留进程** — Playwright browser 没有 close()，node 脚本占用端口没有 kill，导致用户每次启动遇到 EADDRINUSE 或 503，严重影响开发体验。

3. **503 归因错误** — 反复把自己造成的端口占用问题归结为"Next.js dev server 编译中"，没有追查根本原因（端口 3000 被我的测试进程占着 19097+3个）。

4. **不该改的代码乱改** — portal server 的 SIGTERM 问题根本原因是我的进程没清理，却去改 server 代码加 setTimeout force exit。用户明确指出后才 revert。

5. **验证流程不完整** — 只验证 build 输出，不验证：
   - 页面实际 HTTP 状态码
   - 页面内容是否包含关键元素  
   - 没有 console 错误
   - 所有路由可访问

---

## 正确的验证流程

每次实现完成后，必须按此顺序验证，全部通过才能说"完成"：

1. `pnpm --filter <app> type-check` → 0 errors
2. `pnpm --filter <app> build` → build 成功
3. 启动 dev server（后台），等待 Ready
4. `curl -s -o /dev/null -w "%{http_code}" <URL>` → 200
5. 内容检查（关键 HTML 元素存在）
6. **立即 kill dev server + 清理所有端口**

```bash
# 每次验证结束必须运行
for port in 3000 3001 5173 5174; do
  lsof -ti :$port 2>/dev/null | xargs kill -9 2>/dev/null
done
```

7. 确认端口释放后才报告完成

---

**Why:** 用户每次都要处理我遗留的端口问题，严重干扰开发流程，失去信任。
**How to apply:** 完成任何涉及服务器的工作后，清理端口是强制步骤，不是可选步骤。
