"""
Financial Calculation Engine for Indian Banking and Sovereign Schemes
Implements RBI quarterly compounding, Section 194A TDS, DICGC insurance checks,
Govt Small Savings rules (PPF, SSY, SCSS, POMIS, NSC), and 5-Year Laddering strategy.
"""

from typing import List, Tuple, Dict, Any, Optional
import math
from backend.config_rates import (
    DICGC_LIMIT,
    SAFE_PRINCIPAL_PER_BANK,
    FD_LOAN_INTEREST_MARGIN,
    PREMATURE_PENALTY,
    TDS_THRESHOLD_REGULAR,
    TDS_THRESHOLD_SENIOR,
    TDS_RATE_WITH_PAN,
    BANK_FD_SLABS,
    GOVT_SCHEMES_CONFIG,
    get_bank_fd_rate,
    get_govt_scheme_rate
)
from backend.schemas import (
    InvestmentRequest,
    CalculationResponse,
    LadderTranche,
    CashflowItem,
    DICGCInfo
)


def compute_investment(request: InvestmentRequest) -> CalculationResponse:
    """
    Master computation pipeline that parses InvestmentRequest, applies regulatory logic,
    and returns a fully populated CalculationResponse.
    """
    total_days = (request.tenure_years * 365) + (request.tenure_months * 30) + request.tenure_days
    tenure_years_float = total_days / 365.0 if total_days > 0 else 1.0

    regulatory_notes: List[str] = []

    # ------------------------------------------------------------------------
    # 1. 5-Year FD Ladder Strategy Mode
    # ------------------------------------------------------------------------
    if request.calculation_mode == "LADDER":
        return _compute_fd_ladder(request)

    # ------------------------------------------------------------------------
    # 2. Government Small Savings Schemes
    # ------------------------------------------------------------------------
    if request.category == "GOVT_SCHEME":
        return _compute_govt_scheme(request, total_days, tenure_years_float)

    # ------------------------------------------------------------------------
    # 3. Bank Recurring Deposit (RD)
    # ------------------------------------------------------------------------
    if request.category == "BANK_RD":
        return _compute_bank_rd(request, total_days)

    # ------------------------------------------------------------------------
    # 4. Bank Fixed Deposit (FD) - Standard Mode
    # ------------------------------------------------------------------------
    return _compute_bank_fd(request, total_days, tenure_years_float)


