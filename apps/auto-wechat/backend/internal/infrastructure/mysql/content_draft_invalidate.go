package mysql

import (
	"context"
	"fmt"

	"github.com/auto-wechat-tech/backend/internal/domain"
)

func (r *ContentDraftRepository) InvalidateDownstreamContent(ctx context.Context, runID string, fromStep domain.PipelineStep) error {
	draft, err := r.GetByRunID(ctx, runID)
	if err == ErrNotFound {
		return nil
	}
	if err != nil {
		return err
	}

	fromIdx := domain.StepIndex(fromStep)
	if fromIdx < 0 {
		return fmt.Errorf("unknown step: %s", fromStep)
	}

	editorIdx := domain.StepIndex(domain.StepEditor)
	writerIdx := domain.StepIndex(domain.StepWriter)
	layoutIdx := domain.StepIndex(domain.StepLayout)
	reviewIdx := domain.StepIndex(domain.StepReview)
	coverIdx := domain.StepIndex(domain.StepCover)

	title, summary, bodyMD, bodyHTML := draft.Title, draft.Summary, draft.BodyMarkdown, draft.BodyHTML
	coverURL, coverMediaID := draft.CoverURL, draft.CoverMediaID
	editorJSON, reviewJSON := draft.EditorJSON, draft.ReviewJSON

	if fromIdx <= editorIdx {
		editorJSON = map[string]any{}
	}
	if fromIdx <= writerIdx {
		summary = ""
		bodyMD = ""
	}
	if fromIdx <= layoutIdx {
		bodyHTML = ""
	}
	if fromIdx <= reviewIdx {
		reviewJSON = map[string]any{}
	}
	if fromIdx <= coverIdx {
		coverURL = ""
		coverMediaID = ""
	}

	const query = `
		UPDATE content_drafts
		SET title = ?,
		    summary = ?,
		    body_markdown = ?,
		    body_html = ?,
		    cover_url = ?,
		    cover_media_id = ?,
		    editor_json = ?,
		    review_json = ?,
		    updated_at = CURRENT_TIMESTAMP(3)
		WHERE id = ?
	`

	editorBytes, err := marshalOptionalMap(editorJSON)
	if err != nil {
		return err
	}
	reviewBytes, err := marshalOptionalMap(reviewJSON)
	if err != nil {
		return err
	}

	_, err = r.db.ExecContext(ctx, query,
		title,
		summary,
		bodyMD,
		bodyHTML,
		nullString(coverURL),
		nullString(coverMediaID),
		editorBytes,
		reviewBytes,
		draft.ID,
	)
	if err != nil {
		return fmt.Errorf("invalidate draft content: %w", err)
	}
	return nil
}
