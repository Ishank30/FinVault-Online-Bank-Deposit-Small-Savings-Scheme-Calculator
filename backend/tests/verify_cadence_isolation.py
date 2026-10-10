"""
Verification test for Cadence Isolation & Like-for-Like Tenure Matching in backend/engine.py
"""
from backend.schemas import InvestmentRequest
from backend.engine import compare_all_eligible_schemes, resolve_active_cadence

def test_1yr_bank_fd():
    req = InvestmentRequest(
        amount=10000.0,
        tenure_years=1,
        tenure_months=0,
        tenure_days=0,
        age=35,
        gender="MALE",
        resident_status="RESIDENT",
        tax_slab=0.20,
        category="BANK_FD",
        selected_bank="SBI",
        investment_frequency="LUMP_SUM"
    )
    cadence = resolve_active_cadence(req)
    assert cadence == "LUMP_SUM", f"Expected LUMP_SUM, got {cadence}"
    
    resp = compare_all_eligible_schemes(req)
    assert resp.active_cadence == "LUMP_SUM"
    assert resp.best_pick is not None
    # Check that PPF or SSY are NOT in ranked schemes
    scheme_codes = [s.scheme_code for s in resp.ranked_schemes]
    assert "PPF" not in scheme_codes, f"PPF should not be in LUMP_SUM 1Y: {scheme_codes}"
    assert "SSY" not in scheme_codes, f"SSY should not be in LUMP_SUM 1Y: {scheme_codes}"
    # Check that 5-year locked schemes (NSC, POMIS, SCSS) are NOT in ranked schemes for 1Y
    assert "NSC" not in scheme_codes, f"NSC should not be in 1Y: {scheme_codes}"
    assert "POMIS" not in scheme_codes, f"POMIS should not be in 1Y: {scheme_codes}"
    assert "SCSS" not in scheme_codes, f"SCSS should not be in 1Y: {scheme_codes}"
    # Check that POTD (1Y) is present alongside bank FDs
    assert any("POTD" in s for s in scheme_codes), f"POTD should be in 1Y: {scheme_codes}"
    print("[PASS] 1-Year Bank FD test passed! Best pick:", resp.best_pick.scheme_name, resp.best_pick.gross_interest_rate)

def test_1yr_bank_rd():
    req = InvestmentRequest(
        amount=1000.0,
        tenure_years=1,
        tenure_months=0,
        tenure_days=0,
        age=35,
        gender="MALE",
        resident_status="RESIDENT",
        tax_slab=0.20,
        category="BANK_RD",
        selected_bank="SBI",
        investment_frequency="MONTHLY"
    )
    cadence = resolve_active_cadence(req)
    assert cadence == "MONTHLY", f"Expected MONTHLY, got {cadence}"
    
    resp = compare_all_eligible_schemes(req)
    assert resp.active_cadence == "MONTHLY"
    assert resp.best_pick is not None
    scheme_codes = [s.scheme_code for s in resp.ranked_schemes]
    assert "PPF" not in scheme_codes, f"PPF should not be in MONTHLY: {scheme_codes}"
    assert "SSY" not in scheme_codes, f"SSY should not be in MONTHLY: {scheme_codes}"
    assert "SBI" not in scheme_codes, f"Bank FDs should not be in MONTHLY: {scheme_codes}"
    # PO RD is included in monthly schemes
    assert "POST_OFFICE_RD" in scheme_codes, f"PO RD should be in monthly schemes: {scheme_codes}"
    # Winner should be BOB RD or PNB RD (highest yielding RD)
    print("[PASS] 1-Year Bank RD test passed! Best pick:", resp.best_pick.scheme_name, f"{resp.best_pick.gross_interest_rate}%", f"Maturity: Rs.{resp.best_pick.post_tax_maturity_amount}")
    assert resp.best_pick.scheme_code in ("BOB_RD", "PNB_RD"), f"Expected BOB_RD or PNB_RD, got {resp.best_pick.scheme_code}"

def test_5yr_senior_fd():
    req = InvestmentRequest(
        amount=50000.0,
        tenure_years=5,
        tenure_months=0,
        tenure_days=0,
        age=65,
        gender="MALE",
        resident_status="RESIDENT",
        tax_slab=0.20,
        category="BANK_FD",
        selected_bank="SBI",
        investment_frequency="LUMP_SUM"
    )
    cadence = resolve_active_cadence(req)
    assert cadence == "LUMP_SUM"
    
    resp = compare_all_eligible_schemes(req)
    scheme_codes = [s.scheme_code for s in resp.ranked_schemes]
    # For 5-year senior, SCSS (8.20%) and NSC (7.70%) and POMIS should be included!
    assert "SCSS" in scheme_codes, f"SCSS should be in 5Y senior: {scheme_codes}"
    assert "NSC" in scheme_codes, f"NSC should be in 5Y: {scheme_codes}"
    assert "POMIS" in scheme_codes, f"POMIS should be in 5Y: {scheme_codes}"
    assert "PPF" not in scheme_codes, f"PPF should not be in LUMP_SUM: {scheme_codes}"
    print("[PASS] 5-Year Senior FD test passed! Best pick:", resp.best_pick.scheme_name, resp.best_pick.gross_interest_rate)
    assert resp.best_pick.scheme_code == "SCSS", f"Expected SCSS to win for 5Y Senior, got {resp.best_pick.scheme_code}"

def test_yearly_ppf():
    req = InvestmentRequest(
        amount=50000.0,
        tenure_years=15,
        tenure_months=0,
        tenure_days=0,
        age=35,
        gender="MALE",
        resident_status="RESIDENT",
        tax_slab=0.20,
        category="GOVT_SCHEME",
        selected_scheme="PPF",
        investment_frequency="YEARLY"
    )
    cadence = resolve_active_cadence(req)
    assert cadence == "YEARLY"
    
    resp = compare_all_eligible_schemes(req)
    scheme_codes = [s.scheme_code for s in resp.ranked_schemes]
    assert "PPF" in scheme_codes
    assert "SBI" not in scheme_codes
    assert "BOB_RD" not in scheme_codes
    print("[PASS] Yearly PPF test passed! Best pick:", resp.best_pick.scheme_name)

if __name__ == "__main__":
    test_1yr_bank_fd()
    test_1yr_bank_rd()
    test_5yr_senior_fd()
    test_yearly_ppf()
    print("\nALL VERIFICATION TESTS COMPLETED SUCCESSFULLY!")
