package domain

const (
	PublishModeDraftOnly = "draft_only"
	PublishModeCopyHTML  = "copy_html"

	// MaxReviewRounds 保留常量；质检为建议性，不再用于失败退出或自动回环。
	MaxReviewRounds = 1
)

type ContentDraft struct {
	ID           string
	RunID        string
	DigestID     string
	Title        string
	Summary      string
	BodyMarkdown string
	BodyHTML     string
	CoverURL     string
	CoverMediaID         string
	ReadSourcePresetID   string
	Status               string
	EditorJSON           map[string]any
	ReviewJSON           map[string]any
}

type UpdateDraftInput struct {
	Title        *string
	Summary      *string
	BodyMarkdown *string
	BodyHTML     *string
	CoverURL             *string
	ReadSourcePresetID   *string
}

type EditorOutput struct {
	ArticleType  string         `json:"articleType"`
	Topic        string         `json:"topic"`
	Angle        string         `json:"angle"`
	Outline      []OutlineEntry `json:"outline"`
	SelectedURLs []string       `json:"selectedUrls"`
}

type OutlineEntry struct {
	Heading string   `json:"heading"`
	Tag     string   `json:"tag,omitempty"`
	Bullets []string `json:"bullets"`
}

type WriterOutput struct {
	Title           string      `json:"title"`
	TitleCandidates []string    `json:"titleCandidates"`
	Summary         string      `json:"summary"`
	BodyMarkdown    string      `json:"bodyMarkdown"`
	Sources         []SourceRef `json:"sources"`
}

type SourceRef struct {
	Name string `json:"name"`
	URL  string `json:"url"`
}

type LayoutOutput struct {
	Title              string              `json:"title"`
	CoverImageURL      string              `json:"coverImageUrl"`
	BodyHTML           string              `json:"bodyHtml"`
	LayoutNotes        string              `json:"layoutNotes"`
	Blocks             []map[string]any    `json:"blocks,omitempty"`
	RenderEngine       string              `json:"renderEngine,omitempty"`
	SelectedTemplateID string              `json:"selectedTemplateId,omitempty"`
	TemplateMatch      *TemplateMatchResult `json:"templateMatch,omitempty"`
}

type CoverOutput struct {
	CoverImageURL string `json:"coverImageUrl"`
	Source        string `json:"source"`
	ImagePrompt   string `json:"imagePrompt,omitempty"`
}

type ReviewDimensionScore struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Score    int    `json:"score"`
	Feedback string `json:"feedback"`
}

type ReviewOutput struct {
	OverallScore int                    `json:"overallScore"`
	Dimensions   []ReviewDimensionScore `json:"dimensions"`
	Approved     bool                   `json:"approved"`
	Target       string                 `json:"target"`
	Feedback     string                 `json:"feedback"`
	Issues       []string               `json:"issues"`
}

type PublishResult struct {
	DraftMediaID string
	PublishMode  string
}
