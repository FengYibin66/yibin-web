package handler

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	"github.com/auto-wechat-tech/backend/internal/application"
	"github.com/auto-wechat-tech/backend/internal/domain"
	"github.com/auto-wechat-tech/backend/internal/infrastructure/mysql"
	"github.com/auto-wechat-tech/backend/internal/interface/http/dto"
	"github.com/auto-wechat-tech/backend/internal/interface/http/response"
)

type ArtifactHandler struct {
	service *application.ArtifactService
}

func NewArtifactHandler(service *application.ArtifactService) *ArtifactHandler {
	return &ArtifactHandler{service: service}
}

func (h *ArtifactHandler) GetArtifacts(c *gin.Context) {
	runID := c.Param("id")
	artifacts, err := h.service.GetArtifacts(c.Request.Context(), runID)
	if err != nil {
		if err == mysql.ErrNotFound {
			response.Error(c, http.StatusNotFound, 40400, "run not found")
			return
		}
		response.Error(c, http.StatusInternalServerError, 50000, err.Error())
		return
	}
	response.OK(c, dto.ToRunArtifactsResponse(artifacts))
}

func (h *ArtifactHandler) GetStep(c *gin.Context) {
	runID := c.Param("id")
	step := domain.PipelineStep(c.Param("step"))

	detail, err := h.service.GetStep(c.Request.Context(), runID, step)
	if err != nil {
		if err == mysql.ErrNotFound {
			response.Error(c, http.StatusNotFound, 40400, "step not found")
			return
		}
		response.Error(c, http.StatusInternalServerError, 50000, err.Error())
		return
	}

	response.OK(c, dto.StepDetailResponse{
		Step:         string(detail.Step),
		Status:       string(detail.Status),
		Input:        detail.InputJSON,
		Output:       detail.OutputJSON,
		ErrorMessage: detail.ErrorMessage,
		DurationMs:   detail.DurationMs,
		StartedAt:    dto.FormatTimePtr(detail.StartedAt),
		FinishedAt:   dto.FormatTimePtr(detail.FinishedAt),
	})
}

func (h *ArtifactHandler) RegenerateStep(c *gin.Context) {
	runID := c.Param("id")
	step := domain.PipelineStep(c.Param("step"))

	replace, _ := strconv.ParseBool(c.Query("replace"))
	if c.Query("replace") == "1" {
		replace = true
	}

	if err := h.service.RegenerateStep(c.Request.Context(), runID, step, replace); err != nil {
		if err == mysql.ErrNotFound {
			response.Error(c, http.StatusNotFound, 40400, "run not found")
			return
		}
		if errors.Is(err, application.ErrRunReplaceRequired) {
			response.Error(c, http.StatusConflict, 40901, err.Error())
			return
		}
		response.Error(c, http.StatusInternalServerError, 50000, err.Error())
		return
	}

	affected := make([]string, 0, len(domain.StepsFrom(step)))
	for _, s := range domain.StepsFrom(step) {
		affected = append(affected, string(s))
	}
	response.OK(c, gin.H{
		"runId":          runID,
		"step":           step,
		"status":         "running",
		"affectedSteps":  affected,
		"cascade":        true,
	})
}

func (h *ArtifactHandler) UpdateDraft(c *gin.Context) {
	runID := c.Param("id")
	var req dto.UpdateDraftRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, 40000, "invalid request body")
		return
	}

	draft, err := h.service.UpdateDraft(c.Request.Context(), runID, dto.ToUpdateDraftInput(req))
	if err != nil {
		if err == mysql.ErrNotFound {
			response.Error(c, http.StatusNotFound, 40400, "draft not found")
			return
		}
		response.Error(c, http.StatusInternalServerError, 50000, err.Error())
		return
	}

	response.OK(c, dto.ToContentDraftResponse(draft))
}

func (h *ArtifactHandler) UpdateDigest(c *gin.Context) {
	runID := c.Param("id")
	var req dto.UpdateDigestRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, 40000, "invalid request body")
		return
	}

	digest, err := h.service.UpdateDigestItems(c.Request.Context(), runID, dto.ToRankedItems(req.Items))
	if err != nil {
		if err == mysql.ErrNotFound {
			response.Error(c, http.StatusNotFound, 40400, "digest not found")
			return
		}
		response.Error(c, http.StatusInternalServerError, 50000, err.Error())
		return
	}

	response.OK(c, dto.ToDigestResponse(digest))
}

func (h *ArtifactHandler) PublishRun(c *gin.Context) {
	runID := c.Param("id")
	var req dto.PublishRunRequest
	_ = c.ShouldBindJSON(&req)

	record, err := h.service.PublishRun(c.Request.Context(), runID, domain.PublishRunInput{
		ReadSourcePresetID: req.ReadSourcePresetID,
	})
	if err != nil {
		response.Error(c, http.StatusInternalServerError, 50000, err.Error())
		return
	}
	response.OK(c, dto.ToPublishResultResponse(record))
}
