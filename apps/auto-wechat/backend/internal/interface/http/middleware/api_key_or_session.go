package middleware

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	"github.com/auto-wechat-tech/backend/internal/application"
	"github.com/auto-wechat-tech/backend/internal/interface/http/response"
)

type APIKeyOrSessionConfig struct {
	AdminAPIKey       string
	SessionCookieName string
	AuthService       *application.AuthService
}

func APIKeyOrSessionAuth(cfg APIKeyOrSessionConfig) gin.HandlerFunc {
	return func(c *gin.Context) {
		sessionEnabled := cfg.AuthService != nil && cfg.AuthService.SessionLoginEnabled(c.Request.Context())
		apiKeyEnabled := strings.TrimSpace(cfg.AdminAPIKey) != ""

		if !sessionEnabled && !apiKeyEnabled {
			c.Next()
			return
		}

		if apiKeyEnabled {
			key := strings.TrimSpace(c.GetHeader("X-API-Key"))
			if key == cfg.AdminAPIKey {
				setAuthContext(c, "admin", "admin", "api_key")
				c.Next()
				return
			}
		}

		if sessionEnabled && cfg.SessionCookieName != "" {
			sessionID, err := c.Cookie(cfg.SessionCookieName)
			if err == nil && sessionID != "" {
				session, err := cfg.AuthService.GetSession(c.Request.Context(), sessionID)
				if err == nil {
					setAuthContext(c, session.Username, session.Role, "session")
					c.Next()
					return
				}
			}
		}

		response.Error(c, http.StatusUnauthorized, 40100, "unauthorized")
		c.Abort()
	}
}
