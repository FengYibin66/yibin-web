CREATE TABLE IF NOT EXISTS pipeline_runs (
    id              CHAR(36) PRIMARY KEY,
    status          VARCHAR(32) NOT NULL DEFAULT 'queued',
    publish_mode    VARCHAR(32) NOT NULL DEFAULT 'draft_only',
    triggered_by    VARCHAR(255),
    error_message   TEXT,
    draft_media_id  TEXT,
    preview_html    MEDIUMTEXT,
    started_at      DATETIME(3),
    finished_at     DATETIME(3),
    created_at      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS pipeline_run_steps (
    id            CHAR(36) PRIMARY KEY,
    run_id        CHAR(36) NOT NULL,
    step          VARCHAR(32) NOT NULL,
    status        VARCHAR(32) NOT NULL DEFAULT 'pending',
    input_json    JSON,
    output_json   JSON,
    error_message TEXT,
    duration_ms   INT,
    started_at    DATETIME(3),
    finished_at   DATETIME(3),
    UNIQUE KEY uq_pipeline_run_steps_run_step (run_id, step),
    CONSTRAINT fk_pipeline_run_steps_run
        FOREIGN KEY (run_id) REFERENCES pipeline_runs(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_pipeline_runs_status ON pipeline_runs(status);
CREATE INDEX idx_pipeline_runs_created_at ON pipeline_runs(created_at DESC);
CREATE INDEX idx_pipeline_run_steps_run_id ON pipeline_run_steps(run_id);

CREATE TABLE IF NOT EXISTS sources (
    id         CHAR(36) PRIMARY KEY,
    name       VARCHAR(255) NOT NULL,
    type       VARCHAR(32) NOT NULL DEFAULT 'rss',
    url        TEXT NOT NULL,
    weight     DOUBLE NOT NULL DEFAULT 1.0,
    enabled    TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS articles (
    id           CHAR(36) PRIMARY KEY,
    source_id    CHAR(36),
    title        TEXT NOT NULL,
    url          VARCHAR(2048) NOT NULL,
    source_name  VARCHAR(255),
    published_at DATETIME(3),
    summary      TEXT,
    content      MEDIUMTEXT,
    image_url    TEXT,
    language     VARCHAR(16) DEFAULT 'en',
    content_hash VARCHAR(128),
    created_at   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE KEY uq_articles_url (url(768)),
    CONSTRAINT fk_articles_source
        FOREIGN KEY (source_id) REFERENCES sources(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS daily_digests (
    id         CHAR(36) PRIMARY KEY,
    run_id     CHAR(36) NOT NULL,
    items      JSON NOT NULL,
    stats      JSON,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    CONSTRAINT fk_daily_digests_run
        FOREIGN KEY (run_id) REFERENCES pipeline_runs(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS content_drafts (
    id              CHAR(36) PRIMARY KEY,
    run_id          CHAR(36) NOT NULL,
    digest_id       CHAR(36),
    title           TEXT,
    summary         TEXT,
    body_markdown   MEDIUMTEXT,
    body_html       MEDIUMTEXT,
    cover_url       TEXT,
    cover_media_id  VARCHAR(128),
    status          VARCHAR(32) NOT NULL DEFAULT 'draft',
    created_at      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    CONSTRAINT fk_content_drafts_run
        FOREIGN KEY (run_id) REFERENCES pipeline_runs(id) ON DELETE CASCADE,
    CONSTRAINT fk_content_drafts_digest
        FOREIGN KEY (digest_id) REFERENCES daily_digests(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS wechat_publish_results (
    id              CHAR(36) PRIMARY KEY,
    draft_id        CHAR(36) NOT NULL,
    draft_media_id  VARCHAR(128),
    publish_mode    VARCHAR(32) NOT NULL,
    created_at      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    CONSTRAINT fk_wechat_publish_results_draft
        FOREIGN KEY (draft_id) REFERENCES content_drafts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
