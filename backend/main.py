"""
FastAPI Backend Application
Indian Bank Deposit & Government Small Savings Scheme Calculator
Phase 1 to Phase 5: Production-grade REST API with strict CORS, dynamic rates catalog,
comprehensive calculation engine, DICGC splitter, and Break FD vs Overdraft Loan analyzer.
"""

import os
import sys
from typing import Dict, Any, List
from dotenv import load_dotenv

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

# Load environment variables from .env if present
load_dotenv()

# Ensure parent and current directories are on sys.path for direct or module execution
_current_dir = os.path.dirname(os.path.abspath(__file__))
_parent_dir = os.path.dirname(_current_dir)
for _p in (_parent_dir, _current_dir):
    if _p not in sys.path:
        sys.path.insert(0, _p)

try:
    from backend.schemas import (
        InvestmentRequest,
        CalculationResponse,
        BreakVsLoanRequest,
        BreakVsLoanResponse,
        GoalPlannerRequest,
        GoalPlannerResponse
    )
    from backend.engine import (
        execute_investment_calculation,
        analyze_break_vs_loan,
        compare_all_eligible_schemes,
        compute_goal_planner
    )
    from backend.config_rates import (
        BANK_FD_SLABS,
        GOVT_SCHEMES_CONFIG,
        DICGC_LIMIT,
        SAFE_PRINCIPAL_PER_BANK,
        FD_LOAN_INTEREST_MARGIN,
        PREMATURE_PENALTY
    )
except ImportError:
    from schemas import (  # type: ignore
        InvestmentRequest,
        CalculationResponse,
        BreakVsLoanRequest,
        BreakVsLoanResponse,
        GoalPlannerRequest,
        GoalPlannerResponse
    )
    from engine import (  # type: ignore
        execute_investment_calculation,
        analyze_break_vs_loan,
        compare_all_eligible_schemes,
        compute_goal_planner
    )
    from config_rates import (  # type: ignore
        BANK_FD_SLABS,
        GOVT_SCHEMES_CONFIG,
        DICGC_LIMIT,
        SAFE_PRINCIPAL_PER_BANK,
        FD_LOAN_INTEREST_MARGIN,
        PREMATURE_PENALTY
    )

# ============================================================================
# FastAPI Application Initialization
# ============================================================================
app = FastAPI(
    title="Indian Bank Deposit & Sovereign Scheme Calculator API",
    description="High-performance financial computation engine adhering to RBI norms, CBDT taxation rules, and Government Small Savings statutory guidelines.",
    version="2.0.0"
)

# ============================================================================
# Dynamic Production CORS Configuration
# ============================================================================
default_origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:4173",
    "http://127.0.0.1:4173",
]

env_origins = os.getenv("ALLOWED_ORIGINS", "")
if env_origins.strip():
    custom_origins = [orig.strip() for orig in env_origins.split(",") if orig.strip()]
    allowed_origins = list(dict.fromkeys(default_origins + custom_origins))
else:
    allowed_origins = default_origins

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:[0-9]+)?$|^https://.*\.vercel\.app$",
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["*"],
)


# ============================================================================
# Global Exception Handlers (Clean JSON Error Output)
# ============================================================================
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """
    Format Pydantic schema validation errors into human-readable messages.
    Sanitizes raw errors to avoid non-JSON-serializable ValueError objects in ctx.
    """
    formatted_errors = []
    clean_errors = []
    for err in exc.errors():
        field_path = " -> ".join(str(loc) for loc in err.get("loc", []) if loc != "body")
        msg = err.get("msg", "Invalid value")
        formatted_errors.append(f"{field_path}: {msg}" if field_path else msg)
        clean_errors.append({
            "loc": [str(x) for x in err.get("loc", [])],
            "msg": str(msg),
            "type": str(err.get("type", "value_error"))
        })

    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "detail": "; ".join(formatted_errors) or "Validation failed. Please verify input parameters.",
            "error_type": "ValidationError",
            "errors": clean_errors
        }
    )


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """
    Ensure all HTTPExceptions return structured JSON.
    """
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "detail": exc.detail,
            "error_type": "HTTPException",
            "status_code": exc.status_code
        }
    )


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    """
    Catch unhandled errors and return a clean 500 JSON without dropping connections.
    """
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "detail": f"Internal computation error: {str(exc)}",
            "error_type": "InternalServerError"
        }
    )


# ============================================================================
# Health Check Endpoint
# ============================================================================
@app.get("/health", tags=["System"])
def health_check() -> Dict[str, str]:
    """Liveness probe for backend container orchestration and monitoring."""
    return {"status": "healthy", "service": "finvault-backend"}


