# Spec: Portal 媒体资源（头像 / 项目截图）

**状态**: MVP 已上线（本地上传）— **待升级** COS + CDN  
**作者**: Yibin Feng  
**日期**: 2026-07-09  
**关联**: [portal-homepage.md](./portal-homepage.md), [platform.md](./platform.md)

---

## 1. 当前实现（MVP，Phase 1）

个人站流量小、上线优先，**暂用本机 volume + Nginx 反代**，不做对象存储。

| 项 | 做法 |
|----|------|
| 存储 | Docker volume `portal_uploads` → 容器内 `/app/uploads` |
| 上传 | `POST /api/uploads`（Admin 鉴权）→ 写本地文件 |
| 访问 URL | DB 存相对路径，如 `/uploads/avatar.jpg` |
| 对外 serve | Nginx `location ^~ /uploads/` → `portal-server`（**必须 `^~`**，避免被全站 `*.jpg` 正则拦截） |
| 默认头像 | entrypoint 从镜像内 `default-avatar.jpg` seed 到 volume |

**Env**

- `UPLOADS_DIR=/app/uploads`（`config/env.production.example`）
- 腾讯云 `COS_*` 已在 shared env 预留，**Portal 尚未接入**

**已知限制**

- 文件跟 CVM 磁盘走，换机/扩缩容需手动迁 volume
- URL 为相对路径，与 SPA 静态资源共用域名，依赖 Nginx 路由顺序
- 不适合大文件、高并发、多实例

---

## 2. 目标架构（Phase 2 — 待做）

**升级为：腾讯云 COS + CDN（生产正规做法）**

```
Admin 上传 → Portal API → PutObject(COS)
浏览器读图 → https://media.yibinfeng.com/portal/avatars/{uuid}.webp（CDN）
DB 存完整 avatarUrl，不再存 /uploads/...
Nginx 删除 location /uploads/ 与 portal_uploads volume
```

### 2.1 腾讯云侧

- COS 桶：`ap-beijing`，key 前缀 `portal/avatars/`、`portal/projects/`
- CDN 加速域名：`media.yibinfeng.com`（CNAME 到 CDN）
- CAM 子账号：仅 `cos:PutObject/GetObject` on `portal/*`
- 复用 `.env.shared.local` 中 `TENCENT_SECRET_*`、`COS_BUCKET`、`COS_REGION`

### 2.2 代码侧（升级清单）

- [ ] `MediaStore` 接口：`LocalMediaStore`（dev）/ `CosMediaStore`（prod）
- [ ] Env：`MEDIA_DRIVER=local|cos`，`MEDIA_PUBLIC_BASE_URL=https://media.yibinfeng.com`
- [ ] API：`POST /api/media` 返回 `{ key, url }`；profile 字段 `avatarPath` → `avatarUrl`
- [ ] 删除：`serveStatic('/uploads/*')`、`portal_uploads` volume、Nginx `/uploads/` 块
- [ ] 静态资源缓存正则 **仅** 作用于 `/assets/`，禁止全站 `~* \.jpg$`
- [ ] 迁移：现有 `/uploads/*` 文件一次性上传到 COS，更新 DB URL

### 2.3 可选中间步（非必须）

若不想一步上 COS，可先改为 **纯 API 出流**（`/api/media/:id`），Nginx 只保留 `/api/` + SPA，再迁 COS。  
当前 MVP 已可用，**可直接 Phase 1 → Phase 2**。

---

## 3. 修改流程

1. 本 Spec Phase 2 勾选完成后再改代码  
2. 控制台：COS + CDN + DNS 先于代码上线  
3. 生产切换：`MEDIA_DRIVER=cos` + 迁移脚本 + 验收 CDN URL  
4. 更新 [portal-homepage.md](./portal-homepage.md) § 部署 / API 表

---

## 4. 验收（Phase 2 完成后）

- [ ] `https://media.yibinfeng.com/portal/avatars/...` 可访问，带 CDN 缓存头
- [ ] `www.yibinfeng.com` 无 `/uploads/` 路由
- [ ] Admin 换头像后 profile 返回 HTTPS 绝对 URL
- [ ] CVM 无 `portal_uploads` volume 依赖
