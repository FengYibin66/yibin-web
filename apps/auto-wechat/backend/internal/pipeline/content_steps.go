package pipeline

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/auto-wechat-tech/backend/internal/domain"
	"github.com/auto-wechat-tech/backend/internal/wechatarticle"
)

func (e *Engine) runContentPipeline(
	ctx context.Context,
	runID string,
	digest domain.Digest,
	articles []domain.Article,
) (domain.EditorOutput, domain.WriterOutput, domain.LayoutOutput, domain.ReviewOutput, map[string]any, error) {
	meta := map[string]any{}

	editorOut, editorMeta, err := e.runEditor(ctx, runID, digest.Items)
	if err != nil {
		return domain.EditorOutput{}, domain.WriterOutput{}, domain.LayoutOutput{}, domain.ReviewOutput{}, meta, err
	}
	meta["editor"] = editorMeta

	writerOut, writerMeta, err := e.runWriter(ctx, runID, digest.Items, editorOut, "")
	if err != nil {
		return domain.EditorOutput{}, domain.WriterOutput{}, domain.LayoutOutput{}, domain.ReviewOutput{}, meta, err
	}
	meta["writer"] = writerMeta

	illustrateOut, illustrateMeta, err := e.runIllustrate(ctx, runID, digest.Items, articles, editorOut)
	if err != nil {
		return domain.EditorOutput{}, domain.WriterOutput{}, domain.LayoutOutput{}, domain.ReviewOutput{}, meta, err
	}
	meta["illustrate"] = illustrateMeta

	layoutOut, layoutMeta, err := e.runLayout(ctx, runID, writerOut, editorOut, illustrateOut, digest.Items, articles, "")
	if err != nil {
		return domain.EditorOutput{}, domain.WriterOutput{}, domain.LayoutOutput{}, domain.ReviewOutput{}, meta, err
	}
	meta["layout"] = layoutMeta

	reviewOut, reviewMeta, err := e.runReview(ctx, runID, writerOut, layoutOut, 1)
	if err != nil {
		return domain.EditorOutput{}, domain.WriterOutput{}, domain.LayoutOutput{}, domain.ReviewOutput{}, meta, err
	}
	meta["review"] = reviewMeta
	meta["reviewApproved"] = reviewOut.Approved
	meta["reviewAdvisory"] = true

	return editorOut, writerOut, layoutOut, reviewOut, meta, nil
}

func (e *Engine) runEditor(ctx context.Context, runID string, items []domain.RankedItem) (domain.EditorOutput, map[string]any, error) {
	start := time.Now()
	if err := e.pipelineRepo.FinishStep(ctx, runID, domain.StepEditor, domain.StepStatusRunning, nil, nil, nil); err != nil {
		return domain.EditorOutput{}, nil, err
	}

	output, err := e.llmClient.Invoke(ctx, "editor", map[string]any{"items": items})
	if err != nil {
		e.finishStepFailed(ctx, runID, domain.StepEditor, start, err)
		return domain.EditorOutput{}, nil, err
	}

	editorOut, err := parseEditorOutput(output)
	if err != nil {
		e.finishStepFailed(ctx, runID, domain.StepEditor, start, err)
		return domain.EditorOutput{}, nil, err
	}

	stepOutput := toOutputMap(editorOut)
	if err := e.finishStepSucceeded(ctx, runID, domain.StepEditor, start, stepOutput); err != nil {
		return domain.EditorOutput{}, nil, err
	}

	return editorOut, stepOutput, nil
}

