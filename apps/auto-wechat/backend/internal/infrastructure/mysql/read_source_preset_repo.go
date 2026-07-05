package mysql

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/google/uuid"

	"github.com/auto-wechat-tech/backend/internal/domain"
)

type ReadSourcePresetRepository struct {
	db *sql.DB
}

func NewReadSourcePresetRepository(db *sql.DB) *ReadSourcePresetRepository {
	return &ReadSourcePresetRepository{db: db}
}

func (r *ReadSourcePresetRepository) List(ctx context.Context) ([]domain.ReadSourcePreset, error) {
	const query = `
		SELECT id, label, url, sort_order, created_at
		FROM read_source_presets
		ORDER BY sort_order ASC, created_at ASC
	`
	rows, err := r.db.QueryContext(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("list read source presets: %w", err)
	}
	defer rows.Close()

	presets := make([]domain.ReadSourcePreset, 0)
	for rows.Next() {
		var preset domain.ReadSourcePreset
		if err := rows.Scan(&preset.ID, &preset.Label, &preset.URL, &preset.SortOrder, &preset.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan read source preset: %w", err)
		}
		presets = append(presets, preset)
	}
	return presets, rows.Err()
}

func (r *ReadSourcePresetRepository) GetByID(ctx context.Context, id string) (domain.ReadSourcePreset, error) {
	const query = `
		SELECT id, label, url, sort_order, created_at
		FROM read_source_presets
		WHERE id = ?
	`
	var preset domain.ReadSourcePreset
	err := r.db.QueryRowContext(ctx, query, id).Scan(
		&preset.ID, &preset.Label, &preset.URL, &preset.SortOrder, &preset.CreatedAt,
	)
	if err != nil {
		if errorsIsNoRows(err) {
			return domain.ReadSourcePreset{}, ErrNotFound
		}
		return domain.ReadSourcePreset{}, fmt.Errorf("get read source preset: %w", err)
	}
	return preset, nil
}

func (r *ReadSourcePresetRepository) First(ctx context.Context) (domain.ReadSourcePreset, error) {
	const query = `
		SELECT id, label, url, sort_order, created_at
		FROM read_source_presets
		ORDER BY sort_order ASC, created_at ASC
		LIMIT 1
	`
	var preset domain.ReadSourcePreset
	err := r.db.QueryRowContext(ctx, query).Scan(
		&preset.ID, &preset.Label, &preset.URL, &preset.SortOrder, &preset.CreatedAt,
	)
	if err != nil {
		if errorsIsNoRows(err) {
			return domain.ReadSourcePreset{}, ErrNotFound
		}
		return domain.ReadSourcePreset{}, fmt.Errorf("get first read source preset: %w", err)
	}
	return preset, nil
}

func (r *ReadSourcePresetRepository) Create(ctx context.Context, input domain.CreateReadSourcePresetInput) (domain.ReadSourcePreset, error) {
	id := uuid.NewString()
	const maxOrderQuery = `SELECT COALESCE(MAX(sort_order), -1) + 1 FROM read_source_presets`
	var sortOrder int
	if err := r.db.QueryRowContext(ctx, maxOrderQuery).Scan(&sortOrder); err != nil {
		return domain.ReadSourcePreset{}, fmt.Errorf("next sort order: %w", err)
	}

	const query = `
		INSERT INTO read_source_presets (id, label, url, sort_order)
		VALUES (?, ?, ?, ?)
	`
	if _, err := r.db.ExecContext(ctx, query, id, input.Label, input.URL, sortOrder); err != nil {
		return domain.ReadSourcePreset{}, fmt.Errorf("insert read source preset: %w", err)
	}
	return r.GetByID(ctx, id)
}

func (r *ReadSourcePresetRepository) Count(ctx context.Context) (int, error) {
	const query = `SELECT COUNT(*) FROM read_source_presets`
	var count int
	if err := r.db.QueryRowContext(ctx, query).Scan(&count); err != nil {
		return 0, fmt.Errorf("count read source presets: %w", err)
	}
	return count, nil
}

func (r *ReadSourcePresetRepository) Delete(ctx context.Context, id string) error {
	const query = `DELETE FROM read_source_presets WHERE id = ?`
	result, err := r.db.ExecContext(ctx, query, id)
	if err != nil {
		return fmt.Errorf("delete read source preset: %w", err)
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
