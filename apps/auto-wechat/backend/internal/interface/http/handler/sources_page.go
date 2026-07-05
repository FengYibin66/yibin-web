package handler

import (
	"encoding/json"
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/auto-wechat-tech/backend/internal/domain"
	"github.com/auto-wechat-tech/backend/internal/infrastructure/mysql"
	"github.com/auto-wechat-tech/backend/internal/wechatarticle"
)

type SourcesPageHandler struct {
	pipelineRepo *mysql.PipelineRepository
	digestRepo   *mysql.DigestRepository
	draftRepo    *mysql.ContentDraftRepository
}

func NewSourcesPageHandler(
	pipelineRepo *mysql.PipelineRepository,
	digestRepo *mysql.DigestRepository,
	draftRepo *mysql.ContentDraftRepository,
) *SourcesPageHandler {
	return &SourcesPageHandler{
		pipelineRepo: pipelineRepo,
		digestRepo:   digestRepo,
		draftRepo:    draftRepo,
	}
}

func (h *SourcesPageHandler) Render(c *gin.Context) {
	runID := c.Param("id")
	if runID == "" {
		c.String(http.StatusNotFound, "run not found")
		return
	}

	if _, err := h.pipelineRepo.GetRun(c.Request.Context(), runID); err != nil {
		if err == mysql.ErrNotFound {
			c.String(http.StatusNotFound, "run not found")
			return
		}
		c.String(http.StatusInternalServerError, "failed to load run")
		return
	}

	var items []domain.RankedItem
	if digest, err := h.digestRepo.GetByRunID(c.Request.Context(), runID); err == nil {
		items = digest.Items
	}

	writer := domain.WriterOutput{}
	if step, err := h.pipelineRepo.GetStepDetail(c.Request.Context(), runID, domain.StepWriter); err == nil {
		if w, err := parseWriterFromStep(step.OutputJSON); err == nil {
			writer = w
		}
	}

	title := ""
	if draft, err := h.draftRepo.GetByRunID(c.Request.Context(), runID); err == nil {
		title = draft.Title
	}
	if title == "" {
		title = writer.Title
	}

	refs := wechatarticle.CollectSourceRefs(writer, items)
	html := wechatarticle.RenderSourcesPageHTML(title, refs)
	c.Data(http.StatusOK, "text/html; charset=utf-8", []byte(html))
}

func parseWriterFromStep(raw []byte) (domain.WriterOutput, error) {
	if len(raw) == 0 {
		return domain.WriterOutput{}, nil
	}
	var writer domain.WriterOutput
	if err := json.Unmarshal(raw, &writer); err != nil {
		return domain.WriterOutput{}, err
	}
	return writer, nil
}