func (e *Engine) runWriter(
	ctx context.Context,
	runID string,
	items []domain.RankedItem,
	editor domain.EditorOutput,
	feedback string,
) (domain.WriterOutput, map[string]any, error) {
	start := time.Now()
	if err := e.pipelineRepo.FinishStep(ctx, runID, domain.StepWriter, domain.StepStatusRunning, nil, nil, nil); err != nil {
		return domain.WriterOutput{}, nil, err
	}

	input := map[string]any{
		"items":    items,
		"editor":   editor,
		"feedback": feedback,
	}
	output, err := e.llmClient.Invoke(ctx, "writer", input)
	if err != nil {
		e.finishStepFailed(ctx, runID, domain.StepWriter, start, err)
		return domain.WriterOutput{}, nil, err
	}

	writerOut, err := parseWriterOutput(output)
	if err != nil {
		e.finishStepFailed(ctx, runID, domain.StepWriter, start, err)
		return domain.WriterOutput{}, nil, err
	}

	stepOutput := toOutputMap(writerOut)
	stepOutput["hasFeedback"] = feedback != ""
	if err := e.finishStepSucceeded(ctx, runID, domain.StepWriter, start, stepOutput); err != nil {
		return domain.WriterOutput{}, nil, err
	}

	return writerOut, stepOutput, nil
}

func (e *Engine) runLayout(
	ctx context.Context,
	runID string,
	writer domain.WriterOutput,
	editor domain.EditorOutput,
	illustrate domain.IllustrationOutput,
	items []domain.RankedItem,
	articles []domain.Article,
	feedback string,
) (domain.LayoutOutput, map[string]any, error) {
	start := time.Now()
	if err := e.pipelineRepo.FinishStep(ctx, runID, domain.StepLayout, domain.StepStatusRunning, nil, nil, nil); err != nil {
		return domain.LayoutOutput{}, nil, err
	}

	images := collectImageCandidates(illustrate, items, articles)
	layoutOut, matchMeta, err := e.invokeLayoutWithTemplates(ctx, runID, writer, editor, images, illustrationsForLayout(illustrate), feedback)
	if err != nil {
		e.finishStepFailed(ctx, runID, domain.StepLayout, start, err)
		return domain.LayoutOutput{}, nil, err
	}

	if err := wechatarticle.ValidateIllustrationsInHTML(layoutOut.BodyHTML, illustrationURLsForValidate(illustrate)); err != nil {
		e.finishStepFailed(ctx, runID, domain.StepLayout, start, err)
		return domain.LayoutOutput{}, nil, err
	}

	stepOutput := toOutputMap(layoutOut)
	if matchMeta != nil {
		layoutOut.TemplateMatch = matchMeta
		stepOutput["templateMatch"] = matchMeta
	}
	stepOutput["hasFeedback"] = feedback != ""
	if layoutOut.RenderEngine != "" {
		stepOutput["renderEngine"] = layoutOut.RenderEngine
	}
	if len(layoutOut.Blocks) > 0 {
		stepOutput["blocks"] = layoutOut.Blocks
	}
	if layoutOut.SelectedTemplateID != "" {
		stepOutput["selectedTemplateId"] = layoutOut.SelectedTemplateID
	}
	if layoutOut.TemplateMatch != nil {
		stepOutput["templateMatch"] = layoutOut.TemplateMatch
	}
	if err := e.finishStepSucceeded(ctx, runID, domain.StepLayout, start, stepOutput); err != nil {
		return domain.LayoutOutput{}, nil, err
	}

	return layoutOut, stepOutput, nil
}

func (e *Engine) runReview(
	ctx context.Context,
	runID string,
	writer domain.WriterOutput,
	layout domain.LayoutOutput,
	round int,
) (domain.ReviewOutput, map[string]any, error) {
	start := time.Now()
	if err := e.pipelineRepo.FinishStep(ctx, runID, domain.StepReview, domain.StepStatusRunning, nil, nil, nil); err != nil {
		return domain.ReviewOutput{}, nil, err
	}

	input := map[string]any{
		"writer": writer,
		"layout": layout,
		"round":  round,
	}
	output, err := e.llmClient.Invoke(ctx, "reviewer", input)
	if err != nil {
		e.finishStepFailed(ctx, runID, domain.StepReview, start, err)
		return domain.ReviewOutput{}, nil, err
	}

	reviewOut, err := parseReviewOutput(output)
	if err != nil {
		e.finishStepFailed(ctx, runID, domain.StepReview, start, err)
		return domain.ReviewOutput{}, nil, err
	}

	stepOutput := toOutputMap(reviewOut)
	stepOutput["round"] = round
	if err := e.finishStepSucceeded(ctx, runID, domain.StepReview, start, stepOutput); err != nil {
		return domain.ReviewOutput{}, nil, err
	}

	return reviewOut, stepOutput, nil
}

