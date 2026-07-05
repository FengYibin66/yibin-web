# Frontend — Vue 3 SPA

遵循 [docs/06-frontend-standards.md](../docs/06-frontend-standards.md) 与 fyb-frontend-standards（universal + vue）。

## 开发

```bash
cp .env.example .env.development
# 后端需先运行 createadmin 创建管理员（密码存 admin_users 表），浏览器 Cookie 鉴权

pnpm install
pnpm dev
```

## 检查

```bash
pnpm typecheck
pnpm lint
pnpm build
```

## 页面

| 路由 | 视图 |
|------|------|
| `/` | 触发 Pipeline Run |
| `/runs/:id` | Run 详情与步骤 |
| `/runs/:id/preview` | 成稿预览（sandbox iframe，非 v-html） |
