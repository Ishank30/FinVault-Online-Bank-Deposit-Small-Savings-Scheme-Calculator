"""
AI Advisory Service (Standalone Additive Layer)
Provides:
1. Natural language intent parsing for one-click form auto-fill.
2. Executive commentary and grounded financial takeaways from calculation results.

Resilience Guarantee:
- Zero external dependency breakage.
- Gracefully detects OpenAI or Gemini API keys from environment.
- If LLM times out, fails, or lacks API keys, transparently falls back to
  robust rule-based financial reasoning without raising exceptions.
"""

import os
import re
import json
import logging
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)

# Timeout in seconds for external LLM HTTP calls
LLM_TIMEOUT_SECONDS = 7.0


def _extract_amount_heuristic(text: str) -> Optional[float]:
    """Extract deposit amount from natural text (e.g. ₹50k, 1.5 Lakh, 50,000, 10 Lakhs, 1 Crore)."""
    clean = text.lower().replace(',', '')

    # Check for Crore
    cr_match = re.search(r'([0-9]+(?:\.[0-9]+)?)\s*(?:cr|crore|crores)', clean)
    if cr_match:
        try:
            return float(cr_match.group(1)) * 10_000_000.0
        except ValueError:
            pass

    # Check for Lakh / Lac
    lakh_match = re.search(r'([0-9]+(?:\.[0-9]+)?)\s*(?:lakh|lakhs|lac|lacs|l)\b', clean)
    if lakh_match:
        try:
            return float(lakh_match.group(1)) * 100_000.0
        except ValueError:
            pass

    # Check for 'k' / thousand
    k_match = re.search(r'([0-9]+(?:\.[0-9]+)?)\s*(?:k|thousand|thousands)\b', clean)
    if k_match:
        try:
            return float(k_match.group(1)) * 1_000.0
        except ValueError:
            pass

    # Check for explicit rupee or standalone numbers (e.g. ₹50000, Rs. 10000, or 50000)
    num_match = re.search(r'(?:₹|rs\.?|inr)?\s*([0-9]{3,10})(?:\.[0-9]+)?', clean)
    if num_match:
        try:
            val = float(num_match.group(1))
            if val >= 250:  # Minimum realistic deposit
                return val
        except ValueError:
            pass

    return None


def _extract_age_heuristic(text: str) -> Optional[int]:
    """Extract age from phrases like '5-year-old daughter', 'age 65', 'aged 35'."""
    clean = text.lower()

    # 'X year old', 'X-year-old', 'X yr old'
    yo_match = re.search(r'([0-9]{1,2})\s*(?:-| )?\s*(?:year|yr)s?(?:-| )?\s*old\b', clean)
    if yo_match:
        try:
            return int(yo_match.group(1))
        except ValueError:
            pass

    # 'age 65', 'aged 35'
    age_match = re.search(r'\b(?:age|aged)\s*(?:of|is)?\s*([0-9]{1,2})\b', clean)
    if age_match:
        try:
            return int(age_match.group(1))
        except ValueError:
            pass

    # 'senior citizen'
    if 'senior citizen' in clean or 'senior' in clean or 'retiree' in clean or 'retired' in clean:
        if 'super senior' in clean:
            return 80
        return 65

    return None


def _extract_tenure_heuristic(text: str) -> Dict[str, int]:
    """Extract tenure years, months, or days from prompt."""
    clean = text.lower()
    tenure: Dict[str, int] = {}

    # Check for days (e.g. 444 days)
    days_match = re.search(r'\b([0-9]{2,4})\s*(?:days|d)\b', clean)
    if days_match:
        try:
            tenure["days"] = int(days_match.group(1))
        except ValueError:
            pass

    # Check for months (e.g. 6 months, 36 months)
    months_match = re.search(r'\b([0-9]{1,2})\s*(?:months?|mo|m)\b', clean)
    if months_match:
        try:
            tenure["months"] = int(months_match.group(1))
        except ValueError:
            pass

    # Check for years (e.g. 5 years, 3 yr) - avoid matching '5-year-old'
    years_match = re.search(r'\b([0-9]{1,2})\s*(?:years?|yrs?|y)\b(?!\s*-?\s*old)', clean)
    if years_match:
        try:
            tenure["years"] = int(years_match.group(1))
        except ValueError:
            pass

    return tenure


