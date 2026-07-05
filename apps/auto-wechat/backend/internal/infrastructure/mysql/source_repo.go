package mysql

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/auto-wechat-tech/backend/internal/domain"
)

type SourceRepository struct {
	db *sql.DB
}

func NewSourceRepository(db *sql.DB) *SourceRepository {
	return &SourceRepository{db: db}
}

func (r *SourceRepository) ListEnabled(ctx context.Context) ([]domain.Source, error) {
	const query = `
		SELECT id, name, type, category, url, weight, lang, config, enabled, created_at
		FROM sources
		WHERE enabled = true
		ORDER BY weight DESC, name ASC
	`

	rows, err := r.db.QueryContext(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("list sources: %w", err)
	}
	defer rows.Close()

	sources := make([]domain.Source, 0)
	for rows.Next() {
		var source domain.Source
		var configJSON []byte
		if err := rows.Scan(
			&source.ID,
			&source.Name,
			&source.Type,
			&source.Category,
			&source.URL,
			&source.Weight,
			&source.Lang,
			&configJSON,
			&source.Enabled,
			&source.CreatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan source: %w", err)
		}
		source.Config = configJSON
		sources = append(sources, source)
	}

	return sources, rows.Err()
}
