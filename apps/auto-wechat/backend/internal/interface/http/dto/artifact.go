package dto

import (
	"encoding/json"
	"time"

	"github.com/auto-wechat-tech/backend/internal/domain"
)

type RankedItemResponse struct {
	URL       string   `json:"url"`
	Title     string   `json:"title"`
	Score     float64  `json:"score"`
	Reason    string   `json:"reason,omitempty"`
	Summary   string   `json:"summary,omitempty"`
	SummaryZH string   `json:"summaryZh,omitempty"`
	Tags      []string `json:"tags,omitempty"`
	Source    string   `json:"source,omitempty"`
}

type DigestResponse struct {
	ID    string               `json:"id"`
	RunID string               `json:"runId"`
	Items []RankedItemResponse `json:"items"`
	Stats map[string]any       `json:"stats,omitempty"`
}

type ContentDraftResponse struct {
	ID           string         `json:"id"`
	RunID        string         `json:"runId"`
	DigestID     string         `json:"digestId,omitempty"`
	Title        string         `json:"title"`
	Summary      string         `json:"summary"`
	BodyMarkdown string         `json:"bodyMarkdown"`
	BodyHTML     string         `json:"bodyHtml"`
	CoverURL     string         `json:"coverUrl,omitempty"`
	CoverMediaID         string `json:"coverMediaId,omitempty"`
	ReadSourcePresetID   string `json:"readSourcePresetId,omitempty"`
	Status               string `json:"status"`
	Editor       map[string]any `json:"editor,omitempty"`
	Review       map[string]any `json:"review,omitempty"`
}

type StepDetailResponse struct {
	Step         string          `json:"step"`
	Status       string          `json:"status"`
	Input        json.RawMessage `json:"input,omitempty"`
	Output       json.RawMessage `json:"output,omitempty"`
	ErrorMessage *string         `json:"errorMessage"`
	DurationMs   *int            `json:"durationMs"`
	StartedAt    *string         `json:"startedAt"`
	FinishedAt   *string         `json:"finishedAt"`
}

type PublishResultResponse struct {
	DraftMediaID string `json:"draftMediaId"`
	PublishMode  string `json:"publishMode"`
	CreatedAt    string `json:"createdAt,omitempty"`
}

type RunArtifactsResponse struct {
	RunID         string                  `json:"runId"`
	RunStatus     string                  `json:"runStatus"`
	PublishMode   string                  `json:"publishMode"`
	Digest        *DigestResponse         `json:"digest,omitempty"`
	ContentDraft  *ContentDraftResponse   `json:"contentDraft,omitempty"`
	Steps         []StepDetailResponse    `json:"steps"`
	DraftMediaID  *string                 `json:"draftMediaId"`
	PreviewHTML   *string                 `json:"previewHtml"`
	PublishResult *PublishResultResponse  `json:"publishResult,omitempty"`
}

type UpdateDraftRequest struct {
	Title        *string `json:"title"`
	Summary      *string `json:"summary"`
	BodyMarkdown *string `json:"bodyMarkdown"`
	BodyHTML     *string `json:"bodyHtml"`
	CoverURL             *string `json:"coverUrl"`
	ReadSourcePresetID   *string `json:"readSourcePresetId"`
}

type UpdateDigestRequest struct {
	Items []RankedItemResponse `json:"items"`
}

func ToRunArtifactsResponse(artifacts domain.RunArtifacts) RunArtifactsResponse {
	resp := RunArtifactsResponse{
		RunID:        artifacts.RunID,
		RunStatus:    string(artifacts.RunStatus),
		PublishMode:  artifacts.PublishMode,
		Steps:        toStepDetailResponses(artifacts.Steps),
		DraftMediaID: artifacts.DraftMediaID,
		PreviewHTML:  artifacts.PreviewHTML,
	}

	if artifacts.Digest != nil {
		digest := ToDigestResponse(*artifacts.Digest)
		resp.Digest = &digest
	}
	if artifacts.ContentDraft != nil {
		draft := ToContentDraftResponse(*artifacts.ContentDraft)
		resp.ContentDraft = &draft
	}
	if artifacts.PublishResult != nil {
		record := ToPublishResultResponse(*artifacts.PublishResult)
		resp.PublishResult = &record
	}

	return resp
}

func ToDigestResponse(digest domain.Digest) DigestResponse {
	items := make([]RankedItemResponse, 0, len(digest.Items))
	for _, item := range digest.Items {
		items = append(items, RankedItemResponse{
			URL:       item.URL,
			Title:     item.Title,
			Score:     item.Score,
			Reason:    item.Reason,
			Summary:   item.Summary,
			SummaryZH: item.SummaryZH,
			Tags:      item.Tags,
			Source:    item.Source,
		})
	}
	return DigestResponse{
		ID:    digest.ID,
		RunID: digest.RunID,
		Items: items,
		Stats: digest.Stats,
	}
}

func ToContentDraftResponse(draft domain.ContentDraft) ContentDraftResponse {
	return ContentDraftResponse{
		ID:           draft.ID,
		RunID:        draft.RunID,
		DigestID:     draft.DigestID,
		Title:        draft.Title,
		Summary:      draft.Summary,
		BodyMarkdown: draft.BodyMarkdown,
		BodyHTML:     draft.BodyHTML,
		CoverURL:     draft.CoverURL,
		CoverMediaID:       draft.CoverMediaID,
		ReadSourcePresetID: draft.ReadSourcePresetID,
		Status:             draft.Status,
		Editor:       draft.EditorJSON,
		Review:       draft.ReviewJSON,
	}
}

func ToPublishResultResponse(record domain.PublishRecord) PublishResultResponse {
	resp := PublishResultResponse{
		DraftMediaID: record.DraftMediaID,
		PublishMode:  record.PublishMode,
	}
	if !record.CreatedAt.IsZero() {
		resp.CreatedAt = record.CreatedAt.UTC().Format(time.RFC3339)
	}
	return resp
}

func ToRankedItems(items []RankedItemResponse) []domain.RankedItem {
	result := make([]domain.RankedItem, 0, len(items))
	for _, item := range items {
		result = append(result, domain.RankedItem{
			URL:       item.URL,
			Title:     item.Title,
			Score:     item.Score,
			Reason:    item.Reason,
			Summary:   item.Summary,
			SummaryZH: item.SummaryZH,
			Tags:      item.Tags,
			Source:    item.Source,
		})
	}
	return result
}

func toStepDetailResponses(steps []domain.StepDetail) []StepDetailResponse {
	result := make([]StepDetailResponse, 0, len(steps))
	for _, step := range steps {
		result = append(result, StepDetailResponse{
			Step:         string(step.Step),
			Status:       string(step.Status),
			Input:        step.InputJSON,
			Output:       step.OutputJSON,
			ErrorMessage: step.ErrorMessage,
			DurationMs:   step.DurationMs,
			StartedAt:    formatTimePtr(step.StartedAt),
			FinishedAt:   formatTimePtr(step.FinishedAt),
		})
	}
	return result
}

func ToUpdateDraftInput(req UpdateDraftRequest) domain.UpdateDraftInput {
	return domain.UpdateDraftInput{
		Title:        req.Title,
		Summary:      req.Summary,
		BodyMarkdown: req.BodyMarkdown,
		BodyHTML:     req.BodyHTML,
		CoverURL:           req.CoverURL,
		ReadSourcePresetID: req.ReadSourcePresetID,
	}
}
