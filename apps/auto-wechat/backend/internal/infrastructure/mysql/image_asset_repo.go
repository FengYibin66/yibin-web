package mysql

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/auto-wechat-tech/backend/internal/domain"
)

type ImageAssetRepository struct {
	db *sql.DB
}

func NewImageAssetRepository(db *sql.DB) *ImageAssetRepository {
	return &ImageAssetRepository{db: db}
}

func (r *ImageAssetRepository) FindByContentHash(ctx context.Context, hash string) (domain.ImageAsset, error) {
	const query = `
		SELECT id, name, url, storage, source, origin_url, prompt, mime_type, byte_size,
		       width, height, content_hash, tags_json, provenance_json, file_path,
		       usage_count, auto_ingested, deleted_at, created_at, updated_at
		FROM image_assets
		WHERE content_hash = ? AND deleted_at IS NULL
		LIMIT 1
	`
	row := r.db.QueryRowContext(ctx, query, hash)
	return scanImageAssetRow(row)
}

func (r *ImageAssetRepository) GetByID(ctx context.Context, id string) (domain.ImageAsset, error) {
	const query = `
		SELECT id, name, url, storage, source, origin_url, prompt, mime_type, byte_size,
		       width, height, content_hash, tags_json, provenance_json, file_path,
		       usage_count, auto_ingested, deleted_at, created_at, updated_at
		FROM image_assets
		WHERE id = ? AND deleted_at IS NULL
	`
	row := r.db.QueryRowContext(ctx, query, id)
	return scanImageAssetRow(row)
}

func (r *ImageAssetRepository) Create(ctx context.Context, asset domain.ImageAsset) (domain.ImageAsset, error) {
	if asset.ID == "" {
		asset.ID = uuid.NewString()
	}
	now := time.Now().UTC()
	asset.CreatedAt = now
	asset.UpdatedAt = now

	tagsJSON, err := json.Marshal(asset.Tags)
	if err != nil {
		return domain.ImageAsset{}, err
	}
	provJSON, err := json.Marshal(asset.Provenance)
	if err != nil {
		return domain.ImageAsset{}, err
	}

	const query = `
		INSERT INTO image_assets (
			id, name, url, storage, source, origin_url, prompt, mime_type, byte_size,
			width, height, content_hash, tags_json, provenance_json, file_path,
			usage_count, auto_ingested, created_at, updated_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`
	_, err = r.db.ExecContext(ctx, query,
		asset.ID,
		asset.Name,
		asset.URL,
		string(asset.Storage),
		string(asset.Source),
		nullString(asset.OriginURL),
		nullString(asset.Prompt),
		asset.MimeType,
		asset.ByteSize,
		nullInt(asset.Width),
		nullInt(asset.Height),
		asset.ContentHash,
		tagsJSON,
		provJSON,
		asset.FilePath,
		asset.UsageCount,
		boolToTinyInt(asset.AutoIngested),
		asset.CreatedAt,
		asset.UpdatedAt,
	)
	if err != nil {
		return domain.ImageAsset{}, fmt.Errorf("create image asset: %w", err)
	}
	return asset, nil
}

func (r *ImageAssetRepository) List(ctx context.Context, filter domain.ListImageAssetsFilter) ([]domain.ImageAsset, error) {
	limit := filter.Limit
	if limit <= 0 || limit > 200 {
		limit = 50
	}
	offset := filter.Offset
	if offset < 0 {
		offset = 0
	}

	query := `
		SELECT id, name, url, storage, source, origin_url, prompt, mime_type, byte_size,
		       width, height, content_hash, tags_json, provenance_json, file_path,
		       usage_count, auto_ingested, deleted_at, created_at, updated_at
		FROM image_assets
		WHERE deleted_at IS NULL
	`
	args := make([]any, 0, 4)
	if strings.TrimSpace(filter.Source) != "" {
		query += " AND source = ?"
		args = append(args, filter.Source)
	}
	if kw := strings.TrimSpace(filter.Keyword); kw != "" {
		query += " AND (name LIKE ? OR origin_url LIKE ?)"
		like := "%" + kw + "%"
		args = append(args, like, like)
	}
	query += " ORDER BY created_at DESC LIMIT ? OFFSET ?"
	args = append(args, limit, offset)

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("list image assets: %w", err)
	}
	defer rows.Close()

	items := make([]domain.ImageAsset, 0)
	for rows.Next() {
		item, err := scanImageAssetRows(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func (r *ImageAssetRepository) IncrementUsage(ctx context.Context, id string) error {
	const query = `
		UPDATE image_assets
		SET usage_count = usage_count + 1, updated_at = CURRENT_TIMESTAMP(3)
		WHERE id = ? AND deleted_at IS NULL
	`
	res, err := r.db.ExecContext(ctx, query, id)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return ErrNotFound
	}
	return nil
}

func (r *ImageAssetRepository) SoftDelete(ctx context.Context, id string) error {
	const query = `
		UPDATE image_assets
		SET deleted_at = CURRENT_TIMESTAMP(3), updated_at = CURRENT_TIMESTAMP(3)
		WHERE id = ? AND deleted_at IS NULL
	`
	res, err := r.db.ExecContext(ctx, query, id)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return ErrNotFound
	}
	return nil
}

