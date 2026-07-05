CREATE TABLE IF NOT EXISTS layout_templates (
    id              CHAR(36) PRIMARY KEY,
    name            VARCHAR(255) NOT NULL,
    description     TEXT NULL,
    article_type    VARCHAR(64) NOT NULL DEFAULT 'daily_digest',
    tags_json       JSON NULL,
    body_html       MEDIUMTEXT NOT NULL,
    has_svg         TINYINT(1) NOT NULL DEFAULT 0,
    item_count_min  INT NOT NULL DEFAULT 0,
    item_count_max  INT NOT NULL DEFAULT 99,
    quality_score   INT NOT NULL DEFAULT 80,
    usage_count     INT NOT NULL DEFAULT 0,
    is_featured     TINYINT(1) NOT NULL DEFAULT 0,
    source_run_id   CHAR(36) NULL,
    created_at      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_layout_templates_featured ON layout_templates(is_featured DESC, quality_score DESC);
CREATE INDEX idx_layout_templates_article_type ON layout_templates(article_type);