def _compute_bank_fd(
    request: InvestmentRequest,
    total_days: int,
    tenure_years_float: float
) -> CalculationResponse:
    """
    Compute Bank Fixed Deposit with RBI quarterly compounding or non-cumulative payouts.
    """
    bank = request.selected_bank or "SBI"
    rate = get_bank_fd_rate(bank, total_days, request.age)
    principal = request.amount
    payout_type = request.payout_type

    regulatory_notes: List[str] = [
        f"Interest rate {rate:.2f}% p.a. derived from {bank} published card rate for tenure of {total_days} days.",
        "Deposits with scheduled commercial banks are insured up to ₹5,00,000 per depositor under DICGC."
    ]

    if request.age >= 80:
        regulatory_notes.append("Applied Super Senior Citizen privilege rate (+0.80% / specialized slab).")
    elif request.age >= 60:
        regulatory_notes.append("Applied Senior Citizen privilege rate (+0.50% / specialized slab).")

    periodic_payout: Optional[float] = None
    periodic_frequency: Optional[str] = None
    cashflow_schedule: List[CashflowItem] = []

    # RBI Compounding Norms:
    # Under 180 days: Simple interest is paid at maturity
    # 180 days and above: Quarterly compounding
    if payout_type == "CUMULATIVE":
        if total_days < 180:
            interest_earned = principal * (rate / 100.0) * (total_days / 365.0)
            maturity_amount = principal + interest_earned
        else:
            # Quarterly compounding: A = P * (1 + r/400)^(4 * t)
            quarters = (total_days / 365.0) * 4.0
            maturity_amount = principal * math.pow(1.0 + (rate / 400.0), quarters)
            interest_earned = maturity_amount - principal

    elif payout_type == "QUARTERLY":
        # Regular quarterly payout = P * (r / 400)
        num_quarters = max(1, int(round((total_days / 365.0) * 4.0)))
        quarterly_payout = principal * (rate / 400.0)
        periodic_payout = round(quarterly_payout, 2)
        periodic_frequency = "QUARTERLY"
        interest_earned = quarterly_payout * num_quarters
        maturity_amount = principal  # Principal returned at maturity

        for q in range(1, num_quarters + 1):
            cashflow_schedule.append(
                CashflowItem(
                    period=q,
                    label=f"Quarter {q}",
                    payout_amount=round(quarterly_payout, 2),
                    cumulative_interest=round(quarterly_payout * q, 2),
                    remaining_principal=principal
                )
            )

    elif payout_type == "MONTHLY":
        # Discounted monthly payout under Indian banking formula:
        # P * (r / 1200) / (1 + (r / 400))^(1/3 - 1)
        # Or standard flat monthly interest:
        num_months = max(1, int(round((total_days / 365.0) * 12.0)))
        # Standard monthly payout per banking conventions
        monthly_payout = principal * (rate / 1200.0)
        periodic_payout = round(monthly_payout, 2)
        periodic_frequency = "MONTHLY"
        interest_earned = monthly_payout * num_months
        maturity_amount = principal

        # Cap cashflow schedule items to reasonable size (e.g. up to 60 months)
        max_cf = min(num_months, 36)
        for m in range(1, max_cf + 1):
            cashflow_schedule.append(
                CashflowItem(
                    period=m,
                    label=f"Month {m}",
                    payout_amount=round(monthly_payout, 2),
                    cumulative_interest=round(monthly_payout * m, 2),
                    remaining_principal=principal
                )
            )

    # Annualized yield
    effective_annual_yield = ((maturity_amount / principal) ** (1.0 / max(tenure_years_float, 0.08)) - 1.0) * 100.0 if payout_type == "CUMULATIVE" else rate

    # Tax & TDS calculations
    tds_info = _calculate_tax_and_tds(
        interest_earned=interest_earned,
        tenure_years=tenure_years_float,
        request=request,
        is_govt_eee=False
    )

    # DICGC Insurance
    dicgc_info = _evaluate_dicgc(principal, maturity_amount, is_bank=True)

    # Real Returns
    real_returns = _calculate_inflation_adjustment(
        nominal_maturity=maturity_amount if payout_type == "CUMULATIVE" else (principal + interest_earned),
        tenure_years=tenure_years_float,
        nominal_rate=rate,
        inflation_rate=request.inflation_rate
    )

    # Loan against FD
    max_loan = round(principal * 0.90, 2)  # Typically 90%
    loan_rate = rate + FD_LOAN_INTEREST_MARGIN

    tenure_str = _format_tenure(request.tenure_years, request.tenure_months, request.tenure_days)

    return CalculationResponse(
        principal=round(principal, 2),
        applicable_interest_rate=round(rate, 2),
        effective_annual_yield=round(effective_annual_yield, 2),
        tenure_display=tenure_str,
        total_tenure_days=total_days,
        maturity_amount=round(maturity_amount, 2),
        total_interest_earned=round(interest_earned, 2),
        tax_status="TAXABLE_AS_PER_SLAB",
        is_tds_applicable=tds_info["is_tds_applicable"],
        estimated_tds_amount=round(tds_info["estimated_tds"], 2),
        estimated_tax_payable=round(tds_info["estimated_tax"], 2),
        net_post_tax_maturity=round((maturity_amount if payout_type == "CUMULATIVE" else (principal + interest_earned)) - tds_info["estimated_tax"], 2),
        post_tax_annualized_yield=round(tds_info["post_tax_yield"], 2),
        inflation_rate=request.inflation_rate,
        inflation_adjusted_maturity=round(real_returns["real_maturity"], 2),
        real_rate_of_return=round(real_returns["real_rate"], 2),
        loan_against_fd_eligible=True,
        max_loan_amount=max_loan,
        loan_interest_rate=round(loan_rate, 2),
        premature_penalty_rate=PREMATURE_PENALTY,
        dicgc_analysis=dicgc_info,
        calculation_mode="STANDARD",
        periodic_payout=periodic_payout,
        periodic_payout_frequency=periodic_frequency,
        cashflow_schedule=cashflow_schedule if cashflow_schedule else None,
        institution_or_scheme_name=f"{bank} Fixed Deposit",
        regulatory_notes=regulatory_notes
    )


