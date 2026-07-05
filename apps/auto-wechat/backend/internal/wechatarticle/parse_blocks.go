package wechatarticle

import (
	"encoding/json"
	"fmt"
	"strings"
)

func stringFieldMap(m map[string]any, key string) string {
	if m == nil {
		return ""
	}
	v, ok := m[key]
	if !ok || v == nil {
		return ""
	}
	s, ok := v.(string)
	if !ok {
		return ""
	}
	return strings.TrimSpace(s)
}

func parseSources(raw any) []SourceEntry {
	items, ok := raw.([]any)
	if !ok {
		return nil
	}
	out := make([]SourceEntry, 0, len(items))
	for _, entry := range items {
		m, ok := entry.(map[string]any)
		if !ok {
			continue
		}
		url := stringFieldMap(m, "url")
		if url == "" {
			continue
		}
		name := stringFieldMap(m, "name")
		if name == "" {
			name = url
		}
		out = append(out, SourceEntry{Name: name, URL: url})
	}
	return out
}

// ParseBlock converts a generic JSON object into a typed Block.
func ParseBlock(raw map[string]any) (Block, error) {
	blockType := BlockType(stringFieldMap(raw, "type"))
	if blockType == "" {
		return Block{}, fmt.Errorf("block missing type")
	}

	block := Block{Type: blockType}
	switch blockType {
	case BlockMasthead:
		block.SeriesTitle = stringFieldMap(raw, "seriesTitle")
		block.DateLabel = stringFieldMap(raw, "dateLabel")
		block.Topic = stringFieldMap(raw, "topic")
	case BlockHeroSVG:
		variant := HeroSVGVariant(stringFieldMap(raw, "variant"))
		if variant == "" {
			variant = HeroLeadExpand
		}
		block.Variant = variant
		block.LeadText = stringFieldMap(raw, "leadText")
		block.TapHint = stringFieldMap(raw, "tapHint")
		block.BackgroundImageURL = stringFieldMap(raw, "backgroundImageUrl")
	case BlockLead, BlockQuote:
		block.Text = stringFieldMap(raw, "text")
	case BlockSection:
		block.Heading = stringFieldMap(raw, "heading")
		block.Tag = stringFieldMap(raw, "tag")
	case BlockNewsItem:
		block.Headline = stringFieldMap(raw, "headline")
		block.Summary = stringFieldMap(raw, "summary")
		block.SourceName = stringFieldMap(raw, "sourceName")
		block.SourceURL = stringFieldMap(raw, "sourceUrl")
	case BlockDivider:
		// no fields
	case BlockFigure:
		block.ImageURL = stringFieldMap(raw, "imageUrl")
		block.Caption = stringFieldMap(raw, "caption")
	case BlockSourcesFooter:
		block.Title = stringFieldMap(raw, "title")
		block.Sources = parseSources(raw["sources"])
	default:
		return Block{}, fmt.Errorf("unsupported block type: %s", blockType)
	}
	return block, nil
}

// ParseBlocks parses a blocks array from layout LLM output.
func ParseBlocks(raw any) ([]Block, error) {
	items, ok := raw.([]any)
	if !ok {
		return nil, fmt.Errorf("blocks must be an array")
	}
	if len(items) == 0 {
		return nil, fmt.Errorf("blocks empty")
	}

	blocks := make([]Block, 0, len(items))
	for i, entry := range items {
		m, ok := entry.(map[string]any)
		if !ok {
			return nil, fmt.Errorf("blocks[%d] must be an object", i)
		}
		block, err := ParseBlock(m)
		if err != nil {
			return nil, fmt.Errorf("blocks[%d]: %w", i, err)
		}
		blocks = append(blocks, block)
	}
	return blocks, nil
}

// ParseLayoutDocument unmarshals a full layout planner payload.
func ParseLayoutDocument(output map[string]any) (LayoutDocument, error) {
	doc := LayoutDocument{
		Title:         stringFieldMap(output, "title"),
		CoverImageURL: stringFieldMap(output, "coverImageUrl"),
		LayoutNotes:   stringFieldMap(output, "layoutNotes"),
	}
	blocks, err := ParseBlocks(output["blocks"])
	if err != nil {
		return LayoutDocument{}, err
	}
	doc.Blocks = blocks
	return doc, nil
}

// BlocksFromJSON is a helper for tests.
func BlocksFromJSON(data []byte) ([]Block, error) {
	var blocks []Block
	if err := json.Unmarshal(data, &blocks); err != nil {
		return nil, err
	}
	return blocks, nil
}
