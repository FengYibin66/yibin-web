package handler

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/auto-wechat-tech/backend/internal/application"
	"github.com/auto-wechat-tech/backend/internal/domain"
	"github.com/auto-wechat-tech/backend/internal/infrastructure/mysql"
	"github.com/auto-wechat-tech/backend/internal/interface/http/dto"
	"github.com/auto-wechat-tech/backend/internal/interface/http/response"
)

type ReadSourcePresetHandler struct {
	service *application.ReadSourcePresetService
}

func NewReadSourcePresetHandler(service *application.ReadSourcePresetService) *ReadSourcePresetHandler {
	return &ReadSourcePresetHandler{service: service}
}

func (h *ReadSourcePresetHandler) List(c *gin.Context) {
	presets, err := h.service.List(c.Request.Context())
	if err != nil {
		response.Error(c, http.StatusInternalServerError, 50000, err.Error())
		return
	}
	response.OK(c, dto.ToReadSourcePresetListResponse(presets))
}

func (h *ReadSourcePresetHandler) Create(c *gin.Context) {
	var req dto.CreateReadSourcePresetRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, 40000, "invalid request body")
		return
	}
	preset, err := h.service.Create(c.Request.Context(), domain.CreateReadSourcePresetInput{
		Label: req.Label,
		URL:   req.URL,
	})
	if err != nil {
		response.Error(c, http.StatusBadRequest, 40001, err.Error())
		return
	}
	response.OK(c, dto.ToReadSourcePresetResponse(preset))
}

func (h *ReadSourcePresetHandler) Delete(c *gin.Context) {
	id := c.Param("id")
	if err := h.service.Delete(c.Request.Context(), id); err != nil {
		if errors.Is(err, application.ErrReadSourcePresetMinRemaining) {
			response.Error(c, http.StatusBadRequest, 40002, err.Error())
			return
		}
		if err == mysql.ErrNotFound {
			response.Error(c, http.StatusNotFound, 40400, "preset not found")
			return
		}
		response.Error(c, http.StatusBadRequest, 40001, err.Error())
		return
	}
	response.OK(c, gin.H{"deleted": true, "id": id})
}
