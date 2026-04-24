# Prompt Versioning

Prompt templates live in the Python AI service:

```text
services/ai-py/app/prompts/<version>/<name>.yaml
```

The current template is:

```text
services/ai-py/app/prompts/v1/fitness_plan.yaml
```

## Template Shape

```yaml
version: "v1"
name: "fitness_plan"
description: "Generate a personalized weekly fitness plan"

system: |
  ...

user: |
  Create a {days_per_week}-day weekly workout plan...
```

The prompt manager loads the YAML and renders Python `str.format` placeholders.

Current variables for `fitness_plan`:

- `goal`
- `days_per_week`
- `equipment`
- `constraints`

## Request Flow

1. Client sends `prompt_version` to `POST /v1/plans/generate`.
2. Go API defaults it to `v1` if empty.
3. Worker passes it to the Python AI service.
4. Python loads `app/prompts/<prompt_version>/fitness_plan.yaml`.
5. Python returns `prompt_version` in the generation response.
6. Worker stores it in `plans.prompt_version`.

## Adding A Prompt Version

Create a new directory and file:

```text
services/ai-py/app/prompts/v2/fitness_plan.yaml
```

Keep the same required variables unless the API request schema is also updated.

Validate import and template loading:

```bash
cd services/ai-py
python - <<'PY'
from app.prompts.manager import get_prompt_manager
tpl = get_prompt_manager().get_template("fitness_plan", "v2")
system, user = tpl.render(
    goal="Build muscle",
    days_per_week=4,
    equipment="full gym",
    constraints="none",
)
print(tpl.version)
print(system[:80])
print(user[:80])
PY
```

## Compatibility Rules

- Do not remove existing variables unless the rendering code and API request schema change together.
- Keep output shape compatible with the frontend parser:
  - `plan_name`
  - `days`
  - day-level `day`, `focus`, `exercises`
  - exercise-level `name`, `sets`, `reps`, `rest_seconds`, `notes`
  - top-level `notes`
- Use a new version directory for behavior changes that should remain auditable.
- Store the version with generated plans by preserving `prompt_version`.

## Plain Generator vs Agent Workflow

The plain `/v1/generate` endpoint uses the YAML template.

The `/v1/generate/agent` endpoint currently uses hardcoded prompts inside `app/agent/nodes.py`. If prompt-version control is required for agent mode, move those prompts into versioned templates or include the agent prompt version in the persisted metadata.