def _compute_bank_rd(request: InvestmentRequest, total_days: int) -> CalculationResponse:
    """
    Compute Bank Recurring Deposit (RD) with monthly installment and quarterly compounding.
    """
    bank = request.selected_bank or "SBI"
    rate = get_bank_fd_rate(bank, total_days, request.age)
    monthly_installment = request.amount
    total_months = (request.tenure_years * 12) + request.tenure_months
    tenure_years_float = total_months / 12.0

    total_invested = monthly_installment * total_months

    # RBI Quarterly compounding formula for RD:
    # Each monthly installment 'm' from 1 to total_months earns interest compounded quarterly
    # for the remaining tenure (total_months - m + 1) months.
    maturity_amount = 0.0
    for m in range(1, total_months + 1):
        months_remaining = total_months - m + 1
        quarters = months_remaining / 3.0
        maturity_amount += monthly_installment * math.pow(1.0 + (rate / 400.0), quarters)

    interest_earned = maturity_amount - total_invested

    tds_info = _calculate_tax_and_tds(
        interest_earned=interest_earned,
        tenure_years=tenure_years_float,
        request=request,
        is_govt_eee=False
    )
    dicgc_info = _evaluate_dicgc(total_invested, maturity_amount, is_bank=True)
    real_returns = _calculate_inflation_adjustment(
        nominal_maturity=maturity_amount,
        tenure_years=tenure_years_float,
        nominal_rate=rate,
        inflation_rate=request.inflation_rate
    )

    tenure_str = f"{request.tenure_years} Years, {request.tenure_months} Months"

    return CalculationResponse(
        principal=round(total_invested, 2),
        applicable_interest_rate=round(rate, 2),
        effective_annual_yield=round(((maturity_amount / total_invested) ** (1.0 / max(tenure_years_float, 0.5)) - 1.0) * 100.0, 2),
        tenure_display=tenure_str,
        total_tenure_days=total_days,
        maturity_amount=round(maturity_amount, 2),
        total_interest_earned=round(interest_earned, 2),
        tax_status="TAXABLE_AS_PER_SLAB",
        is_tds_applicable=tds_info["is_tds_applicable"],
        estimated_tds_amount=round(tds_info["estimated_tds"], 2),
        estimated_tax_payable=round(tds_info["estimated_tax"], 2),
        net_post_tax_maturity=round(maturity_amount - tds_info["estimated_tax"], 2),
        post_tax_annualized_yield=round(tds_info["post_tax_yield"], 2),
        inflation_rate=request.inflation_rate,
        inflation_adjusted_maturity=round(real_returns["real_maturity"], 2),
        real_rate_of_return=round(real_returns["real_rate"], 2),
        loan_against_fd_eligible=True,
        max_loan_amount=round(total_invested * 0.90, 2),
        loan_interest_rate=round(rate + FD_LOAN_INTEREST_MARGIN, 2),
        premature_penalty_rate=PREMATURE_PENALTY,
        dicgc_analysis=dicgc_info,
        calculation_mode="STANDARD",
        periodic_payout=None,
        periodic_payout_frequency=None,
        cashflow_schedule=None,
        institution_or_scheme_name=f"{bank} Recurring Deposit (RD)",
        regulatory_notes=[
            f"Monthly installment: ₹{monthly_installment:,.2f} for {total_months} months.",
            "Compounded quarterly as per Reserve Bank of India (RBI) guidelines on term deposits.",
            "TDS under Section 194A is applicable on RD interest if annual threshold is breached."
        ]
    )


