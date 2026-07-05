package domain

type RankedItem struct {
	URL       string  `json:"url"`
	Title     string  `json:"title"`
	Score     float64 `json:"score"`
	Reason    string  `json:"reason,omitempty"`
	Summary   string  `json:"summary,omitempty"`
	SummaryZH string  `json:"summaryZh,omitempty"`
	Tags      []string `json:"tags,omitempty"`
	Source    string  `json:"source,omitempty"`
}

type Digest struct {
	ID     string
	RunID  string
	Items  []RankedItem
	Stats  map[string]any
}

const DigestTopN = 10
