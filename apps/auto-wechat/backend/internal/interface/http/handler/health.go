package handler

import (
	"context"
	"database/sql"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	goredis "github.com/redis/go-redis/v9"

	"github.com/auto-wechat-tech/backend/internal/infrastructure/llmclient"
	"github.com/auto-wechat-tech/backend/internal/infrastructure/mysql"
	"github.com/auto-wechat-tech/backend/internal/interface/http/response"
)

type HealthHandler struct {
	db        *sql.DB
	redis     *goredis.Client
	llmClient *llmclient.Client
}

func NewHealthHandler(db *sql.DB, redis *goredis.Client, llmClient *llmclient.Client) *HealthHandler {
	return &HealthHandler{
		db:        db,
		redis:     redis,
		llmClient: llmClient,
	}
}

func (h *HealthHandler) Live(c *gin.Context) {
	response.OK(c, gin.H{"status": "ok"})
}

func (h *HealthHandler) Ready(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	checks := gin.H{
		"database": "ok",
		"redis":    "ok",
		"llm":      "ok",
	}

	if err := mysql.Ping(ctx, h.db); err != nil {
		checks["database"] = err.Error()
		response.Error(c, http.StatusServiceUnavailable, 50300, "not ready")
		return
	}

	if err := h.redis.Ping(ctx).Err(); err != nil {
		checks["redis"] = err.Error()
		response.Error(c, http.StatusServiceUnavailable, 50300, "not ready")
		return
	}

	if err := h.llmClient.Health(ctx); err != nil {
		checks["llm"] = err.Error()
		response.Error(c, http.StatusServiceUnavailable, 50300, "not ready")
		return
	}

	response.OK(c, checks)
}
