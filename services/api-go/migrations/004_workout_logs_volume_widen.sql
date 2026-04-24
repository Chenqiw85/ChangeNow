-- workout_logs.volume started life as numeric(7,2) (cap 99999.99). The daily
-- upsert in LogWorkout accumulates SUM(weight*reps) across a user's sets,
-- which can exceed the cap for heavy days and trip 22003 numeric_field_overflow.
-- Widen to numeric(10,2) (cap 99,999,999.99) — orders of magnitude more headroom.
-- Idempotent: re-running is a no-op once the column is already numeric(10,2).

ALTER TABLE workout_logs
    ALTER COLUMN volume TYPE numeric(10,2);
