-- 一天只允许同一个用户有一条 workout_logs；同天内的重复写入会走 ON CONFLICT
-- 的 upsert 路径（见 LogWorkout handler）。
--
-- 旧环境可能已存在同 (user_id, performed_at) 的重复行，所以在添加唯一约束前
-- 先合并：保留 id 最小的一行作为 canonical，sum 其余行的 volume/calories，
-- 把它们的 notes 合并进去，并把所有 workout_sets 改挂到 canonical 行上。

BEGIN;

-- 找出每个 (user_id, performed_at) 的 canonical id（只记录真正有重复的组）。
CREATE TEMP TABLE _wl_canonical ON COMMIT DROP AS
SELECT user_id, performed_at, MIN(id) AS keep_id
FROM workout_logs
GROUP BY user_id, performed_at
HAVING COUNT(*) > 1;

-- 把同组所有行的 volume/calories/notes 合并到 canonical 行。
UPDATE workout_logs wl
SET volume   = totals.total_volume,
    calories = totals.total_calories,
    notes    = totals.merged_notes
FROM (
    SELECT c.keep_id,
           SUM(wl2.volume)   AS total_volume,
           SUM(wl2.calories) AS total_calories,
           COALESCE(STRING_AGG(NULLIF(wl2.notes, ''), E'\n' ORDER BY wl2.id), '') AS merged_notes
    FROM _wl_canonical c
    JOIN workout_logs wl2
      ON wl2.user_id = c.user_id AND wl2.performed_at = c.performed_at
    GROUP BY c.keep_id
) totals
WHERE wl.id = totals.keep_id;

-- 把重复行里的 workout_sets 改挂到 canonical 行。
UPDATE workout_sets ws
SET workout_log_id = c.keep_id
FROM workout_logs wl
JOIN _wl_canonical c
  ON c.user_id = wl.user_id AND c.performed_at = wl.performed_at
WHERE ws.workout_log_id = wl.id
  AND wl.id <> c.keep_id;

-- 删掉已经腾空的重复行。
DELETE FROM workout_logs wl
USING _wl_canonical c
WHERE wl.user_id = c.user_id
  AND wl.performed_at = c.performed_at
  AND wl.id <> c.keep_id;

-- Idempotent: the runner may re-apply this file against a DB where the
-- constraint was added manually before schema_migrations existed.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'workout_logs_user_day_unique'
    ) THEN
        ALTER TABLE workout_logs
            ADD CONSTRAINT workout_logs_user_day_unique UNIQUE (user_id, performed_at);
    END IF;
END$$;

COMMIT;
