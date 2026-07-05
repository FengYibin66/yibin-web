ALTER TABLE layout_templates
    ADD COLUMN is_default TINYINT(1) NOT NULL DEFAULT 0 AFTER is_featured;

ALTER TABLE pipeline_runs
    ADD COLUMN layout_template_id CHAR(36) NULL AFTER triggered_by,
    ADD CONSTRAINT fk_pipeline_runs_layout_template
        FOREIGN KEY (layout_template_id) REFERENCES layout_templates(id)
        ON DELETE SET NULL;

CREATE INDEX idx_layout_templates_default ON layout_templates(article_type, is_default);
