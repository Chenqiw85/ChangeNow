"""
Agent nodes - each function is one step in the workflow.

Each node:
  1. Receives the full PlannerState
  2. Does its job (usually calling the LLM)
  3. Returns a dict of state updates (only the fields it changes)
"""

import json
import logging

from app.llm.gateway import get_gateway
from app.llm.models import LLMRequest
from app.agent.state import PlannerState

logger = logging.getLogger(__name__)

MAX_REVISIONS = 2


async def planner_node(state: PlannerState) -> dict:
    """
    Step 1: Generate an initial workout plan draft.
    """
    logger.info("Agent: running planner node")

    gateway = get_gateway()

    system = (
        "You are an expert fitness coach. "
        "Generate a detailed weekly workout plan in valid JSON format.\n"
        "JSON structure:\n"
        '{"plan_name":"string","days":[{"day":"string","focus":"string",'
        '"exercises":[{"name":"string","sets":int,"reps":"string",'
        '"rest_seconds":int,"notes":"string"}]}],"notes":"string"}'
    )

    user = (
        f"Create a {state['days_per_week']}-day weekly workout plan.\n"
        f"Goal: {state['goal']}\n"
        f"Equipment: {state['equipment']}\n"
        f"Constraints/injuries: {state['constraints']}\n\n"
        f"Respond ONLY with valid JSON."
    )

    response = await gateway.generate(LLMRequest(
        system_prompt=system,
        user_prompt=user,
        temperature=0.7,
        max_tokens=4096,
    ))

    return {
        "draft_plan": response.content,
        "provider": response.provider,
        "model": response.model,
        "total_tokens": state.get("total_tokens", 0) + response.total_tokens,
        "revision_count": 0,
    }


async def reviewer_node(state: PlannerState) -> dict:
    """
    Step 2: Review the draft plan for safety and quality issues.
    """
    logger.info("Agent: running reviewer node")

    gateway = get_gateway()

    system = (
        "You are a fitness plan reviewer. Evaluate the workout plan for:\n"
        "1. Safety - are exercises appropriate given the user's constraints?\n"
        "2. Completeness - does it cover the requested number of days?\n"
        "3. Balance - are muscle groups covered appropriately?\n"
        "4. JSON validity - is the plan valid JSON?\n\n"
        "Respond in this exact JSON format:\n"
        '{"passed": true/false, "issues": ["issue1", "issue2"]}'
    )

    user = (
        f"User constraints: {state['constraints']}\n"
        f"User goal: {state['goal']}\n"
        f"Requested days: {state['days_per_week']}\n\n"
        f"Plan to review:\n{state['draft_plan']}"
    )

    response = await gateway.generate(LLMRequest(
        system_prompt=system,
        user_prompt=user,
        temperature=0.3,  # lower temperature for more consistent reviews
        max_tokens=1024,
    ))

    # Try to parse the reviewer's response
    passed = True
    feedback = ""
    try:
        # Find JSON in the response (LLM might add extra text)
        text = response.content
        start = text.find("{")
        end = text.rfind("}") + 1
        if start >= 0 and end > start:
            review = json.loads(text[start:end])
            passed = review.get("passed", True)
            issues = review.get("issues", [])
            feedback = "; ".join(issues) if issues else "No issues found"
        else:
            feedback = "Could not parse review response"
            passed = True  # if we can't parse, just pass it through
    except json.JSONDecodeError:
        feedback = "Review response was not valid JSON, passing through"
        passed = True

    logger.info(f"Agent: review result - passed={passed}, feedback={feedback}")

    return {
        "review_passed": passed,
        "review_feedback": feedback,
        "total_tokens": state.get("total_tokens", 0) + response.total_tokens,
    }


async def reviser_node(state: PlannerState) -> dict:
    """
    Step 3: Revise the plan based on reviewer feedback.
    Only runs if the reviewer found issues.
    """
    logger.info(f"Agent: running reviser node (revision #{state.get('revision_count', 0) + 1})")

    gateway = get_gateway()

    system = (
        "You are an expert fitness coach. "
        "You received feedback on a workout plan. "
        "Fix the issues while keeping the plan structure.\n"
        "Respond ONLY with the corrected plan in valid JSON format."
    )

    user = (
        f"Original plan:\n{state['draft_plan']}\n\n"
        f"Issues found:\n{state['review_feedback']}\n\n"
        f"User constraints: {state['constraints']}\n"
        f"User goal: {state['goal']}\n\n"
        f"Fix these issues and return the corrected plan as valid JSON."
    )

    response = await gateway.generate(LLMRequest(
        system_prompt=system,
        user_prompt=user,
        temperature=0.5,
        max_tokens=4096,
    ))

    return {
        "draft_plan": response.content,  # overwrite the draft with revised version
        "revision_count": state.get("revision_count", 0) + 1,
        "total_tokens": state.get("total_tokens", 0) + response.total_tokens,
    }


async def formatter_node(state: PlannerState) -> dict:
    """
    Step 4: Final formatting - ensure the output is valid JSON.
    If it's already valid, pass through. If not, ask LLM to fix it.
    """
    logger.info("Agent: running formatter node")

    draft = state["draft_plan"]

    # Try to extract JSON from the draft
    try:
        start = draft.find("{")
        end = draft.rfind("}") + 1
        if start >= 0 and end > start:
            json_str = draft[start:end]
            json.loads(json_str)  # validate it parses
            return {"final_plan": json_str}
    except json.JSONDecodeError:
        pass

    # If we can't extract valid JSON, ask LLM to fix it
    logger.warning("Agent: draft plan is not valid JSON, asking LLM to fix")

    gateway = get_gateway()
    response = await gateway.generate(LLMRequest(
        system_prompt="Convert the following text into valid JSON matching the workout plan schema. Respond ONLY with JSON.",
        user_prompt=draft,
        temperature=0.2,
        max_tokens=4096,
    ))

    # Try one more time
    text = response.content
    try:
        start = text.find("{")
        end = text.rfind("}") + 1
        if start >= 0 and end > start:
            json_str = text[start:end]
            json.loads(json_str)
            return {
                "final_plan": json_str,
                "total_tokens": state.get("total_tokens", 0) + response.total_tokens,
            }
    except json.JSONDecodeError:
        pass

    # Last resort: return as-is
    return {
        "final_plan": draft,
        "error": "Could not produce valid JSON",
    }