def _heuristic_parse_prompt(user_text: str) -> Dict[str, Any]:
    """
    Robust rule-based parser that maps freeform natural language
    into FinVault application form parameters.
    """
    if not user_text or not user_text.strip():
        return {}

    text_lower = user_text.lower()
    parsed: Dict[str, Any] = {}

    # 1. Scheme / Category Detection
    if any(k in text_lower for k in ["sukanya", "ssy", "daughter", "girl child", "girl"]):
        parsed["category"] = "GOVT_SCHEME"
        parsed["selected_scheme"] = "SSY"
        parsed["gender"] = "FEMALE"
        parsed["years"] = 21
        parsed["months"] = 0
        parsed["days"] = 0
    elif any(k in text_lower for k in ["ppf", "public provident fund", "provident fund"]):
        parsed["category"] = "GOVT_SCHEME"
        parsed["selected_scheme"] = "PPF"
        parsed["years"] = 15
        parsed["months"] = 0
        parsed["days"] = 0
    elif any(k in text_lower for k in ["scss", "senior citizen savings", "senior citizen scheme"]):
        parsed["category"] = "GOVT_SCHEME"
        parsed["selected_scheme"] = "SCSS"
        parsed["years"] = 5
        parsed["months"] = 0
        parsed["days"] = 0
        parsed["age"] = 65
    elif any(k in text_lower for k in ["pomis", "post office monthly", "monthly income scheme"]):
        parsed["category"] = "GOVT_SCHEME"
        parsed["selected_scheme"] = "POMIS"
        parsed["years"] = 5
        parsed["months"] = 0
        parsed["days"] = 0
    elif any(k in text_lower for k in ["nsc", "national savings certificate"]):
        parsed["category"] = "GOVT_SCHEME"
        parsed["selected_scheme"] = "NSC"
        parsed["years"] = 5
        parsed["months"] = 0
        parsed["days"] = 0
    elif any(k in text_lower for k in ["ladder", "staggered", "tranche"]):
        parsed["category"] = "BANK_FD"
        parsed["calculation_mode"] = "LADDER"
        parsed["years"] = 5
        parsed["months"] = 0
        parsed["days"] = 0
    elif any(k in text_lower for k in ["rd", "recurring", "monthly deposit", "per month", "every month"]):
        parsed["category"] = "BANK_RD"
        parsed["selected_bank"] = "SBI"
    elif any(k in text_lower for k in ["fd", "fixed deposit", "term deposit", "bank"]):
        parsed["category"] = "BANK_FD"
        parsed["selected_bank"] = "SBI"

    # 2. Bank Identification
    if "sbi" in text_lower or "state bank" in text_lower:
        parsed["selected_bank"] = "SBI"
        if "category" not in parsed:
            parsed["category"] = "BANK_FD"
    elif "pnb" in text_lower or "punjab national" in text_lower:
        parsed["selected_bank"] = "PNB"
        if "category" not in parsed:
            parsed["category"] = "BANK_FD"
    elif "bob" in text_lower or "bank of baroda" in text_lower or "baroda" in text_lower:
        parsed["selected_bank"] = "BOB"
        if "category" not in parsed:
            parsed["category"] = "BANK_FD"
    elif "hdfc" in text_lower:
        parsed["selected_bank"] = "HDFC"
        if "category" not in parsed:
            parsed["category"] = "BANK_FD"
    elif "icici" in text_lower:
        parsed["selected_bank"] = "ICICI"
        if "category" not in parsed:
            parsed["category"] = "BANK_FD"

    # 3. Amount Extraction
    amt = _extract_amount_heuristic(user_text)
    if amt is not None:
        parsed["amount"] = amt

    # 4. Age Extraction
    extracted_age = _extract_age_heuristic(user_text)
    if extracted_age is not None:
        parsed["age"] = extracted_age

    # 5. Gender Detection (if not already set by SSY)
    if "gender" not in parsed:
        if re.search(r'\b(daughter|girl|female|she|her|mother|sister|wife|woman|women)\b', text_lower):
            parsed["gender"] = "FEMALE"
        elif re.search(r'\b(son|boy|male|he|his|him|father|brother|husband|man|men)\b', text_lower):
            parsed["gender"] = "MALE"

    # 6. Tenure Extraction (if not fixed by statutory scheme)
    if parsed.get("category") != "GOVT_SCHEME":
        tenure_info = _extract_tenure_heuristic(user_text)
        if "years" in tenure_info:
            parsed["years"] = tenure_info["years"]
        if "months" in tenure_info:
            parsed["months"] = tenure_info["months"]
        if "days" in tenure_info:
            parsed["days"] = tenure_info["days"]

    # 7. Tax Bracket Detection
    tax_match = re.search(r'\b([0-9]{1,2})\s*%\s*(?:tax|slab|bracket)', text_lower)
    if tax_match:
        try:
            slab_pct = float(tax_match.group(1)) / 100.0
            if slab_pct in [0.0, 0.05, 0.10, 0.15, 0.20, 0.30]:
                parsed["tax_slab"] = slab_pct
        except ValueError:
            pass
    elif "highest tax" in text_lower or "30%" in text_lower:
        parsed["tax_slab"] = 0.30
    elif "zero tax" in text_lower or "nil tax" in text_lower or "exempt" in text_lower:
        parsed["tax_slab"] = 0.0

    # Minimum certainty requirement: must contain at least one meaningful financial parameter
    core_financial_keys = {"category", "selected_scheme", "selected_bank", "amount", "age", "years", "months", "days", "calculation_mode"}
    if not any(k in parsed for k in core_financial_keys):
        return {}

    return parsed


