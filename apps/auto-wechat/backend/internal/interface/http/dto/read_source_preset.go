package dto

import (
	"time"

	"github.com/auto-wechat-tech/backend/internal/domain"
)

type ReadSourcePresetResponse struct {
	ID        string `json:"id"`
	Label     string `json:"label"`
	URL       string `json:"url"`
	SortOrder int    `json:"sortOrder"`
	CreatedAt string `json:"createdAt,omitempty"`
}

type ReadSourcePresetListResponse struct {
	Items []ReadSourcePresetResponse `json:"items"`
}

type CreateReadSourcePresetRequest struct {
	Label string `json:"label"`
	URL   string `json:"url"`
}

type PublishRunRequest struct {
	ReadSourcePresetID *string `json:"readSourcePresetId"`
}

func ToReadSourcePresetResponse(preset domain.ReadSourcePreset) ReadSourcePresetResponse {
	resp := ReadSourcePresetResponse{
		ID:        preset.ID,
		Label:     preset.Label,
		URL:       preset.URL,
		SortOrder: preset.SortOrder,
	}
	if !preset.CreatedAt.IsZero() {
		resp.CreatedAt = preset.CreatedAt.UTC().Format(time.RFC3339)
	}
	return resp
}

func ToReadSourcePresetListResponse(presets []domain.ReadSourcePreset) ReadSourcePresetListResponse {
	items := make([]ReadSourcePresetResponse, 0, len(presets))
	for _, preset := range presets {
		items = append(items, ToReadSourcePresetResponse(preset))
	}
	return ReadSourcePresetListResponse{Items: items}
}
