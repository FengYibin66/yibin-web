package mysql

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"

	"github.com/google/uuid"

	"github.com/auto-wechat-tech/backend/internal/domain"
)

type DigestRepository struct {
	db *sql.DB
}

func NewDigestRepository(db *sql.DB) *DigestRepository {
	return &DigestRepository{db: db}
}

func (r *DigestRepository) Create(ctx context.Context, runID string, items []domain.RankedItem, stats map[string]any) (domain.Digest, error) {
	itemsJSON, err := json.Marshal(items)
	if err != nil {
		return domain.Digest{}, fmt.Errorf("marshal items: %w", err)
	}

	statsJSON, err := json.Marshal(stats)
	if err != nil {
		return domain.Digest{}, fmt.Errorf("marshal stats: %w", err)
	}

	id := uuid.NewString()
	const query = `
		INSERT INTO daily_digests (id, run_id, items, stats)
		VALUES (?, ?, ?, ?)
	`

	if _, err := r.db.ExecContext(ctx, query, id, runID, itemsJSON, statsJSON); err != nil {
		return domain.Digest{}, fmt.Errorf("insert digest: %w", err)
	}

	return domain.Digest{
		ID:     id,
		RunID:  runID,
		Items:  items,
		Stats:  stats,
	}, nil
}

func (r *DigestRepository) GetByRunID(ctx context.Context, runID string) (domain.Digest, error) {
	const query = `
		SELECT id, run_id, items, stats
		FROM daily_digests
		WHERE run_id = ?
		ORDER BY created_at DESC
		LIMIT 1
	`

	var digest domain.Digest
	var itemsJSON, statsJSON []byte
	if err := r.db.QueryRowContext(ctx, query, runID).Scan(&digest.ID, &digest.RunID, &itemsJSON, &statsJSON); err != nil {
		if errorsIsNoRows(err) {
			return domain.Digest{}, ErrNotFound
		}
		return domain.Digest{}, fmt.Errorf("get digest: %w", err)
	}

	if err := json.Unmarshal(itemsJSON, &digest.Items); err != nil {
		return domain.Digest{}, fmt.Errorf("unmarshal items: %w", err)
	}
	if len(statsJSON) > 0 {
		if err := json.Unmarshal(statsJSON, &digest.Stats); err != nil {
			return domain.Digest{}, fmt.Errorf("unmarshal stats: %w", err)
		}
	}

	return digest, nil
}

func (r *DigestRepository) UpdateItems(ctx context.Context, digestID string, items []domain.RankedItem) (domain.Digest, error) {
	itemsJSON, err := json.Marshal(items)
	if err != nil {
		return domain.Digest{}, fmt.Errorf("marshal items: %w", err)
	}

	const query = `UPDATE daily_digests SET items = ? WHERE id = ?`
	result, err := r.db.ExecContext(ctx, query, itemsJSON, digestID)
	if err != nil {
		return domain.Digest{}, fmt.Errorf("update digest items: %w", err)
	}
	affected, err := result.RowsAffected()
	if err != nil {
		return domain.Digest{}, err
	}
	if affected == 0 {
		return domain.Digest{}, ErrNotFound
	}

	const selectQuery = `SELECT id, run_id, items, stats FROM daily_digests WHERE id = ?`
	var digest domain.Digest
	var returnedItemsJSON, statsJSON []byte
	if err := r.db.QueryRowContext(ctx, selectQuery, digestID).Scan(
		&digest.ID, &digest.RunID, &returnedItemsJSON, &statsJSON,
	); err != nil {
		return domain.Digest{}, fmt.Errorf("get updated digest: %w", err)
	}

	if err := json.Unmarshal(returnedItemsJSON, &digest.Items); err != nil {
		return domain.Digest{}, fmt.Errorf("unmarshal items: %w", err)
	}
	if len(statsJSON) > 0 {
		if err := json.Unmarshal(statsJSON, &digest.Stats); err != nil {
			return domain.Digest{}, fmt.Errorf("unmarshal stats: %w", err)
		}
	}

	return digest, nil
}
