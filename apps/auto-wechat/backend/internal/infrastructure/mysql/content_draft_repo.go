package mysql

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"

	"github.com/google/uuid"

	"github.com/auto-wechat-tech/backend/internal/domain"
)

type ContentDraftRepository struct {
	db *sql.DB
}

func NewContentDraftRepository(db *sql.DB) *ContentDraftRepository {
	return &ContentDraftRepository{db: db}
}

func (r *ContentDraftRepository) Create(ctx context.Context, draft domain.ContentDraft) (domain.ContentDraft, error) {
	id := uuid.NewString()
	editorJSON, err := marshalOptionalMap(draft.EditorJSON)
	if err != nil {
		return domain.ContentDraft{}, err
	}
	reviewJSON, err := marshalOptionalMap(draft.ReviewJSON)
	if err != nil {
		return domain.ContentDraft{}, err
	}

	const query = `
		INSERT INTO content_drafts (
			id, run_id, digest_id, title, summary, body_markdown, body_html,
			cover_url, cover_media_id, read_source_preset_id, status, editor_json, review_json
		)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`

	_, err = r.db.ExecContext(ctx, query,
		id,
		draft.RunID,
		nullUUID(draft.DigestID),
		draft.Title,
		draft.Summary,
		draft.BodyMarkdown,
		draft.BodyHTML,
		nullString(draft.CoverURL),
		nullString(draft.CoverMediaID),
		nullUUID(draft.ReadSourcePresetID),
		draft.Status,
		editorJSON,
		reviewJSON,
	)
	if err != nil {
		return domain.ContentDraft{}, fmt.Errorf("insert content draft: %w", err)
	}

	draft.ID = id
	return draft, nil
}

func (r *ContentDraftRepository) GetByRunID(ctx context.Context, runID string) (domain.ContentDraft, error) {
	const query = `
		SELECT id, run_id, digest_id, title, summary, body_markdown, body_html,
		       cover_url, cover_media_id, read_source_preset_id, status, editor_json, review_json
		FROM content_drafts
		WHERE run_id = ?
		ORDER BY created_at DESC
		LIMIT 1
	`

	return r.scanDraft(r.db.QueryRowContext(ctx, query, runID))
}

func (r *ContentDraftRepository) Update(ctx context.Context, id string, input domain.UpdateDraftInput) (domain.ContentDraft, error) {
	const query = `
		UPDATE content_drafts
		SET title = COALESCE(?, title),
		    summary = COALESCE(?, summary),
		    body_markdown = COALESCE(?, body_markdown),
		    body_html = COALESCE(?, body_html),
		    cover_url = COALESCE(?, cover_url),
		    read_source_preset_id = COALESCE(?, read_source_preset_id),
		    updated_at = CURRENT_TIMESTAMP(3)
		WHERE id = ?
	`

	result, err := r.db.ExecContext(ctx, query,
		input.Title,
		input.Summary,
		input.BodyMarkdown,
		input.BodyHTML,
		input.CoverURL,
		input.ReadSourcePresetID,
		id,
	)
	if err != nil {
		return domain.ContentDraft{}, fmt.Errorf("update content draft: %w", err)
	}
	affected, err := result.RowsAffected()
	if err != nil {
		return domain.ContentDraft{}, err
	}
	if affected == 0 {
		return domain.ContentDraft{}, ErrNotFound
	}

	const selectQuery = `
		SELECT id, run_id, digest_id, title, summary, body_markdown, body_html,
		       cover_url, cover_media_id, read_source_preset_id, status, editor_json, review_json
		FROM content_drafts
		WHERE id = ?
	`
	return r.scanDraft(r.db.QueryRowContext(ctx, selectQuery, id))
}

func (r *ContentDraftRepository) SavePublishResult(ctx context.Context, draftID, draftMediaID, publishMode string) error {
	const query = `
		INSERT INTO wechat_publish_results (id, draft_id, draft_media_id, publish_mode)
		VALUES (?, ?, ?, ?)
	`
	_, err := r.db.ExecContext(ctx, query, uuid.NewString(), draftID, draftMediaID, publishMode)
	if err != nil {
		return fmt.Errorf("insert publish result: %w", err)
	}
	return nil
}

func (r *ContentDraftRepository) GetPublishResultByRunID(ctx context.Context, runID string) (domain.PublishRecord, error) {
	const query = `
		SELECT wpr.draft_media_id, wpr.publish_mode, wpr.created_at
		FROM wechat_publish_results wpr
		JOIN content_drafts cd ON cd.id = wpr.draft_id
		WHERE cd.run_id = ?
		ORDER BY wpr.created_at DESC
		LIMIT 1
	`

	var record domain.PublishRecord
	if err := r.db.QueryRowContext(ctx, query, runID).Scan(&record.DraftMediaID, &record.PublishMode, &record.CreatedAt); err != nil {
		if errorsIsNoRows(err) {
			return domain.PublishRecord{}, ErrNotFound
		}
		return domain.PublishRecord{}, fmt.Errorf("get publish result: %w", err)
	}
	return record, nil
}

func (r *ContentDraftRepository) UpdateCoverMediaID(ctx context.Context, draftID, mediaID string) error {
	const query = `UPDATE content_drafts SET cover_media_id = ?, updated_at = CURRENT_TIMESTAMP(3) WHERE id = ?`
	_, err := r.db.ExecContext(ctx, query, mediaID, draftID)
	if err != nil {
		return fmt.Errorf("update cover media id: %w", err)
	}
	return nil
}

func (r *ContentDraftRepository) scanDraft(row *sql.Row) (domain.ContentDraft, error) {
	var draft domain.ContentDraft
	var digestID, coverURL, coverMediaID, readSourcePresetID *string
	var editorJSON, reviewJSON []byte

	err := row.Scan(
		&draft.ID,
		&draft.RunID,
		&digestID,
		&draft.Title,
		&draft.Summary,
		&draft.BodyMarkdown,
		&draft.BodyHTML,
		&coverURL,
		&coverMediaID,
		&readSourcePresetID,
		&draft.Status,
		&editorJSON,
		&reviewJSON,
	)
	if err != nil {
		if errorsIsNoRows(err) {
			return domain.ContentDraft{}, ErrNotFound
		}
		return domain.ContentDraft{}, fmt.Errorf("scan content draft: %w", err)
	}

	if digestID != nil {
		draft.DigestID = *digestID
	}
	if coverURL != nil {
		draft.CoverURL = *coverURL
	}
	if coverMediaID != nil {
		draft.CoverMediaID = *coverMediaID
	}
	if readSourcePresetID != nil {
		draft.ReadSourcePresetID = *readSourcePresetID
	}
	draft.EditorJSON = unmarshalMap(editorJSON)
	draft.ReviewJSON = unmarshalMap(reviewJSON)

	return draft, nil
}

func marshalOptionalMap(value map[string]any) ([]byte, error) {
	if len(value) == 0 {
		return nil, nil
	}
	return json.Marshal(value)
}

func unmarshalMap(raw []byte) map[string]any {
	if len(raw) == 0 {
		return nil
	}
	var result map[string]any
	if err := json.Unmarshal(raw, &result); err != nil {
		return nil
	}
	return result
}
