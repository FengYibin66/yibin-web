CREATE TABLE IF NOT EXISTS image_assets (
    id              CHAR(36) PRIMARY KEY,
    name            VARCHAR(200) NOT NULL,
    url             VARCHAR(2048) NOT NULL,
    storage         VARCHAR(32) NOT NULL DEFAULT 'local_volume',
    source          VARCHAR(32) NOT NULL,
    origin_url      VARCHAR(2048) NULL,
    prompt          TEXT NULL,
    mime_type       VARCHAR(64) NOT NULL,
    byte_size       INT NOT NULL,
    width           INT NULL,
    height          INT NULL,
    content_hash    CHAR(64) NOT NULL,
    tags_json       JSON NULL,
    provenance_json JSON NULL,
    file_path       VARCHAR(512) NOT NULL,
    usage_count     INT NOT NULL DEFAULT 0,
    auto_ingested   TINYINT(1) NOT NULL DEFAULT 0,
    deleted_at      DATETIME(3) NULL,
    created_at      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE UNIQUE INDEX idx_image_assets_content_hash ON image_assets(content_hash);
CREATE INDEX idx_image_assets_source ON image_assets(source, created_at DESC);
CREATE INDEX idx_image_assets_deleted ON image_assets(deleted_at);

-- Insert illustrate step between writer and layout for existing runs.
INSERT INTO pipeline_run_steps (id, run_id, step, status)
SELECT UUID(), r.id, 'illustrate', 'pending'
FROM pipeline_runs r
WHERE NOT EXISTS (
    SELECT 1
    FROM pipeline_run_steps s
    WHERE s.run_id = r.id AND s.step = 'illustrate'
);
