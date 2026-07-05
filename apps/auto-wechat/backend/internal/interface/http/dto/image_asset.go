package dto

import (
	"time"

	"github.com/auto-wechat-tech/backend/internal/domain"
)

type ImageAssetResponse struct {
	ID           string                 `json:"id"`
	Name         string                 `json:"name"`
	URL          string                 `json:"url"`
	Storage      string                 `json:"storage"`
	Source       string                 `json:"source"`
	OriginURL    string                 `json:"originUrl,omitempty"`
	Prompt       string                 `json:"prompt,omitempty"`
	MimeType     string                 `json:"mimeType"`
	ByteSize     int                    `json:"byteSize"`
	Width        int                    `json:"width,omitempty"`
	Height       int                    `json:"height,omitempty"`
	ContentHash  string                 `json:"contentHash"`
	Tags         []string               `json:"tags,omitempty"`
	Provenance   domain.ImageProvenance `json:"provenance,omitempty"`
	UsageCount   int                    `json:"usageCount"`
	AutoIngested bool                   `json:"autoIngested"`
	CreatedAt    time.Time              `json:"createdAt"`
	UpdatedAt    time.Time              `json:"updatedAt"`
}

type ImageAssetListResponse struct {
	Items []ImageAssetResponse `json:"items"`
}

func ToImageAssetResponse(item domain.ImageAsset) ImageAssetResponse {
	return ImageAssetResponse{
		ID:           item.ID,
		Name:         item.Name,
		URL:          item.URL,
		Storage:      string(item.Storage),
		Source:       string(item.Source),
		OriginURL:    item.OriginURL,
		Prompt:       item.Prompt,
		MimeType:     item.MimeType,
		ByteSize:     item.ByteSize,
		Width:        item.Width,
		Height:       item.Height,
		ContentHash:  item.ContentHash,
		Tags:         item.Tags,
		Provenance:   item.Provenance,
		UsageCount:   item.UsageCount,
		AutoIngested: item.AutoIngested,
		CreatedAt:    item.CreatedAt,
		UpdatedAt:    item.UpdatedAt,
	}
}

func ToImageAssetListResponse(items []domain.ImageAsset) ImageAssetListResponse {
	out := make([]ImageAssetResponse, 0, len(items))
	for _, item := range items {
		out = append(out, ToImageAssetResponse(item))
	}
	return ImageAssetListResponse{Items: out}
}
