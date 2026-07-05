package handler

import (
	"errors"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	"github.com/auto-wechat-tech/backend/internal/application"
	redisstore "github.com/auto-wechat-tech/backend/internal/infrastructure/redis"
	"github.com/auto-wechat-tech/backend/internal/infrastructure/mysql"
	"github.com/auto-wechat-tech/backend/internal/interface/http/dto"
	"github.com/auto-wechat-tech/backend/internal/interface/http/response"
	"github.com/auto-wechat-tech/backend/internal/wechatarticle"
)

type WeChatPreviewHandler struct {
	service *application.WeChatPreviewService
}

func NewWeChatPreviewHandler(service *application.WeChatPreviewService) *WeChatPreviewHandler {
	return &WeChatPreviewHandler{service: service}
}

func (h *WeChatPreviewHandler) CreateSession(c *gin.Context) {
	var req dto.CreateWeChatPreviewRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, 40001, err.Error())
		return
	}

	session, err := h.service.CreateSession(c.Request.Context(), application.CreateWeChatPreviewInput{
		Title:            strings.TrimSpace(req.Title),
		BodyHTML:         strings.TrimSpace(req.BodyHTML),
		RunID:            strings.TrimSpace(req.RunID),
		LayoutTemplateID: strings.TrimSpace(req.LayoutTemplateID),
	})
	if err != nil {
		if errors.Is(err, mysql.ErrNotFound) {
			response.Error(c, http.StatusNotFound, 40400, err.Error())
			return
		}
		response.Error(c, http.StatusBadRequest, 40001, err.Error())
		return
	}

	response.OK(c, dto.ToWeChatPreviewSessionResponse(session))
}

func (h *WeChatPreviewHandler) Render(c *gin.Context) {
	token := strings.TrimSpace(c.Param("token"))
	if token == "" {
		c.String(http.StatusNotFound, "preview not found")
		return
	}

	payload, err := h.service.GetPayload(c.Request.Context(), token)
	if err != nil {
		if errors.Is(err, redisstore.ErrPreviewNotFound) {
			c.String(http.StatusNotFound, "预览链接已过期或不存在")
			return
		}
		c.String(http.StatusInternalServerError, "failed to load preview")
		return
	}

	html := wechatarticle.RenderWeChatArticlePreviewHTML(payload.Title, payload.BodyHTML)
	c.Data(http.StatusOK, "text/html; charset=utf-8", []byte(html))
}
