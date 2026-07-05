package mysql

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/google/uuid"

	"github.com/auto-wechat-tech/backend/internal/domain"
	"github.com/auto-wechat-tech/backend/internal/textutil"
)

type ArticleRepository struct {
	db *sql.DB
}

func NewArticleRepository(db *sql.DB) *ArticleRepository {
	return &ArticleRepository{db: db}
}

func (r *ArticleRepository) UpsertBatch(ctx context.Context, articles []domain.Article) (int, error) {
	if len(articles) == 0 {
		return 0, nil
	}

	const query = `
		INSERT INTO articles (
			id, source_id, title, url, source_name, source_type, source_category,
			published_at, summary, content, image_url, language, content_hash
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		ON DUPLICATE KEY UPDATE
			title = VALUES(title),
			summary = VALUES(summary),
			source_type = VALUES(source_type),
			source_category = VALUES(source_category),
			published_at = COALESCE(VALUES(published_at), published_at)
	`

	inserted := 0
	for _, article := range articles {
		article = textutil.NormalizeArticle(article)
		result, err := r.db.ExecContext(ctx, query,
			uuid.NewString(),
			nullUUID(article.SourceID),
			article.Title,
			article.URL,
			article.SourceName,
			defaultString(article.SourceType, "rss"),
			nullString(article.SourceCategory),
			article.PublishedAt,
			article.Summary,
			article.Content,
			nullString(article.ImageURL),
			defaultString(article.Language, "en"),
			nullString(article.ContentHash),
		)
		if err != nil {
			return inserted, fmt.Errorf("upsert article %s: %w", article.URL, err)
		}
		affected, err := result.RowsAffected()
		if err != nil {
			return inserted, err
		}
		if affected > 0 {
			inserted++
		}
	}

	return inserted, nil
}
