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

type LayoutTemplateHandler struct {
	service     *application.LayoutTemplateService
	draftRepo   *mysql.ContentDraftRepository
}

func NewLayoutTemplateHandler(
	service *application.LayoutTemplateService,
	draftRepo *mysql.ContentDraftRepository,
) *LayoutTemplateHandler {
	return &LayoutTemplateHandler{service: service, draftRepo: draftRepo}
}

func (h *LayoutTemplateHandler) List(c *gin.Context) {
	items, err := h.service.List(c.Request.Context())
	if err != nil {
		response.Error(c, http.StatusInternalServerError, 50000, err.Error())
		return
	}
	response.OK(c, dto.ToLayoutTemplateListResponse(items))
}

func (h *LayoutTemplateHandler) Get(c *gin.Context) {
	id := c.Param("id")
	item, err := h.service.GetByID(c.Request.Context(), id)
	if err != nil {
		if errors.Is(err, mysql.ErrNotFound) {
			response.Error(c, http.StatusNotFound, 40400, "template not found")
			return
		}
		response.Error(c, http.StatusInternalServerError, 50000, err.Error())
		return
	}
	response.OK(c, dto.ToLayoutTemplateDetailResponse(item))
}

func (h *LayoutTemplateHandler) Create(c *gin.Context) {
	var req dto.CreateLayoutTemplateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, 40000, "invalid request body")
		return
	}
	item, err := h.service.Create(c.Request.Context(), domain.CreateLayoutTemplateInput{
		Name:         req.Name,
		Description:  req.Description,
		ArticleType:  req.ArticleType,
		Tags:         req.Tags,
		BodyHTML:     req.BodyHTML,
		HasSVG:       req.HasSVG,
		ItemCountMin: req.ItemCountMin,
		ItemCountMax: req.ItemCountMax,
		QualityScore: req.QualityScore,
		IsFeatured:   req.IsFeatured,
	})
	if err != nil {
		response.Error(c, http.StatusBadRequest, 40001, err.Error())
		return
	}
	response.OK(c, dto.ToLayoutTemplateDetailResponse(item))
}

func (h *LayoutTemplateHandler) SaveFromRun(c *gin.Context) {
	runID := c.Param("id")
	var req dto.SaveRunAsLayoutTemplateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, 40000, "invalid request body")
		return
	}
	draft, err := h.draftRepo.GetByRunID(c.Request.Context(), runID)
	if err != nil {
		if errors.Is(err, mysql.ErrNotFound) {
			response.Error(c, http.StatusNotFound, 40400, "draft not found for run")
			return
		}
		response.Error(c, http.StatusInternalServerError, 50000, err.Error())
		return
	}
	if draft.BodyHTML == "" {
		response.Error(c, http.StatusBadRequest, 40001, "draft bodyHtml empty")
		return
	}
	item, err := h.service.CreateFromRunDraft(
		c.Request.Context(),
		req.Name,
		req.Description,
		req.Tags,
		draft.BodyHTML,
		runID,
	)
	if err != nil {
		response.Error(c, http.StatusBadRequest, 40001, err.Error())
		return
	}
	response.OK(c, dto.ToLayoutTemplateDetailResponse(item))
}

func (h *LayoutTemplateHandler) Delete(c *gin.Context) {
	id := c.Param("id")
	if err := h.service.Delete(c.Request.Context(), id); err != nil {
		if errors.Is(err, mysql.ErrNotFound) {
			response.Error(c, http.StatusNotFound, 40400, "template not found")
			return
		}
		response.Error(c, http.StatusInternalServerError, 50000, err.Error())
		return
	}
	response.OK(c, gin.H{"deleted": true})
}

func (h *LayoutTemplateHandler) SetDefault(c *gin.Context) {
	id := c.Param("id")
	item, err := h.service.SetDefault(c.Request.Context(), id)
	if err != nil {
		if errors.Is(err, mysql.ErrNotFound) {
			response.Error(c, http.StatusNotFound, 40400, "template not found")
			return
		}
		response.Error(c, http.StatusInternalServerError, 50000, err.Error())
		return
	}
	response.OK(c, dto.ToLayoutTemplateDetailResponse(item))
}
