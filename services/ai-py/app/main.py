"""
AI Fitness Planning Service - FastAPI Entry Point

Endpoints:
  POST /v1/generate       - Generate a fitness plan (called by Go API)
  POST /v1/llm/raw        - Raw LLM completion (for testing)
  GET  /v1/health         - Health check with provider status
  GET  /v1/prompts/{name} - List available prompt versions
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from app.config import get_settings
from app.llm.gateway import get_gateway
from app.llm.models import LLMRequest, AllProvidersFailedError
from app.prompts.manager import get_prompt_manager


# ── Logging ──────────────────────────────────────────────
logging.basicConfig(
    level=get_settings().log_level,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
)
logger = logging.getLogger(__name__)


# ── Lifespan ─────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: eagerly initialize gateway so config errors surface early."""
    gateway = get_gateway()
    logger.info(f"LLM Gateway ready. Providers: {gateway.available_providers}")
    yield
    logger.info("Shutting down AI service")


app = FastAPI(
    title="AI Fitness Planning Service",
    version="0.1.0",
    lifespan=lifespan,
)

# ── Schemas ──────────────────────────────────────────────
class GeneratePlanRequest(BaseModel):
    """Request from the Go API layer to generate a fitness plan."""
    goal: str = Field(..., example="Build muscle and lose fat")
    days_per_week: int = Field(..., ge=1, le=7, example=4)
    equipment: str = Field(default="full gym", example="dumbbells and barbell")
    constraints: str = Field(default="none", example="bad left knee")
    prompt_version: str = Field(default="v1")
    preferred_provider: str | None = Field(
        default=None,
        description="Force a specific provider (e.g. 'openai' or 'anthropic')",
    )


class GeneratePlanResponse(BaseModel):
    """Response returned to the Go API layer."""
    plan_text: str
    provider: str
    model: str
    prompt_version: str
    total_tokens: int
    latency_ms: float


class RawLLMRequest(BaseModel):
    """Direct LLM request for testing."""
    system_prompt: str = ""
    user_prompt: str
    temperature: float = 0.7
    max_tokens: int = 2048
    preferred_provider: str | None = None

# ── Endpoints ────────────────────────────────────────────

@app.get("/v1/health")
async def health():
    """Health check - shows which providers are available."""
    gateway = get_gateway()
    return {
        "status": "ok",
        "providers": gateway.available_providers,
    }


@app.post("/v1/generate", response_model=GeneratePlanResponse)
async def generate_plan(req: GeneratePlanRequest):
    """
    Generate a fitness plan using the LLM Gateway.
    This is the main endpoint called by the Go API layer.
    """
    # 1. Load prompt template
    pm = get_prompt_manager()
    try:
        template = pm.get_template("fitness_plan", req.prompt_version)
    except FileNotFoundError:
        raise HTTPException(
            status_code=400,
            detail=f"Prompt version '{req.prompt_version}' not found",
        )

    # 2. Render template with user input
    system_prompt, user_prompt = template.render(
        goal=req.goal,
        days_per_week=req.days_per_week,
        equipment=req.equipment,
        constraints=req.constraints,
    )

    # 3. Send to LLM Gateway
    gateway = get_gateway()
    try:
        response = await gateway.generate(
            LLMRequest(
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                temperature=0.7,
                max_tokens=4096,
            ),
            preferred_provider=req.preferred_provider,
        )
    except AllProvidersFailedError as e:
        logger.error(f"Plan generation failed: {e}")
        raise HTTPException(status_code=502, detail=str(e))

    return GeneratePlanResponse(
        plan_text=response.content,
        provider=response.provider,
        model=response.model,
        prompt_version=req.prompt_version,
        total_tokens=response.total_tokens,
        latency_ms=response.latency_ms,
    )

@app.post("/v1/llm/raw")
async def raw_llm(req: RawLLMRequest):
    """
    Raw LLM completion endpoint for testing and debugging.
    Bypasses prompt templates - sends your prompt directly.
    """
    gateway = get_gateway()
    try:
        response = await gateway.generate(
            LLMRequest(
                system_prompt=req.system_prompt,
                user_prompt=req.user_prompt,
                temperature=req.temperature,
                max_tokens=req.max_tokens,
            ),
            preferred_provider=req.preferred_provider,
        )
    except AllProvidersFailedError as e:
        raise HTTPException(status_code=502, detail=str(e))

    return {
        "content": response.content,
        "provider": response.provider,
        "model": response.model,
        "tokens": response.total_tokens,
        "latency_ms": response.latency_ms,
    }