func collectImageCandidates(illustrate domain.IllustrationOutput, items []domain.RankedItem, articles []domain.Article) []map[string]string {
	images := make([]map[string]string, 0)
	seen := make(map[string]struct{})

	add := func(url, caption string) {
		if url == "" {
			return
		}
		if _, ok := seen[url]; ok {
			return
		}
		seen[url] = struct{}{}
		images = append(images, map[string]string{"url": url, "caption": caption})
	}

	for _, slot := range illustrate.Slots {
		if slot.Status == domain.IllustrationStatusReady {
			add(slot.Image.URL, slot.BindTo.Headline)
		}
	}

	if len(images) == 0 {
		byURL := make(map[string]domain.Article, len(articles))
		for _, article := range articles {
			byURL[article.URL] = article
		}
		for _, item := range items {
			if article, ok := byURL[item.URL]; ok {
				add(article.ImageURL, item.Title)
			}
		}
	}
	return images
}

func parseEditorOutput(output map[string]any) (domain.EditorOutput, error) {
	data, err := json.Marshal(output)
	if err != nil {
		return domain.EditorOutput{}, err
	}
	var result domain.EditorOutput
	if err := json.Unmarshal(data, &result); err != nil {
		return domain.EditorOutput{}, err
	}
	if result.Topic == "" {
		return domain.EditorOutput{}, fmt.Errorf("editor missing topic")
	}
	return result, nil
}

func parseWriterOutput(output map[string]any) (domain.WriterOutput, error) {
	data, err := json.Marshal(output)
	if err != nil {
		return domain.WriterOutput{}, err
	}
	var result domain.WriterOutput
	if err := json.Unmarshal(data, &result); err != nil {
		return domain.WriterOutput{}, err
	}
	if result.Title == "" || result.BodyMarkdown == "" {
		return domain.WriterOutput{}, fmt.Errorf("writer missing title or body")
	}
	return result, nil
}

func (e *Engine) invokeLayoutWithTemplates(
	ctx context.Context,
	runID string,
	writer domain.WriterOutput,
	editor domain.EditorOutput,
	images []map[string]string,
	illustrations map[string]any,
	feedback string,
) (domain.LayoutOutput, *domain.TemplateMatchResult, error) {
	if runID != "" {
		run, err := e.pipelineRepo.GetRun(ctx, runID)
		if err == nil && run.LayoutTemplateID != nil && *run.LayoutTemplateID != "" {
			tmpl, tmplErr := e.layoutTemplateRepo.GetByID(ctx, *run.LayoutTemplateID)
			if tmplErr == nil {
				return e.invokeFewshotWithPinnedTemplate(ctx, writer, editor, images, illustrations, feedback, tmpl)
			}
		}
	}

	templates, err := e.layoutTemplateRepo.List(ctx)
	if err != nil {
		return domain.LayoutOutput{}, nil, err
	}
	if len(templates) == 0 {
		output, invokeErr := e.llmClient.Invoke(ctx, "layout", map[string]any{
			"mode":          "blocks_fallback",
			"writer":        writer,
			"editor":        editor,
			"images":        images,
			"illustrations": illustrations,
			"feedback":      feedback,
		})
		if invokeErr != nil {
			return domain.LayoutOutput{}, nil, invokeErr
		}
		layoutOut, parseErr := parseLayoutOutput(output, domain.LayoutOutput{})
		return layoutOut, nil, parseErr
	}

	match, topTemplates, err := e.matchLayoutTemplates(ctx, writer, editor, templates)
	if err != nil {
		return domain.LayoutOutput{}, nil, err
	}

	output, err := e.llmClient.Invoke(ctx, "layout", map[string]any{
		"mode":          "template_fewshot",
		"writer":        writer,
		"editor":        editor,
		"images":        images,
		"illustrations": illustrations,
		"feedback":      feedback,
		"templates":     templatesToLLMInput(topTemplates),
		"templateMatch": match,
	})
	if err != nil {
		return domain.LayoutOutput{}, nil, err
	}

	primary := topTemplates[0]
	layoutOut, err := parseFewshotLayoutOutput(output, primary)
	if err != nil {
		return domain.LayoutOutput{}, nil, err
	}
	layoutOut.TemplateMatch = &match

	ids := make([]string, 0, len(topTemplates))
	for _, t := range topTemplates {
		ids = append(ids, t.ID)
	}
	_ = e.layoutTemplateRepo.IncrementUsage(ctx, ids)

	return layoutOut, &match, nil
}

