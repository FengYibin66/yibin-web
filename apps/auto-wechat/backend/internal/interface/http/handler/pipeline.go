package handler

import (
	"context"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	"github.com/auto-wechat-tech/backend/internal/application"
	"github.com/auto-wechat-tech/backend/internal/domain"
	"github.com/auto-wechat-tech/backend/internal/infrastructure/mysql"
	"github.com/auto-wechat-tech/backend/internal/interface/http/dto"
	"github.com/auto-wechat-tech/backend/internal/interface/http/response"
)

type PipelineHandler struct {
	service            *application.PipelineService
	digestRepo         *mysql.DigestRepository
	draftRepo          *mysql.ContentDraftRepository
	layoutTemplateRepo *mysql.LayoutTemplateRepository
}

func NewPipelineHandler(
	service *application.PipelineService,
	digestRepo *mysql.DigestRepository,
	draftRepo *mysql.ContentDraftRepository,
	layoutTemplateRepo *mysql.LayoutTemplateRepository,
) *PipelineHandler {
	return &PipelineHandler{
		service:            service,
		digestRepo:         digestRepo,
		draftRepo:          draftRepo,
		layoutTemplateRepo: layoutTemplateRepo,
	}
}

func (h *PipelineHandler) CreateRun(c *gin.Context) {
	var req dto.CreateRunRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, 40000, "invalid request body")
		return
	}

	run, err := h.service.CreateRun(c.Request.Context(), application.CreateRunCommand{
		PublishMode: req.PublishMode,
		TriggeredBy: "api",
	})
	if err != nil {
		response.Error(c, http.StatusInternalServerError, 50000, err.Error())
		return
	}

	response.Created(c, dto.ToPipelineRunResponse(run, nil, nil, h.layoutTemplateName(c.Request.Context(), run.LayoutTemplateID)))
}

func (h *PipelineHandler) UpdateRunLayoutTemplate(c *gin.Context) {
	id := c.Param("id")
	var req dto.UpdateRunLayoutTemplateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, 40000, "invalid request body")
		return
	}

	run, err := h.service.UpdateRunLayoutTemplate(c.Request.Context(), id, application.UpdateRunLayoutTemplateCommand{
		LayoutTemplateID: req.LayoutTemplateID,
		UseGlobalDefault: req.UseGlobalDefault,
		ClearTemplate:    req.ClearTemplate,
	})
	if err != nil {
		if err == mysql.ErrNotFound {
			response.Error(c, http.StatusNotFound, 40400, "run or template not found")
			return
		}
		response.Error(c, http.StatusBadRequest, 40001, err.Error())
		return
	}

	digest := h.loadDigest(c.Request.Context(), id)
	draft := h.loadDraft(c.Request.Context(), id)
	response.OK(c, dto.ToPipelineRunResponse(run, digest, draft, h.layoutTemplateName(c.Request.Context(), run.LayoutTemplateID)))
}

func (h *PipelineHandler) GetRun(c *gin.Context) {
	id := c.Param("id")
	run, err := h.service.GetRun(c.Request.Context(), id)
	if err != nil {
		if err == mysql.ErrNotFound {
			response.Error(c, http.StatusNotFound, 40400, "run not found")
			return
		}
		response.Error(c, http.StatusInternalServerError, 50000, err.Error())
		return
	}

	digest := h.loadDigest(c.Request.Context(), id)
	draft := h.loadDraft(c.Request.Context(), id)
	response.OK(c, dto.ToPipelineRunResponse(run, digest, draft, h.layoutTemplateName(c.Request.Context(), run.LayoutTemplateID)))
}

func (h *PipelineHandler) ListRuns(c *gin.Context) {
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	runs, err := h.service.ListRuns(c.Request.Context(), limit, offset)
	if err != nil {
		response.Error(c, http.StatusInternalServerError, 50000, err.Error())
		return
	}

	items := make([]dto.PipelineRunResponse, 0, len(runs))
	for _, run := range runs {
		digest := h.loadDigest(c.Request.Context(), run.ID)
		draft := h.loadDraft(c.Request.Context(), run.ID)
		items = append(items, dto.ToPipelineRunResponse(run, digest, draft, h.layoutTemplateName(c.Request.Context(), run.LayoutTemplateID)))
	}

	response.OK(c, items)
}

func (h *PipelineHandler) DeleteRun(c *gin.Context) {
	id := c.Param("id")
	if err := h.service.DeleteRun(c.Request.Context(), id); err != nil {
		if err == mysql.ErrNotFound {
			response.Error(c, http.StatusNotFound, 40400, "run not found")
			return
		}
		response.Error(c, http.StatusInternalServerError, 50000, err.Error())
		return
	}
	response.OK(c, gin.H{"deleted": true, "runId": id})
}

func (h *PipelineHandler) loadDigest(ctx context.Context, runID string) *domain.Digest {
	digest, err := h.digestRepo.GetByRunID(ctx, runID)
	if err != nil {
		return nil
	}
	return &digest
}

func (h *PipelineHandler) loadDraft(ctx context.Context, runID string) *domain.ContentDraft {
	draft, err := h.draftRepo.GetByRunID(ctx, runID)
	if err != nil {
		return nil
	}
	return &draft
}

func (h *PipelineHandler) layoutTemplateName(ctx context.Context, templateID *string) *string {
	if templateID == nil || *templateID == "" || h.layoutTemplateRepo == nil {
		return nil
	}
	tmpl, err := h.layoutTemplateRepo.GetByID(ctx, *templateID)
	if err != nil {
		return nil
	}
	name := tmpl.Name
	return &name
}

type SourceHandler struct {
	sourceRepo *mysql.SourceRepository
}

func NewSourceHandler(sourceRepo *mysql.SourceRepository) *SourceHandler {
	return &SourceHandler{sourceRepo: sourceRepo}
}

func (h *SourceHandler) List(c *gin.Context) {
	sources, err := h.sourceRepo.ListEnabled(c.Request.Context())
	if err != nil {
		response.Error(c, http.StatusInternalServerError, 50000, err.Error())
		return
	}
	response.OK(c, sources)
}
