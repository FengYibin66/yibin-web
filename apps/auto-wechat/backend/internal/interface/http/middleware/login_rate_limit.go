package middleware

import (
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	goredis "github.com/redis/go-redis/v9"

	"github.com/auto-wechat-tech/backend/internal/interface/http/response"
)

const (
	loginRateLimitMax    = 5
	loginRateLimitWindow = time.Minute
)

func LoginRateLimit(redisClient *goredis.Client) gin.HandlerFunc {
	return func(c *gin.Context) {
		if redisClient == nil {
			c.Next()
			return
		}

		key := fmt.Sprintf("login_attempt:%s", c.ClientIP())
		count, err := redisClient.Incr(c.Request.Context(), key).Result()
		if err != nil {
			c.Next()
			return
		}

		if count == 1 {
			_ = redisClient.Expire(c.Request.Context(), key, loginRateLimitWindow).Err()
		}

		if count > loginRateLimitMax {
			response.Error(c, http.StatusTooManyRequests, 42901, "登录尝试过于频繁，请稍后再试")
			c.Abort()
			return
		}

		c.Next()
	}
}
