# 0005: Use Versioned YAML Prompts

## Status

Accepted.

## Context

Fitness-plan prompt wording changes frequently. Prompt edits need versioning so outputs can be traced to the prompt that produced them.

## Decision

Store prompt templates as YAML files under `services/ai-py/app/prompts/<version>/`.

## Consequences

- The API can request a `prompt_version`.
- The AI service stores the returned prompt version in the response.
- The Go worker persists `prompt_version` with the generated plan.
- Adding a prompt version is a file addition, not a code change.
- Prompt template variable names must stay compatible with `PromptTemplate.render`.

