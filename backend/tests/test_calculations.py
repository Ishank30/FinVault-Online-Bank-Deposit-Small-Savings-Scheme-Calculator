"""
Automated Test Suite for FinVault India Calculation Engine & Statutory Guardrails
Validates:
1. Bank FD Quarterly Compounding mathematical parity: A = P * (1 + r/400)^4
2. Senior (+0.50%) and Super Senior Citizen rate bumps across age brackets
3. Statutory boundary rejections (HTTP 422) for SCSS, SSY, and PPF
4. DICGC Concentration Risk Trigger (Projected maturity > ₹5,00,000)
5. Strategy Engines: 5-Year FD Ladder and Break FD vs Loan Analyzer
"""

import math
import pytest
from fastapi.testclient import TestClient

from backend.main import app
from backend.engine import (
    compute_bank_fd,
    lookup_bank_rates_all_tiers,
    compute_apy
)

client = TestClient(app)


# ============================================================================
# 1. Bank FD Quarterly Compounding Parity
# ============================================================================
def test_quarterly_compounding_math_parity():
    """
    Verify quarterly compounding parity:
    Principal P = ₹1,00,000, 1 Year (fractional_years = 1.0, 365 days) @ 6.75%
    Adheres strictly to RBI standard formula:
    A = P * (1 + r / 400)**4
    """
    principal = 100000.0
    nominal_rate = 6.75
    fractional_years = 1.0
    total_days = 365

    # Theoretical formula calculation:
    # A = P * (1 + 6.75/400)^4 = 100000 * (1.016875)^4 = 106922.78965... ≈ 106922.79
    expected_maturity = principal * math.pow(1.0 + (nominal_rate / 400.0), 4.0 * fractional_years)
    expected_interest = expected_maturity - principal

    # Engine calculation
    mat_amount, int_earned, periodic_payout, freq, schedule = compute_bank_fd(
        principal=principal,
        rate=nominal_rate,
        total_days=total_days,
        fractional_years=fractional_years,
        payout_type="CUMULATIVE"
    )

    # Parity check within 2 decimal places (paisa level)
    assert round(mat_amount, 2) == round(expected_maturity, 2)
    assert round(int_earned, 2) == round(expected_interest, 2)
    assert round(mat_amount, 2) == 106922.79
    assert round(int_earned, 2) == 6922.79


def test_quarterly_compounding_api_parity():
    """
    Verify /api/calculate endpoint returns mathematically accurate quarterly compounded output.
    """
    payload = {
        "category": "BANK_FD",
        "selected_bank": "SBI",
        "amount": 100000.0,
        "age": 35,
        "gender": "MALE",
        "tenure_years": 1,
        "tenure_months": 0,
        "tenure_days": 0,
        "payout_type": "CUMULATIVE",
        "tax_slab": 0.20,
        "has_form_15g_15h": False
    }
    response = client.post("/api/calculate", json=payload)
    assert response.status_code == 200
    data = response.json()

    # Rate for SBI 1 Year (365d) regular is 6.80%
    rate = data["applicable_interest_rate"]
    expected_maturity = 100000.0 * math.pow(1.0 + (rate / 400.0), 4.0)
    assert round(data["maturity_amount"], 2) == round(expected_maturity, 2)


# ============================================================================
# 2. Senior Citizen & Super Senior Rate Bumps
# ============================================================================
def test_senior_and_super_senior_rate_lookups():
    """
    Test rate differentials across age brackets:
    - Regular (<60 years)
    - Senior Citizen (60-79 years): Standard +0.50% bump (or +1.00% on special slabs)
    - Super Senior Citizen (80+ years): Enhanced super-senior rate
    """
    # Test SBI 1-Year slab (365 to 443 days): Reg: 6.80%, Senior: 7.30%, Super Senior: 7.60%
    regular_sbi = lookup_bank_rates_all_tiers("SBI", 365, age=35)
    senior_sbi = lookup_bank_rates_all_tiers("SBI", 365, age=65)
    super_senior_sbi = lookup_bank_rates_all_tiers("SBI", 365, age=82)

    assert regular_sbi["applicable_rate"] == 6.80
    assert senior_sbi["applicable_rate"] == 7.30
    assert super_senior_sbi["applicable_rate"] == 7.60

    # Verify +0.50% standard senior citizen spread
    assert round(senior_sbi["applicable_rate"] - regular_sbi["applicable_rate"], 2) == 0.50

    # Verify Super Senior Citizen premium
    assert super_senior_sbi["applicable_rate"] > senior_sbi["applicable_rate"]


