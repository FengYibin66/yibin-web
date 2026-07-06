# Memory Index

- [Architecture First — No Patches](feedback_architecture_first.md) — 禁止补丁式修改，所有改动必须以规范架构为指导，先审核根因和架构合理性
- [Cleanup Ports After Testing](feedback_cleanup_ports.md) — 验证脚本结束后必须立即清理所有残留进程和端口，否则会影响用户开发环境
- [Verification Discipline](feedback_verification_discipline.md) — 完整验证流程（type-check→build→HTTP 200→内容检查→清理端口），全部通过才能说完成；不得改无关代码
