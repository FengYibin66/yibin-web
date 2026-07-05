package application

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/auto-wechat-tech/backend/internal/domain"
	"github.com/auto-wechat-tech/backend/internal/infrastructure/mysql"
)

func (s *ArtifactService) ensureDraft(ctx context.Context, runID string) (domain.ContentDraft, error) {
	draft, err := s.draftRepo.GetByRunID(ctx, runID)
	if err == nil {
		return draft, nil
	}
	if err != mysql.ErrNotFound {
		return domain.ContentDraft{}, err
	}
	return s.materializeDraftFromSteps(ctx, runID)
}

func (s *ArtifactService) materializeDraftFromSteps(ctx context.Context, runID string) (domain.ContentDraft, error) {
	layoutStep, layoutErr := s.pipelineRepo.GetStepDetail(ctx, runID, domain.StepLayout)
	writerStep, writerErr := s.pipelineRepo.GetStepDetail(ctx, runID, domain.StepWriter)

	if layoutErr != nil && writerErr != nil {
		return domain.ContentDraft{}, fmt.Errorf("content draft not found and no writer/layout step output")
	}

	layoutOut := parseStepOutput(layoutStep.OutputJSON)
	writerOut := parseStepOutput(writerStep.OutputJSON)

	title := firstNonEmptyString(
		stringField(layoutOut, "title"),
		stringField(writerOut, "title"),
	)
	summary := stringField(writerOut, "summary")
	bodyMarkdown := stringField(writerOut, "bodyMarkdown")
	bodyHTML := stringField(layoutOut, "bodyHtml")
	coverURL := stringField(layoutOut, "coverImageUrl")
	if coverStep, err := s.pipelineRepo.GetStepDetail(ctx, runID, domain.StepCover); err == nil {
		coverOut := parseStepOutput(coverStep.OutputJSON)
		if u := stringField(coverOut, "coverImageUrl"); u != "" {
			coverURL = u
		}
	}

	if bodyHTML == "" && bodyMarkdown == "" {
		return domain.ContentDraft{}, fmt.Errorf("writer/layout output empty, cannot materialize draft")
	}

	var digestID string
	if digest, err := s.digestRepo.GetByRunID(ctx, runID); err == nil {
		digestID = digest.ID
	}

	editorJSON := map[string]any{}
	if editorStep, err := s.pipelineRepo.GetStepDetail(ctx, runID, domain.StepEditor); err == nil {
		editorJSON = parseStepOutput(editorStep.OutputJSON)
	}

	reviewJSON := map[string]any{}
	if reviewStep, err := s.pipelineRepo.GetStepDetail(ctx, runID, domain.StepReview); err == nil {
		reviewJSON = parseStepOutput(reviewStep.OutputJSON)
	}

	draft := domain.ContentDraft{
		RunID:        runID,
		DigestID:     digestID,
		Title:        title,
		Summary:      summary,
		BodyMarkdown: bodyMarkdown,
		BodyHTML:     bodyHTML,
		CoverURL:     coverURL,
		Status:       "draft",
		EditorJSON:   editorJSON,
		ReviewJSON:   reviewJSON,
	}

	saved, err := s.draftRepo.Create(ctx, draft)
	if err != nil {
		return domain.ContentDraft{}, err
	}

	if bodyHTML != "" {
		html := bodyHTML
		_ = s.pipelineRepo.UpdateRunArtifacts(ctx, runID, nil, &html)
	}

	return saved, nil
}

func parseStepOutput(raw json.RawMessage) map[string]any {
	if len(raw) == 0 {
		return map[string]any{}
	}
	var result map[string]any
	if err := json.Unmarshal(raw, &result); err != nil {
		return map[string]any{}
	}
	return result
}

func stringField(m map[string]any, key string) string {
	value, ok := m[key]
	if !ok || value == nil {
		return ""
	}
	switch typed := value.(type) {
	case string:
		return typed
	default:
		return fmt.Sprintf("%v", typed)
	}
}

func firstNonEmptyString(values ...string) string {
	for _, value := range values {
		if value != "" {
			return value
		}
	}
	return ""
}