def test_senior_citizen_rate_applied_in_api():
    """
    Verify /api/calculate applies the senior citizen bump when age >= 60.
    """
    payload_regular = {
        "category": "BANK_FD",
        "selected_bank": "SBI",
        "amount": 100000.0,
        "age": 40,
        "gender": "MALE",
        "tenure_years": 1,
        "tenure_months": 0,
        "tenure_days": 0
    }
    payload_senior = {
        "category": "BANK_FD",
        "selected_bank": "SBI",
        "amount": 100000.0,
        "age": 65,
        "gender": "MALE",
        "tenure_years": 1,
        "tenure_months": 0,
        "tenure_days": 0
    }

    resp_reg = client.post("/api/calculate", json=payload_regular)
    resp_sen = client.post("/api/calculate", json=payload_senior)

    assert resp_reg.status_code == 200
    assert resp_sen.status_code == 200

    reg_rate = resp_reg.json()["applicable_interest_rate"]
    sen_rate = resp_sen.json()["applicable_interest_rate"]

    assert sen_rate == round(reg_rate + 0.50, 2)
    assert resp_sen.json()["maturity_amount"] > resp_reg.json()["maturity_amount"]


# ============================================================================
# 3. Statutory Boundary Rejections (HTTP 422)
# ============================================================================
def test_scss_rejection_for_underage():
    """
    Senior Citizen Savings Scheme (SCSS) strictly mandates age >= 60.
    Submitting with age 45 must trigger HTTP 422 Unprocessable Entity.
    """
    payload = {
        "category": "GOVT_SCHEME",
        "selected_scheme": "SCSS",
        "amount": 500000.0,
        "age": 45,  # Statutory violation: < 60
        "gender": "MALE",
        "tenure_years": 5
    }
    response = client.post("/api/calculate", json=payload)
    assert response.status_code == 422
    err_detail = str(response.json()["detail"])
    assert "Senior Citizen Savings Scheme (SCSS) requires age 60 or above" in err_detail


def test_ssy_rejection_for_male_gender():
    """
    Sukanya Samriddhi Yojana (SSY) is strictly for female child beneficiaries.
    Submitting with gender = MALE must trigger HTTP 422.
    """
    payload = {
        "category": "GOVT_SCHEME",
        "selected_scheme": "SSY",
        "amount": 100000.0,
        "age": 7,
        "gender": "MALE",  # Statutory violation: Must be FEMALE
        "tenure_years": 21
    }
    response = client.post("/api/calculate", json=payload)
    assert response.status_code == 422
    err_detail = str(response.json()["detail"])
    assert "strictly restricted to girl child beneficiaries" in err_detail


def test_ssy_rejection_for_age_over_10():
    """
    Sukanya Samriddhi Yojana (SSY) mandates opening before the girl child turns 10.
    Submitting with age 12 must trigger HTTP 422.
    """
    payload = {
        "category": "GOVT_SCHEME",
        "selected_scheme": "SSY",
        "amount": 100000.0,
        "age": 12,  # Statutory violation: Must be <= 10
        "gender": "FEMALE",
        "tenure_years": 21
    }
    response = client.post("/api/calculate", json=payload)
    assert response.status_code == 422
    err_detail = str(response.json()["detail"])
    assert "up to 10 years of age" in err_detail


def test_ppf_rejection_for_amount_over_1_5_lakh():
    """
    Public Provident Fund (PPF) statutory annual deposit ceiling is ₹1,50,000.
    Submitting with ₹2,00,000 must trigger HTTP 422.
    """
    payload = {
        "category": "GOVT_SCHEME",
        "selected_scheme": "PPF",
        "amount": 200000.0,  # Statutory violation: Exceeds ₹1,50,000
        "age": 30,
        "gender": "MALE",
        "tenure_years": 15
    }
    response = client.post("/api/calculate", json=payload)
    assert response.status_code == 422
    err_detail = str(response.json()["detail"])
    assert "Public Provident Fund (PPF) annual contribution must be between" in err_detail
    assert "1,50,000" in err_detail


# ============================================================================
# 4. DICGC Concentration Risk Trigger & Auto-Splitter
# ============================================================================
def test_dicgc_risk_trigger_over_5_lakh():
    """
    When projected Bank FD maturity proceeds exceed the statutory DICGC ₹5,00,000 cover,
    the engine must flag uninsured risk and construct an institutional auto-split plan.
    """
    payload = {
        "category": "BANK_FD",
        "selected_bank": "SBI",
        "amount": 600000.0,  # Principal alone exceeds ₹5,00,000
        "age": 45,
        "gender": "MALE",
        "tenure_years": 1,
        "tenure_months": 0,
        "tenure_days": 0
    }
    response = client.post("/api/calculate", json=payload)
    assert response.status_code == 200
    data = response.json()

    dicgc = data["dicgc_analysis"]
    assert dicgc is not None
    assert dicgc["is_fully_insured"] is False
    assert dicgc["uninsured_amount"] > 0
    assert dicgc["auto_split_plan"] is not None
    assert len(dicgc["auto_split_plan"]) >= 2

    # Verify each tranche in the auto-split plan is capped at safe principal (<= ₹4,25,000)
    for tranche in dicgc["auto_split_plan"]:
        assert tranche["principal_allocated"] <= 425000.0


