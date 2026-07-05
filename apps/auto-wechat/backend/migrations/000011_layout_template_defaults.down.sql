ALTER TABLE pipeline_runs
    DROP FOREIGN KEY fk_pipeline_runs_layout_template,
    DROP COLUMN layout_template_id;

ALTER TABLE layout_templates
    DROP COLUMN is_default;
