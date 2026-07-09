# Troubleshooting Production Deployment

## Container Issues

### Containers Won't Start

```bash
# Check logs for all services
docker compose -f docker-compose.prod.yml logs

# Logs for specific service
docker compose -f docker-compose.prod.yml logs portal-server
docker compose -f docker-compose.prod.yml logs auto-wechat-api
docker compose -f docker-compose.prod.yml logs mysql

# Watch logs in real-time
docker compose -f docker-compose.prod.yml logs -f nginx
```

### Restart a Specific Service

```bash
docker compose -f docker-compose.prod.yml restart portal-server
docker compose -f docker-compose.prod.yml restart auto-wechat-api
```

### Check Resource Usage

```bash
docker stats
# If memory/CPU constrained, adjust mem_limit in docker-compose.prod.yml
```

---

## Database Issues

### Portal Server Cannot Connect to MySQL

```bash
# Test MySQL health
docker compose -f docker-compose.prod.yml exec mysql mysqladmin ping -h 127.0.0.1

# Test connectivity from portal container
docker compose -f docker-compose.prod.yml exec portal-server \
  mysql -h mysql -u root -p$MYSQL_ROOT_PASSWORD -e "SELECT 1"

# Check database URL
docker compose -f docker-compose.prod.yml exec portal-server env | grep DATABASE_URL
```

### MySQL Authentication Error

```bash
# Reset MySQL user password
docker compose -f docker-compose.prod.yml exec mysql \
  mysql -u root -p$MYSQL_ROOT_PASSWORD \
  -e "ALTER USER 'wechat'@'%' IDENTIFIED BY '$MYSQL_PASSWORD'; FLUSH PRIVILEGES;"
```

---

## Nginx Issues

### Nginx Returns 502 Bad Gateway

**Cause:** Backend service not responding

```bash
# 1. Check backend services are running
docker compose -f docker-compose.prod.yml ps

# 2. Verify backend health
docker compose -f docker-compose.prod.yml exec portal-server curl -f http://localhost:3001/health
docker compose -f docker-compose.prod.yml exec auto-wechat-api curl -f http://localhost:8080/api/v1/health

# 3. Check Nginx config
docker compose -f docker-compose.prod.yml exec nginx nginx -t

# 4. View Nginx error logs
docker compose -f docker-compose.prod.yml logs nginx
```

### Cannot Reach Website by Domain

```bash
# Check if DNS resolves
nslookup www.yibinfeng.com

# Verify Nginx is listening on 80/443
netstat -tuln | grep -E ':(80|443)'

# Test local access
curl -i http://localhost/
curl -i https://www.yibinfeng.com/ (from local machine if DNS works)
```

---

## SSL Certificate Issues

### Certificate Expired or Invalid

```bash
# Check certificate status
sudo certbot certificates

# Manually renew
sudo certbot renew

# Force renewal
sudo certbot renew --force-renewal

# View cert details
sudo openssl x509 -in /etc/letsencrypt/live/www.yibinfeng.com/cert.pem -text -noout
```

### HTTPS Connection Fails

```bash
# Verify certificate files exist
ls -la /etc/letsencrypt/live/www.yibinfeng.com/

# Test TLS connection
openssl s_client -connect www.yibinfeng.com:443

# Reload Nginx after cert renewal
docker compose -f docker-compose.prod.yml exec nginx nginx -s reload
```

---

## Redis Issues

### Redis Not Responding

```bash
# Check Redis health
docker compose -f docker-compose.prod.yml exec redis redis-cli ping

# View Redis logs
docker compose -f docker-compose.prod.yml logs redis

# Check memory usage
docker compose -f docker-compose.prod.yml exec redis redis-cli INFO memory
```

### Redis Memory Full

```bash
# Check maxmemory policy
docker compose -f docker-compose.prod.yml exec redis redis-cli CONFIG GET maxmemory-policy

# Clear old sessions/cache
docker compose -f docker-compose.prod.yml exec redis redis-cli FLUSHDB
```

---

## API Issues

### Auto-Wechat API Errors

```bash
# Test API health endpoint
curl https://mpauto.yibinfeng.com/api/v1/health

# Check API logs
docker compose -f docker-compose.prod.yml logs auto-wechat-api

# Verify API can reach Redis
docker compose -f docker-compose.prod.yml exec auto-wechat-api \
  curl -s http://redis:6379 | head

# Verify API can reach MySQL
docker compose -f docker-compose.prod.yml exec auto-wechat-api \
  mysql -h mysql -u wechat -p$MYSQL_PASSWORD -e "SELECT 1"
```

### LLM Service Not Responding

```bash
# Check Python service health
docker compose -f docker-compose.prod.yml logs llm-service

# Test LLM endpoint
curl -X POST http://localhost:8090/v1/completions
```

---

## Disk Space Issues

```bash
# Check disk usage
df -h

# Check Docker usage
docker system df

# Clean up unused images/volumes
docker image prune -f
docker volume prune -f

# Remove dangling images
docker rmi $(docker images -f "dangling=true" -q)
```

---

## Network Issues

### Services Cannot Communicate

```bash
# Check Docker network
docker network ls
docker network inspect yibin-net

# Test connectivity between containers
docker compose -f docker-compose.prod.yml exec portal-server ping mysql
docker compose -f docker-compose.prod.yml exec auto-wechat-api ping redis

# Check if ports are correctly exposed
docker compose -f docker-compose.prod.yml port
```

---

## Recovery Steps

### Full Restart

```bash
# Stop everything
docker compose -f docker-compose.prod.yml down

# Wait 10 seconds
sleep 10

# Start everything again
docker compose -f docker-compose.prod.yml up -d --build

# Verify
docker compose -f docker-compose.prod.yml ps
```

### Reset Everything (⚠️ Destructive — loses all data!)

```bash
# Stop & remove everything including volumes
docker compose -f docker-compose.prod.yml down -v

# Wait
sleep 10

# Rebuild from scratch
docker compose -f docker-compose.prod.yml up -d --build

# Recreate databases (if you have backup SQL)
# docker compose -f docker-compose.prod.yml exec mysql \
#   mysql -u root -p$MYSQL_ROOT_PASSWORD < backup.sql
```

---

## Monitoring & Health Checks

### Enable Live Monitoring

```bash
# Watch container status in real-time
watch -n 2 'docker compose -f docker-compose.prod.yml ps'

# Monitor resource usage
docker stats --no-stream
```

### Set Up Automatic Alerts

Consider integrating:
- Datadog (APM + alerts)
- Prometheus + Grafana (metrics)
- ELK Stack (logs aggregation)

---

## When to Escalate

If none of the above steps work:

1. Collect logs: `docker compose -f docker-compose.prod.yml logs > /tmp/deploy_logs.txt`
2. Check GitHub Issues or contact the team
3. Consider rolling back to a previous working version

---

## See Also

- [AGENT_PROMPT.md](./AGENT_PROMPT.md) — Full deployment guide
- [MAINTENANCE.md](./MAINTENANCE.md) — Regular maintenance tasks
- [../../DEPLOYMENT.md](../../DEPLOYMENT.md) — Production overview