def _compute_govt_scheme(
    request: InvestmentRequest,
    total_days: int,
    tenure_years_float: float
) -> CalculationResponse:
    """
    Compute Government Small Savings Schemes (PPF, SSY, SCSS, POMIS, NSC)
    applying statutory compounding rules, lock-in tenures, and tax statutes.
    """
    scheme_code = request.selected_scheme or "PPF"
    cfg = GOVT_SCHEMES_CONFIG[scheme_code]
    rate = cfg["interest_rate"]
    tax_status = cfg["tax_status"]
    is_eee = (tax_status == "EEE")

    periodic_payout: Optional[float] = None
    periodic_frequency: Optional[str] = None
    cashflow_schedule: List[CashflowItem] = []
    regulatory_notes: List[str] = [
        f"Backed by Government of India sovereign guarantee. Rate: {rate:.2f}% p.a. as per latest Ministry of Finance notification.",
        f"Tax Status: {tax_status} under Income Tax Act."
    ]

    if scheme_code == "PPF":
        # 15 years lock-in, annual compounding
        annual_deposit = request.amount
        total_principal = annual_deposit * 15
        # FV of annuity: P * [((1 + r)^15 - 1) / r] * (1 + r)
        r = rate / 100.0
        fv = annual_deposit * (((1.0 + r) ** 15 - 1.0) / r) * (1.0 + r)
        maturity_amount = fv
        interest_earned = maturity_amount - total_principal
        tenure_years_float = 15.0
        total_days = 15 * 365
        regulatory_notes.append("Deposits made between April 1st and 5th maximize annual compound interest accrual.")
        regulatory_notes.append("Full EEE tax exemption: Contributions eligible under Sec 80C, interest accrued and maturity sum are 100% tax-free.")

    elif scheme_code == "SSY":
        # 21 years maturity, deposits for first 15 years, compounding for 21 years
        annual_deposit = request.amount
        total_principal = annual_deposit * 15
        r = rate / 100.0
        # Balance at 15th year
        balance_15 = annual_deposit * (((1.0 + r) ** 15 - 1.0) / r) * (1.0 + r)
        # Compounded for remaining 6 years without fresh deposits
        maturity_amount = balance_15 * ((1.0 + r) ** 6)
        interest_earned = maturity_amount - total_principal
        tenure_years_float = 21.0
        total_days = 21 * 365
        regulatory_notes.append("Deposits required for initial 15 years; continues compounding tax-free up to 21 years.")
        regulatory_notes.append("Exclusively for girl child up to 10 years of age. Section 10(11A) full tax exemption.")

    elif scheme_code == "SCSS":
        # 5 years lock-in, quarterly payout
        principal = request.amount
        total_principal = principal
        quarterly_payout = principal * (rate / 400.0)
        periodic_payout = round(quarterly_payout, 2)
        periodic_frequency = "QUARTERLY"
        num_quarters = 20  # 5 years * 4
        interest_earned = quarterly_payout * num_quarters
        maturity_amount = principal  # Principal returned at maturity
        tenure_years_float = 5.0
        total_days = 5 * 365

        for q in range(1, num_quarters + 1):
            cashflow_schedule.append(
                CashflowItem(
                    period=q,
                    label=f"Quarter {q}",
                    payout_amount=round(quarterly_payout, 2),
                    cumulative_interest=round(quarterly_payout * q, 2),
                    remaining_principal=principal
                )
            )
        regulatory_notes.append("Quarterly interest automatically credited on 1st of April, July, October, January.")
        regulatory_notes.append("Eligible for Section 80C up to ₹1.5 Lakh. Quarterly interest is taxable as per your tax slab.")

    elif scheme_code == "POMIS":
        # 5 years lock-in, monthly payout
        principal = request.amount
        total_principal = principal
        monthly_payout = principal * (rate / 1200.0)
        periodic_payout = round(monthly_payout, 2)
        periodic_frequency = "MONTHLY"
        num_months = 60  # 5 years * 12
        interest_earned = monthly_payout * num_months
        maturity_amount = principal
        tenure_years_float = 5.0
        total_days = 5 * 365

        for m in range(1, 37):  # First 36 months for display
            cashflow_schedule.append(
                CashflowItem(
                    period=m,
                    label=f"Month {m}",
                    payout_amount=round(monthly_payout, 2),
                    cumulative_interest=round(monthly_payout * m, 2),
                    remaining_principal=principal
                )
            )
        regulatory_notes.append("Monthly interest credited directly to linked Post Office Savings Account.")
        regulatory_notes.append("No 80C rebate; monthly payout is taxable as per income slab without TDS at Post Office.")

    elif scheme_code == "NSC":
        # 5 years lock-in, annual compounding, paid at maturity
        principal = request.amount
        total_principal = principal
        r = rate / 100.0
        maturity_amount = principal * ((1.0 + r) ** 5)
        interest_earned = maturity_amount - total_principal
        tenure_years_float = 5.0
        total_days = 5 * 365
        regulatory_notes.append("Interest compounded annually and deemed reinvested for first 4 years, qualifying for Section 80C.")

    # Tax & TDS calculations
    tds_info = _calculate_tax_and_tds(
        interest_earned=interest_earned,
        tenure_years=tenure_years_float,
        request=request,
        is_govt_eee=is_eee
    )

    # Sovereign schemes have zero default risk (100% sovereign backed by Govt of India, bypasses DICGC limit)
    dicgc_info = DICGCInfo(
        total_exposure=round(total_principal, 2),
        insurance_limit=float("inf"),
        is_fully_insured=True,
        uninsured_amount=0.0,
        safe_principal_limit=float("inf"),
        recommendation="Sovereign Guarantee: Backed 100% by the Consolidated Fund of India with zero credit/default risk."
    )

    real_returns = _calculate_inflation_adjustment(
        nominal_maturity=maturity_amount if scheme_code in ("PPF", "SSY", "NSC") else (total_principal + interest_earned),
        tenure_years=tenure_years_float,
        nominal_rate=rate,
        inflation_rate=request.inflation_rate
    )

    loan_eligible = cfg.get("loan_facility_available", False)
    max_loan = round(total_principal * 0.85, 2) if loan_eligible else 0.0

    return CalculationResponse(
        principal=round(total_principal, 2),
        applicable_interest_rate=round(rate, 2),
        effective_annual_yield=round(rate, 2),
        tenure_display=f"{int(tenure_years_float)} Years Fixed Lock-in",
        total_tenure_days=total_days,
        maturity_amount=round(maturity_amount, 2),
        total_interest_earned=round(interest_earned, 2),
        tax_status=tax_status,
        is_tds_applicable=tds_info["is_tds_applicable"],
        estimated_tds_amount=round(tds_info["estimated_tds"], 2),
        estimated_tax_payable=round(tds_info["estimated_tax"], 2),
        net_post_tax_maturity=round((maturity_amount if scheme_code in ("PPF", "SSY", "NSC") else (total_principal + interest_earned)) - tds_info["estimated_tax"], 2),
        post_tax_annualized_yield=round(tds_info["post_tax_yield"], 2),
        inflation_rate=request.inflation_rate,
        inflation_adjusted_maturity=round(real_returns["real_maturity"], 2),
        real_rate_of_return=round(real_returns["real_rate"], 2),
        loan_against_fd_eligible=loan_eligible,
        max_loan_amount=max_loan,
        loan_interest_rate=round(rate + 1.0, 2) if loan_eligible else 0.0,
        premature_penalty_rate=0.0,
        dicgc_analysis=dicgc_info,
        calculation_mode="STANDARD",
        periodic_payout=periodic_payout,
        periodic_payout_frequency=periodic_frequency,
        cashflow_schedule=cashflow_schedule if cashflow_schedule else None,
        institution_or_scheme_name=f"Govt Scheme: {cfg['name']} ({scheme_code})",
        regulatory_notes=regulatory_notes
    )