@app.get("/api/health", tags=["System"])
def api_health_check() -> Dict[str, str]:
    """Lightweight API health probe for frontend client warmup and monitoring."""
    return {"status": "healthy", "service": "finvault-backend"}


# ============================================================================
# Scheme & Bank Rate Catalog Endpoint
# ============================================================================
@app.get("/api/rates", tags=["Rates & Catalog"])
def get_all_rates_catalog() -> Dict[str, Any]:
    """
    Expose current bank rate matrices, statutory govt scheme parameters,
    and regulatory guardrails to populate reactive frontend client states.
    """
    return {
        "bank_fd_slabs": BANK_FD_SLABS,
        "govt_schemes": GOVT_SCHEMES_CONFIG,
        "feature_constants": {
            "dicgc_limit": DICGC_LIMIT,
            "safe_principal_per_bank": SAFE_PRINCIPAL_PER_BANK,
            "fd_loan_interest_margin": FD_LOAN_INTEREST_MARGIN,
            "premature_penalty": PREMATURE_PENALTY
        }
    }


# ============================================================================
# Master Financial Calculation Endpoint
# ============================================================================
@app.post(
    "/api/calculate",
    response_model=CalculationResponse,
    status_code=status.HTTP_200_OK,
    tags=["Calculations"],
    summary="Compute term deposit returns, tax liabilities, DICGC split, 5-bank benchmarks, and smart scheme comparisons"
)
def calculate_investment(request: InvestmentRequest) -> CalculationResponse:
    """
    Master Financial Calculation Pipeline:
    - Standardizes tenure (days, fractional years, total months).
    - Resolves rate tier based on investor age (Regular, Senior +0.50%, Super Senior +0.80%).
    - Applies RBI quarterly compounding (FD/RD) or statutory government compounding loops.
    - Runs Smart Scheme Comparison & Recommendation Engine across all eligible banks & sovereign schemes.
    - Evaluates DICGC insurance exposure and auto-splits across banks if principal exceeds ₹4,25,000.
    - Runs 5-Bank Simultaneous Comparator (SBI, PNB, BOB, HDFC, ICICI).
    - Computes Section 194A TDS, Post-Tax Maturity, and Inflation-Discounted Real Purchasing Power.
    - Generates 5-Year FD Ladder distribution if LADDER mode is requested.
    - Generates annual amortization ledger schedule.
    """
    try:
        response = execute_investment_calculation(request)
        return response
    except ValueError as ve:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(ve)
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Financial computation engine error: {str(exc)}"
        )


# ============================================================================
# Break FD vs Overdraft Loan Decision Endpoint
# ============================================================================
@app.post(
    "/api/break-vs-loan",
    response_model=BreakVsLoanResponse,
    status_code=status.HTTP_200_OK,
    tags=["Strategy Engines"],
    summary="Evaluate premature liquidation penalty vs overdraft loan against FD"
)
def evaluate_break_vs_loan(request: BreakVsLoanRequest) -> BreakVsLoanResponse:
    """
    Evaluates whether an investor requiring emergency liquidity should prematurely
    liquidate their fixed deposit (incurring penalty rate loss) or take an overdraft loan
    at Base Rate + 1.00% while allowing the FD to continue compounding.
    """
    try:
        response = analyze_break_vs_loan(request)
        return response
    except ValueError as ve:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(ve)
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Break vs Loan evaluation error: {str(exc)}"
        )


# ============================================================================
# Target Goal Planner (Reverse Wealth Engineering) Endpoint
# ============================================================================
@app.post(
    "/api/goal-planner",
    response_model=GoalPlannerResponse,
    status_code=status.HTTP_200_OK,
    tags=["Goal Planner"],
    summary="Reverse-engineer required lump-sum and monthly RD deposits for target goal"
)
def evaluate_goal_planner(request: GoalPlannerRequest) -> GoalPlannerResponse:
    """
    Reverse Wealth Engineering Endpoint:
    Computes required one-time lump-sum deposit today and required monthly recurring deposit (RD)
    to achieve the investor's target corpus (e.g. ₹10,00,000) over the requested tenure.
    Compares capital required across commercial banks and post office schemes.
    """
    try:
        response = compute_goal_planner(request)
        return response
    except ValueError as ve:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(ve)
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Goal Planner computation error: {str(exc)}"
        )


# ============================================================================
# Additive AI Advisory Routes
# ============================================================================
try:
    from backend.api.ai_routes import router as ai_router
except ImportError:
    from api.ai_routes import router as ai_router  # type: ignore

app.include_router(ai_router, prefix="/api/ai", tags=["AI Advisor"])


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    host = os.environ.get("HOST", "0.0.0.0")
    module_target = "backend.main:app" if "backend" in sys.modules else "main:app"
    uvicorn.run(module_target, host=host, port=port, reload=False)
