---
name: cleanup-ports-after-testing
description: 每次运行验证脚本或测试后必须清理残留进程，避免占用端口影响用户开发
metadata:
  type: feedback
---

每次跑完验证脚本（Playwright、node 测试脚本、curl 循环等）之后，必须立即清理所有可能残留的进程和端口占用。

**Why:** 残留进程会占用 Vite 端口（5173+）和后端端口（3001），导致用户每次启动开发环境都遇到 EADDRINUSE 或 Vite 跳端口，严重干扰开发体验。这是我造成的问题，不是代码 bug。

**How to apply:**
- 验证结束后立即运行：`lsof -ti :3000,:3001,:5173,:5174,:5175,:5176,:5177,:5178,:5179,:5180,:5181,:5182,:5183,:5184,:5185,:5186,:5187,:5188,:5189,:5190,:5191,:5192,:5193 2>/dev/null | xargs kill -9 2>/dev/null`
- 任何启动 server 或 Vite 进程的脚本，用完后必须在 `finally` 块或脚本末尾 kill
- Playwright browser 实例必须调用 `browser.close()`
- 不允许留下任何后台进程没有清理