def _compute_fd_ladder(request: InvestmentRequest) -> CalculationResponse:
    """
    Compute 5-Year Bank Fixed Deposit Laddering Strategy.
    Divides total capital equally into 5 separate FDs of 1, 2, 3, 4, and 5 years.
    Guarantees staggered annual liquidity and mitigates reinvestment interest rate risk.
    """
    bank = request.selected_bank or "SBI"
    total_principal = request.amount
    tranche_principal = total_principal / 5.0
    age = request.age

    ladder_tranches: List[LadderTranche] = []
    total_maturity = 0.0
    total_interest = 0.0
    weighted_rate_sum = 0.0

    tenure_map = [
        (1, 365),
        (2, 730),
        (3, 1095),
        (4, 1460),
        (5, 1826)
    ]

    for year_num, days in tenure_map:
        rate = get_bank_fd_rate(bank, days, age)
        quarters = year_num * 4.0
        mat_val = tranche_principal * math.pow(1.0 + (rate / 400.0), quarters)
        interest = mat_val - tranche_principal

        ladder_tranches.append(
            LadderTranche(
                tranche_number=year_num,
                tenure_years=year_num,
                principal_allocated=round(tranche_principal, 2),
                interest_rate=round(rate, 2),
                maturity_amount=round(mat_val, 2),
                interest_earned=round(interest, 2),
                annual_payout_on_maturity=round(mat_val, 2)
            )
        )
        total_maturity += mat_val
        total_interest += interest
        weighted_rate_sum += rate

    avg_rate = weighted_rate_sum / 5.0

    # DICGC check
    dicgc_info = _evaluate_dicgc(total_principal, total_maturity, is_bank=True)

    tds_info = _calculate_tax_and_tds(
        interest_earned=total_interest,
        tenure_years=3.0,  # Average duration
        request=request,
        is_govt_eee=False
    )

    real_returns = _calculate_inflation_adjustment(
        nominal_maturity=total_maturity,
        tenure_years=3.0,
        nominal_rate=avg_rate,
        inflation_rate=request.inflation_rate
    )

    return CalculationResponse(
        principal=round(total_principal, 2),
        applicable_interest_rate=round(avg_rate, 2),
        effective_annual_yield=round(avg_rate, 2),
        tenure_display="5-Year Staggered Ladder (1y, 2y, 3y, 4y, 5y)",
        total_tenure_days=1826,
        maturity_amount=round(total_maturity, 2),
        total_interest_earned=round(total_interest, 2),
        tax_status="TAXABLE_AS_PER_SLAB",
        is_tds_applicable=tds_info["is_tds_applicable"],
        estimated_tds_amount=round(tds_info["estimated_tds"], 2),
        estimated_tax_payable=round(tds_info["estimated_tax"], 2),
        net_post_tax_maturity=round(total_maturity - tds_info["estimated_tax"], 2),
        post_tax_annualized_yield=round(tds_info["post_tax_yield"], 2),
        inflation_rate=request.inflation_rate,
        inflation_adjusted_maturity=round(real_returns["real_maturity"], 2),
        real_rate_of_return=round(real_returns["real_rate"], 2),
        loan_against_fd_eligible=True,
        max_loan_amount=round(total_principal * 0.90, 2),
        loan_interest_rate=round(avg_rate + FD_LOAN_INTEREST_MARGIN, 2),
        premature_penalty_rate=PREMATURE_PENALTY,
        dicgc_analysis=dicgc_info,
        calculation_mode="LADDER",
        ladder_schedule=ladder_tranches,
        periodic_payout=None,
        periodic_payout_frequency=None,
        cashflow_schedule=None,
        institution_or_scheme_name=f"{bank} 5-Year FD Ladder Strategy",
        regulatory_notes=[
            f"Capital ₹{total_principal:,.2f} divided into 5 equal tranches of ₹{tranche_principal:,.2f}.",
            "Provides liquidity every 12 months with automatic compounding at each maturity milestone.",
            "Mitigates interest rate cycle risk by rolling each mature tranche into fresh 5-year FDs."
        ]
    )


