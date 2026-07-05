package wechatarticle

import (
	"fmt"
	"strings"
)

// ValidateDocument checks layout blocks against the methodology checklist.
func ValidateDocument(doc LayoutDocument) error {
	if strings.TrimSpace(doc.Title) == "" {
		return fmt.Errorf("layout missing title")
	}
	if len(doc.Blocks) < 3 {
		return fmt.Errorf("layout blocks too few: need masthead, content, sources_footer")
	}

	var (
		hasMasthead      bool
		hasLeadOrHero     bool
		hasSourcesFooter  bool
		newsCount         int
		heroSVGCount      int
		openSection       bool
	)

	for i, block := range doc.Blocks {
		switch block.Type {
		case BlockMasthead:
			hasMasthead = true
			if block.SeriesTitle == "" || block.DateLabel == "" {
				return fmt.Errorf("blocks[%d] masthead missing seriesTitle or dateLabel", i)
			}
		case BlockHeroSVG:
			heroSVGCount++
			if block.LeadText == "" {
				return fmt.Errorf("blocks[%d] hero_svg missing leadText", i)
			}
			if block.TapHint == "" {
				return fmt.Errorf("blocks[%d] hero_svg missing tapHint", i)
			}
			hasLeadOrHero = true
		case BlockLead:
			if block.Text == "" {
				return fmt.Errorf("blocks[%d] lead missing text", i)
			}
			hasLeadOrHero = true
		case BlockSection:
			if block.Heading == "" {
				return fmt.Errorf("blocks[%d] section missing heading", i)
			}
			openSection = true
		case BlockNewsItem:
			if block.Summary == "" || block.SourceURL == "" {
				return fmt.Errorf("blocks[%d] news_item missing summary or sourceUrl", i)
			}
			if !strings.HasPrefix(strings.ToLower(block.SourceURL), "http") {
				return fmt.Errorf("blocks[%d] news_item sourceUrl must be http(s)", i)
			}
			newsCount++
		case BlockSourcesFooter:
			hasSourcesFooter = true
			if len(block.Sources) == 0 {
				return fmt.Errorf("blocks[%d] sources_footer empty", i)
			}
		case BlockDivider, BlockQuote, BlockFigure:
			// optional blocks
		default:
			return fmt.Errorf("blocks[%d] unsupported type %s", i, block.Type)
		}
	}

	if !hasMasthead {
		return fmt.Errorf("layout missing masthead block")
	}
	if !hasLeadOrHero {
		return fmt.Errorf("layout missing lead or hero_svg block")
	}
	if !hasSourcesFooter {
		return fmt.Errorf("layout missing sources_footer block")
	}
	if newsCount == 0 {
		return fmt.Errorf("layout has no news_item blocks")
	}
	if heroSVGCount > 1 {
		return fmt.Errorf("layout has %d hero_svg blocks; max 1 allowed", heroSVGCount)
	}
	if openSection && newsCount == 0 {
		return fmt.Errorf("layout has section without news_item")
	}
	return nil
}
