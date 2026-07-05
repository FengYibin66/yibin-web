package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/auto-wechat-tech/backend/internal/application"
	"github.com/auto-wechat-tech/backend/internal/interface/http/dto"
	"github.com/auto-wechat-tech/backend/internal/interface/http/response"
)

type IllustrationHandler struct {
	service *application.IllustrationService
}

func NewIllustrationHandler(service *application.IllustrationService) *IllustrationHandler {
	return &IllustrationHandler{service: service}
}

type regenerateSlotRequest struct {
	Mode string `json:"mode"`
}

type assignLibraryRequest struct {
	AssetID string `json:"assetId" binding:"required"`
}

func (h *IllustrationHandler) GetOutput(c *gin.Context) {
	runID := c.Param("id")
	out, err := h.service.GetOutput(c.Request.Context(), runID)
	if err != nil {
		response.Error(c, http.StatusNotFound, 40400, err.Error())
		return
	}
	response.OK(c, dto.ToIllustrationOutputResponse(out))
}

func (h *IllustrationHandler) RegenerateSlot(c *gin.Context) {
	runID := c.Param("id")
	slotID := c.Param("slotId")
	var req regenerateSlotRequest
	_ = c.ShouldBindJSON(&req)

	out, err := h.service.RegenerateSlot(c.Request.Context(), runID, slotID, req.Mode)
	if err != nil {
		response.Error(c, http.StatusBadRequest, 40001, err.Error())
		return
	}
	response.OK(c, dto.ToIllustrationOutputResponse(out))
}

func (h *IllustrationHandler) IngestSlot(c *gin.Context) {
	runID := c.Param("id")
	slotID := c.Param("slotId")
	out, asset, err := h.service.IngestSlot(c.Request.Context(), runID, slotID)
	if err != nil {
		response.Error(c, http.StatusBadRequest, 40001, err.Error())
		return
	}
	response.OK(c, gin.H{
		"illustration": dto.ToIllustrationOutputResponse(out),
		"asset":        dto.ToImageAssetResponse(asset),
	})
}

func (h *IllustrationHandler) AssignLibraryAsset(c *gin.Context) {
	runID := c.Param("id")
	slotID := c.Param("slotId")
	var req assignLibraryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, 40000, "invalid request body")
		return
	}
	out, err := h.service.AssignLibraryAsset(c.Request.Context(), runID, slotID, req.AssetID)
	if err != nil {
		response.Error(c, http.StatusBadRequest, 40001, err.Error())
		return
	}
	response.OK(c, dto.ToIllustrationOutputResponse(out))
}