def _calculate_tax_and_tds(
    interest_earned: float,
    tenure_years: float,
    request: InvestmentRequest,
    is_govt_eee: bool
) -> Dict[str, Any]:
    """
    Calculate statutory TDS under Section 194A and overall income tax liability.
    """
    if is_govt_eee:
        return {
            "is_tds_applicable": False,
            "estimated_tds": 0.0,
            "estimated_tax": 0.0,
            "post_tax_yield": request.tax_slab
        }

    # Annualized interest for TDS threshold evaluation
    annual_interest = interest_earned / max(tenure_years, 1.0)
    tds_threshold = TDS_THRESHOLD_SENIOR if request.age >= 60 else TDS_THRESHOLD_REGULAR

    # If Form 15G (under 60) or Form 15H (senior 60+) is submitted, zero TDS is deducted
    is_tds_applicable = (annual_interest > tds_threshold) and (not request.has_form_15g_15h)

    # Resident TDS is 10%; NRI NRO TDS is 30% (+cess); NRI NRE is exempt
    if request.resident_status == "NRI_NRE":
        is_tds_applicable = False
        estimated_tds = 0.0
        tax_payable = 0.0
    elif request.resident_status == "NRI_NRO":
        is_tds_applicable = True
        estimated_tds = interest_earned * 0.312  # 30% + 4% cess
        tax_payable = estimated_tds
    else:
        # Resident
        estimated_tds = (interest_earned * TDS_RATE_WITH_PAN) if is_tds_applicable else 0.0
        # Total tax liability as per investor's marginal tax bracket
        # Senior citizens get deduction under Section 80TTB up to ₹50,000
        taxable_interest = max(0.0, interest_earned - (50000.0 if request.age >= 60 else 0.0))
        tax_payable = taxable_interest * request.tax_slab

    post_tax_nominal_yield = max(0.0, (1.0 - request.tax_slab))

    return {
        "is_tds_applicable": is_tds_applicable,
        "estimated_tds": estimated_tds,
        "estimated_tax": tax_payable,
        "post_tax_yield": post_tax_nominal_yield
    }