def _call_external_llm_json(system_prompt: str, user_prompt: str) -> Optional[Dict[str, Any]]:
    """
    Attempt to invoke OpenAI or Gemini via HTTP REST with a strict timeout.
    Returns parsed JSON dict on success, None on any failure.
    """
    try:
        import httpx  # Standard library in virtualenv
    except ImportError:
        return None

    # Check for OpenAI Key
    openai_key = os.getenv("OPENAI_API_KEY")
    if openai_key:
        try:
            with httpx.Client(timeout=LLM_TIMEOUT_SECONDS) as client:
                res = client.post(
                    "https://api.openai.com/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {openai_key}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "model": "gpt-4o-mini",
                        "response_format": {"type": "json_object"},
                        "messages": [
                            {"role": "system", "content": system_prompt},
                            {"role": "user", "content": user_prompt}
                        ],
                        "temperature": 0.1,
                        "max_tokens": 400
                    }
                )
                if res.status_code == 200:
                    data = res.json()
                    content = data["choices"][0]["message"]["content"]
                    return json.loads(content)
        except Exception as e:
            logger.warning("OpenAI API call failed or timed out: %s", e)

    # Check for Gemini Key
    gemini_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    if gemini_key:
        try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={gemini_key}"
            with httpx.Client(timeout=LLM_TIMEOUT_SECONDS) as client:
                res = client.post(
                    url,
                    headers={"Content-Type": "application/json"},
                    json={
                        "contents": [{
                            "parts": [{"text": f"{system_prompt}\n\nUser text:\n{user_prompt}\nOutput valid JSON only."}]
                        }],
                        "generationConfig": {
                            "responseMimeType": "application/json",
                            "temperature": 0.1,
                            "maxOutputTokens": 400
                        }
                    }
                )
                if res.status_code == 200:
                    data = res.json()
                    text = data["candidates"][0]["content"]["parts"][0]["text"]
                    return json.loads(text)
        except Exception as e:
            logger.warning("Gemini API call failed or timed out: %s", e)

    return None


