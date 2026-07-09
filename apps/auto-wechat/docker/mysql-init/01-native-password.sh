#!/bin/bash
# Sequel Ace 等本地 GUI 默认不走 SSL；确保开发账号使用 mysql_native_password。
# 仅在数据卷首次初始化时执行（/docker-entrypoint-initdb.d）。
# 密码来自 compose 注入的 MYSQL_* 环境变量，禁止硬编码。

set -e

mysql -uroot -p"${MYSQL_ROOT_PASSWORD}" <<-EOSQL
  ALTER USER 'wechat'@'%' IDENTIFIED WITH mysql_native_password BY '${MYSQL_PASSWORD}';
  CREATE USER IF NOT EXISTS 'wechat'@'localhost' IDENTIFIED WITH mysql_native_password BY '${MYSQL_PASSWORD}';
  GRANT ALL PRIVILEGES ON wechat_ai.* TO 'wechat'@'localhost';
  FLUSH PRIVILEGES;
EOSQL
