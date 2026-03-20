"""
LangGraph workflow definition.

This file wires the nodes together into a directed graph with
conditional edges (the review → revise loop).

Graph structure:
  planner → reviewer → [conditional] → formatter → END
                              ↓
                           reviser → reviewer (loop back)
"""

import logging
from langgraph.graph import StateGraph, END

from app.agent.state import PlannerState
from app.agent.nodes import (
    planner_node,
    reviewer_node,
    reviser_node,
    formatter_node,
    MAX_REVISIONS,
)

logger = logging.getLogger(__name__)


def should_revise(state: PlannerState) -> str:
    """
    Conditional edge after reviewer:
    - If review passed → go to formatter
    - If review failed AND under revision limit → go to reviser
    - If review failed AND at revision limit → go to formatter anyway
    """
    if state.get("review_passed", True):
        logger.info("Agent: review passed, proceeding to formatter")
        return "formatter"

    if state.get("revision_count", 0) >= MAX_REVISIONS:
        logger.warning(
            f"Agent: review failed but hit max revisions ({MAX_REVISIONS}), "
            f"proceeding to formatter with current draft"
        )
        return "formatter"

    logger.info("Agent: review failed, sending to reviser")
    return "reviser"


def build_workflow() -> StateGraph:
    """
    Build and compile the plan generation workflow.

    Returns a compiled graph that can be invoked with:
        result = await graph.ainvoke(initial_state)
    """
    # 1. Create the graph with our state type
    graph = StateGraph(PlannerState)

    # 2. Add nodes
    graph.add_node("planner", planner_node)
    graph.add_node("reviewer", reviewer_node)
    graph.add_node("reviser", reviser_node)
    graph.add_node("formatter", formatter_node)

    # 3. Add edges
    # Start → planner (entry point)
    graph.set_entry_point("planner")

    # planner → reviewer (always)
    graph.add_edge("planner", "reviewer")

    # reviewer → conditional (reviser or formatter)
    graph.add_conditional_edges("reviewer", should_revise)

    # reviser → reviewer (loop back for re-review)
    graph.add_edge("reviser", "reviewer")

    # formatter → END
    graph.add_edge("formatter", END)

    # 4. Compile
    return graph.compile()


# Singleton compiled workflow
_workflow = None


def get_workflow():
    global _workflow
    if _workflow is None:
        _workflow = build_workflow()
        logger.info("Agent workflow compiled successfully")
    return _workflow