def test_dicgc_safe_under_5_lakh():
    """
    When Bank FD maturity proceeds remain within the DICGC ₹5,00,000 limit,
    is_fully_insured must be True and uninsured_amount must be 0.0.
    """
    payload = {
        "category": "BANK_FD",
        "selected_bank": "SBI",
        "amount": 100000.0,
        "age": 45,
        "gender": "MALE",
        "tenure_years": 1,
        "tenure_months": 0,
        "tenure_days": 0
    }
    response = client.post("/api/calculate", json=payload)
    assert response.status_code == 200
    dicgc = response.json()["dicgc_analysis"]

    assert dicgc["is_fully_insured"] is True
    assert dicgc["uninsured_amount"] == 0.0
    assert dicgc["auto_split_plan"] is None


# ============================================================================
# 5. Break FD vs Overdraft Loan Strategy Analyzer
# ============================================================================
def test_break_vs_loan_decision_endpoint():
    """
    Verify /api/break-vs-loan calculates premature penalty vs loan cost.
    """
    payload = {
        "principal": 500000.0,
        "contracted_rate": 7.00,
        "total_tenure_months": 36,
        "elapsed_months": 12,
        "emergency_cash_needed": 100000.0,
        "loan_duration_months": 6,
        "age": 40,
        "selected_bank": "SBI"
    }
    response = client.post("/api/break-vs-loan", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert data["recommendation"] in ["TAKE_LOAN", "BREAK_FD"]
    assert data["loan_interest_rate"] == 8.00  # Base 7.00% + 1.00% margin
    assert data["financial_difference"] > 0
    assert len(data["verdict_headline"]) > 0


# ============================================================================
# 6. Scheme Frequency Classification & Cadence-Aware Comparison
# ============================================================================
def test_lump_sum_comparison_filters_out_yearly_and_monthly():
    """
    When evaluating a Lump Sum (BANK_FD), do NOT run or display PPF, SSY, or Bank RD.
    Compare only against ONE_TIME schemes (SCSS, POMIS, NSC, and commercial bank FDs).
    """
    payload = {
        "category": "BANK_FD",
        "selected_bank": "SBI",
        "amount": 100000.0,
        "age": 35,
        "gender": "MALE",
        "tenure_years": 1,
        "tenure_months": 0,
        "tenure_days": 0
    }
    response = client.post("/api/calculate", json=payload)
    assert response.status_code == 200
    comp = response.json()["comparison"]
    assert comp["active_cadence"] in ("LUMP_SUM", "ONE_TIME")

    ranked_codes = [s["scheme_code"] for s in comp["ranked_schemes"]]
    # Must NOT contain yearly or monthly instruments
    assert "PPF" not in ranked_codes
    assert "SSY" not in ranked_codes
    assert "POST_OFFICE_RD" not in ranked_codes
    assert not any(code.endswith("_RD") for code in ranked_codes)

    # Under Tenure Parity, a 1-year FD must NOT compare against 5-year lock-in schemes (SCSS, POMIS, NSC)
    assert "SCSS" not in ranked_codes
    assert "POMIS" not in ranked_codes
    assert "NSC" not in ranked_codes
    # Must include 1-Year POTD and Bank FDs
    assert "POTD" in ranked_codes

    # All returned schemes must have cadence LUMP_SUM or ONE_TIME and tenure 1 year
    for s in comp["ranked_schemes"]:
        assert s["cadence"] in ("LUMP_SUM", "ONE_TIME")
        assert s["tenure_years"] == 1.0

    # Contextual PPF reference is provided separately with designated tag
    assert comp["cross_cadence_reference"] is not None
    assert comp["cross_cadence_reference"]["scheme_code"] == "PPF"
    assert comp["cross_cadence_reference"]["contextual_tag"] == "Assuming equivalent annual reinvestment over 15 years"


def test_monthly_rd_comparison_only_includes_monthly_products():
    """
    When evaluating Monthly (BANK_RD), compare only against MONTHLY recurring products.
    """
    payload = {
        "category": "BANK_RD",
        "selected_bank": "SBI",
        "amount": 5000.0,
        "age": 35,
        "gender": "MALE",
        "tenure_years": 1,
        "tenure_months": 0,
        "tenure_days": 0
    }
    response = client.post("/api/calculate", json=payload)
    assert response.status_code == 200
    comp = response.json()["comparison"]
    assert comp["active_cadence"] == "MONTHLY"

    for s in comp["ranked_schemes"]:
        assert s["cadence"] == "MONTHLY"

    ranked_codes = [s["scheme_code"] for s in comp["ranked_schemes"]]
    # Must contain RD instruments and must NOT contain lump sum FDs or PPF
    assert "SBI_RD" in ranked_codes
    assert "POST_OFFICE_RD" in ranked_codes
    assert "SBI" not in ranked_codes
    assert "PPF" not in ranked_codes
    assert "SCSS" not in ranked_codes


def test_yearly_comparison_only_includes_annual_products():
    """
    When evaluating Yearly (PPF / SSY), compare only against matching annual contribution schemes.
    """
    payload = {
        "category": "GOVT_SCHEME",
        "selected_scheme": "PPF",
        "amount": 50000.0,
        "age": 35,
        "gender": "MALE",
        "tenure_years": 15,
        "tenure_months": 0,
        "tenure_days": 0
    }
    response = client.post("/api/calculate", json=payload)
    assert response.status_code == 200
    comp = response.json()["comparison"]
    assert comp["active_cadence"] == "YEARLY"

    for s in comp["ranked_schemes"]:
        assert s["cadence"] == "YEARLY"

    ranked_codes = [s["scheme_code"] for s in comp["ranked_schemes"]]
    assert "PPF" in ranked_codes
    assert "SBI" not in ranked_codes
    assert "SBI_RD" not in ranked_codes
    assert "SCSS" not in ranked_codes


def test_5_year_lump_sum_includes_all_5_year_products():
    """
    When evaluating a 5-year Lump Sum for a senior citizen,
    SCSS, POMIS, NSC, 5Y POTD, and 5Y Bank FDs should all be included.
    """
    payload = {
        "category": "BANK_FD",
        "selected_bank": "SBI",
        "amount": 100000.0,
        "age": 62,
        "gender": "MALE",
        "tenure_years": 5,
        "tenure_months": 0,
        "tenure_days": 0
    }
    response = client.post("/api/calculate", json=payload)
    assert response.status_code == 200
    comp = response.json()["comparison"]
    assert comp["active_cadence"] in ("LUMP_SUM", "ONE_TIME")

    ranked_codes = [s["scheme_code"] for s in comp["ranked_schemes"]]
    assert "SCSS" in ranked_codes
    assert "POMIS" in ranked_codes
    assert "NSC" in ranked_codes
    assert "POTD" in ranked_codes
    assert "SBI" in ranked_codes
    # PPF & Bank RD must still be excluded by cadence isolation
    assert "PPF" not in ranked_codes
    assert "SBI_RD" not in ranked_codes


def test_form_15g_15h_smart_detector():
    """
    Test smart Form 15G (for <60 with interest > 40k) and Form 15H (for 60+ with interest > 50k) alerts.
    """
    # Regular citizen earning > 40k interest
    payload_regular = {
        "category": "BANK_FD",
        "selected_bank": "SBI",
        "amount": 1000000.0,
        "age": 35,
        "gender": "MALE",
        "tenure_years": 1,
        "tenure_months": 0,
        "tenure_days": 0,
        "has_form_15g_15h": False
    }
    resp = client.post("/api/calculate", json=payload_regular)
    assert resp.status_code == 200
    data = resp.json()
    assert data["form_15g_15h_advisory"] is not None
    assert "Form 15G" in data["form_15g_15h_advisory"]

    # Senior citizen earning > 50k interest
    payload_senior = {
        "category": "BANK_FD",
        "selected_bank": "SBI",
        "amount": 1000000.0,
        "age": 65,
        "gender": "MALE",
        "tenure_years": 1,
        "tenure_months": 0,
        "tenure_days": 0,
        "has_form_15g_15h": False
    }
    resp = client.post("/api/calculate", json=payload_senior)
    assert resp.status_code == 200
    data = resp.json()
    assert data["form_15g_15h_advisory"] is not None
    assert "Form 15H" in data["form_15g_15h_advisory"]


def test_goal_planner_endpoint():
    """
    Test reverse wealth goal planner endpoint for 10 Lakh target over 5 years.
    """
    payload = {
        "target_amount": 1000000.0,
        "tenure_years": 5,
        "tenure_months": 0,
        "tenure_days": 0,
        "age": 35
    }
    resp = client.post("/api/goal-planner", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["target_amount"] == 1000000.0
    assert data["best_lump_sum_option"] is not None
    assert data["best_monthly_option"] is not None
    assert len(data["options"]) >= 5
    # Required lump sum deposit must be less than 10 Lakh
    assert data["best_lump_sum_option"]["required_lump_sum"] < 1000000.0
    assert data["best_lump_sum_option"]["required_lump_sum"] > 500000.0
    # Required monthly RD deposit must be positive
    assert data["best_monthly_option"]["required_monthly_rd"] > 0.0



