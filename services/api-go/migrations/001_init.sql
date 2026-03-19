--user
create table if not exists users(
    id bigserial primary key,
    email text unique not null,
    password_hash text not null,
    created_at timestamptz not null default now()
);

--task
create type task_status as enum('pending','running','done','failed');

create table if not exists tasks(
    id uuid primary key,
    user_id bigint not null REFERENCES users(id) on delete cascade,
    status task_status NOT NULL DEFAULT 'pending',
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    plan_id uuid
);

--plans
CREATE TABLE if NOT exists plans(
    id uuid PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) on delete cascade,
    goal TEXT,
    days_per_week INT,
    equipment TEXT,
    constraints TEXT,
    plan_text TEXT NOT NULL,
    prompt_version TEXT NOT NULL DEFAULT 'v1',
    pipeline_version TEXT NOT NULL DEFAULT 'v1',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);


