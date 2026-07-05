ALTER TABLE content_drafts
    DROP FOREIGN KEY fk_content_drafts_read_source_preset;

ALTER TABLE content_drafts
    DROP COLUMN read_source_preset_id;

DROP TABLE IF EXISTS read_source_presets;
