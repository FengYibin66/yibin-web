package pipeline

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/auto-wechat-tech/backend/internal/domain"
	"github.com/auto-wechat-tech/backend/internal/wechatarticle"
)

func (e *Engine) matchLayoutTemplates(
	ctx context.Context,
	writer domain.WriterOutput,
	editor domain.EditorOutput,
	templates []domain.LayoutTemplate,
) (domain.TemplateMatchResult, []domain.LayoutTemplate, error) {
	if len(templates) == 0 {
		return domain.TemplateMatchResult{}, nil, fmt.Errorf("no layout templates")
	}

	summaries := make([]map[string]any, 0, len(templates))
	for _, t := range templates {
		summaries = append(summaries, map[string]any{
			"id":           t.ID,
			"name":         t.Name,
			"description":  t.Description,
			"articleType":  t.ArticleType,
			"tags":         t.Tags,
			"hasSvg":       t.HasSVG,
			"itemCountMin": t.ItemCountMin,
			"itemCountMax": t.ItemCountMax,
			"qualityScore": t.QualityScore,
		})
	}

	output, err := e.llmClient.Invoke(ctx, "template_matcher", map[string]any{
		"writer":     writer,
		"editor":     editor,
		"templates":  summaries,
		"itemCount":  len(writer.Sources),
	})
	if err != nil {
		return e.fallbackTemplateMatch(templates), templates[:min(3, len(templates))], nil
	}

	match, err := parseTemplateMatchOutput(output)
	if err != nil || len(match.Ranked) == 0 {
		return e.fallbackTemplateMatch(templates), templates[:min(3, len(templates))], nil
	}

	ids := make([]string, 0, 3)
	for _, entry := range match.Ranked {
		if entry.TemplateID != "" {
			ids = append(ids, entry.TemplateID)
		}
	}
	selected, err := e.layoutTemplateRepo.GetByIDs(ctx, ids)
	if err != nil || len(selected) == 0 {
		return e.fallbackTemplateMatch(templates), templates[:min(3, len(templates))], nil
	}
	return match, selected, nil
}

func (e *Engine) fallbackTemplateMatch(templates []domain.LayoutTemplate) domain.TemplateMatchResult {
	limit := min(3, len(templates))
	ranked := make([]domain.TemplateMatchEntry, 0, limit)
	for i := 0; i < limit; i++ {
		ranked = append(ranked, domain.TemplateMatchEntry{
			TemplateID: templates[i].ID,
			Score:      templates[i].QualityScore,
			Reason:     "fallback: featured/quality order",
		})
	}
	return domain.TemplateMatchResult{Ranked: ranked}
}

func parseTemplateMatchOutput(output map[string]any) (domain.TemplateMatchResult, error) {
	data, err := json.Marshal(output)
	if err != nil {
		return domain.TemplateMatchResult{}, err
	}
	var result domain.TemplateMatchResult
	if err := json.Unmarshal(data, &result); err != nil {
		return domain.TemplateMatchResult{}, err
	}
	return result, nil
}

func templatesToLLMInput(templates []domain.LayoutTemplate) []map[string]any {
	out := make([]map[string]any, 0, len(templates))
	for _, t := range templates {
		out = append(out, map[string]any{
			"id":          t.ID,
			"name":        t.Name,
			"description": t.Description,
			"articleType": t.ArticleType,
			"tags":        t.Tags,
			"hasSvg":      t.HasSVG,
			"bodyHtml":    t.BodyHTML,
		})
	}
	return out
}

func parseFewshotLayoutOutput(output map[string]any, primaryTemplate domain.LayoutTemplate) (domain.LayoutOutput, error) {
	bodyHTML := stringField(output, "bodyHtml")
	if bodyHTML == "" {
		return domain.LayoutOutput{}, fmt.Errorf("layout missing bodyHtml")
	}
	if err := wechatarticle.ValidateGeneratedHTML(bodyHTML); err != nil {
		return domain.LayoutOutput{}, err
	}
	if err := wechatarticle.PreserveSVGStructure(primaryTemplate.BodyHTML, bodyHTML); err != nil {
		return domain.LayoutOutput{}, err
	}
	if strings.Contains(strings.ToLower(primaryTemplate.BodyHTML), "<image") {
		if !strings.Contains(strings.ToLower(bodyHTML), "<image") {
			return domain.LayoutOutput{}, fmt.Errorf("template has svg image but output removed image tags")
		}
	}

	result := domain.LayoutOutput{
		Title:              stringField(output, "title"),
		CoverImageURL:      stringField(output, "coverImageUrl"),
		BodyHTML:           wechatarticle.EnhanceBodyHTML(bodyHTML),
		LayoutNotes:        stringField(output, "layoutNotes"),
		SelectedTemplateID: stringField(output, "selectedTemplateId"),
		RenderEngine:       "template_fewshot/v1",
	}
	if result.SelectedTemplateID == "" {
		result.SelectedTemplateID = primaryTemplate.ID
	}
	return result, nil
}

func (e *Engine) invokeFewshotWithPinnedTemplate(
	ctx context.Context,
	writer domain.WriterOutput,
	editor domain.EditorOutput,
	images []map[string]string,
	illustrations map[string]any,
	feedback string,
	tmpl domain.LayoutTemplate,
) (domain.LayoutOutput, *domain.TemplateMatchResult, error) {
	match := domain.TemplateMatchResult{
		Ranked: []domain.TemplateMatchEntry{{
			TemplateID: tmpl.ID,
			Score:      100,
			Reason:     "任务指定排版模板（跳过 Matcher）",
		}},
	}

	templatePayload := templatesToLLMInput([]domain.LayoutTemplate{tmpl})

	output, err := e.llmClient.Invoke(ctx, "layout", map[string]any{
		"mode":          "template_fewshot",
		"writer":        writer,
		"editor":        editor,
		"images":        images,
		"illustrations": illustrations,
		"feedback":      feedback,
		"templates":     templatePayload,
		"templateMatch": match,
	})
	if err != nil {
		return domain.LayoutOutput{}, nil, err
	}

	layoutOut, err := parseFewshotLayoutOutput(output, tmpl)
	if err != nil {
		return domain.LayoutOutput{}, nil, err
	}
	layoutOut.TemplateMatch = &match
	_ = e.layoutTemplateRepo.IncrementUsage(ctx, []string{tmpl.ID})
	return layoutOut, &match, nil
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
