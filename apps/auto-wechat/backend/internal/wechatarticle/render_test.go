package wechatarticle

import (
	"strings"
	"testing"
)

func sampleDocument() LayoutDocument {
	return LayoutDocument{
		Title: "AI 要闻",
		Blocks: []Block{
			{
				Type:        BlockMasthead,
				SeriesTitle: "AI 科技日报",
				DateLabel:   "2026年6月4日",
				Topic:       "今日速览",
			},
			{
				Type:     BlockHeroSVG,
				Variant:  HeroLeadExpand,
				LeadText: "OpenAI 发布新模型；Agent 框架更新。",
				TapHint:  "点击展开导读",
			},
			{
				Type: BlockLead,
				Text: "今日 AI 圈最值得关注的动态一览。",
			},
			{
				Type:    BlockSection,
				Heading: "大模型",
				Tag:     "大模型",
			},
			{
				Type:       BlockNewsItem,
				Headline:   "新模型发布",
				Summary:    "性能提升显著，上下文窗口扩大。",
				SourceName: "HN",
				SourceURL:  "https://news.ycombinator.com/item?id=1",
			},
			{
				Type: BlockSourcesFooter,
				Sources: []SourceEntry{
					{Name: "HN", URL: "https://news.ycombinator.com/item?id=1"},
				},
			},
		},
	}
}

func TestRenderDocument_producesWeChatHTML(t *testing.T) {
	theme, err := DefaultTheme()
	if err != nil {
		t.Fatalf("theme: %v", err)
	}
	html, err := RenderDocument(sampleDocument(), theme)
	if err != nil {
		t.Fatalf("render: %v", err)
	}
	for _, want := range []string{
		"<section",
		"AI 科技日报",
		"<svg",
		`begin="click"`,
		"大模型",
		"border-left:4px solid",
		"[HN]",
		"参考来源",
		"https://news.ycombinator.com/item?id=1",
	} {
		if !strings.Contains(html, want) {
			t.Fatalf("expected fragment %q in html", want)
		}
	}
}

func TestRenderDocument_rejectsForbiddenSVGPatterns(t *testing.T) {
	theme, err := DefaultTheme()
	if err != nil {
		t.Fatalf("theme: %v", err)
	}
	html, err := RenderDocument(sampleDocument(), theme)
	if err != nil {
		t.Fatalf("render: %v", err)
	}
	for _, forbidden := range []string{"<script", "<iframe", `id="`, "<table"} {
		if strings.Contains(strings.ToLower(html), forbidden) {
			t.Fatalf("forbidden fragment %q in hero svg output", forbidden)
		}
	}
}

func TestRenderSection_usesBorderLeftAccent(t *testing.T) {
	theme, err := DefaultTheme()
	if err != nil {
		t.Fatalf("theme: %v", err)
	}
	html := renderSection(Block{Type: BlockSection, Heading: "大模型", Tag: "大模型"}, theme)
	if !strings.Contains(html, "border-left:4px solid #2563eb") {
		t.Fatalf("expected border-left accent, got: %s", html)
	}
	if strings.Contains(html, "<table") {
		t.Fatal("section bar must not use table layout")
	}
}

func TestValidateDocument_requiresCoreBlocks(t *testing.T) {
	doc := sampleDocument()
	doc.Blocks = doc.Blocks[:2]
	if err := ValidateDocument(doc); err == nil {
		t.Fatal("expected validation error for incomplete blocks")
	}
}

func TestEnhanceBodyHTML_afterRender(t *testing.T) {
	theme, err := DefaultTheme()
	if err != nil {
		t.Fatalf("theme: %v", err)
	}
	html, err := RenderDocument(sampleDocument(), theme)
	if err != nil {
		t.Fatalf("render: %v", err)
	}
	enhanced := EnhanceBodyHTML(html)
	if !strings.Contains(enhanced, "wechat-plain-source-url") {
		t.Fatal("expected plain url span after enhance")
	}
}
