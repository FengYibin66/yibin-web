# Production Maintenance Guide

## Daily Checks

### Health Status

```bash
cd /data/yibin-web

# Verify all services running
docker compose -f docker-compose.prod.yml ps

# Expect: All 7 services with status "Up"
```

### Error Log Monitoring

```bash
# Check for recent errors (last 50 lines)
docker compose -f docker-compose.prod.yml logs --tail=50 | grep -i error

# Monitor specific service
docker compose -f docker-compose.prod.yml logs --tail=100 nginx
```

### SSL Certificate Expiry

```bash
# Check remaining days
sudo certbot certificates

# Certbot auto-renewal runs daily via cron (no action needed)
# But verify occasionally to be safe
```

---

## Weekly Tasks

### Database Backup

```bash
# Manual backup (supplement to automated backups)
cd /data/yibin-web

docker compose -f docker-compose.prod.yml exec -T mysql \
  mysqldump -u root -p$MYSQL_ROOT_PASSWORD wechat_ai \
  > /data/backups/backup_$(date +%Y%m%d_%H%M%S).sql

# Keep backups for 30 days
find /data/backups -name "backup_*.sql" -mtime +30 -delete
```

### Redis Cache Status

```bash
# Check memory usage
docker compose -f docker-compose.prod.yml exec redis redis-cli INFO memory

# Expected: Used memory should be < 80% of maxmemory
# If > 90%, consider clearing old keys or increasing memory limit
```

### Review Application Logs

```bash
# Portal Server logs
docker compose -f docker-compose.prod.yml logs --since 7d portal-server | head -50

# Auto-Wechat API logs
docker compose -f docker-compose.prod.yml logs --since 7d auto-wechat-api | head -50

# Look for warnings, errors, or anomalies
```

---

## Monthly Tasks

### Full System Backup

```bash
# Backup database with timestamp
BACKUP_FILE="/data/backups/monthly_backup_$(date +%Y%m%d).sql"

docker compose -f docker-compose.prod.yml exec -T mysql \
  mysqldump -u root -p$MYSQL_ROOT_PASSWORD --all-databases \
  > $BACKUP_FILE

# Verify backup integrity
mysql -u root -p$MYSQL_ROOT_PASSWORD < $BACKUP_FILE --dry-run

# Compress for long-term storage
gzip $BACKUP_FILE
```

### Storage Cleanup

```bash
# Remove old logs (keep 90 days)
docker system prune --filter "until=2160h" -f

# Check disk usage
du -sh /data
du -sh /data/backups

# Remove old backups (keep 6 months)
find /data/backups -name "*.sql.gz" -mtime +180 -delete
```

### Docker Image Updates

```bash
# Check for new base image versions
docker pull nginx:alpine
docker pull mysql:8.4
docker pull redis:7-alpine

# Rebuild if new versions are important
docker compose -f docker-compose.prod.yml build --no-cache

# Or update one service
docker compose -f docker-compose.prod.yml build --no-cache nginx
docker compose -f docker-compose.prod.yml up -d nginx
```

---

## Deployment Updates

### Update Application Code

```bash
cd /data/yibin-web

# Pull latest changes
git pull origin main

# Rebuild & restart
docker compose -f docker-compose.prod.yml up -d --build

# Verify
docker compose -f docker-compose.prod.yml ps
```

### Update Environment Variables

```bash
# Edit secrets (in .env.shared.local or .env.production)
nano .env.shared.local

# Rebuild environment
./scripts/env-build.sh production

# Restart affected services
docker compose -f docker-compose.prod.yml restart portal-server
docker compose -f docker-compose.prod.yml restart auto-wechat-api
```

### Zero-Downtime Deployment

```bash
# 1. Pull & build new version
git pull && docker compose -f docker-compose.prod.yml build

# 2. Start new containers (without stopping old ones)
docker compose -f docker-compose.prod.yml up -d --no-deps portal-server

# 3. If there are issues, old containers are still running
# 4. Verify new version
docker compose -f docker-compose.prod.yml ps

# 5. If all good, stop old containers (they're already replaced by up -d)
```

---

## Performance Optimization

### Database Query Performance

```bash
# Enable slow query log (temporary)
docker compose -f docker-compose.prod.yml exec mysql \
  mysql -u root -p$MYSQL_ROOT_PASSWORD \
  -e "SET GLOBAL slow_query_log = 'ON'; SET GLOBAL long_query_time = 2;"

# View slow queries
docker compose -f docker-compose.prod.yml exec mysql \
  tail -f /var/log/mysql/slow_queries.log
```

