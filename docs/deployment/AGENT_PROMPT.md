# 🚀 yibin_web 腾讯云 CVM 部署 Agent Prompt

> **Spec 索引**: [docs/specs/README.md](../specs/README.md)  
> **平台 Spec**: [docs/specs/platform.md](../specs/platform.md)

## 任务概述

部署 yibin_web monorepo 到腾讯云 CVM（北京 Lighthouse），启动完整的生产环境。所有配置文件和代码已经完成，现在需要在 CVM 上实施部署。

**预期时间**: 20-30 分钟  
**难度**: 中等（主要是 SSH 操作和等待）

---

## 前置条件（由用户提供）

用户需要提供以下信息，你在开始前应该立即向用户确认：

```
□ CVM IP 地址
□ SSH 用户名（通常 ubuntu 或 root）
□ SSH 私钥或密码
□ 三个域名（www.yibinfeng.com, resume.yibinfeng.com, mpauto.yibinfeng.com）
□ 邮箱地址（用于 Let's Encrypt 证书）
□ 敏感信息（DASHSCOPE_API_KEY, WECHAT_APP_ID 等）- 见下方
```

### 必需的敏感信息（来自用户）

```
MYSQL_ROOT_PASSWORD=            # MySQL root 密码
MYSQL_PASSWORD=                 # MySQL wechat 用户密码
ADMIN_PASSWORD=                 # Portal 管理员密码
DASHSCOPE_API_KEY=              # 阿里云通义千问 API Key
WECHAT_APP_ID=                  # 微信公众号 APP ID
WECHAT_APP_SECRET=              # 微信公众号 APP Secret
WECHAT_ORIGINAL_ID=             # 微信原始 ID
TENCENT_SECRET_ID=              # 腾讯云 Secret ID
TENCENT_SECRET_KEY=             # 腾讯云 Secret Key
COS_BUCKET=                     # 腾讯云 COS 桶名
SECRET_KEY=                     # 随机 32 字符密钥（自己生成即可）
```

---

## 部署步骤

### **Phase 1: SSH 连接 & 基础环境**

1. **SSH 登录到 CVM**
   ```bash
   ssh ubuntu@{CVM_IP}
   # 或 ssh root@{CVM_IP}
   ```
   - 确认能成功登录
   - 检查系统类型：`uname -a` 应该显示 Linux

2. **安装 Docker & Docker Compose**
   ```bash
   curl -fsSL https://get.docker.com | sh
   sudo usermod -aG docker $USER
   newgrp docker
   docker --version
   docker compose --version
   ```
   - 验证两个命令都成功输出版本号

3. **创建数据目录**
   ```bash
   mkdir -p /data
   cd /data
   ```

---

### **Phase 2: 克隆项目 & 配置**

4. **克隆 yibin_web 项目**
   ```bash
   git clone https://github.com/FengYibin66/yibin-web.git
   cd yibin-web
   ```
   - 确认项目克隆成功，能看到 docker-compose.prod.yml

5. **配置环境变量**
   ```bash
   cp config/env.shared.example .env.shared.local
   nano .env.shared.local   # 填入所有密钥（见前置条件）
   ./scripts/env-build.sh production
   ./scripts/env-build.sh production --check   # 确认无 CHANGE_ME
   ```
   - 生产 URL 已在 `config/env.production.example`，**无需 sed 改域名**
   - `.env.production` 由脚本生成，不要手改

---

### **Phase 3: SSL 证书申请**

7. **安装 Certbot**
   ```bash
   sudo apt-get update && sudo apt-get install -y certbot
   ```

8. **申请 SSL 证书（Let's Encrypt）**
   ```bash
   sudo certbot certonly --standalone \
     -d www.yibinfeng.com \
     -d resume.yibinfeng.com \
     -d mpauto.yibinfeng.com \
     --agree-tos \
     --email {用户邮箱}
   ```
   - 确认三个域名的 DNS A 记录已指向此 CVM IP（这是前提）
   - 等待证书申请完成
   - 验证：`sudo certbot certificates` 应显示 3 个有效证书

---

### **Phase 4: 启动 Docker Compose**

9. **启动所有服务**
   ```bash
   cd /data/yibin-web
   docker compose -f docker-compose.prod.yml up -d --build
   ```
   - 这会耗时 5-10 分钟（第一次需要拉取镜像、构建、启动）
   - 输出应该显示每个服务都 `Created` 和 `Started`

10. **等待服务稳定**
    - 等待 2-3 分钟让所有容器启动完毕
    - 运行：`docker compose -f docker-compose.prod.yml ps`
    - 应该看到 7 个服务都是 `Up` 状态

---

### **Phase 5: 验证部署**

11. **检查服务健康状态**
    ```bash
    docker compose -f docker-compose.prod.yml ps
    ```
    - 所有容器应显示 `Up` 状态
    - 没有 `Exited` 或 `Error` 状态

