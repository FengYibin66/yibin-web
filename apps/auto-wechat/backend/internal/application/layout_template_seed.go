package application

import (
	"strings"
	"time"

	"github.com/auto-wechat-tech/backend/internal/domain"
	"github.com/auto-wechat-tech/backend/internal/wechatarticle"
)

func seedLayoutTemplateInputs() ([]domain.CreateLayoutTemplateInput, error) {
	theme, err := wechatarticle.DefaultTheme()
	if err != nil {
		return nil, err
	}

	dailyDoc := wechatarticle.LayoutDocument{
		Title: "AI 科技日报",
		Blocks: []wechatarticle.Block{
			{
				Type:        wechatarticle.BlockMasthead,
				SeriesTitle: "AI 科技日报",
				DateLabel:   time.Now().Format("2006年1月2日"),
				Topic:       "今日 AI 要闻速览",
			},
			{
				Type:     wechatarticle.BlockHeroSVG,
				Variant:  wechatarticle.HeroLeadExpand,
				LeadText: "点击展开查看今日导读：大模型、Agent、开源生态动态一览。",
				TapHint:  "点击展开今日导读",
			},
			{
				Type: wechatarticle.BlockLead,
				Text: "今日 AI 圈最值得关注的动态一览，面向开发者与 AI 从业者。",
			},
			{
				Type:    wechatarticle.BlockSection,
				Heading: "大模型",
				Tag:     "大模型",
			},
			{
				Type:       wechatarticle.BlockNewsItem,
				Headline:   "示例：新模型发布",
				Summary:    "上下文窗口扩大，推理成本下降，开发者 API 同步更新。",
				SourceName: "示例来源",
				SourceURL:  "https://example.com/llm",
			},
			{Type: wechatarticle.BlockDivider},
			{
				Type:    wechatarticle.BlockSection,
				Heading: "Agent",
				Tag:     "Agent",
			},
			{
				Type:       wechatarticle.BlockNewsItem,
				Summary:    "开源 Agent 编排框架发布新版本，支持多工具链路与可观测性。",
				SourceName: "GitHub",
				SourceURL:  "https://example.com/agent",
			},
			{
				Type:  wechatarticle.BlockSourcesFooter,
				Title: "参考来源",
				Sources: []wechatarticle.SourceEntry{
					{Name: "示例来源", URL: "https://example.com/llm"},
					{Name: "GitHub", URL: "https://example.com/agent"},
				},
			},
		},
	}
	dailyHTML, err := wechatarticle.RenderDocument(dailyDoc, theme)
	if err != nil {
		return nil, err
	}
	dailyHTML = wechatarticle.EnhanceBodyHTML(dailyHTML)

	compactDoc := dailyDoc
	compactDoc.Blocks = []wechatarticle.Block{
		compactDoc.Blocks[0],
		compactDoc.Blocks[2],
		compactDoc.Blocks[3],
		compactDoc.Blocks[4],
		compactDoc.Blocks[8],
	}
	compactHTML, err := wechatarticle.RenderDocument(compactDoc, theme)
	if err != nil {
		return nil, err
	}
	compactHTML = wechatarticle.EnhanceBodyHTML(compactHTML)

	return []domain.CreateLayoutTemplateInput{
		{
			Name:         "AI日报·SVG导读展开（精选）",
			Description:  "刊头 + 点击展开导读 SVG + 板块色条 + 资讯卡片 + 来源区。适合 5-8 条日报。",
			ArticleType:  domain.LayoutArticleTypeDailyDigest,
			Tags:         []string{"大模型", "Agent", "SVG导读", "日报合集"},
			BodyHTML:     dailyHTML,
			HasSVG:       strings.Contains(dailyHTML, "<svg"),
			ItemCountMin: 5,
			ItemCountMax: 10,
			QualityScore: 95,
			IsFeatured:   true,
		},
		{
			Name:         "AI日报·简洁静态版",
			Description:  "无 SVG 交互，静态精美卡片排版。适合快速出刊或 SVG 降级场景。",
			ArticleType:  domain.LayoutArticleTypeDailyDigest,
			Tags:         []string{"简洁", "静态", "日报合集"},
			BodyHTML:     compactHTML,
			HasSVG:       false,
			ItemCountMin: 3,
			ItemCountMax: 6,
			QualityScore: 88,
			IsFeatured:   true,
		},
	}, nil
}
