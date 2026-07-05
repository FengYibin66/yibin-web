ALTER TABLE pipeline_runs
    ADD COLUMN active_job VARCHAR(64),
    ADD COLUMN active_job_at DATETIME(3);