### Redis Memory Optimization

```bash
# Check for large keys
docker compose -f docker-compose.prod.yml exec redis redis-cli --bigkeys

# Delete keys by pattern (e.g., old sessions)
docker compose -f docker-compose.prod.yml exec redis \
  redis-cli KEYS "session:*" | wc -l
```

### Nginx Response Time

```bash
# Check Nginx cache hit rate
docker compose -f docker-compose.prod.yml exec nginx \
  grep "Cache-Status" /var/log/nginx/access.log | sort | uniq -c

# Adjust caching headers in docker/nginx-prod.conf if needed
```

---

## Monitoring Setup

### Enable Prometheus Metrics (Optional)

```bash
# Add to docker-compose.prod.yml:
# (See docker-compose.prod.yml comments for details)

# Then query metrics
curl http://localhost:9090/api/v1/query?query=docker_container_cpu_usage
```

### Grafana Dashboards (Optional)

```bash
# Access Grafana
http://CVM_IP:3000

# Default: admin / admin (change immediately!)
# Add Prometheus data source
# Create dashboards for CPU, Memory, Disk, Network
```

---

## Recovery Procedures

### Rollback to Previous Version

```bash
# If current deployment has critical issues

# 1. Check git history
git log --oneline -5

# 2. Revert to previous version
git revert HEAD

# 3. Rebuild & restart
docker compose -f docker-compose.prod.yml up -d --build

# 4. Verify
curl https://www.yibinfeng.com/api/health
```

### Database Recovery

```bash
# If accidental data deletion, restore from backup

# 1. Stop services
docker compose -f docker-compose.prod.yml down

# 2. List available backups
ls -la /data/backups/

# 3. Restore (example)
docker compose -f docker-compose.prod.yml up -d mysql
sleep 10
docker compose -f docker-compose.prod.yml exec mysql \
  mysql -u root -p$MYSQL_ROOT_PASSWORD < /data/backups/backup_20260701.sql

# 4. Start all services
docker compose -f docker-compose.prod.yml up -d
```

---

## Scheduled Maintenance Windows

Recommended schedule (adjust per your needs):

| Frequency | Task | Duration |
|-----------|------|----------|
| Daily (2 AM) | Certbot auto-renewal check | < 1 min |
| Weekly (Sun 2 AM) | Database backup + cleanup | 5-10 min |
| Monthly (1st, 2 AM) | Full backup + Docker prune | 15-30 min |
| Quarterly | SSL cert renewal test | 5 min |

Configure cron jobs:

```bash
sudo crontab -e

# Add lines:
0 2 * * * cd /data/yibin-web && docker compose -f docker-compose.prod.yml exec -T mysql mysqldump -u root -p$MYSQL_ROOT_PASSWORD wechat_ai > /data/backups/backup_$(date +\%Y\%m\%d).sql
0 3 1 * * docker system prune -af
0 4 * * 0 find /data/backups -name "*.sql.gz" -mtime +180 -delete
```

---

## Alerting Setup

### Email Alerts on Service Failure

```bash
# Install alertmanager or use Datadog/PagerDuty

# Or simple script with cron:
cat > /usr/local/bin/check_health.sh << 'EOF'
#!/bin/bash
if ! curl -f https://www.yibinfeng.com/api/health > /dev/null 2>&1; then
  echo "Portal health check failed" | mail -s "Alert: Portal Down" admin@example.com
fi
EOF

sudo chmod +x /usr/local/bin/check_health.sh

# Add to crontab (every 5 minutes)
# */5 * * * * /usr/local/bin/check_health.sh
```

---

## Incident Response

### Service Down

1. Check status: `docker compose ps`
2. View logs: `docker compose logs --tail=100 <service>`
3. Try restart: `docker compose restart <service>`
4. If persists, see [TROUBLESHOOT.md](./TROUBLESHOOT.md)

### High CPU/Memory

1. Identify: `docker stats`
2. Check limits: `docker inspect <container> | grep Memory`
3. Adjust if needed in docker-compose.prod.yml
4. Restart: `docker compose up -d`

### Disk Full

1. Check: `df -h`
2. Clean: `docker system prune -a`
3. Remove old backups: `find /data/backups -mtime +90 -delete`
4. If persists, add storage to CVM

---

## See Also

- [AGENT_PROMPT.md](./AGENT_PROMPT.md) — Deployment instructions
- [TROUBLESHOOT.md](./TROUBLESHOOT.md) — Problem solving
- [../../DEPLOYMENT.md](../../DEPLOYMENT.md) — Production overview