12. **查看日志（如有错误）**
    ```bash
    docker compose -f docker-compose.prod.yml logs --tail=50
    docker compose -f docker-compose.prod.yml logs portal-server
    docker compose -f docker-compose.prod.yml logs auto-wechat-api
    ```

13. **HTTP 健康检查**
    ```bash
    # Portal API
    curl http://localhost:3001/health
    
    # Auto-Wechat API  
    curl http://localhost:8080/api/v1/health
    
    # Nginx
    curl http://localhost/
    ```
    - 应该都能返回 200 或有相关响应

14. **HTTPS 访问验证（最重要！）**
    ```bash
    # 从 CVM 本机测试
    curl https://www.yibinfeng.com/api/health
    curl https://resume.yibinfeng.com/
    curl https://mpauto.yibinfeng.com/api/v1/health
    ```
    - 都应返回 200 或有内容
    - 如果无法访问，检查防火墙规则（80、443 端口是否开放）

15. **浏览器访问验证**
    - 在本地电脑上打开浏览器：
      - https://www.yibinfeng.com → 应看到 Portal 网站
      - https://resume.yibinfeng.com → 应看到 Resume 页面
      - https://mpauto.yibinfeng.com → 应看到 Auto-Wechat 前端
    - 检查浏览器控制台是否有 HTTPS 错误或混合内容警告

---

## 故障排查

### **如果容器无法启动**

```bash
# 查看详细日志
docker compose -f docker-compose.prod.yml logs -f

# 重启特定服务
docker compose -f docker-compose.prod.yml restart portal-server

# 检查资源是否不足
docker stats
```

### **如果 HTTPS 连接失败**

```bash
# 检查证书是否正确
sudo certbot certificates

# 检查 Nginx 配置
docker compose -f docker-compose.prod.yml exec nginx nginx -t

# 查看 Nginx 日志
docker compose -f docker-compose.prod.yml logs nginx
```

### **如果数据库无法连接**

```bash
# 测试 MySQL 连接
docker compose -f docker-compose.prod.yml exec mysql \
  mysql -u root -p{MYSQL_ROOT_PASSWORD} -e "SELECT 1"
```

### **如果需要停止服务**

```bash
docker compose -f docker-compose.prod.yml down
# 保留数据卷：
docker compose -f docker-compose.prod.yml down -v  # 删除所有卷（谨慎！）
```

---

## 成功标志 ✅

部署完成的标志：

- [ ] SSH 成功登录 CVM
- [ ] Docker 和 Docker Compose 已安装
- [ ] git clone 项目成功
- [ ] `.env.shared.local` 已填写，`./scripts/env-build.sh production --check` 通过
- [ ] SSL 证书已申请（certbot 显示 3 个有效证书）
- [ ] `docker compose ps` 显示 7 个服务都 `Up`
- [ ] `curl http://localhost:3001/health` 返回 200
- [ ] `curl http://localhost:8080/api/v1/health` 返回 200
- [ ] `curl https://www.yibinfeng.com/api/health` 返回 200（HTTPS）
- [ ] 浏览器打开三个域名都能正常访问
- [ ] 没有任何 HTTPS 警告或混合内容错误

---

## 最后一步（可选）：配置 GitHub CI/CD

配置自动部署（用户在完成部署后操作）：

在 GitHub repo Settings → Secrets and variables → Actions 添加：

```
DOCKER_USERNAME         = 用户的 Docker Hub 用户名
DOCKER_PASSWORD         = Docker Hub Personal Access Token
SSH_PRIVATE_KEY         = CVM SSH 私钥（cat ~/.ssh/id_rsa）
CVM_IP                  = CVM 公网 IP
CVM_USER                = SSH 用户名（ubuntu 或 root）
```

之后每次 push 到 main 分支会自动触发 GitHub Actions 部署。

---

## 注意事项

1. **DNS 生效** — 确保三个域名的 A 记录已指向 CVM IP（DNS 可能需要 1-2 小时生效）
2. **防火墙规则** — 腾讯云安全组需要开放 80、443 端口
3. **SSL 证书** — Let's Encrypt 证书有效期 90 天，certbot 会自动续期
4. **敏感信息** — `.env.shared.local` / `.env.production` 不要提交到 git（见 `config/README.md`）
5. **监控日志** — 生产环境建议定期查看 `docker compose logs` 排查问题

---

## 参考文档

- Spec 索引: [docs/specs/README.md](../specs/README.md)
- 平台 Spec: [docs/specs/platform.md](../specs/platform.md)
- 操作手册: [DEPLOYMENT.md](../../DEPLOYMENT.md)
- CI/CD: [.github/workflows/deploy.yml](../../.github/workflows/deploy.yml)

