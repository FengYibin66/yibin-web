package dto

import (
	"time"

	"github.com/auto-wechat-tech/backend/internal/domain"
)

type PipelineRunStepResponse struct {
	Step         string  `json:"step"`
	Status       string  `json:"status"`
	StartedAt    *string `json:"startedAt"`
	FinishedAt   *string `json:"finishedAt"`
	ErrorMessage *string `json:"errorMessage"`
}

type PipelineRunResponse struct {
	ID              string                    `json:"id"`
	Status          string                    `json:"status"`
	PublishMode     string                    `json:"publishMode"`
	CreatedAt       string                    `json:"createdAt"`
	UpdatedAt       string                    `json:"updatedAt"`
	FinishedAt      *string                   `json:"finishedAt"`
	ErrorMessage    *string                   `json:"errorMessage"`
	Steps           []PipelineRunStepResponse `json:"steps"`
	DraftMediaID        *string                   `json:"draftMediaId"`
	PreviewHTML         *string                   `json:"previewHtml"`
	LayoutTemplateID    *string                   `json:"layoutTemplateId"`
	LayoutTemplateName  *string                   `json:"layoutTemplateName,omitempty"`
	DigestID            *string                   `json:"digestId,omitempty"`
	DigestItemCount *int                      `json:"digestItemCount,omitempty"`
	ContentDraftID  *string                   `json:"contentDraftId,omitempty"`
}

type CreateRunRequest struct {
	PublishMode string `json:"publishMode"`
}

type UpdateRunLayoutTemplateRequest struct {
	LayoutTemplateID *string `json:"layoutTemplateId"`
	UseGlobalDefault bool    `json:"useGlobalDefault"`
	ClearTemplate    bool    `json:"clearTemplate"`
}

func ToPipelineRunResponse(run domain.PipelineRun, digest *domain.Digest, draft *domain.ContentDraft, layoutTemplateName *string) PipelineRunResponse {
	steps := make([]PipelineRunStepResponse, 0, len(run.Steps))
	for _, step := range run.Steps {
		steps = append(steps, PipelineRunStepResponse{
			Step:         string(step.Step),
			Status:       string(step.Status),
			StartedAt:    formatTimePtr(step.StartedAt),
			FinishedAt:   formatTimePtr(step.FinishedAt),
			ErrorMessage: step.ErrorMessage,
		})
	}

	resp := PipelineRunResponse{
		ID:                 run.ID,
		Status:             string(run.Status),
		PublishMode:        run.PublishMode,
		CreatedAt:          run.CreatedAt.UTC().Format(time.RFC3339),
		UpdatedAt:          run.UpdatedAt.UTC().Format(time.RFC3339),
		FinishedAt:         formatTimePtr(run.FinishedAt),
		ErrorMessage:       run.ErrorMessage,
		Steps:              steps,
		DraftMediaID:       run.DraftMediaID,
		PreviewHTML:        run.PreviewHTML,
		LayoutTemplateID:   run.LayoutTemplateID,
		LayoutTemplateName: layoutTemplateName,
	}

	if digest != nil {
		resp.DigestID = &digest.ID
		count := len(digest.Items)
		resp.DigestItemCount = &count
	}

	if draft != nil {
		resp.ContentDraftID = &draft.ID
	}

	return resp
}

func formatTimePtr(value *time.Time) *string {
	if value == nil {
		return nil
	}
	formatted := value.UTC().Format(time.RFC3339)
	return &formatted
}

func FormatTimePtr(value *time.Time) *string {
	return formatTimePtr(value)
}
