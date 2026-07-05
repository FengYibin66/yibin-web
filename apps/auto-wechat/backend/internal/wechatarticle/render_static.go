package wechatarticle

import (
	"fmt"
	"html"
	"strings"
)

func renderMasthead(block Block, theme Theme) string {
	series := block.SeriesTitle
	if series == "" {
		series = theme.SeriesTitle
	}
	topicLine := ""
	if block.Topic != "" {
		topicLine = fmt.Sprintf(
			`<p style="margin:6px 0 0;font-size:%s;color:%s;opacity:0.9;line-height:1.5;">%s</p>`,
			theme.Typography.MastheadSize,
			theme.Colors.MastheadText,
			html.EscapeString(block.Topic),
		)
	}
	return fmt.Sprintf(
		`<section style="margin:0 0 %s;border-radius:%s;background:%s;color:%s;padding:14px %s;">`+
			`<p style="margin:0;font-size:%s;font-weight:600;letter-spacing:0.04em;">%s</p>`+
			`<p style="margin:4px 0 0;font-size:%s;opacity:0.85;">%s</p>%s</section>`,
		theme.Spacing.SectionGap,
		theme.Spacing.BlockRadius,
		theme.Colors.MastheadBg,
		theme.Colors.MastheadText,
		theme.Spacing.LeadPadding,
		theme.Typography.MastheadSize,
		html.EscapeString(series),
		theme.Typography.MetaSize,
		html.EscapeString(block.DateLabel),
		topicLine,
	)
}

func renderLead(block Block, theme Theme) string {
	return fmt.Sprintf(
		`<section style="margin:0 0 %s;padding:%s;background:%s;border-radius:%s;border:1px solid %s;">`+
			`<p style="margin:0;font-size:%s;line-height:%s;color:%s;">%s</p></section>`,
		theme.Spacing.SectionGap,
		theme.Spacing.LeadPadding,
		theme.Colors.SurfaceLead,
		theme.Spacing.BlockRadius,
		theme.Colors.BorderSubtle,
		theme.Typography.LeadSize,
		theme.Typography.LeadLineHeight,
		theme.Colors.TextSecondary,
		html.EscapeString(block.Text),
	)
}

func renderSection(block Block, theme Theme) string {
	accent := theme.accentForTag(block.Tag)
	// border-left 竖条：微信内 table+固定宽 td 常被拉成宽色块，与 renderQuote 同源写法更稳。
	return fmt.Sprintf(
		`<section style="margin:%s 0 %s;">`+
			`<p style="margin:0;padding-left:12px;border-left:4px solid %s;font-size:%s;font-weight:600;color:%s;line-height:1.4;">%s</p>`+
			`</section>`,
		theme.Spacing.SectionGap,
		theme.Spacing.ItemGap,
		accent,
		theme.Typography.SectionSize,
		theme.Colors.TextPrimary,
		html.EscapeString(block.Heading),
	)
}

func renderNewsItem(block Block, theme Theme) string {
	headline := ""
	if block.Headline != "" {
		headline = fmt.Sprintf(
			`<strong style="color:%s;font-weight:600;">%s</strong><br/>`,
			theme.Colors.TextPrimary,
			html.EscapeString(block.Headline),
		)
	}
	sourceLabel := block.SourceName
	if sourceLabel == "" {
		sourceLabel = "来源"
	}
	return fmt.Sprintf(
		`<section style="margin:0 0 %s;padding:0 0 %s;border-bottom:1px solid %s;">`+
			`<p style="margin:0 0 8px;font-size:%s;line-height:%s;color:%s;">%s%s</p>`+
			`<p style="margin:0;font-size:%s;line-height:1.5;">`+
			`<a href="%s" style="color:%s;text-decoration:none;">[%s]</a></p></section>`,
		theme.Spacing.ItemGap,
		theme.Spacing.ItemGap,
		theme.Colors.BorderSubtle,
		theme.Typography.BodySize,
		theme.Typography.BodyLineHeight,
		theme.Colors.TextPrimary,
		headline,
		html.EscapeString(block.Summary),
		theme.Typography.MetaSize,
		html.EscapeString(block.SourceURL),
		theme.Colors.Link,
		html.EscapeString(sourceLabel),
	)
}

func renderDivider(theme Theme) string {
	return fmt.Sprintf(
		`<section style="margin:%s 0;text-align:center;">`+
			`<p style="margin:0;font-size:12px;color:%s;letter-spacing:0.3em;">· · ·</p></section>`,
		theme.Spacing.SectionGap,
		theme.Colors.Divider,
	)
}

func renderQuote(block Block, theme Theme) string {
	return fmt.Sprintf(
		`<section style="margin:0 0 %s;padding:12px %s;border-left:3px solid %s;background:%s;">`+
			`<p style="margin:0;font-size:%s;line-height:%s;color:%s;">%s</p></section>`,
		theme.Spacing.ItemGap,
		theme.Spacing.LeadPadding,
		theme.Colors.BorderSubtle,
		theme.Colors.SurfaceLead,
		theme.Typography.LeadSize,
		theme.Typography.LeadLineHeight,
		theme.Colors.TextSecondary,
		html.EscapeString(block.Text),
	)
}

func renderFigure(block Block, theme Theme) string {
	if block.ImageURL == "" {
		return ""
	}
	caption := ""
	if block.Caption != "" {
		caption = fmt.Sprintf(
			`<p style="margin:8px 0 0;font-size:%s;color:%s;text-align:center;line-height:1.5;">%s</p>`,
			theme.Typography.MetaSize,
			theme.Colors.TextMuted,
			html.EscapeString(block.Caption),
		)
	}
	return fmt.Sprintf(
		`<section style="margin:0 0 %s;">`+
			`<img src="%s" alt="%s" style="display:block;width:100%%;max-width:100%%;height:auto;border-radius:%s;" />%s</section>`,
		theme.Spacing.SectionGap,
		html.EscapeString(block.ImageURL),
		html.EscapeString(block.Caption),
		theme.Spacing.BlockRadius,
		caption,
	)
}

func renderSourcesFooter(block Block, theme Theme) string {
	title := block.Title
	if title == "" {
		title = "参考来源"
	}
	var items strings.Builder
	for _, source := range block.Sources {
		name := source.Name
		if name == "" {
			name = source.URL
		}
		items.WriteString(fmt.Sprintf(
			`<p style="margin:0 0 10px;font-size:%s;line-height:1.6;">`+
				`<a href="%s" style="color:%s;text-decoration:none;">%s</a></p>`,
			theme.Typography.MetaSize,
			html.EscapeString(source.URL),
			theme.Colors.Link,
			html.EscapeString(name),
		))
	}
	return fmt.Sprintf(
		`<section style="margin:%s 0 0;padding:%s 0 0;border-top:1px solid %s;">`+
			`<p style="margin:0 0 12px;font-size:%s;font-weight:600;color:%s;">%s</p>%s</section>`,
		theme.Spacing.SectionGap,
		theme.Spacing.SectionGap,
		theme.Colors.BorderSubtle,
		theme.Typography.SectionSize,
		theme.Colors.TextPrimary,
		html.EscapeString(title),
		items.String(),
	)
}
