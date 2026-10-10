"""
Unit & Integration Tests for AI Advisory Layer (Additive & Resilient)
"""

from fastapi.testclient import TestClient
from backend.main import app
from backend.services.ai_advisory import parse_natural_prompt, generate_summary

client = TestClient(app)


def test_parse_natural_prompt_ssy():
    res = parse_natural_prompt("Save ₹50,000 yearly for my 5-year-old daughter")
    assert isinstance(res, dict)
    assert res.get("category") == "GOVT_SCHEME"
    assert res.get("selected_scheme") == "SSY"
    assert res.get("amount") == 50000.0
    assert res.get("age") == 5
    assert res.get("gender") == "FEMALE"


def test_parse_natural_prompt_bank_fd():
    res = parse_natural_prompt("₹5 Lakhs fixed deposit in SBI for 3 years")
    assert isinstance(res, dict)
    assert res.get("category") == "BANK_FD"
    assert res.get("selected_bank") == "SBI"
    assert res.get("amount") == 500000.0
    assert res.get("years") == 3


def test_parse_natural_prompt_empty_or_unclear():
    assert parse_natural_prompt("") == {}
    assert parse_natural_prompt("Hello world, random sentence") == {}


def test_generate_summary_grounded():
    sample_calc = {
        "principal": 100000.0,
        "maturity_amount": 107250.0,
        "net_post_tax_maturity": 105800.0,
        "total_interest_earned": 7250.0,
        "estimated_tax_payable": 1450.0,
        "applicable_interest_rate": 7.25,
        "post_tax_annualized_yield": 5.80,
        "institution_or_scheme_name": "State Bank of India",
        "tax_status": "Taxable under Section 194A",
        "dicgc_analysis": {
            "is_fully_insured": True
        }
    }
    summary = generate_summary(sample_calc)
    assert isinstance(summary, str)
    assert len(summary) > 20
    assert "State Bank of India" in summary
    assert "7.25%" in summary


def test_generate_summary_empty():
    assert generate_summary({}) == ""


def test_api_parse_intent_endpoint():
    response = client.post(
        "/api/ai/parse-intent",
        json={"prompt": "Senior citizen aged 65 investing ₹15 Lakhs in SCSS"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data.get("success") is True
    parsed = data.get("data", {})
    assert parsed.get("category") == "GOVT_SCHEME"
    assert parsed.get("selected_scheme") == "SCSS"
    assert parsed.get("amount") == 1500000.0
    assert parsed.get("age") == 65


def test_api_generate_insights_endpoint():
    response = client.post(
        "/api/ai/generate-insights",
        json={
            "results": {
                "principal": 150000.0,
                "maturity_amount": 4200000.0,
                "net_post_tax_maturity": 4200000.0,
                "total_interest_earned": 1950000.0,
                "estimated_tax_payable": 0.0,
                "applicable_interest_rate": 7.10,
                "post_tax_annualized_yield": 7.10,
                "institution_or_scheme_name": "Public Provident Fund (PPF)",
                "tax_status": "Exempt-Exempt-Exempt (EEE)"
            }
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data.get("success") is True
    summary = data.get("summary", "")
    assert len(summary) > 20
    assert "PPF" in summary or "Public Provident Fund" in summary or "EEE" in summary
