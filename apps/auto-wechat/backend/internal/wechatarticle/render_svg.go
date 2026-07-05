package wechatarticle

import (
	"fmt"
	"html"
	"strings"
)

func renderHeroSVG(block Block, theme Theme) (string, error) {
	switch block.Variant {
	case "", HeroLeadExpand:
		return renderHeroLeadExpand(block, theme), nil
	default:
		return "", fmt.Errorf("unsupported hero_svg variant: %s", block.Variant)
	}
}

// renderHeroLeadExpand implements click-to-expand lead per WeChat SVG SMIL rules.
// Reference: https://zhuanlan.zhihu.com/p/75023148
func renderHeroLeadExpand(block Block, theme Theme) string {
	tapHint := block.TapHint
	if tapHint == "" {
		tapHint = "点击展开今日导读"
	}

	bgStyle := fmt.Sprintf(
		"display:inline-block;width:100%%;pointer-events:none;-webkit-tap-highlight-color:transparent;outline:none;",
	)
	if block.BackgroundImageURL != "" {
		// WeChat rule: url() must not use quotes.
		bgStyle += fmt.Sprintf(
			"background-image:url(%s);background-size:100%% 100%%;background-repeat:no-repeat;",
			block.BackgroundImageURL,
		)
	}

	leadLines := wrapSVGText(block.LeadText, 18, 3)
	leadTspans := buildLeadTspans(leadLines, 48, 200, 28)

	return fmt.Sprintf(
		`<section style="margin:0 0 %s;padding:0;">`+
			`<svg style="%s" version="1.1" viewBox="0 0 640 200" xmlns="http://www.w3.org/2000/svg">`+
			`<animate attributeName="height" values="200px;360px" keyTimes="0;1" dur="0.45s" begin="click" fill="freeze" restart="never"></animate>`+
			`%s`+
			`<g style="outline:none">`+
			`<animate attributeName="opacity" begin="0s" dur="1.2s" values="1;0.35;1" repeatCount="indefinite"></animate>`+
			`<text x="32" y="56" fill="#ffffff" style="font-size:22px;font-weight:600;">%s</text>`+
			`<text x="32" y="88" fill="#dbeafe" style="font-size:14px;">%s</text>`+
			`</g>`+
			`<g style="outline:none;opacity:0;">`+
			`<animate attributeName="opacity" begin="click+0.12" dur="0.25s" values="0;1" fill="freeze" restart="never"></animate>`+
			`<text x="32" y="130" fill="#f8fafc" style="font-size:15px;">`+
			`%s</text></g></svg></section>`,
		theme.Spacing.SectionGap,
		bgStyle,
		heroBackgroundRect(block, theme),
		html.EscapeString(theme.SeriesTitle),
		html.EscapeString(tapHint),
		leadTspans,
	)
}

func heroBackgroundRect(block Block, theme Theme) string {
	if block.BackgroundImageURL != "" {
		return ""
	}
	// WeChat SVG: avoid id/defs; use solid brand fill.
	return fmt.Sprintf(
		`<rect x="0" y="0" width="640" height="200" rx="8" fill="%s" style="outline:none"></rect>`,
		theme.Colors.HeroGradientEnd,
	)
}

func wrapSVGText(text string, maxRunes, maxLines int) []string {
	text = strings.TrimSpace(text)
	if text == "" {
		return []string{""}
	}
	runes := []rune(text)
	lines := make([]string, 0, maxLines)
	var current []rune
	for _, r := range runes {
		current = append(current, r)
		if len(current) >= maxRunes {
			lines = append(lines, string(current))
			current = nil
			if len(lines) >= maxLines {
				break
			}
		}
	}
	if len(current) > 0 && len(lines) < maxLines {
		lines = append(lines, string(current))
	}
	if len(lines) == 0 {
		return []string{text}
	}
	return lines
}

func buildLeadTspans(lines []string, x, startY, lineHeight int) string {
	if len(lines) == 0 {
		return `<tspan x="32" y="130"></tspan>`
	}
	var b strings.Builder
	for i, line := range lines {
		if i == 0 {
			b.WriteString(fmt.Sprintf(`<tspan x="%d" y="%d">%s</tspan>`, x, startY, html.EscapeString(line)))
			continue
		}
		b.WriteString(fmt.Sprintf(`<tspan x="%d" dy="%d">%s</tspan>`, x, lineHeight, html.EscapeString(line)))
	}
	return b.String()
}
