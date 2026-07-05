package dto

import (
	"time"

	"github.com/auto-wechat-tech/backend/internal/domain"
)

type LayoutTemplateResponse struct {
	ID           string    `json:"id"`
	Name         string    `json:"name"`
	Description  string    `json:"description,omitempty"`
	ArticleType  string    `json:"articleType"`
	Tags         []string  `json:"tags,omitempty"`
	HasSVG       bool      `json:"hasSvg"`
	ItemCountMin int       `json:"itemCountMin"`
	ItemCountMax int       `json:"itemCountMax"`
	QualityScore int       `json:"qualityScore"`
	UsageCount   int       `json:"usageCount"`
	IsFeatured   bool      `json:"isFeatured"`
	IsDefault    bool      `json:"isDefault"`
	SourceRunID  string    `json:"sourceRunId,omitempty"`
	CreatedAt    time.Time `json:"createdAt"`
	UpdatedAt    time.Time `json:"updatedAt"`
}

type LayoutTemplateDetailResponse struct {
	LayoutTemplateResponse
	BodyHTML string `json:"bodyHtml"`
}

type LayoutTemplateListResponse struct {
	Items []LayoutTemplateResponse `json:"items"`
}

type CreateLayoutTemplateRequest struct {
	Name         string   `json:"name" binding:"required"`
	Description  string   `json:"description"`
	ArticleType  string   `json:"articleType"`
	Tags         []string `json:"tags"`
	BodyHTML     string   `json:"bodyHtml" binding:"required"`
	HasSVG       bool     `json:"hasSvg"`
	ItemCountMin int      `json:"itemCountMin"`
	ItemCountMax int      `json:"itemCountMax"`
	QualityScore int      `json:"qualityScore"`
	IsFeatured   bool     `json:"isFeatured"`
}

type SaveRunAsLayoutTemplateRequest struct {
	Name        string   `json:"name" binding:"required"`
	Description string   `json:"description"`
	Tags        []string `json:"tags"`
}

func ToLayoutTemplateResponse(t domain.LayoutTemplate) LayoutTemplateResponse {
	return LayoutTemplateResponse{
		ID:           t.ID,
		Name:         t.Name,
		Description:  t.Description,
		ArticleType:  t.ArticleType,
		Tags:         t.Tags,
		HasSVG:       t.HasSVG,
		ItemCountMin: t.ItemCountMin,
		ItemCountMax: t.ItemCountMax,
		QualityScore: t.QualityScore,
		UsageCount:   t.UsageCount,
		IsFeatured:   t.IsFeatured,
		IsDefault:    t.IsDefault,
		SourceRunID:  t.SourceRunID,
		CreatedAt:    t.CreatedAt,
		UpdatedAt:    t.UpdatedAt,
	}
}

func ToLayoutTemplateDetailResponse(t domain.LayoutTemplate) LayoutTemplateDetailResponse {
	return LayoutTemplateDetailResponse{
		LayoutTemplateResponse: ToLayoutTemplateResponse(t),
		BodyHTML:               t.BodyHTML,
	}
}

func ToLayoutTemplateListResponse(items []domain.LayoutTemplate) LayoutTemplateListResponse {
	out := make([]LayoutTemplateResponse, 0, len(items))
	for _, item := range items {
		out = append(out, ToLayoutTemplateResponse(item))
	}
	return LayoutTemplateListResponse{Items: out}
}