def parse_natural_prompt(user_text: str) -> Dict[str, Any]:
    """
    Step 1: Auto-Fill Parsing
    Accepts freeform user text (e.g. 'Save ₹50,000 yearly for my 5-year-old daughter').
    Uses structured output to extract matching form fields:
    {'category': 'GOVT_SCHEME', 'selected_scheme': 'SSY', 'amount': 50000, 'age': 5, 'gender': 'FEMALE', 'years': 15}
    If parsing fails or lacks certainty, returns an empty dict {} gracefully.
    """
    if not user_text or not isinstance(user_text, str) or not user_text.strip():
        return {}

    # Fast heuristic baseline
    heuristic_data = _heuristic_parse_prompt(user_text)

    # If an LLM API key exists, attempt structured extraction to enrich/validate
    has_api_key = bool(os.getenv("OPENAI_API_KEY") or os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY"))
    if has_api_key:
        system_prompt = (
            "You are a financial form intent extractor for an Indian banking and sovereign scheme calculator. "
            "Extract parameters from user prompt into a JSON object with these allowed keys: "
            "category (one of 'BANK_FD', 'BANK_RD', 'GOVT_SCHEME'), "
            "selected_bank (one of 'SBI', 'PNB', 'BOB', 'HDFC', 'ICICI'), "
            "selected_scheme (one of 'PPF', 'SSY', 'SCSS', 'POMIS', 'NSC'), "
            "amount (number), age (integer), gender ('MALE' or 'FEMALE'), "
            "years (integer), months (integer), days (integer), calculation_mode ('STANDARD' or 'LADDER'), "
            "tax_slab (float, e.g. 0.0, 0.05, 0.10, 0.15, 0.20, 0.30). "
            "Only include keys you are confident in. If no financial intent is recognized, return {}."
        )
        llm_result = _call_external_llm_json(system_prompt, user_text)
        if llm_result and isinstance(llm_result, dict):
            # Merge LLM results over heuristic defaults
            merged = {**heuristic_data, **llm_result}
            # Clean up empty or null values
            clean_result = {k: v for k, v in merged.items() if v is not None}
            return clean_result

    return heuristic_data


def generate_summary(calculated_results: Dict[str, Any]) -> str:
    """
    Step 1: Executive Commentary Generator
    Accepts the exact JSON output that the existing /api/calculate endpoint produces.
    Generates a 2-3 sentence grounded advisory takeaway focusing on post-tax efficiency
    and statutory benefits.
    """
    if not calculated_results or not isinstance(calculated_results, dict):
        return ""

    principal = calculated_results.get("principal", 0)
    maturity = calculated_results.get("maturity_amount", 0)
    post_tax_maturity = calculated_results.get("net_post_tax_maturity", maturity)
    interest_earned = calculated_results.get("total_interest_earned", 0)
    tax_payable = calculated_results.get("estimated_tax_payable", 0)
    rate = calculated_results.get("applicable_interest_rate", 0)
    post_tax_yield = calculated_results.get("post_tax_annualized_yield", rate)
    scheme_name = calculated_results.get("institution_or_scheme_name", "Fixed Deposit")
    tax_status = calculated_results.get("tax_status", "")
    mode = calculated_results.get("calculation_mode", "STANDARD")
    dicgc_info = calculated_results.get("dicgc_analysis", {})
    comparison = calculated_results.get("comparison", {})

    # If external LLM key is present, attempt dynamic generation
    has_api_key = bool(os.getenv("OPENAI_API_KEY") or os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY"))
    if has_api_key:
        system_prompt = (
            "You are a Senior Wealth Advisor in India. Write a 2 to 3 sentence grounded executive financial summary "
            "focusing specifically on post-tax efficiency, statutory benefits (e.g. 80C EEE or Section 194A TDS), "
            "and liquidity based on the provided investment calculation results. "
            "Do NOT include boilerplate greetings or signatures. Only return the 2-3 sentence commentary."
        )
        context_str = json.dumps({
            "scheme": scheme_name,
            "principal": principal,
            "maturity_amount": maturity,
            "post_tax_maturity": post_tax_maturity,
            "tax_payable": tax_payable,
            "interest_rate": rate,
            "post_tax_yield": post_tax_yield,
            "tax_status": tax_status,
            "is_fully_insured": dicgc_info.get("is_fully_insured", True),
            "best_alternative": comparison.get("best_pick", {}).get("scheme_name") if comparison else None
        })
        llm_response = _call_external_llm_json(system_prompt, context_str)
        if llm_response and isinstance(llm_response, dict) and "summary" in llm_response:
            return str(llm_response["summary"]).strip()
        elif llm_response and isinstance(llm_response, str) and len(llm_response.strip()) > 10:
            return llm_response.strip()

    # Grounded Deterministic Advisory Fallback (100% Reliable, Zero Dependency)
    formatted_principal = f"₹{principal:,.0f}"
    formatted_maturity = f"₹{maturity:,.0f}"
    formatted_post_tax = f"₹{post_tax_maturity:,.0f}"
    formatted_interest = f"₹{interest_earned:,.0f}"
    formatted_tax = f"₹{tax_payable:,.0f}"

    if mode == "LADDER":
        return (
            f"Your 5-Year FD Ladder divides {formatted_principal} across 5 staggered tranches, unlocking 20% guaranteed annual "
            f"liquidity every 12 months at an effective blended rate of {rate:.2f}% p.a. This strategy protects your wealth from "
            f"reinvestment rate shocks while delivering a projected cumulative maturity of {formatted_maturity}."
        )

    if "PPF" in scheme_name.upper() or "SUKANYA" in scheme_name.upper() or "SSY" in scheme_name.upper():
        tax_saved_str = f"saving approximately {formatted_tax} in income tax" if tax_payable > 0 else "safeguarding 100% of your earnings"
        return (
            f"Because {scheme_name} enjoys sovereign Exempt-Exempt-Exempt (EEE) status, your entire maturity of {formatted_post_tax} "
            f"remains completely tax-free, {tax_saved_str} compared to standard taxable deposits. This sovereign guarantee delivers "
            f"an inflation-beating effective post-tax yield of {post_tax_yield:.2f}% p.a. with zero credit risk."
        )

    if "SCSS" in scheme_name.upper() or "SENIOR" in scheme_name.upper():
        return (
            f"The Senior Citizen Savings Scheme locks in a sovereign-backed {rate:.2f}% p.a. return with quarterly income payouts "
            f"totaling {formatted_interest} over 5 years. It maximizes post-retirement cashflow stability while offering Section 80C "
            f"deductions on the initial deposit."
        )

    if "POMIS" in scheme_name.upper():
        return (
            f"Post Office Monthly Income Scheme provides a sovereign-guaranteed {rate:.2f}% p.a. return, translating into disciplined "
            f"monthly cash disbursements while preserving your complete principal of {formatted_principal} safely at maturity."
        )

    # Commercial Bank FD / RD
    dicgc_flag = dicgc_info.get("is_fully_insured", True)
    dicgc_note = ""
    if not dicgc_flag:
        uninsured = dicgc_info.get("uninsured_amount", 0)
        dicgc_note = f" Since ₹{uninsured:,.0f} exceeds the DICGC insurance limit, consider using multi-bank auto-splitting."

    if tax_payable > 0:
        return (
            f"Your {formatted_principal} deposit in {scheme_name} generates {formatted_interest} in gross interest at {rate:.2f}% p.a., "
            f"resulting in a net post-tax maturity of {formatted_post_tax} after {formatted_tax} tax liability.{dicgc_note} "
            f"The effective net annualized yield stands at {post_tax_yield:.2f}% p.a."
        )

    return (
        f"Your {formatted_principal} investment in {scheme_name} yields a guaranteed maturity of {formatted_maturity} "
        f"at an annual rate of {rate:.2f}% p.a.{dicgc_note} This provides steady wealth accumulation with predictable liquidity."
    )