func parseLayoutOutput(output map[string]any, base domain.LayoutOutput) (domain.LayoutOutput, error) {
	if base.BodyHTML != "" {
		return base, nil
	}

	data, err := json.Marshal(output)
	if err != nil {
		return domain.LayoutOutput{}, err
	}
	var result domain.LayoutOutput
	if err := json.Unmarshal(data, &result); err != nil {
		return domain.LayoutOutput{}, err
	}
	if result.Title == "" {
		result.Title = stringField(output, "title")
	}

	bodyHTML := stringField(output, "bodyHtml")
	if bodyHTML != "" {
		if err := wechatarticle.ValidateGeneratedHTML(bodyHTML); err != nil {
			return domain.LayoutOutput{}, err
		}
		result.BodyHTML = wechatarticle.EnhanceBodyHTML(bodyHTML)
		result.RenderEngine = "template_fewshot/v1"
		if result.SelectedTemplateID == "" {
			result.SelectedTemplateID = stringField(output, "selectedTemplateId")
		}
		return result, nil
	}

	if blocksRaw, ok := output["blocks"]; ok && blocksRaw != nil {
		doc, html, renderErr := wechatarticle.RenderFromOutputMap(output)
		if renderErr != nil {
			return domain.LayoutOutput{}, fmt.Errorf("layout blocks render: %w", renderErr)
		}
		result.BodyHTML = wechatarticle.EnhanceBodyHTML(html)
		result.RenderEngine = "wechatarticle/v1"
		result.Blocks = blocksToMaps(doc.Blocks)
		if result.CoverImageURL == "" {
			result.CoverImageURL = doc.CoverImageURL
		}
		if result.LayoutNotes == "" {
			result.LayoutNotes = doc.LayoutNotes
		}
		return result, nil
	}

	if result.BodyHTML == "" {
		return domain.LayoutOutput{}, fmt.Errorf("layout missing bodyHtml or blocks")
	}
	result.BodyHTML = wechatarticle.EnhanceBodyHTML(result.BodyHTML)
	result.RenderEngine = "legacy_llm_html"
	return result, nil
}

// parseLayoutOutputFromMap is used when reloading layout step output from DB.
func parseLayoutOutputFromMap(output map[string]any) (domain.LayoutOutput, error) {
	return parseLayoutOutput(output, domain.LayoutOutput{})
}

func blocksToMaps(blocks []wechatarticle.Block) []map[string]any {
	out := make([]map[string]any, 0, len(blocks))
	for _, block := range blocks {
		data, err := json.Marshal(block)
		if err != nil {
			continue
		}
		var m map[string]any
		if err := json.Unmarshal(data, &m); err != nil {
			continue
		}
		out = append(out, m)
	}
	return out
}

func parseReviewOutput(output map[string]any) (domain.ReviewOutput, error) {
	data, err := json.Marshal(output)
	if err != nil {
		return domain.ReviewOutput{}, err
	}
	var result domain.ReviewOutput
	if err := json.Unmarshal(data, &result); err != nil {
		return domain.ReviewOutput{}, err
	}
	return result, nil
}
