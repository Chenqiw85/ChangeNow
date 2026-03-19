-- 用户的训练动作库
CREATE TABLE IF NOT EXISTS exercises (
    id          BIGSERIAL PRIMARY KEY,
    user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,                         -- e.g. "Bench Press"
    type        TEXT NOT NULL DEFAULT 'Strength training', -- e.g. "Cardio", "Swim"
    description TEXT NOT NULL DEFAULT '',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- 同一个用户不能有两个同名训练
    UNIQUE(user_id, name)
);

-- 一次训练记录（某天做了某个exercise）
CREATE TABLE IF NOT EXISTS workout_logs (
    id          BIGSERIAL PRIMARY KEY,
    user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    performed_at DATE NOT NULL DEFAULT CURRENT_DATE,   -- 哪天做的
    notes       TEXT NOT NULL DEFAULT '',
    volume      NUMERIC(7,2) NOT NULL DEFAULT 0.00,
    calories    INT NOT NULL DEFAULT 0
);

-- 每一组的详细数据
CREATE TABLE IF NOT EXISTS workout_sets (
    id             BIGSERIAL PRIMARY KEY,
    workout_log_id BIGINT NOT NULL REFERENCES workout_logs(id) ON DELETE CASCADE,
    exercise_id BIGINT NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
    set_number     INT NOT NULL,          -- 第几组（1, 2, 3...）
    weight         NUMERIC(7,2) NOT NULL, -- 重量，支持小数（比如 112.5）
    reps           INT NOT NULL,          -- 次数
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);