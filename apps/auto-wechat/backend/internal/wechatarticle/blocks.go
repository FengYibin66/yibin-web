package wechatarticle

// BlockType identifies a layout block variant.
type BlockType string

const (
	BlockMasthead       BlockType = "masthead"
	BlockHeroSVG        BlockType = "hero_svg"
	BlockLead           BlockType = "lead"
	BlockSection        BlockType = "section"
	BlockNewsItem       BlockType = "news_item"
	BlockDivider        BlockType = "divider"
	BlockQuote          BlockType = "quote"
	BlockFigure         BlockType = "figure"
	BlockSourcesFooter  BlockType = "sources_footer"
)

// HeroSVGVariant selects an SVG interaction template.
type HeroSVGVariant string

const (
	HeroLeadExpand HeroSVGVariant = "lead_expand"
)

// SourceEntry is a citation in the article footer.
type SourceEntry struct {
	Name string `json:"name"`
	URL  string `json:"url"`
}

// Block is a union of layout block payloads.
type Block struct {
	Type BlockType `json:"type"`

	// masthead
	SeriesTitle string `json:"seriesTitle,omitempty"`
	DateLabel   string `json:"dateLabel,omitempty"`
	Topic       string `json:"topic,omitempty"`

	// hero_svg
	Variant            HeroSVGVariant `json:"variant,omitempty"`
	LeadText           string         `json:"leadText,omitempty"`
	TapHint            string         `json:"tapHint,omitempty"`
	BackgroundImageURL string         `json:"backgroundImageUrl,omitempty"`

	// lead / quote
	Text string `json:"text,omitempty"`

	// section
	Heading string `json:"heading,omitempty"`
	Tag     string `json:"tag,omitempty"`

	// news_item
	Headline   string `json:"headline,omitempty"`
	Summary    string `json:"summary,omitempty"`
	SourceName string `json:"sourceName,omitempty"`
	SourceURL  string `json:"sourceUrl,omitempty"`

	// figure
	ImageURL string `json:"imageUrl,omitempty"`
	Caption  string `json:"caption,omitempty"`

	// sources_footer
	Title   string        `json:"title,omitempty"`
	Sources []SourceEntry `json:"sources,omitempty"`
}

// LayoutDocument is the Layout Planner output before HTML rendering.
type LayoutDocument struct {
	Title         string  `json:"title"`
	CoverImageURL string  `json:"coverImageUrl"`
	LayoutNotes   string  `json:"layoutNotes"`
	Blocks        []Block `json:"blocks"`
}
