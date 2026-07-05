package wechatarticle

import (
	"fmt"
	"strings"
)

// RenderDocument turns blocks into WeChat-ready HTML wrapped in a root section.
func RenderDocument(doc LayoutDocument, theme Theme) (string, error) {
	if err := ValidateDocument(doc); err != nil {
		return "", err
	}

	var b strings.Builder
	b.WriteString(`<section style="`)
	b.WriteString(fmt.Sprintf(
		"font-family:%s;font-size:%s;line-height:%s;color:%s;padding:0 %s;max-width:100%%;box-sizing:border-box;",
		theme.Typography.FontFamily,
		theme.Typography.BodySize,
		theme.Typography.BodyLineHeight,
		theme.Colors.TextPrimary,
		theme.Spacing.PagePadding,
	))
	b.WriteString(`">`)

	for _, block := range doc.Blocks {
		chunk, err := renderBlock(block, theme)
		if err != nil {
			return "", fmt.Errorf("render %s: %w", block.Type, err)
		}
		b.WriteString(chunk)
	}

	b.WriteString(`</section>`)
	return b.String(), nil
}

func renderBlock(block Block, theme Theme) (string, error) {
	switch block.Type {
	case BlockMasthead:
		return renderMasthead(block, theme), nil
	case BlockHeroSVG:
		return renderHeroSVG(block, theme)
	case BlockLead:
		return renderLead(block, theme), nil
	case BlockSection:
		return renderSection(block, theme), nil
	case BlockNewsItem:
		return renderNewsItem(block, theme), nil
	case BlockDivider:
		return renderDivider(theme), nil
	case BlockQuote:
		return renderQuote(block, theme), nil
	case BlockFigure:
		return renderFigure(block, theme), nil
	case BlockSourcesFooter:
		return renderSourcesFooter(block, theme), nil
	default:
		return "", fmt.Errorf("unsupported block type: %s", block.Type)
	}
}

// RenderFromOutputMap parses blocks from LLM output and renders HTML.
func RenderFromOutputMap(output map[string]any) (LayoutDocument, string, error) {
	doc, err := ParseLayoutDocument(output)
	if err != nil {
		return LayoutDocument{}, "", err
	}
	theme, err := DefaultTheme()
	if err != nil {
		return LayoutDocument{}, "", err
	}
	html, err := RenderDocument(doc, theme)
	if err != nil {
		return doc, "", err
	}
	return doc, html, nil
}
