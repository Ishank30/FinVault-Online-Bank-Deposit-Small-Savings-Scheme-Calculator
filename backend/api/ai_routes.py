"""
AI Routes Module (Additive & Isolated)
Provides dedicated endpoints:
- POST /api/ai/parse-intent
- POST /api/ai/generate-insights

Guaranteed Non-Breaking:
- Never interferes with core compounding math or existing endpoints.
- Catches all unexpected internal errors and returns safe, structured responses.
"""

from fastapi import APIRouter, status, Request
from pydantic import BaseModel, Field
from typing import Dict, Any, Optional

from backend.services.ai_advisory import parse_natural_prompt, generate_summary

router = APIRouter()


class ParseIntentRequest(BaseModel):
    """Payload for natural language intent parsing."""
    prompt: Optional[str] = Field(default="", description="Freeform user text or scenario")
    user_text: Optional[str] = Field(default=None, description="Alternative alias for prompt")


class GenerateInsightsRequest(BaseModel):
    """Payload for generating financial summary insights."""
    results: Optional[Dict[str, Any]] = Field(default=None, description="Calculated results object from /api/calculate")


@router.post(
    "/parse-intent",
    status_code=status.HTTP_200_OK,
    summary="Parse natural language scenario into form parameters"
)
async def parse_intent_endpoint(request: Request) -> Dict[str, Any]:
    """
    Accepts natural language scenarios (e.g. 'Save ₹50,000 yearly for my 5-year-old daughter')
    and extracts structured form values.
    Returns {} gracefully if parsing fails or lacks certainty.
    """
    try:
        body = await request.json()
    except Exception:
        body = {}

    user_text = body.get("prompt") or body.get("user_text") or ""
    if not isinstance(user_text, str):
        user_text = str(user_text)

    try:
        parsed_data = parse_natural_prompt(user_text)
        return {
            "success": True,
            "data": parsed_data,
            "raw_prompt": user_text
        }
    except Exception as exc:
        # Failsafe fallback: never crash or return 500
        return {
            "success": False,
            "data": {},
            "raw_prompt": user_text,
            "error": str(exc)
        }


@router.post(
    "/generate-insights",
    status_code=status.HTTP_200_OK,
    summary="Generate executive financial takeaway from calculation results"
)
async def generate_insights_endpoint(request: Request) -> Dict[str, Any]:
    """
    Accepts calculation result JSON and produces a 2-3 sentence grounded
    executive takeaway on post-tax efficiency and statutory advantages.
    """
    try:
        body = await request.json()
    except Exception:
        body = {}

    # Support { "results": { ... } } or passing calculation object directly at top-level
    calc_results = body.get("results") if isinstance(body.get("results"), dict) else body

    try:
        summary_text = generate_summary(calc_results)
        return {
            "success": True,
            "summary": summary_text,
            "insights": summary_text
        }
    except Exception as exc:
        # Failsafe fallback: never crash or return 500
        return {
            "success": False,
            "summary": "",
            "insights": "",
            "error": str(exc)
        }
