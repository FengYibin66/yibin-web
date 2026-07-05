package domain

const IllustrationPlanVersion = "v1"

type IllustrationSlotRole string

const IllustrationRoleNewsThumbnail IllustrationSlotRole = "news_thumbnail"

type IllustrationSlotStatus string

const (
	IllustrationStatusPending IllustrationSlotStatus = "pending"
	IllustrationStatusReady   IllustrationSlotStatus = "ready"
	IllustrationStatusFailed  IllustrationSlotStatus = "failed"
)

type IllustrationBindTo struct {
	SourceURL string `json:"sourceUrl"`
	Headline  string `json:"headline"`
	Section   string `json:"section,omitempty"`
	Rank      int    `json:"rank"`
}

type IllustrationImage struct {
	AssetID         *string `json:"assetId"`
	InLibrary       bool    `json:"inLibrary"`
	URL             string  `json:"url"`
	Source          string  `json:"source"`
	OriginURL       string  `json:"originUrl,omitempty"`
	Width           int     `json:"width,omitempty"`
	Height          int     `json:"height,omitempty"`
	RelevanceScore  float64 `json:"relevanceScore,omitempty"`
	Prompt          string  `json:"prompt,omitempty"`
}

type IllustrationSlot struct {
	ID           string                 `json:"id"`
	Role         IllustrationSlotRole   `json:"role"`
	BindTo       IllustrationBindTo     `json:"bindTo"`
	Image        IllustrationImage      `json:"image"`
	Status       IllustrationSlotStatus `json:"status"`
	ErrorMessage *string                `json:"errorMessage"`
}

type IllustrationStats struct {
	Total    int            `json:"total"`
	Ready    int            `json:"ready"`
	Failed   int            `json:"failed"`
	InLibrary int           `json:"inLibrary"`
	BySource map[string]int `json:"bySource,omitempty"`
}

type IllustrationOutput struct {
	PlanVersion string             `json:"planVersion"`
	Slots       []IllustrationSlot `json:"slots"`
	Stats       IllustrationStats  `json:"stats"`
}
