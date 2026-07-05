-- Add cover step to existing runs (between review and publish).
INSERT INTO pipeline_run_steps (run_id, step, status)
SELECT r.id, 'cover', 'pending'
FROM pipeline_runs r
WHERE NOT EXISTS (
    SELECT 1
    FROM pipeline_run_steps s
    WHERE s.run_id = r.id AND s.step = 'cover'
);