def _evaluate_dicgc(principal: float, maturity_amount: float, is_bank: bool) -> DICGCInfo:
    """
    Evaluate exposure against the DICGC ₹5,00,000 sovereign deposit insurance limit.
    """
    if not is_bank:
        return DICGCInfo(
            total_exposure=round(principal, 2),
            insurance_limit=float("inf"),
            is_fully_insured=True,
            uninsured_amount=0.0,
            safe_principal_limit=float("inf"),
            recommendation="100% sovereign guaranteed by Govt of India."
        )

    # DICGC covers both Principal and Accrued Interest up to ₹5,00,000 per depositor per bank
    total_exposure = maturity_amount
    is_fully_insured = total_exposure <= DICGC_LIMIT
    uninsured = max(0.0, total_exposure - DICGC_LIMIT)

    if is_fully_insured:
        rec = f"Fully protected under DICGC insurance (₹{total_exposure:,.2f} <= ₹5,00,000 cover)."
    else:
        rec = (
            f"ALERT: Total maturity proceeds (₹{total_exposure:,.2f}) exceed DICGC insurance ceiling by ₹{uninsured:,.2f}. "
            f"To maintain 100% sovereign insurance safety, cap principal to ₹{SAFE_PRINCIPAL_PER_BANK:,.2f} "
            f"per bank and diversify the remaining capital across other scheduled commercial banks."
        )

    return DICGCInfo(
        total_exposure=round(total_exposure, 2),
        insurance_limit=DICGC_LIMIT,
        is_fully_insured=is_fully_insured,
        uninsured_amount=round(uninsured, 2),
        safe_principal_limit=SAFE_PRINCIPAL_PER_BANK,
        recommendation=rec
    )


def _calculate_inflation_adjustment(
    nominal_maturity: float,
    tenure_years: float,
    nominal_rate: float,
    inflation_rate: float
) -> Dict[str, float]:
    """
    Calculate real inflation-adjusted purchasing power and real rate of return using Fisher equation:
    (1 + Real Rate) = (1 + Nominal Rate) / (1 + Inflation Rate)
    """
    real_maturity = nominal_maturity / math.pow(1.0 + inflation_rate, max(tenure_years, 0.1))
    real_rate = (((1.0 + (nominal_rate / 100.0)) / (1.0 + inflation_rate)) - 1.0) * 100.0

    return {
        "real_maturity": real_maturity,
        "real_rate": real_rate
    }


def _format_tenure(years: int, months: int, days: int) -> str:
    parts = []
    if years > 0:
        parts.append(f"{years} {'Year' if years == 1 else 'Years'}")
    if months > 0:
        parts.append(f"{months} {'Month' if months == 1 else 'Months'}")
    if days > 0:
        parts.append(f"{days} {'Day' if days == 1 else 'Days'}")
    return ", ".join(parts) if parts else "0 Days"
