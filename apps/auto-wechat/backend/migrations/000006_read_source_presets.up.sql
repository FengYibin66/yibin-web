CREATE TABLE IF NOT EXISTS read_source_presets (
    id          CHAR(36) PRIMARY KEY,
    label       VARCHAR(255) NOT NULL,
    url         TEXT NOT NULL,
    sort_order  INT NOT NULL DEFAULT 0,
    created_at  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_read_source_presets_sort ON read_source_presets(sort_order ASC, created_at ASC);

ALTER TABLE content_drafts
    ADD COLUMN read_source_preset_id CHAR(36) NULL,
    ADD CONSTRAINT fk_content_drafts_read_source_preset
        FOREIGN KEY (read_source_preset_id) REFERENCES read_source_presets(id) ON DELETE SET NULL;

INSERT INTO read_source_presets (id, label, url, sort_order)
VALUES (
    'a0000000-0000-4000-8000-000000000001',
    '个人主页',
    'https://fengyibin66.github.io/',
    0
);
