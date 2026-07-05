package mysql

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/google/uuid"

	"github.com/auto-wechat-tech/backend/internal/domain"
)

type LayoutTemplateRepository struct {
	db *sql.DB
}

func NewLayoutTemplateRepository(db *sql.DB) *LayoutTemplateRepository {
	return &LayoutTemplateRepository{db: db}
}

func (r *LayoutTemplateRepository) List(ctx context.Context) ([]domain.LayoutTemplate, error) {
	const query = `
		SELECT id, name, description, article_type, tags_json, body_html,
		       has_svg, item_count_min, item_count_max, quality_score, usage_count,
		       is_featured, is_default, source_run_id, created_at, updated_at
		FROM layout_templates
		ORDER BY is_default DESC, is_featured DESC, quality_score DESC, usage_count DESC, created_at DESC
	`
	rows, err := r.db.QueryContext(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("list layout templates: %w", err)
	}
	defer rows.Close()

	items := make([]domain.LayoutTemplate, 0)
	for rows.Next() {
		item, err := scanLayoutTemplate(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func (r *LayoutTemplateRepository) ListSummaries(ctx context.Context) ([]domain.LayoutTemplateSummary, error) {
	templates, err := r.List(ctx)
	if err != nil {
		return nil, err
	}
	out := make([]domain.LayoutTemplateSummary, 0, len(templates))
	for _, t := range templates {
		out = append(out, t.Summary())
	}
	return out, nil
}

func (r *LayoutTemplateRepository) GetByName(ctx context.Context, name string) (domain.LayoutTemplate, error) {
	const query = `
		SELECT id, name, description, article_type, tags_json, body_html,
		       has_svg, item_count_min, item_count_max, quality_score, usage_count,
		       is_featured, is_default, source_run_id, created_at, updated_at
		FROM layout_templates
		WHERE name = ?
		LIMIT 1
	`
	row := r.db.QueryRowContext(ctx, query, name)
	return scanLayoutTemplateRow(row)
}

func (r *LayoutTemplateRepository) Update(ctx context.Context, id string, input domain.UpdateLayoutTemplateInput) (domain.LayoutTemplate, error) {
	tagsJSON, err := json.Marshal(input.Tags)
	if err != nil {
		return domain.LayoutTemplate{}, err
	}
	const query = `
		UPDATE layout_templates
		SET description = ?, tags_json = ?, body_html = ?, has_svg = ?,
		    item_count_min = ?, item_count_max = ?
		WHERE id = ?
	`
	result, err := r.db.ExecContext(ctx, query,
		input.Description, string(tagsJSON), input.BodyHTML, boolToTinyInt(input.HasSVG),
		input.ItemCountMin, input.ItemCountMax, id,
	)
	if err != nil {
		return domain.LayoutTemplate{}, fmt.Errorf("update layout template: %w", err)
	}
	affected, err := result.RowsAffected()
	if err != nil {
		return domain.LayoutTemplate{}, err
	}
	if affected == 0 {
		return domain.LayoutTemplate{}, ErrNotFound
	}
	return r.GetByID(ctx, id)
}

func (r *LayoutTemplateRepository) GetByID(ctx context.Context, id string) (domain.LayoutTemplate, error) {
	const query = `
		SELECT id, name, description, article_type, tags_json, body_html,
		       has_svg, item_count_min, item_count_max, quality_score, usage_count,
		       is_featured, is_default, source_run_id, created_at, updated_at
		FROM layout_templates
		WHERE id = ?
	`
	row := r.db.QueryRowContext(ctx, query, id)
	return scanLayoutTemplateRow(row)
}

func (r *LayoutTemplateRepository) GetByIDs(ctx context.Context, ids []string) ([]domain.LayoutTemplate, error) {
	if len(ids) == 0 {
		return nil, nil
	}
	placeholders := make([]string, len(ids))
	args := make([]any, len(ids))
	for i, id := range ids {
		placeholders[i] = "?"
		args[i] = id
	}
	query := fmt.Sprintf(`
		SELECT id, name, description, article_type, tags_json, body_html,
		       has_svg, item_count_min, item_count_max, quality_score, usage_count,
		       is_featured, is_default, source_run_id, created_at, updated_at
		FROM layout_templates
		WHERE id IN (%s)
	`, strings.Join(placeholders, ","))
	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("get layout templates by ids: %w", err)
	}
	defer rows.Close()

	byID := make(map[string]domain.LayoutTemplate, len(ids))
	for rows.Next() {
		item, err := scanLayoutTemplate(rows)
		if err != nil {
			return nil, err
		}
		byID[item.ID] = item
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	ordered := make([]domain.LayoutTemplate, 0, len(ids))
	for _, id := range ids {
		if item, ok := byID[id]; ok {
			ordered = append(ordered, item)
		}
	}
	return ordered, nil
}

func (r *LayoutTemplateRepository) Create(ctx context.Context, input domain.CreateLayoutTemplateInput) (domain.LayoutTemplate, error) {
	id := uuid.NewString()
	tagsJSON, err := json.Marshal(input.Tags)
	if err != nil {
		return domain.LayoutTemplate{}, err
	}
	articleType := input.ArticleType
	if articleType == "" {
		articleType = domain.LayoutArticleTypeDailyDigest
	}
	const query = `
		INSERT INTO layout_templates (
			id, name, description, article_type, tags_json, body_html,
			has_svg, item_count_min, item_count_max, quality_score, is_featured, source_run_id
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`
	sourceRunID := sql.NullString{}
	if input.SourceRunID != "" {
		sourceRunID = sql.NullString{String: input.SourceRunID, Valid: true}
	}
	quality := input.QualityScore
	if quality <= 0 {
		quality = 80
	}
	_, err = r.db.ExecContext(ctx, query,
		id, input.Name, input.Description, articleType, string(tagsJSON), input.BodyHTML,
		boolToTinyInt(input.HasSVG), input.ItemCountMin, input.ItemCountMax, quality,
		boolToTinyInt(input.IsFeatured), sourceRunID,
	)
	if err != nil {
		return domain.LayoutTemplate{}, fmt.Errorf("insert layout template: %w", err)
	}
	return r.GetByID(ctx, id)
}

func (r *LayoutTemplateRepository) IncrementUsage(ctx context.Context, ids []string) error {
	if len(ids) == 0 {
		return nil
	}
	placeholders := make([]string, len(ids))
	args := make([]any, len(ids))
	for i, id := range ids {
		placeholders[i] = "?"
		args[i] = id
	}
	query := fmt.Sprintf(`UPDATE layout_templates SET usage_count = usage_count + 1 WHERE id IN (%s)`, strings.Join(placeholders, ","))
	_, err := r.db.ExecContext(ctx, query, args...)
	return err
}

func (r *LayoutTemplateRepository) Count(ctx context.Context) (int, error) {
	var count int
	err := r.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM layout_templates`).Scan(&count)
	return count, err
}

func (r *LayoutTemplateRepository) Delete(ctx context.Context, id string) error {
	result, err := r.db.ExecContext(ctx, `DELETE FROM layout_templates WHERE id = ?`, id)
	if err != nil {
		return fmt.Errorf("delete layout template: %w", err)
	}
	affected, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if affected == 0 {
		return ErrNotFound
	}
	return nil
}

func (r *LayoutTemplateRepository) GetDefaultID(ctx context.Context, articleType string) (string, error) {
	const query = `
		SELECT id FROM layout_templates
		WHERE article_type = ? AND is_default = 1
		LIMIT 1
	`
	var id string
	err := r.db.QueryRowContext(ctx, query, articleType).Scan(&id)
	if err != nil {
		if errorsIsNoRows(err) {
			return "", nil
		}
		return "", fmt.Errorf("get default layout template: %w", err)
	}
	return id, nil
}

func (r *LayoutTemplateRepository) SetDefault(ctx context.Context, id, articleType string) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback()

	if _, err := tx.ExecContext(ctx,
		`UPDATE layout_templates SET is_default = 0 WHERE article_type = ?`, articleType,
	); err != nil {
		return fmt.Errorf("clear default layout templates: %w", err)
	}

	result, err := tx.ExecContext(ctx,
		`UPDATE layout_templates SET is_default = 1 WHERE id = ? AND article_type = ?`, id, articleType,
	)
	if err != nil {
		return fmt.Errorf("set default layout template: %w", err)
	}
	affected, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if affected == 0 {
		return ErrNotFound
	}

	return tx.Commit()
}

func scanLayoutTemplate(rows *sql.Rows) (domain.LayoutTemplate, error) {
	var item domain.LayoutTemplate
	var description sql.NullString
	var tagsJSON sql.NullString
	var sourceRunID sql.NullString
	var hasSVG, isFeatured, isDefault int
	err := rows.Scan(
		&item.ID, &item.Name, &description, &item.ArticleType, &tagsJSON, &item.BodyHTML,
		&hasSVG, &item.ItemCountMin, &item.ItemCountMax, &item.QualityScore, &item.UsageCount,
		&isFeatured, &isDefault, &sourceRunID, &item.CreatedAt, &item.UpdatedAt,
	)
	if err != nil {
		return domain.LayoutTemplate{}, fmt.Errorf("scan layout template: %w", err)
	}
	item.Description = description.String
	item.HasSVG = hasSVG == 1
	item.IsFeatured = isFeatured == 1
	item.IsDefault = isDefault == 1
	item.SourceRunID = sourceRunID.String
	item.Tags = decodeStringSliceJSON(tagsJSON.String)
	return item, nil
}

func scanLayoutTemplateRow(row *sql.Row) (domain.LayoutTemplate, error) {
	var item domain.LayoutTemplate
	var description sql.NullString
	var tagsJSON sql.NullString
	var sourceRunID sql.NullString
	var hasSVG, isFeatured, isDefault int
	err := row.Scan(
		&item.ID, &item.Name, &description, &item.ArticleType, &tagsJSON, &item.BodyHTML,
		&hasSVG, &item.ItemCountMin, &item.ItemCountMax, &item.QualityScore, &item.UsageCount,
		&isFeatured, &isDefault, &sourceRunID, &item.CreatedAt, &item.UpdatedAt,
	)
	if err != nil {
		if errorsIsNoRows(err) {
			return domain.LayoutTemplate{}, ErrNotFound
		}
		return domain.LayoutTemplate{}, fmt.Errorf("get layout template: %w", err)
	}
	item.Description = description.String
	item.HasSVG = hasSVG == 1
	item.IsFeatured = isFeatured == 1
	item.IsDefault = isDefault == 1
	item.SourceRunID = sourceRunID.String
	item.Tags = decodeStringSliceJSON(tagsJSON.String)
	return item, nil
}

func decodeStringSliceJSON(raw string) []string {
	if strings.TrimSpace(raw) == "" {
		return nil
	}
	var tags []string
	if err := json.Unmarshal([]byte(raw), &tags); err != nil {
		return nil
	}
	return tags
}

func boolToTinyInt(v bool) int {
	if v {
		return 1
	}
	return 0
}
