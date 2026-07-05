package domain

import "time"

const LayoutArticleTypeDailyDigest = "daily_digest"

type LayoutTemplate struct {
	ID           string
	Name         string
	Description  string
	ArticleType  string
	Tags         []string
	BodyHTML     string
	HasSVG       bool
	ItemCountMin int
	ItemCountMax int
	QualityScore int
	UsageCount   int
	IsFeatured   bool
	IsDefault    bool
	SourceRunID  string
	CreatedAt    time.Time
	UpdatedAt    time.Time
}

type LayoutTemplateSummary struct {
	ID           string   `json:"id"`
	Name         string   `json:"name"`
	Description  string   `json:"description"`
	ArticleType  string   `json:"articleType"`
	Tags         []string `json:"tags"`
	HasSVG       bool     `json:"hasSvg"`
	ItemCountMin int      `json:"itemCountMin"`
	ItemCountMax int      `json:"itemCountMax"`
	QualityScore int      `json:"qualityScore"`
	IsDefault    bool     `json:"isDefault"`
}

type CreateLayoutTemplateInput struct {
	Name         string
	Description  string
	ArticleType  string
	Tags         []string
	BodyHTML     string
	HasSVG       bool
	ItemCountMin int
	ItemCountMax int
	QualityScore int
	IsFeatured   bool
	SourceRunID  string
}

type UpdateLayoutTemplateInput struct {
	Description  string
	Tags         []string
	BodyHTML     string
	HasSVG       bool
	ItemCountMin int
	ItemCountMax int
}

type TemplateMatchEntry struct {
	TemplateID string `json:"templateId"`
	Score      int    `json:"score"`
	Reason     string `json:"reason"`
}

type TemplateMatchResult struct {
	Ranked []TemplateMatchEntry `json:"ranked"`
}

func (t LayoutTemplate) Summary() LayoutTemplateSummary {
	return LayoutTemplateSummary{
		ID:           t.ID,
		Name:         t.Name,
		Description:  t.Description,
		ArticleType:  t.ArticleType,
		Tags:         t.Tags,
		HasSVG:       t.HasSVG,
		ItemCountMin: t.ItemCountMin,
		ItemCountMax: t.ItemCountMax,
		QualityScore: t.QualityScore,
		IsDefault:    t.IsDefault,
	}
}
