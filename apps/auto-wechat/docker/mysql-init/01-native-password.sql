-- Sequel Ace 等本地 GUI 默认不走 SSL；确保开发账号使用 mysql_native_password。
-- 仅在数据卷首次初始化时执行（/docker-entrypoint-initdb.d）。
-- MySQL 8.4 需 compose 中 --mysql-native-password=ON 后 ALTER 才生效。

ALTER USER 'wechat'@'%' IDENTIFIED WITH mysql_native_password BY 'change_me';
CREATE USER IF NOT EXISTS 'wechat'@'localhost' IDENTIFIED WITH mysql_native_password BY 'change_me';
GRANT ALL PRIVILEGES ON wechat_ai.* TO 'wechat'@'localhost';
ALTER USER 'root'@'%' IDENTIFIED WITH mysql_native_password BY 'root_change_me';
ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY 'root_change_me';
FLUSH PRIVILEGES;
