-- 一天只允许同一个用户有一条 workout_logs；同天内的重复写入会走 ON CONFLICT
-- 的 upsert 路径（见 LogWorkout handler）。
ALTER TABLE workout_logs
    ADD CONSTRAINT workout_logs_user_day_unique UNIQUE (user_id, performed_at);
