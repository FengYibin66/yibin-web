package handler

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/auto-wechat-tech/backend/internal/application"
	"github.com/auto-wechat-tech/backend/internal/interface/http/dto"
	"github.com/auto-wechat-tech/backend/internal/interface/http/middleware"
	"github.com/auto-wechat-tech/backend/internal/interface/http/response"
)

type AuthHandler struct {
	service    *application.AuthService
	cookieName string
	maxAge     int
	secure     bool
	sameSite   http.SameSite
}

func NewAuthHandler(
	service *application.AuthService,
	cookieName string,
	maxAge int,
	secure bool,
	sameSite http.SameSite,
) *AuthHandler {
	return &AuthHandler{
		service:    service,
		cookieName: cookieName,
		maxAge:     maxAge,
		secure:     secure,
		sameSite:   sameSite,
	}
}

func (h *AuthHandler) Login(c *gin.Context) {
	var req dto.LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, 40000, "invalid request body")
		return
	}

	sessionID, session, err := h.service.Login(c.Request.Context(), req.Username, req.Password)
	if err != nil {
		if errors.Is(err, application.ErrAuthNotConfigured) {
			response.Error(c, http.StatusServiceUnavailable, 50300, "login is not configured")
			return
		}
		if errors.Is(err, application.ErrInvalidCredentials) {
			response.Error(c, http.StatusUnauthorized, 40101, "用户名或密码错误")
			return
		}
		response.Error(c, http.StatusInternalServerError, 50000, err.Error())
		return
	}

	h.setSessionCookie(c, sessionID)
	response.OK(c, dto.AuthUserResponse{
		Username: session.Username,
		Role:     session.Role,
	})
}

func (h *AuthHandler) Logout(c *gin.Context) {
	sessionID, _ := c.Cookie(h.cookieName)
	_ = h.service.Logout(c.Request.Context(), sessionID)
	h.clearSessionCookie(c)
	response.OK(c, gin.H{"ok": true})
}

func (h *AuthHandler) Me(c *gin.Context) {
	username, ok := middleware.AuthUser(c)
	if !ok {
		response.Error(c, http.StatusUnauthorized, 40100, "unauthorized")
		return
	}

	response.OK(c, dto.AuthUserResponse{
		Username: username,
		Role:     middleware.AuthRole(c),
	})
}

func (h *AuthHandler) setSessionCookie(c *gin.Context, sessionID string) {
	c.SetSameSite(h.sameSite)
	c.SetCookie(h.cookieName, sessionID, h.maxAge, "/", "", h.secure, true)
}

func (h *AuthHandler) clearSessionCookie(c *gin.Context) {
	c.SetSameSite(h.sameSite)
	c.SetCookie(h.cookieName, "", -1, "/", "", h.secure, true)
}
