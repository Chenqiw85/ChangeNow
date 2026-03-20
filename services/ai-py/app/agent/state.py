"""
Agent state definition.

This TypedDict flows through every node in the LangGraph workflow.
Each node reads what it needs, adds its output, passes it forward.
"""

from typing import TypedDict


class PlannerState(TypedDict, total=False):
    """
    State that flows through the plan generation agent.

    Fields are added progressively as the pipeline runs:
      input node   → goal, days_per_week, equipment, constraints
      planner node → draft_plan
      reviewer     → review_feedback, review_passed
      reviser      → draft_plan (updated)
      formatter    → final_plan
    """

    # ── User Input (set at the start) ────────────────
    goal: str
    days_per_week: int
    equipment: str
    constraints: str

    # ── Planner Output ───────────────────────────────
    draft_plan: str          # raw LLM output from the planner

    # ── Reviewer Output ──────────────────────────────
    review_feedback: str     # what the reviewer found wrong
    review_passed: bool      # True = plan is good, False = needs revision

    # ── Revision Tracking ────────────────────────────
    revision_count: int      # how many times we've revised (prevent infinite loop)

    # ── Final Output ─────────────────────────────────
    final_plan: str          # validated, formatted JSON plan

    # ── Metadata ─────────────────────────────────────
    provider: str            # which LLM provider was used
    model: str               # which model
    total_tokens: int        # accumulated token usage
    error: str               # error message if something failed