func scanImageAssetRow(row *sql.Row) (domain.ImageAsset, error) {
	var (
		item       domain.ImageAsset
		storage    string
		source     string
		originURL  sql.NullString
		prompt     sql.NullString
		width      sql.NullInt64
		height     sql.NullInt64
		tagsJSON   []byte
		provJSON   []byte
		deletedAt  sql.NullTime
		autoIngest int
	)
	err := row.Scan(
		&item.ID,
		&item.Name,
		&item.URL,
		&storage,
		&source,
		&originURL,
		&prompt,
		&item.MimeType,
		&item.ByteSize,
		&width,
		&height,
		&item.ContentHash,
		&tagsJSON,
		&provJSON,
		&item.FilePath,
		&item.UsageCount,
		&autoIngest,
		&deletedAt,
		&item.CreatedAt,
		&item.UpdatedAt,
	)
	if err != nil {
		if errorsIsNoRows(err) {
			return domain.ImageAsset{}, ErrNotFound
		}
		return domain.ImageAsset{}, err
	}
	return fillImageAsset(item, storage, source, originURL, prompt, width, height, tagsJSON, provJSON, deletedAt, autoIngest)
}

func scanImageAssetRows(rows *sql.Rows) (domain.ImageAsset, error) {
	var (
		item       domain.ImageAsset
		storage    string
		source     string
		originURL  sql.NullString
		prompt     sql.NullString
		width      sql.NullInt64
		height     sql.NullInt64
		tagsJSON   []byte
		provJSON   []byte
		deletedAt  sql.NullTime
		autoIngest int
	)
	err := rows.Scan(
		&item.ID,
		&item.Name,
		&item.URL,
		&storage,
		&source,
		&originURL,
		&prompt,
		&item.MimeType,
		&item.ByteSize,
		&width,
		&height,
		&item.ContentHash,
		&tagsJSON,
		&provJSON,
		&item.FilePath,
		&item.UsageCount,
		&autoIngest,
		&deletedAt,
		&item.CreatedAt,
		&item.UpdatedAt,
	)
	if err != nil {
		return domain.ImageAsset{}, err
	}
	return fillImageAsset(item, storage, source, originURL, prompt, width, height, tagsJSON, provJSON, deletedAt, autoIngest)
}

func fillImageAsset(
	item domain.ImageAsset,
	storage, source string,
	originURL, prompt sql.NullString,
	width, height sql.NullInt64,
	tagsJSON, provJSON []byte,
	deletedAt sql.NullTime,
	autoIngest int,
) (domain.ImageAsset, error) {
	item.Storage = domain.ImageStorage(storage)
	item.Source = domain.ImageSource(source)
	if originURL.Valid {
		item.OriginURL = originURL.String
	}
	if prompt.Valid {
		item.Prompt = prompt.String
	}
	if width.Valid {
		item.Width = int(width.Int64)
	}
	if height.Valid {
		item.Height = int(height.Int64)
	}
	if len(tagsJSON) > 0 {
		_ = json.Unmarshal(tagsJSON, &item.Tags)
	}
	if len(provJSON) > 0 {
		_ = json.Unmarshal(provJSON, &item.Provenance)
	}
	item.AutoIngested = autoIngest == 1
	if deletedAt.Valid {
		t := deletedAt.Time
		item.DeletedAt = &t
	}
	return item, nil
}

func nullInt(v int) any {
	if v <= 0 {
		return nil
	}
	return v
}
