"""
Core Financial Calculation and Strategy Engines
Phase 3 & Phase 4:
- Standardized tenure normalization
- Dynamic multi-tier slab extraction
- RBI quarterly compounding, RD series, and sovereign scheme loops
- 5-Year FD Ladder Strategy
- DICGC Risk & Multi-Bank Auto-Splitter
- Break FD vs Overdraft Loan Decision Engine
- Section 194A TDS, Post-Tax Yield, and Inflation Discounting
- 5-Bank Simultaneous Comparator
"""

import math
from typing import List, Dict, Any, Tuple, Optional
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
    POTD_RATES,
    get_bank_fd_rate,
    get_govt_scheme_rate
)
from backend.schemas import (
    InvestmentRequest,
    CalculationResponse,
    LadderTranche,
    CashflowItem,
    DICGCInfo,
    DICGCSplitBank,
    BankComparisonItem,
    BreakVsLoanRequest,
    BreakVsLoanResponse,
    AmortizationRow,
    SchemeComparisonItem,
    SmartComparisonResponse,
    GoalPlannerRequest,
    GoalPlannerResponse,
    GoalOptionItem
)

# Friendly bank institutional metadata
BANK_METADATA = {
    "SBI": {"name": "State Bank of India", "type": "Public Sector"},
    "PNB": {"name": "Punjab National Bank", "type": "Public Sector"},
    "BOB": {"name": "Bank of Baroda", "type": "Public Sector"},
    "HDFC": {"name": "HDFC Bank", "type": "Private Sector"},
    "ICICI": {"name": "ICICI Bank", "type": "Private Sector"},
}


# ============================================================================
# 1. Tenure Standardization
# ============================================================================

def standardize_tenure(years: int, months: int, days: int) -> Tuple[int, float, int]:
    """
    Standardize tenure into exact days, fractional years, and total months.
    Formula:
        D = (years * 365) + (months * 30) + days
        T = D / 365.0
        M = (years * 12) + months + floor(days / 30)
    """
    total_days = (years * 365) + (months * 30) + days
    fractional_years = total_days / 365.0 if total_days > 0 else 0.0
    total_months = (years * 12) + months + (days // 30)
    return total_days, fractional_years, total_months


# ============================================================================
# 2. Dynamic Rate Lookup
# ============================================================================

def lookup_bank_rates_all_tiers(bank: str, days: int, age: int) -> Dict[str, float]:
    """
    Look up regular, senior (60-79), and super senior (80+) rates from bank slab matrix
    and resolve applicable_rate based on investor age.
    """
    bank_key = bank.upper()
    if bank_key not in BANK_FD_SLABS:
        raise ValueError(f"Unknown bank: {bank}")

    slabs = BANK_FD_SLABS[bank_key]
    matched_slab = None

    for slab in slabs:
        min_d, max_d, reg_r, sen_r, sup_sen_r = slab
        if min_d <= days <= max_d:
            matched_slab = slab
            break

    if not matched_slab:
        matched_slab = slabs[-1] if days >= 1826 else slabs[0]

    min_d, max_d, reg_rate, senior_rate, super_senior_rate = matched_slab

    if age >= 80:
        applicable_rate = super_senior_rate
    elif age >= 60:
        applicable_rate = senior_rate
    else:
        applicable_rate = reg_rate

    return {
        "regular_rate": float(reg_rate),
        "senior_rate": float(senior_rate),
        "super_senior_rate": float(super_senior_rate),
        "applicable_rate": float(applicable_rate)
    }


def compute_apy(nominal_rate: float) -> float:
    """
    Compute Annual Percentage Yield (APY) under standard quarterly compounding:
    APY = ((1 + r / 400)**4 - 1) * 100.0
    """
    return (math.pow(1.0 + (nominal_rate / 400.0), 4.0) - 1.0) * 100.0


# ============================================================================
# 3. Core Compounding & Product Calculators
# ============================================================================

def compute_bank_fd(
    principal: float,
    rate: float,
    total_days: int,
    fractional_years: float,
    payout_type: str
) -> Tuple[float, float, Optional[float], Optional[str], List[CashflowItem]]:
    """
    Execute Bank FD calculation adhering to RBI compounding conventions:
    - If total_days < 180: Simple interest paid at maturity
    - If total_days >= 180: Quarterly compounding A = P * (1 + r/400)**(4 * T)
    - If Monthly payout: Payout = (P * r) / 1200
    - If Quarterly payout: Payout = (P * r) / 400
    """
    periodic_payout: Optional[float] = None
    periodic_frequency: Optional[str] = None
    cashflow_schedule: List[CashflowItem] = []

    if payout_type == "CUMULATIVE":
        if total_days < 180:
            interest_earned = principal * (rate / 100.0) * (total_days / 365.0)
            maturity_amount = principal + interest_earned
        else:
            # Quarterly compounding: A = P * (1 + r/400)**(4 * T)
            quarters = fractional_years * 4.0
            maturity_amount = principal * math.pow(1.0 + (rate / 400.0), quarters)
            interest_earned = maturity_amount - principal

    elif payout_type == "QUARTERLY":
        quarterly_payout = (principal * rate) / 400.0
        periodic_payout = round(quarterly_payout, 2)
        periodic_frequency = "QUARTERLY"
        num_quarters = max(1, int(round(fractional_years * 4.0)))
        interest_earned = quarterly_payout * num_quarters
        maturity_amount = principal

        for q in range(1, min(num_quarters + 1, 41)):
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
        monthly_payout = (principal * rate) / 1200.0
        periodic_payout = round(monthly_payout, 2)
        periodic_frequency = "MONTHLY"
        num_months = max(1, int(round(fractional_years * 12.0)))
        interest_earned = monthly_payout * num_months
        maturity_amount = principal

        for m in range(1, min(num_months + 1, 37)):
            cashflow_schedule.append(
                CashflowItem(
                    period=m,
                    label=f"Month {m}",
                    payout_amount=round(monthly_payout, 2),
                    cumulative_interest=round(monthly_payout * m, 2),
                    remaining_principal=principal
                )
            )
    else:
        raise ValueError(f"Unsupported payout type: {payout_type}")

    return maturity_amount, interest_earned, periodic_payout, periodic_frequency, cashflow_schedule


def compute_bank_rd(
    monthly_installment: float,
    rate: float,
    total_months: int
) -> Tuple[float, float, float]:
    """
    Bank RD: Monthly compound series under RBI Master Direction:
    A = sum_{k=1}^{M} [ P * (1 + r/400)**(k / 3.0) ]
    where k is the remaining term in months for each installment.
    """
    total_invested = monthly_installment * total_months
    maturity_amount = 0.0

    for k in range(1, total_months + 1):
        quarters = k / 3.0
        maturity_amount += monthly_installment * math.pow(1.0 + (rate / 400.0), quarters)

    interest_earned = maturity_amount - total_invested
    return total_invested, maturity_amount, interest_earned


def compute_govt_scheme(
    scheme_code: str,
    amount: float
) -> Tuple[float, float, float, Optional[float], Optional[str], List[CashflowItem], int, float, List[str]]:
    """
    Government Small Savings compounding loops & statutory rules:
    - PPF: 15-year annual compounding loop
    - SSY: 21-year compounding (15 years deposits + 6 years compounding)
    - SCSS: 5-year quarterly payout (P * r / 400)
    - POMIS: 5-year monthly payout (P * r / 1200)
    - NSC: 5-year annual compounding A = P * (1 + r/100)**5
    """
    cfg = GOVT_SCHEMES_CONFIG[scheme_code]
    rate = cfg["interest_rate"]
    periodic_payout: Optional[float] = None
    periodic_frequency: Optional[str] = None
    cashflow_schedule: List[CashflowItem] = []
    regulatory_notes: List[str] = [
        f"100% Sovereign backing by Government of India. Rate: {rate:.2f}% p.a."
    ]

    if scheme_code == "PPF":
        annual_deposit = amount
        total_principal = annual_deposit * 15
        balance = 0.0
        r_dec = rate / 100.0
        # Annual compounding loop
        for yr in range(1, 16):
            balance = (balance + annual_deposit) * (1.0 + r_dec)
        maturity_amount = balance
        interest_earned = maturity_amount - total_principal
        tenure_days = 15 * 365
        fractional_years = 15.0
        regulatory_notes.append("Statutory 15-year lock-in with EEE tax exemption under Section 80C and Section 10(11).")

    elif scheme_code == "SSY":
        annual_deposit = amount
        total_principal = annual_deposit * 15
        balance = 0.0
        r_dec = rate / 100.0
        # First 15 years: annual deposits + interest
        for yr in range(1, 16):
            balance = (balance + annual_deposit) * (1.0 + r_dec)
        # Next 6 years: continues compounding without fresh deposits
        for yr in range(16, 22):
            balance = balance * (1.0 + r_dec)
        maturity_amount = balance
        interest_earned = maturity_amount - total_principal
        tenure_days = 21 * 365
        fractional_years = 21.0
        regulatory_notes.append("Matures in 21 years (or marriage after 18). Triple tax-free EEE status.")

    elif scheme_code == "SCSS":
        principal = amount
        total_principal = principal
        quarterly_payout = (principal * rate) / 400.0
        periodic_payout = round(quarterly_payout, 2)
        periodic_frequency = "QUARTERLY"
        num_quarters = 20  # 5 years * 4
        interest_earned = quarterly_payout * num_quarters
        maturity_amount = principal
        tenure_days = 5 * 365
        fractional_years = 5.0

        for q in range(1, 21):
            cashflow_schedule.append(
                CashflowItem(
                    period=q,
                    label=f"Quarter {q}",
                    payout_amount=round(quarterly_payout, 2),
                    cumulative_interest=round(quarterly_payout * q, 2),
                    remaining_principal=principal
                )
            )
        regulatory_notes.append("Quarterly payout credited on 1st of April, July, October, January.")

    elif scheme_code == "POMIS":
        principal = amount
        total_principal = principal
        monthly_payout = (principal * rate) / 1200.0
        periodic_payout = round(monthly_payout, 2)
        periodic_frequency = "MONTHLY"
        num_months = 60  # 5 years * 12
        interest_earned = monthly_payout * num_months
        maturity_amount = principal
        tenure_days = 5 * 365
        fractional_years = 5.0

        for m in range(1, 37):
            cashflow_schedule.append(
                CashflowItem(
                    period=m,
                    label=f"Month {m}",
                    payout_amount=round(monthly_payout, 2),
                    cumulative_interest=round(monthly_payout * m, 2),
                    remaining_principal=principal
                )
            )
        regulatory_notes.append("Monthly interest credited directly to linked savings account.")

    elif scheme_code == "NSC":
        principal = amount
        total_principal = principal
        maturity_amount = principal * math.pow(1.0 + (rate / 100.0), 5.0)
        interest_earned = maturity_amount - total_principal
        tenure_days = 5 * 365
        fractional_years = 5.0
        regulatory_notes.append("Annual compounding paid at maturity. Years 1-4 interest eligible for Sec 80C.")
    else:
        raise ValueError(f"Unknown government scheme: {scheme_code}")

    return (
        total_principal,
        maturity_amount,
        interest_earned,
        periodic_payout,
        periodic_frequency,
        cashflow_schedule,
        tenure_days,
        fractional_years,
        regulatory_notes
    )


# ============================================================================
# 4. Strategy Engine 1: 5-Year FD Ladder
# ============================================================================

def compute_fd_ladder_strategy(
    bank: str,
    total_amount: float,
    age: int
) -> Tuple[List[LadderTranche], float, float, float]:
    """
    Split total amount into 5 equal 20% tranches maturing in Year 1, 2, 3, 4, and 5
    at respective bank slab rates.
    """
    tranche_principal = total_amount / 5.0
    ladder_tranches: List[LadderTranche] = []
    total_maturity = 0.0
    total_interest = 0.0
    weighted_rate_sum = 0.0

    tenures = [
        (1, 365),
        (2, 730),
        (3, 1095),
        (4, 1460),
        (5, 1826)
    ]

    for year_idx, days in tenures:
        rates = lookup_bank_rates_all_tiers(bank, days, age)
        rate = rates["applicable_rate"]
        quarters = year_idx * 4.0
        mat_val = tranche_principal * math.pow(1.0 + (rate / 400.0), quarters)
        interest = mat_val - tranche_principal

        ladder_tranches.append(
            LadderTranche(
                tranche_number=year_idx,
                tenure_years=year_idx,
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

    blended_rate = weighted_rate_sum / 5.0
    return ladder_tranches, total_maturity, total_interest, blended_rate


# ============================================================================
# 5. Strategy Engine 2: DICGC Risk & Auto-Splitter
# ============================================================================

def compute_dicgc_analysis_and_split(
    principal: float,
    projected_maturity: float,
    total_days: int,
    age: int,
    is_bank: bool
) -> DICGCInfo:
    """
    Evaluate DICGC exposure.
    If projected maturity > ₹5,00,000, calculate uninsured risk and generate
    an auto-split across top banks (SBI, BOB, HDFC, PNB, ICICI) capping principal
    at ₹4,25,000 per bank.
    """
    if not is_bank:
        return DICGCInfo(
            total_exposure=round(principal, 2),
            insurance_limit=float("inf"),
            is_fully_insured=True,
            uninsured_amount=0.0,
            safe_principal_limit=float("inf"),
            recommendation="100% sovereign guaranteed by Government of India. Zero credit/default risk.",
            auto_split_plan=None
        )

    total_exposure = projected_maturity
    is_fully_insured = total_exposure <= DICGC_LIMIT
    uninsured_amount = max(0.0, total_exposure - DICGC_LIMIT)

    auto_split_plan: Optional[List[DICGCSplitBank]] = None

    if is_fully_insured:
        rec = f"Fully insured under DICGC (₹{total_exposure:,.2f} <= ₹5,00,000 cover). Full principal & interest are safe."
    else:
        rec = (
            f"ALERT: Total maturity proceeds (₹{total_exposure:,.2f}) exceed DICGC insurance ceiling by ₹{uninsured_amount:,.2f}. "
            f"To achieve 100% sovereign insurance protection, split your capital across multiple scheduled banks "
            f"capping principal at ₹{SAFE_PRINCIPAL_PER_BANK:,.2f} per institution."
        )

        # Generate auto-split plan across SBI, BOB, and HDFC (or more if needed)
        split_banks_pool = ["SBI", "BOB", "HDFC", "PNB", "ICICI"]
        remaining_principal = principal
        auto_split_plan = []

        for b_code in split_banks_pool:
            if remaining_principal <= 0:
                break
            alloc = min(remaining_principal, SAFE_PRINCIPAL_PER_BANK)
            remaining_principal -= alloc

            # Calculate projected maturity in this split bank
            b_rate = lookup_bank_rates_all_tiers(b_code, total_days, age)["applicable_rate"]
            t_yrs = total_days / 365.0
            if total_days < 180:
                mat = alloc + (alloc * (b_rate / 100.0) * t_yrs)
            else:
                mat = alloc * math.pow(1.0 + (b_rate / 400.0), t_yrs * 4.0)

            auto_split_plan.append(
                DICGCSplitBank(
                    bank=b_code,
                    bank_name=BANK_METADATA.get(b_code, {}).get("name", b_code),
                    principal_allocated=round(alloc, 2),
                    projected_interest=round(mat - alloc, 2),
                    projected_maturity=round(mat, 2),
                    is_fully_insured=(mat <= DICGC_LIMIT)
                )
            )

    return DICGCInfo(
        total_exposure=round(total_exposure, 2),
        insurance_limit=DICGC_LIMIT,
        is_fully_insured=is_fully_insured,
        uninsured_amount=round(uninsured_amount, 2),
        safe_principal_limit=SAFE_PRINCIPAL_PER_BANK,
        recommendation=rec,
        auto_split_plan=auto_split_plan
    )


# ============================================================================
# 6. Strategy Engine 3: Break FD vs Overdraft Loan Decision Engine
# ============================================================================

def analyze_break_vs_loan(request: BreakVsLoanRequest) -> BreakVsLoanResponse:
    """
    Compare breaking FD prematurely vs taking an overdraft loan against FD:
    1. Premature Break Penalty:
       - Run tenure rate lookup: rate for elapsed months.
       - Penalized rate = max(0.5, applicable_slab_rate - PREMATURE_PENALTY).
       - Interest paid upon premature liquidation: computed at penalized rate for elapsed time.
       - Maturity interest lost: (Contracted full tenure interest - Interest received on break).
    2. Overdraft Loan:
       - Loan rate = Contracted FD Rate + FD_LOAN_INTEREST_MARGIN (usually +1.00%).
       - Loan cost = cash_needed * (loan_rate / 100.0) * (loan_duration_months / 12.0).
       - FD stays intact and earns full contracted interest till maturity!
    3. Verdict:
       - Net financial outcome comparison.
    """
    principal = request.principal
    contracted_rate = request.contracted_rate
    elapsed_months = request.elapsed_months
    cash_needed = min(request.emergency_cash_needed, principal * 0.90)  # Max 90% loan allowed
    loan_duration_months = request.loan_duration_months
    elapsed_days = elapsed_months * 30

    # 1. Full Contracted Maturity
    total_years = request.total_tenure_months / 12.0
    full_maturity = principal * math.pow(1.0 + (contracted_rate / 400.0), total_years * 4.0)
    full_interest = full_maturity - principal

    # 2. Rate for elapsed period
    try:
        slab_at_break = lookup_bank_rates_all_tiers(request.selected_bank, elapsed_days, request.age)["applicable_rate"]
    except Exception:
        slab_at_break = max(3.50, contracted_rate - 1.00)

    # Penalized rate as per RBI norm: (rate applicable for run period - 1.00%)
    penalized_rate = max(1.0, slab_at_break - PREMATURE_PENALTY)

    # Interest received on breaking now
    elapsed_years = elapsed_days / 365.0
    if elapsed_days < 180:
        interest_earned_on_break = principal * (penalized_rate / 100.0) * elapsed_years
    else:
        maturity_at_break = principal * math.pow(1.0 + (penalized_rate / 400.0), elapsed_years * 4.0)
        interest_earned_on_break = maturity_at_break - principal

    maturity_interest_lost = max(0.0, full_interest - interest_earned_on_break)

    # 3. Overdraft Loan Cost
    loan_interest_rate = contracted_rate + FD_LOAN_INTEREST_MARGIN
    loan_interest_cost = cash_needed * (loan_interest_rate / 100.0) * (loan_duration_months / 12.0)

    # Net Gain if keeping FD and taking loan:
    # Full interest earned from FD minus loan interest paid
    net_gain_from_keeping_fd = full_interest - loan_interest_cost

    # Financial Difference: Keeping FD vs Breaking
    # If keeping FD: you get Full Interest - Loan Interest
    # If breaking FD: you get only Interest on Break
    diff = net_gain_from_keeping_fd - interest_earned_on_break

    if diff >= 0:
        rec = "TAKE_LOAN"
        headline = f"Availing an Overdraft Loan saves ₹{diff:,.2f} over liquidating your FD."
        description = (
            f"Taking a loan of ₹{cash_needed:,.2f} at {loan_interest_rate:.2f}% costs only ₹{loan_interest_cost:,.2f} in interest. "
            f"Your fixed deposit continues compounding at {contracted_rate:.2f}% to yield ₹{full_interest:,.2f} total interest. "
            f"Breaking the FD now triggers a penalty down to {penalized_rate:.2f}%, losing you ₹{maturity_interest_lost:,.2f} in future returns."
        )
    else:
        rec = "BREAK_FD"
        abs_diff = abs(diff)
        headline = f"Breaking the FD is financially favorable by ₹{abs_diff:,.2f}."
        description = (
            f"Because the loan tenure of {loan_duration_months} months is long relative to remaining FD tenure, "
            f"the cumulative borrowing cost (₹{loan_interest_cost:,.2f}) outweighs premature penalty losses. "
            f"Liquidating the FD yields ₹{interest_earned_on_break:,.2f} interest up to month {elapsed_months} without incurring debt."
        )

    return BreakVsLoanResponse(
        emergency_cash_needed=round(cash_needed, 2),
        elapsed_months=elapsed_months,
        loan_duration_months=loan_duration_months,
        applicable_slab_rate_at_break=round(slab_at_break, 2),
        penalized_rate=round(penalized_rate, 2),
        interest_earned_on_break=round(interest_earned_on_break, 2),
        maturity_interest_lost=round(maturity_interest_lost, 2),
        loan_interest_rate=round(loan_interest_rate, 2),
        loan_interest_cost=round(loan_interest_cost, 2),
        fd_full_maturity_proceeds=round(full_maturity, 2),
        net_gain_from_keeping_fd=round(net_gain_from_keeping_fd, 2),
        recommendation=rec,
        financial_difference=round(abs(diff), 2),
        verdict_headline=headline,
        verdict_description=description
    )


# ============================================================================
# 7. Tax, TDS & Multi-Bank Benchmarking
# ============================================================================

def compute_tax_and_tds(
    interest_earned: float,
    fractional_years: float,
    request: InvestmentRequest,
    is_eee: bool
) -> Dict[str, Any]:
    """
    Section 194A TDS Engine:
    - Annual threshold: ₹40,000 (regular) or ₹50,000 (seniors 60+)
    - If threshold exceeded and has_form_15g_15h == False: 10% TDS with PAN
    - NRI_NRO: Mandatory 31.2% TDS (30% + 4% cess) without threshold
    - NRI_NRE: 0% TDS
    - EEE schemes: 0% tax & 0% TDS
    """
    if is_eee:
        return {
            "is_tds_applicable": False,
            "estimated_tds": 0.0,
            "estimated_tax": 0.0,
            "net_interest": interest_earned,
            "post_tax_yield": 0.0
        }

    annual_interest = interest_earned / max(fractional_years, 1.0)
    tds_threshold = TDS_THRESHOLD_SENIOR if request.age >= 60 else TDS_THRESHOLD_REGULAR

    if request.resident_status == "NRI_NRE":
        is_tds_applicable = False
        estimated_tds = 0.0
        tax_payable = 0.0
        net_interest = interest_earned
    elif request.resident_status == "NRI_NRO":
        is_tds_applicable = True
        estimated_tds = interest_earned * 0.312  # 30% tax + 4% health & education cess
        tax_payable = estimated_tds
        net_interest = max(0.0, interest_earned - tax_payable)
    else:
        # Resident
        is_tds_applicable = (annual_interest > tds_threshold) and (not request.has_form_15g_15h)
        estimated_tds = (interest_earned * TDS_RATE_WITH_PAN) if is_tds_applicable else 0.0

        # Section 80TTB deduction for seniors (up to ₹50,000 interest tax-exempt)
        taxable_interest = max(0.0, interest_earned - (50000.0 if request.age >= 60 else 0.0))
        tax_payable = taxable_interest * request.tax_slab
        net_interest = max(0.0, interest_earned - tax_payable)

    post_tax_nominal_yield = (net_interest / max(interest_earned, 1.0)) * 100.0

    # Smart Form 15G / 15H Advisory Detector
    form_15g_15h_advisory: Optional[str] = None
    if not is_eee and request.resident_status == "RESIDENT":
        if request.has_form_15g_15h:
            form_15g_15h_advisory = "Form 15G/15H active: Zero TDS deducted under Section 194A."
        elif request.age < 60 and annual_interest > 40000.0:
            form_15g_15h_advisory = (
                f"10% TDS (₹{estimated_tds:,.2f}) applies under Section 194A. "
                "If your total taxable income is below basic exemption limits, submit Form 15G to prevent deductions."
            )
        elif request.age >= 60 and annual_interest > 50000.0:
            form_15g_15h_advisory = (
                f"10% TDS (₹{estimated_tds:,.2f}) applies under Section 194A (above ₹50,000 Section 80TTB exemption). "
                "If your total taxable income is below basic exemption limits, submit Form 15H to prevent deductions."
            )

    return {
        "is_tds_applicable": is_tds_applicable,
        "estimated_tds": estimated_tds,
        "estimated_tax": tax_payable,
        "net_interest": net_interest,
        "post_tax_yield": post_tax_nominal_yield,
        "form_15g_15h_advisory": form_15g_15h_advisory
    }


def compute_5_bank_benchmarks(
    principal: float,
    total_days: int,
    fractional_years: float,
    total_months: int,
    age: int,
    category: str,
    payout_type: str
) -> List[BankComparisonItem]:
    """
    Run calculation simultaneously across SBI, PNB, BOB, HDFC, and ICICI
    for identical amount, tenure, and demographics. Return ranked list by maturity.
    """
    bank_list = ["SBI", "PNB", "BOB", "HDFC", "ICICI"]
    results: List[Dict[str, Any]] = []

    for b_code in bank_list:
        rates = lookup_bank_rates_all_tiers(b_code, total_days, age)
        app_rate = rates["applicable_rate"]
        apy = compute_apy(app_rate)

        if category == "BANK_RD":
            tot_inv, mat, interest = compute_bank_rd(principal, app_rate, max(6, total_months))
        else:
            mat, interest, _, _, _ = compute_bank_fd(principal, app_rate, total_days, fractional_years, payout_type)

        results.append({
            "bank_code": b_code,
            "bank_name": BANK_METADATA[b_code]["name"],
            "bank_type": BANK_METADATA[b_code]["type"],
            "regular_rate": rates["regular_rate"],
            "senior_rate": rates["senior_rate"],
            "super_senior_rate": rates["super_senior_rate"],
            "applicable_rate": app_rate,
            "apy": apy,
            "maturity_amount": mat,
            "interest_earned": interest,
        })

    # Sort descending by maturity_amount
    results.sort(key=lambda x: x["maturity_amount"], reverse=True)
    max_mat = results[0]["maturity_amount"] if results else 0.0

    ranked_items: List[BankComparisonItem] = []
    for rank, item in enumerate(results, start=1):
        ranked_items.append(
            BankComparisonItem(
                bank_code=item["bank_code"],
                bank_name=item["bank_name"],
                bank_type=item["bank_type"],
                regular_rate=round(item["regular_rate"], 2),
                senior_rate=round(item["senior_rate"], 2),
                super_senior_rate=round(item["super_senior_rate"], 2),
                applicable_rate=round(item["applicable_rate"], 2),
                apy=round(item["apy"], 2),
                maturity_amount=round(item["maturity_amount"], 2),
                interest_earned=round(item["interest_earned"], 2),
                rank=rank,
                is_best_rate=(item["maturity_amount"] == max_mat)
            )
        )

    return ranked_items


# ============================================================================
# 8. Amortization Schedule Generation Engine (Phase 5)
# ============================================================================

def generate_amortization_schedule(
    request: InvestmentRequest,
    rate: float,
    total_days: int,
    fractional_years: float,
    total_months: int,
    principal: float,
    maturity_amount: float,
    ladder_tranches: Optional[List[LadderTranche]] = None
) -> List[AmortizationRow]:
    """
    Generate year-by-year amortization ledger:
    - year, opening_balance, deposit_added, interest_credited, tds_deducted, closing_balance.
    Accurately tracks compounding progression for Bank FD/RD, PPF, SSY, SCSS, POMIS, and NSC.
    """
    rows: List[AmortizationRow] = []
    annual_threshold = TDS_THRESHOLD_SENIOR if request.age >= 60 else TDS_THRESHOLD_REGULAR

    # 1. 5-Year FD Ladder Strategy
    if request.calculation_mode == "LADDER" and ladder_tranches:
        current_balance = request.amount
        for yr in range(1, 6):
            opening = current_balance
            t = ladder_tranches[yr - 1]
            interest_this_year = t.interest_earned
            tds = 0.0
            if interest_this_year > annual_threshold and not request.has_form_15g_15h:
                tds = interest_this_year * TDS_RATE_WITH_PAN

            closing = opening + interest_this_year - tds
            current_balance = closing
            rows.append(AmortizationRow(
                year=yr,
                opening_balance=round(opening, 2),
                deposit_added=0.0,
                interest_credited=round(interest_this_year, 2),
                tds_deducted=round(tds, 2),
                closing_balance=round(closing, 2)
            ))
        return rows

    # 2. Government Small Savings Schemes
    if request.category == "GOVT_SCHEME":
        scheme = request.selected_scheme or "PPF"
        if scheme == "PPF":
            annual_dep = request.amount
            balance = 0.0
            r_dec = rate / 100.0
            for yr in range(1, 16):
                opening = balance
                dep = annual_dep
                interest = (opening + dep) * r_dec
                closing = opening + dep + interest
                balance = closing
                rows.append(AmortizationRow(
                    year=yr,
                    opening_balance=round(opening, 2),
                    deposit_added=round(dep, 2),
                    interest_credited=round(interest, 2),
                    tds_deducted=0.0,
                    closing_balance=round(closing, 2)
                ))
            return rows

        elif scheme == "SSY":
            annual_dep = request.amount
            balance = 0.0
            r_dec = rate / 100.0
            for yr in range(1, 22):
                opening = balance
                dep = annual_dep if yr <= 15 else 0.0
                interest = (opening + dep) * r_dec
                closing = opening + dep + interest
                balance = closing
                rows.append(AmortizationRow(
                    year=yr,
                    opening_balance=round(opening, 2),
                    deposit_added=round(dep, 2),
                    interest_credited=round(interest, 2),
                    tds_deducted=0.0,
                    closing_balance=round(closing, 2)
                ))
            return rows

        elif scheme in ("SCSS", "POMIS"):
            r_dec = rate / 100.0
            for yr in range(1, 6):
                opening = request.amount
                interest = request.amount * r_dec
                tds = 0.0
                if scheme == "SCSS" and interest > annual_threshold and not request.has_form_15g_15h:
                    tds = interest * TDS_RATE_WITH_PAN
                closing = request.amount
                rows.append(AmortizationRow(
                    year=yr,
                    opening_balance=round(opening, 2),
                    deposit_added=0.0,
                    interest_credited=round(interest, 2),
                    tds_deducted=round(tds, 2),
                    closing_balance=round(closing, 2)
                ))
            return rows

        elif scheme == "NSC":
            balance = request.amount
            r_dec = rate / 100.0
            for yr in range(1, 6):
                opening = balance
                interest = opening * r_dec
                closing = opening + interest
                balance = closing
                rows.append(AmortizationRow(
                    year=yr,
                    opening_balance=round(opening, 2),
                    deposit_added=0.0,
                    interest_credited=round(interest, 2),
                    tds_deducted=0.0,
                    closing_balance=round(closing, 2)
                ))
            return rows

    # 3. Bank Recurring Deposit (RD)
    if request.category == "BANK_RD":
        monthly_inst = request.amount
        total_m = max(6, total_months)
        num_years = max(1, math.ceil(total_m / 12.0))
        balance = 0.0
        months_done = 0

        for yr in range(1, num_years + 1):
            opening = balance
            months_this_yr = min(12, total_m - months_done)
            months_done += months_this_yr
            dep = monthly_inst * months_this_yr

            interest_opening = opening * (math.pow(1.0 + (rate / 400.0), (months_this_yr / 3.0)) - 1.0)
            interest_dep = 0.0
            for k in range(1, months_this_yr + 1):
                interest_dep += monthly_inst * math.pow(1.0 + (rate / 400.0), k / 3.0)
            interest_dep -= dep

            total_yr_interest = interest_opening + interest_dep
            tds = 0.0
            if total_yr_interest > annual_threshold and not request.has_form_15g_15h:
                tds = total_yr_interest * (0.312 if request.resident_status == "NRI_NRO" else TDS_RATE_WITH_PAN)

            closing = opening + dep + total_yr_interest - tds
            balance = closing
            rows.append(AmortizationRow(
                year=yr,
                opening_balance=round(opening, 2),
                deposit_added=round(dep, 2),
                interest_credited=round(total_yr_interest, 2),
                tds_deducted=round(tds, 2),
                closing_balance=round(closing, 2)
            ))
        return rows

    # 4. Bank Fixed Deposit (FD)
    num_years = max(1, math.ceil(fractional_years))
    if request.payout_type in ("MONTHLY", "QUARTERLY"):
        for yr in range(1, num_years + 1):
            dt = min(1.0, max(0.01, fractional_years - (yr - 1)))
            opening = request.amount
            interest = request.amount * (rate / 100.0) * dt
            tds = 0.0
            if interest > annual_threshold and not request.has_form_15g_15h:
                tds = interest * (0.312 if request.resident_status == "NRI_NRO" else TDS_RATE_WITH_PAN)
            closing = request.amount
            rows.append(AmortizationRow(
                year=yr,
                opening_balance=round(opening, 2),
                deposit_added=0.0,
                interest_credited=round(interest, 2),
                tds_deducted=round(tds, 2),
                closing_balance=round(closing, 2)
            ))
        return rows
    else:
        balance = request.amount
        for yr in range(1, num_years + 1):
            dt = min(1.0, max(0.01, fractional_years - (yr - 1)))
            opening = balance
            if total_days < 180:
                interest = opening * (rate / 100.0) * dt
                val = opening + interest
            else:
                val = opening * math.pow(1.0 + (rate / 400.0), dt * 4.0)
                interest = val - opening

            tds = 0.0
            if interest > annual_threshold and not request.has_form_15g_15h:
                tds = interest * (0.312 if request.resident_status == "NRI_NRO" else TDS_RATE_WITH_PAN)

            closing = opening + interest - tds
            balance = closing
            rows.append(AmortizationRow(
                year=yr,
                opening_balance=round(opening, 2),
                deposit_added=0.0,
                interest_credited=round(interest, 2),
                tds_deducted=round(tds, 2),
                closing_balance=round(closing, 2)
            ))
        return rows


# ============================================================================
# 9. Smart Scheme Comparison & Recommendation Engine
# ============================================================================

# Statutory scheme frequency classifications
CADENCE_MAP: Dict[str, str] = {
    "BANK_FD": "LUMP_SUM",
    "SCSS": "LUMP_SUM",
    "POMIS": "LUMP_SUM",
    "NSC": "LUMP_SUM",
    "POTD": "LUMP_SUM",
    "BANK_RD": "MONTHLY",
    "POST_OFFICE_RD": "MONTHLY",
    "PPF": "YEARLY",
    "SSY": "YEARLY",
}


def resolve_active_cadence(user_input: InvestmentRequest) -> str:
    """
    Categorize user's intended investment cadence:
    - LUMP_SUM: Bank FD, POTD, SCSS, POMIS, NSC
    - MONTHLY: Bank RD, Post Office RD
    - YEARLY: PPF, SSY
    """
    if getattr(user_input, "investment_frequency", None):
        freq = user_input.investment_frequency.upper()
        if freq in ("MONTHLY", "RECURRING"):
            return "MONTHLY"
        elif freq in ("YEARLY", "ANNUAL"):
            return "YEARLY"
        elif freq in ("LUMP_SUM", "ONE_TIME"):
            return "LUMP_SUM"

    if user_input.category == "BANK_FD":
        return "LUMP_SUM"
    elif user_input.category == "BANK_RD":
        return "MONTHLY"
    elif user_input.category == "GOVT_SCHEME":
        scheme = (user_input.selected_scheme or "").upper()
        if scheme in ("SCSS", "POMIS", "NSC", "POTD"):
            return "LUMP_SUM"
        elif scheme in ("PPF", "SSY"):
            return "YEARLY"
        elif scheme in ("BANK_RD", "POST_OFFICE_RD"):
            return "MONTHLY"
    return "LUMP_SUM"


def compare_all_eligible_schemes(user_input: InvestmentRequest) -> SmartComparisonResponse:
    """
    Smart Scheme Comparison & Recommendation Engine:
    Filters and ranks instruments strictly within the user's active deposit cadence:
    1. LUMP_SUM:
       - Evaluates only Bank FDs (SBI, PNB, BOB, HDFC, ICICI), POTD, NSC, SCSS, and POMIS.
       - Strictly applies TENURE PARITY: only compares schemes matching user's selected tenure
         (e.g., benchmark a 1-year FD only against 1-year products, excluding 5-year SCSS/POMIS/NSC).
       - Strictly EXCLUDES PPF, SSY, and Bank RDs.
    2. MONTHLY:
       - Evaluates only Bank RDs (SBI, PNB, BOB, HDFC, ICICI) and Post Office RD.
       - Strictly EXCLUDES PPF, SSY, SCSS, POMIS, and Bank FDs.
    3. YEARLY:
       - Evaluates only PPF and SSY.
       - Strictly EXCLUDES Bank FDs, POTD, SCSS, POMIS, NSC, and Bank RDs.
    """
    age = user_input.age
    gender = (user_input.gender or "MALE").upper()
    amount = float(user_input.amount)
    tax_slab = float(user_input.tax_slab)
    resident_status = user_input.resident_status
    is_nri = resident_status in ("NRI_NRE", "NRI_NRO")

    active_cadence = resolve_active_cadence(user_input)

    total_days, fractional_years, total_months = standardize_tenure(
        user_input.tenure_years,
        user_input.tenure_months,
        user_input.tenure_days
    )

    eligible_items: List[SchemeComparisonItem] = []
    cross_cadence_ref: Optional[SchemeComparisonItem] = None

    # ========================================================================
    # Branch 1: LUMP_SUM (One-Time Deposit)
    # Instruments: Bank FDs (SBI, PNB, BOB, HDFC, ICICI), POTD, SCSS, POMIS, NSC
    # ========================================================================
    if active_cadence == "LUMP_SUM":
        if 7 <= total_days <= 3653:
            fd_days = total_days
            fd_years = max(fractional_years, 7 / 365.0)
            fd_tenure_display = f"{round(fractional_years, 1)} Yrs" if fractional_years >= 1 else f"{fd_days} Days"
        else:
            fd_days = 365
            fd_years = 1.0
            fd_tenure_display = "1 Year"

        # 1A. 5 Scheduled Commercial Banks (Fixed Deposits) - Adapts to exact user tenure
        banks = ["SBI", "PNB", "BOB", "HDFC", "ICICI"]
        bank_results: List[SchemeComparisonItem] = []

        if amount >= 1000.0:
            for b_code in banks:
                b_info = BANK_METADATA.get(b_code, {"name": b_code, "type": "Commercial Bank"})
                rates = lookup_bank_rates_all_tiers(b_code, fd_days, age)
                gross_rate = rates["applicable_rate"]

                if fd_days < 180:
                    mat = amount + (amount * (gross_rate / 100.0) * fd_years)
                else:
                    mat = amount * math.pow(1.0 + (gross_rate / 400.0), fd_years * 4.0)

                interest = mat - amount

                if resident_status == "NRI_NRE":
                    tax_payable = 0.0
                    post_tax_yield = gross_rate
                elif resident_status == "NRI_NRO":
                    tax_payable = interest * 0.312
                    post_tax_yield = round(gross_rate * (1.0 - 0.312), 2)
                else:
                    taxable_interest = max(0.0, interest - (50000.0 if age >= 60 else 0.0))
                    tax_payable = taxable_interest * tax_slab
                    post_tax_yield = round(((interest - tax_payable) / interest) * gross_rate, 2) if interest > 0 else gross_rate

                post_tax_interest = interest - tax_payable
                post_tax_maturity = amount + post_tax_interest

                tax_treatment_str = (
                    "Nil Tax (NRE Account)" if resident_status == "NRI_NRE"
                    else "31.2% TDS (NRO Account)" if resident_status == "NRI_NRO"
                    else f"Taxable ({int(tax_slab * 100)}% slab with 80TTB)" if age >= 60 and tax_slab > 0
                    else f"Taxable ({int(tax_slab * 100)}% slab)" if tax_slab > 0
                    else "Nil Tax (0% slab)"
                )

                b_item = SchemeComparisonItem(
                    scheme_code=b_code,
                    scheme_name=f"{b_info['name']} FD",
                    category="Commercial Bank FD",
                    institution_or_issuer=b_info["name"],
                    gross_interest_rate=round(gross_rate, 2),
                    post_tax_effective_yield=round(post_tax_yield, 2),
                    estimated_maturity_amount=round(mat, 2),
                    post_tax_maturity_amount=round(post_tax_maturity, 2),
                    total_interest_earned=round(interest, 2),
                    tenure_display=fd_tenure_display,
                    tenure_years=round(fd_years, 2),
                    liquidity_score="High",
                    tax_treatment=tax_treatment_str,
                    badge="High Liquidity FD",
                    cadence="LUMP_SUM",
                    is_cross_cadence=False,
                    highlights=[
                        "Instant 90% overdraft loan facility",
                        "Quarterly compounding interest per RBI norms",
                        "Premature exit allowed with minor penalty"
                    ]
                )
                bank_results.append(b_item)

            if bank_results:
                top_bank = max(bank_results, key=lambda x: x.post_tax_maturity_amount)
                top_bank.badge = "Best for Liquidity"
                eligible_items.extend(bank_results)

        # 1B. Post Office Time Deposit (POTD) - Tenure Parity matching
        if not is_nri and amount >= 1000.0:
            matched_potd_years: Optional[int] = None
            if 0.75 <= fd_years < 1.75:
                matched_potd_years = 1
            elif 1.75 <= fd_years < 2.75:
                matched_potd_years = 2
            elif 2.75 <= fd_years < 4.0:
                matched_potd_years = 3
            elif fd_years >= 4.0:
                matched_potd_years = 5

            if matched_potd_years:
                potd_rate = POTD_RATES.get(matched_potd_years, 7.10)
                potd_years_float = float(matched_potd_years)
                potd_mat = amount * math.pow(1.0 + (potd_rate / 400.0), potd_years_float * 4.0)
                potd_interest = potd_mat - amount

                taxable_interest = max(0.0, potd_interest - (50000.0 if age >= 60 else 0.0))
                tax_payable = taxable_interest * tax_slab
                potd_post_tax_mat = amount + (potd_interest - tax_payable)
                potd_post_tax_yield = round(((potd_interest - tax_payable) / potd_interest) * potd_rate, 2) if potd_interest > 0 else potd_rate

                tax_str = (
                    f"Taxable ({int(tax_slab * 100)}% slab) [Sec 80C]" if matched_potd_years == 5 and tax_slab > 0
                    else f"Taxable ({int(tax_slab * 100)}% slab)" if tax_slab > 0
                    else "Nil Tax (0% slab)"
                )

                eligible_items.append(
                    SchemeComparisonItem(
                        scheme_code="POTD",
                        scheme_name=f"Post Office Time Deposit ({matched_potd_years}Y POTD)",
                        category="Govt Small Savings",
                        institution_or_issuer="Department of Posts",
                        gross_interest_rate=potd_rate,
                        post_tax_effective_yield=potd_post_tax_yield,
                        estimated_maturity_amount=round(potd_mat, 2),
                        post_tax_maturity_amount=round(potd_post_tax_mat, 2),
                        total_interest_earned=round(potd_interest, 2),
                        tenure_display=f"{matched_potd_years} Year{'s' if matched_potd_years > 1 else ''}",
                        tenure_years=potd_years_float,
                        liquidity_score="Medium",
                        tax_treatment=tax_str,
                        badge="Sovereign Term Deposit",
                        cadence="LUMP_SUM",
                        is_cross_cadence=False,
                        highlights=[
                            f"Quarterly compounding at {potd_rate:.2f}% p.a. sovereign rate",
                            "100% Capital protection backed by Government of India",
                            "Eligible for Section 80C deduction" if matched_potd_years == 5 else "Premature exit permitted after 6 months"
                        ]
                    )
                )

        # 1C. 5-Year Statutory Sovereign Schemes (SCSS, POMIS, NSC)
        # Strict Tenure Parity: Only evaluate when user's selected tenure matches the 5-year lock-in (>= 4.5 years)
        is_5_year_matched = (fd_years >= 4.5)

        if not is_nri and is_5_year_matched:
            # SCSS: Age >= 60, ₹1,000 to ₹30,00,000, strictly 5 Years
            if age >= 60 and 1000.0 <= amount <= 3000000.0:
                scss_rate = 8.20
                scss_years = 5.0
                scss_interest = amount * (scss_rate / 100.0) * scss_years
                scss_mat = amount + scss_interest
                taxable_interest = max(0.0, scss_interest - 50000.0)
                tax_payable = taxable_interest * tax_slab
                post_tax_mat = amount + (scss_interest - tax_payable)
                post_tax_yield = round(((scss_interest - tax_payable) / scss_interest) * scss_rate, 2) if scss_interest > 0 else scss_rate

                eligible_items.append(
                    SchemeComparisonItem(
                        scheme_code="SCSS",
                        scheme_name="Senior Citizen Savings Scheme (SCSS)",
                        category="Govt Small Savings",
                        institution_or_issuer="Government of India",
                        gross_interest_rate=scss_rate,
                        post_tax_effective_yield=post_tax_yield,
                        estimated_maturity_amount=round(scss_mat, 2),
                        post_tax_maturity_amount=round(post_tax_mat, 2),
                        total_interest_earned=round(scss_interest, 2),
                        tenure_display="5 Years",
                        tenure_years=scss_years,
                        liquidity_score="Medium",
                        tax_treatment=f"Taxable ({int(tax_slab * 100)}% with 80TTB)" if tax_slab > 0 else "Nil Tax (0% slab)",
                        badge="Highest Senior Return",
                        cadence="LUMP_SUM",
                        is_cross_cadence=False,
                        highlights=[
                            "Market-leading 8.20% sovereign return for seniors",
                            "Regular quarterly interest cashflow payouts",
                            "Eligible for Section 80C initial deposit rebate"
                        ]
                    )
                )

            # POMIS: Age >= 10, ₹1,000 to ₹9L (Single) / ₹15L (Joint), strictly 5 Years
            pomis_cap = 1500000.0 if user_input.account_type == "JOINT" else 900000.0
            if age >= 10 and 1000.0 <= amount <= pomis_cap:
                pomis_rate = 7.40
                pomis_years = 5.0
                pomis_interest = amount * (pomis_rate / 100.0) * pomis_years
                pomis_mat = amount + pomis_interest
                taxable_interest = max(0.0, pomis_interest - (50000.0 if age >= 60 else 0.0))
                tax_payable = taxable_interest * tax_slab
                post_tax_mat = amount + (pomis_interest - tax_payable)
                post_tax_yield = round(((pomis_interest - tax_payable) / pomis_interest) * pomis_rate, 2) if pomis_interest > 0 else pomis_rate

                eligible_items.append(
                    SchemeComparisonItem(
                        scheme_code="POMIS",
                        scheme_name="Post Office Monthly Income Scheme (POMIS)",
                        category="Govt Small Savings",
                        institution_or_issuer="Department of Posts",
                        gross_interest_rate=pomis_rate,
                        post_tax_effective_yield=post_tax_yield,
                        estimated_maturity_amount=round(pomis_mat, 2),
                        post_tax_maturity_amount=round(post_tax_mat, 2),
                        total_interest_earned=round(pomis_interest, 2),
                        tenure_display="5 Years",
                        tenure_years=pomis_years,
                        liquidity_score="Medium",
                        tax_treatment=f"Taxable ({int(tax_slab * 100)}% slab)" if tax_slab > 0 else "Nil Tax (0% slab)",
                        badge="Guaranteed Monthly Income",
                        cadence="LUMP_SUM",
                        is_cross_cadence=False,
                        highlights=[
                            "Predictable monthly interest credit into linked savings account",
                            "Zero credit risk backed by Government of India",
                            "Premature closure permissible after 1 year"
                        ]
                    )
                )

            # NSC: Age >= 10, Min ₹1,000, strictly 5 Years
            if age >= 10 and amount >= 1000.0:
                nsc_rate = 7.70
                nsc_years = 5.0
                nsc_mat = amount * math.pow(1.0 + (nsc_rate / 100.0), nsc_years)
                nsc_interest = nsc_mat - amount
                tax_payable = nsc_interest * tax_slab
                post_tax_mat = amount + (nsc_interest - tax_payable)
                post_tax_yield = round(((nsc_interest - tax_payable) / nsc_interest) * nsc_rate, 2) if nsc_interest > 0 else nsc_rate

                eligible_items.append(
                    SchemeComparisonItem(
                        scheme_code="NSC",
                        scheme_name="National Savings Certificate (NSC)",
                        category="Govt Small Savings",
                        institution_or_issuer="Department of Posts",
                        gross_interest_rate=nsc_rate,
                        post_tax_effective_yield=post_tax_yield,
                        estimated_maturity_amount=round(nsc_mat, 2),
                        post_tax_maturity_amount=round(post_tax_mat, 2),
                        total_interest_earned=round(nsc_interest, 2),
                        tenure_display="5 Years",
                        tenure_years=nsc_years,
                        liquidity_score="Medium",
                        tax_treatment="80C Reinvestment Eligible",
                        badge="Sec 80C Reinvestment",
                        cadence="LUMP_SUM",
                        is_cross_cadence=False,
                        highlights=[
                            "Annual compounding at 7.70% p.a. paid at maturity",
                            "Accrued interest in years 1-4 qualifies for Section 80C deduction",
                            "Acceptable as collateral security for bank loans"
                        ]
                    )
                )

        # Contextual reference benchmark: PPF (Triple tax-free 15-year wealth creator)
        # Provided as an optional benchmark outside the primary ranked pool
        if not is_nri and 500.0 <= min(amount, 150000.0) <= 150000.0:
            ppf_rate = 7.10
            ppf_annual_dep = min(amount, 150000.0)
            ppf_bal = 0.0
            for _ in range(15):
                ppf_bal = (ppf_bal + ppf_annual_dep) * (1.0 + (ppf_rate / 100.0))
            ppf_interest = ppf_bal - (ppf_annual_dep * 15.0)
            cross_cadence_ref = SchemeComparisonItem(
                scheme_code="PPF",
                scheme_name="Public Provident Fund (PPF)",
                category="Govt Small Savings",
                institution_or_issuer="Government of India",
                gross_interest_rate=ppf_rate,
                post_tax_effective_yield=ppf_rate,
                estimated_maturity_amount=round(ppf_bal, 2),
                post_tax_maturity_amount=round(ppf_bal, 2),
                total_interest_earned=round(ppf_interest, 2),
                tenure_display="15 Years",
                tenure_years=15.0,
                liquidity_score="Low",
                tax_treatment="Tax-Free (Sec 10(11) EEE)",
                badge="15Y Reference Benchmark",
                cadence="YEARLY",
                is_cross_cadence=True,
                contextual_tag="Assuming equivalent annual reinvestment over 15 years",
                highlights=[
                    "Long-term benchmark: 15-year statutory lock-in",
                    "100% Tax-Free (EEE Status)",
                    "Assuming equivalent annual deposit"
                ]
            )
        else:
            cross_cadence_ref = None

    # ========================================================================
    # Branch 2: MONTHLY (Recurring Deposit Cadence)
    # Instruments: Bank RDs (SBI, PNB, BOB, HDFC, ICICI) + Post Office RD
    # Excludes: Bank FDs, POTD, SCSS, POMIS, NSC, PPF, SSY
    # ========================================================================
    elif active_cadence == "MONTHLY":
        rd_months = max(6, total_months)
        rd_tenure_display = f"{rd_months // 12} Yrs" if (rd_months % 12 == 0 and rd_months >= 12) else f"{rd_months} Months"

        # 2A. 5 Scheduled Commercial Banks (Recurring Deposits)
        banks = ["SBI", "PNB", "BOB", "HDFC", "ICICI"]
        rd_days = total_days if total_days > 0 else (
            (rd_months // 12) * 365 if rd_months >= 12 and rd_months % 12 == 0 else rd_months * 30
        )
        if rd_months >= 12 and rd_days < (rd_months // 12) * 365:
            rd_days = (rd_months // 12) * 365

        for b_code in banks:
            b_info = BANK_METADATA.get(b_code, {"name": b_code, "type": "Commercial Bank"})
            rates = lookup_bank_rates_all_tiers(b_code, rd_days, age)
            gross_rate = rates["applicable_rate"]

            total_inv, mat, interest = compute_bank_rd(amount, gross_rate, rd_months)

            if resident_status == "NRI_NRE":
                tax_payable = 0.0
                post_tax_yield = gross_rate
            elif resident_status == "NRI_NRO":
                tax_payable = interest * 0.312
                post_tax_yield = round(gross_rate * (1.0 - 0.312), 2)
            else:
                taxable_interest = max(0.0, interest - (50000.0 if age >= 60 else 0.0))
                tax_payable = taxable_interest * tax_slab
                post_tax_yield = round(((interest - tax_payable) / interest) * gross_rate, 2) if interest > 0 else gross_rate

            post_tax_maturity = total_inv + (interest - tax_payable)

            tax_treatment_str = (
                "Nil Tax (NRE Account)" if resident_status == "NRI_NRE"
                else "31.2% TDS (NRO Account)" if resident_status == "NRI_NRO"
                else f"Taxable ({int(tax_slab * 100)}% with 80TTB)" if age >= 60 and tax_slab > 0
                else f"Taxable ({int(tax_slab * 100)}% slab)" if tax_slab > 0
                else "Nil Tax (0% slab)"
            )

            b_item = SchemeComparisonItem(
                scheme_code=f"{b_code}_RD",
                scheme_name=f"{b_info['name']} RD",
                category="Commercial Bank RD",
                institution_or_issuer=b_info["name"],
                gross_interest_rate=round(gross_rate, 2),
                post_tax_effective_yield=round(post_tax_yield, 2),
                estimated_maturity_amount=round(mat, 2),
                post_tax_maturity_amount=round(post_tax_maturity, 2),
                total_interest_earned=round(interest, 2),
                tenure_display=rd_tenure_display,
                tenure_years=round(rd_months / 12.0, 2),
                liquidity_score="High",
                tax_treatment=tax_treatment_str,
                badge="High Liquidity RD",
                cadence="MONTHLY",
                is_cross_cadence=False,
                highlights=[
                    "Quarterly compounding interest per RBI rules",
                    "Up to 90% overdraft loan available against RD balance",
                    "Predictable monthly disciplined savings"
                ]
            )
            eligible_items.append(b_item)

        # 2B. Post Office Recurring Deposit (PO RD)
        # Evaluated as the sovereign recurring deposit benchmark
        if not is_nri and amount >= 100.0:
            po_rate = 6.70
            po_total_inv, po_mat, po_int = compute_bank_rd(amount, po_rate, rd_months)
            taxable_po_int = max(0.0, po_int - (50000.0 if age >= 60 else 0.0))
            po_tax = taxable_po_int * tax_slab
            po_post_tax_mat = po_total_inv + (po_int - po_tax)
            po_post_tax_yield = round(((po_int - po_tax) / po_int) * po_rate, 2) if po_int > 0 else po_rate

            eligible_items.append(
                SchemeComparisonItem(
                    scheme_code="POST_OFFICE_RD",
                    scheme_name="Post Office Recurring Deposit (PO RD)",
                    category="Govt Small Savings",
                    institution_or_issuer="Department of Posts",
                    gross_interest_rate=po_rate,
                    post_tax_effective_yield=po_post_tax_yield,
                    estimated_maturity_amount=round(po_mat, 2),
                    post_tax_maturity_amount=round(po_post_tax_mat, 2),
                    total_interest_earned=round(po_int, 2),
                    tenure_display=rd_tenure_display,
                    tenure_years=round(rd_months / 12.0, 2),
                    liquidity_score="Medium",
                    tax_treatment=f"Taxable ({int(tax_slab * 100)}% with 80TTB)" if age >= 60 and tax_slab > 0 else (f"Taxable ({int(tax_slab * 100)}% slab)" if tax_slab > 0 else "Nil Tax (0% slab)"),
                    badge="Sovereign Monthly RD",
                    cadence="MONTHLY",
                    is_cross_cadence=False,
                    highlights=[
                        "100% Sovereign backing by Government of India (DoP)",
                        "Quarterly compounding at 6.70% p.a.",
                        "Partial withdrawal permitted after 3 years"
                    ]
                )
            )

    # ========================================================================
    # Branch 3: YEARLY (Annual Contribution Cadence)
    # Instruments: Public Provident Fund (PPF) + Sukanya Samriddhi Yojana (SSY)
    # Excludes: All Bank FDs, POTD, SCSS, POMIS, NSC, Bank RDs, and PO RD
    # ========================================================================
    elif active_cadence == "YEARLY":
        if not is_nri:
            # 3A. Public Provident Fund (PPF)
            if 500.0 <= amount <= 150000.0:
                ppf_rate = 7.10
                ppf_years = 15.0
                ppf_tot_prin = amount * 15.0
                ppf_bal = 0.0
                for _ in range(15):
                    ppf_bal = (ppf_bal + amount) * (1.0 + (ppf_rate / 100.0))
                ppf_interest = ppf_bal - ppf_tot_prin

                eligible_items.append(
                    SchemeComparisonItem(
                        scheme_code="PPF",
                        scheme_name="Public Provident Fund (PPF)",
                        category="Govt Small Savings",
                        institution_or_issuer="Government of India",
                        gross_interest_rate=ppf_rate,
                        post_tax_effective_yield=ppf_rate,  # EEE tax-exempt
                        estimated_maturity_amount=round(ppf_bal, 2),
                        post_tax_maturity_amount=round(ppf_bal, 2),
                        total_interest_earned=round(ppf_interest, 2),
                        tenure_display="15 Years",
                        tenure_years=ppf_years,
                        liquidity_score="Low",
                        tax_treatment="Tax-Free (Sec 10(11) EEE)",
                        badge="Best Tax-Free Yield",
                        cadence="YEARLY",
                        is_cross_cadence=False,
                        highlights=[
                            "100% Tax-Free (EEE status across deposit, interest & maturity)",
                            "Sovereign guarantee by Central Government",
                            "Loan facility available from 3rd to 6th year"
                        ]
                    )
                )

            # 3B. Sukanya Samriddhi Yojana (SSY)
            if gender == "FEMALE" and age <= 10 and 250.0 <= amount <= 150000.0:
                ssy_rate = 8.20
                ssy_years = 21.0
                ssy_tot_prin = amount * 15.0
                ssy_bal = 0.0
                for _ in range(15):
                    ssy_bal = (ssy_bal + amount) * (1.0 + (ssy_rate / 100.0))
                for _ in range(6):
                    ssy_bal = ssy_bal * (1.0 + (ssy_rate / 100.0))
                ssy_interest = ssy_bal - ssy_tot_prin

                eligible_items.append(
                    SchemeComparisonItem(
                        scheme_code="SSY",
                        scheme_name="Sukanya Samriddhi Yojana (SSY)",
                        category="Govt Small Savings",
                        institution_or_issuer="Government of India",
                        gross_interest_rate=ssy_rate,
                        post_tax_effective_yield=ssy_rate,  # EEE tax-exempt
                        estimated_maturity_amount=round(ssy_bal, 2),
                        post_tax_maturity_amount=round(ssy_bal, 2),
                        total_interest_earned=round(ssy_interest, 2),
                        tenure_display="21 Years",
                        tenure_years=ssy_years,
                        liquidity_score="Low",
                        tax_treatment="Tax-Free (Sec 10(11A) EEE)",
                        badge="Highest Sovereign Return",
                        cadence="YEARLY",
                        is_cross_cadence=False,
                        highlights=[
                            "Highest statutory rate among small savings schemes (8.20%)",
                            "Triple tax-exempt (EEE status)",
                            "Dedicated wealth creation for girl child up to 10 yrs"
                        ]
                    )
                )

    # ========================================================================
    # Ranking & Top Pick Selection
    # ========================================================================
    if not eligible_items:
        rates = lookup_bank_rates_all_tiers("SBI", 365, age)
        gross_rate = rates["applicable_rate"]
        mat = amount * (1.0 + (gross_rate / 100.0))
        fallback_item = SchemeComparisonItem(
            scheme_code="SBI",
            scheme_name="State Bank of India FD",
            category="Commercial Bank FD",
            institution_or_issuer="State Bank of India",
            gross_interest_rate=gross_rate,
            post_tax_effective_yield=round(gross_rate * (1.0 - tax_slab), 2),
            estimated_maturity_amount=round(mat, 2),
            post_tax_maturity_amount=round(mat, 2),
            total_interest_earned=round(mat - amount, 2),
            tenure_display="1 Year",
            tenure_years=1.0,
            liquidity_score="High",
            tax_treatment="Taxable as per slab",
            badge="🏆 Best Overall Pick",
            rank=1,
            is_best_pick=True,
            cadence=active_cadence,
            is_cross_cadence=False,
            highlights=["Standard fallback bank deposit"]
        )
        return SmartComparisonResponse(
            best_pick=fallback_item,
            ranked_schemes=[fallback_item],
            recommendation_headline="State Bank of India is your Available Option",
            recommendation_rationale="Matched to your selected frequency and criteria.",
            total_eligible_schemes=1,
            user_tax_slab_percent=round(tax_slab * 100.0, 1),
            active_cadence=active_cadence,
            cross_cadence_reference=cross_cadence_ref
        )

    # Sort descending by post-tax effective yield, then post-tax maturity amount
    eligible_items.sort(
        key=lambda x: (x.post_tax_effective_yield, x.post_tax_maturity_amount),
        reverse=True
    )

    # Assign ranks and crown #1 winner strictly from the isolated, tenure-matched pool
    for i, item in enumerate(eligible_items, start=1):
        item.rank = i
        if i == 1:
            item.is_best_pick = True
            item.badge = "🏆 Best Overall Pick"
        else:
            item.is_best_pick = False

    best = eligible_items[0]

    # ========================================================================
    # Tailored Decision Rationale Generation
    # ========================================================================
    tax_bracket_str = f"{int(tax_slab * 100)}%" if tax_slab > 0 else "0%"

    if active_cadence == "YEARLY":
        if best.scheme_code == "SSY":
            headline = "Sukanya Samriddhi Yojana (SSY) is your Top Sovereign Annual Wealth Creator"
            rationale = (
                f"SSY delivers an unmatched post-tax maturity of ₹{best.post_tax_maturity_amount:,.2f} "
                f"at an 8.20% tax-free yield under Section 10(11A) EEE status. "
                f"While liquidity is Low due to its 21-year statutory lock-in, it completely eliminates "
                f"tax drag for your {tax_bracket_str} tax bracket to maximize long-term wealth."
            )
        else:
            headline = "Public Provident Fund (PPF) is your Best Sovereign Annual Wealth Builder"
            rationale = (
                f"PPF generates ₹{best.post_tax_maturity_amount:,.2f} with full EEE triple tax exemption at 7.10% p.a., "
                f"beating taxable deposits under your {tax_bracket_str} tax bracket. Over its 15-year statutory lock-in, "
                f"it guarantees 100% sovereign capital protection with zero tax deductions."
            )
    elif active_cadence == "MONTHLY":
        headline = f"{best.scheme_name} is your Top Monthly Savings Pick"
        rationale = (
            f"{best.institution_or_issuer} ranks #1 delivering ₹{best.post_tax_maturity_amount:,.2f} "
            f"post-tax maturity at {best.gross_interest_rate:.2f}% p.a. from disciplined monthly contributions "
            f"of ₹{amount:,.2f} over {best.tenure_display}. Quarterly compounding optimizes your recurring accumulation."
        )
    else:
        # LUMP_SUM
        if best.scheme_code == "SCSS":
            headline = "Senior Citizen Savings Scheme (SCSS) is your #1 Retirement Growth Instrument"
            rationale = (
                f"SCSS delivers India's highest senior citizen return at 8.20% p.a. backed by the Government of India, "
                f"yielding ₹{best.post_tax_maturity_amount:,.2f} post-tax over 5 years with Section 80TTB tax shelter. "
                f"It offers an optimal balance between top-tier yield and medium liquidity via quarterly cashflow payouts."
            )
        elif best.scheme_code == "NSC":
            headline = "National Savings Certificate (NSC) is your Top 5-Year Sovereign Growth Pick"
            rationale = (
                f"NSC produces ₹{best.post_tax_maturity_amount:,.2f} post-tax maturity at a compounded "
                f"7.70% p.a. with Section 80C reinvestment benefits, outperforming conventional bank deposits over 5 years."
            )
        elif best.scheme_code == "POTD":
            headline = f"{best.scheme_name} is your Top Sovereign Term Deposit Pick"
            rationale = (
                f"Post Office Time Deposit yields {best.gross_interest_rate:.2f}% p.a. with quarterly compounding, "
                f"delivering ₹{best.post_tax_maturity_amount:,.2f} post-tax maturity backed 100% by the Department of Posts."
            )
        else:
            headline = f"{best.scheme_name} is your Best Overall Lump Sum Pick"
            rationale = (
                f"{best.institution_or_issuer} ranks #1 for your {best.tenure_display} horizon, delivering "
                f"₹{best.post_tax_maturity_amount:,.2f} post-tax maturity at {best.gross_interest_rate:.2f}% p.a. with High Liquidity. "
                f"It offers instant 90% overdraft loan facility and flexible liquidity, outperforming other tenure-matched options."
            )

    return SmartComparisonResponse(
        best_pick=best,
        ranked_schemes=eligible_items,
        recommendation_headline=headline,
        recommendation_rationale=rationale,
        total_eligible_schemes=len(eligible_items),
        user_tax_slab_percent=round(tax_slab * 100.0, 1),
        active_cadence=active_cadence,
        cross_cadence_reference=cross_cadence_ref
    )


# ============================================================================
# 10. Master Calculation Engine Coordinator
# ============================================================================

def execute_investment_calculation(request: InvestmentRequest) -> CalculationResponse:
    """
    Coordinates standardized tenure, dynamic rate lookup, product compounding,
    strategies (Ladder, DICGC Split, Break vs Loan), tax/TDS, smart multi-scheme comparison,
    and 5-bank benchmarks.
    """
    # 1. Standardize Tenure
    total_days, fractional_years, total_months = standardize_tenure(
        request.tenure_years,
        request.tenure_months,
        request.tenure_days
    )

    # 1b. Smart Scheme Comparison & Recommendation Engine
    smart_comparison = compare_all_eligible_schemes(request)

    # 2. Ladder Strategy Mode
    if request.calculation_mode == "LADDER":
        bank = request.selected_bank or "SBI"
        ladder_tranches, total_maturity, total_interest, blended_rate = compute_fd_ladder_strategy(
            bank,
            request.amount,
            request.age
        )
        dicgc_info = compute_dicgc_analysis_and_split(request.amount, total_maturity, 1826, request.age, is_bank=True)
        tds_info = compute_tax_and_tds(total_interest, 3.0, request, is_eee=False)
        real_purchasing_power = total_maturity / math.pow(1.0 + request.inflation_rate, 3.0)
        real_rate = (((1.0 + (blended_rate / 100.0)) / (1.0 + request.inflation_rate)) - 1.0) * 100.0

        rates_now = lookup_bank_rates_all_tiers(bank, 365, request.age)
        amortization_schedule = generate_amortization_schedule(
            request=request,
            rate=blended_rate,
            total_days=1826,
            fractional_years=5.0,
            total_months=60,
            principal=request.amount,
            maturity_amount=total_maturity,
            ladder_tranches=ladder_tranches
        )

        return CalculationResponse(
            principal=round(request.amount, 2),
            applicable_interest_rate=round(blended_rate, 2),
            regular_rate=round(rates_now["regular_rate"], 2),
            senior_rate=round(rates_now["senior_rate"], 2),
            super_senior_rate=round(rates_now["super_senior_rate"], 2),
            apy=round(compute_apy(blended_rate), 2),
            effective_annual_yield=round(blended_rate, 2),
            tenure_display="5-Year Staggered Ladder (1y, 2y, 3y, 4y, 5y)",
            total_tenure_days=1826,
            fractional_years=5.0,
            total_tenure_months=60,
            maturity_amount=round(total_maturity, 2),
            total_interest_earned=round(total_interest, 2),
            tax_status="TAXABLE_AS_PER_SLAB",
            is_tds_applicable=tds_info["is_tds_applicable"],
            estimated_tds_amount=round(tds_info["estimated_tds"], 2),
            estimated_tax_payable=round(tds_info["estimated_tax"], 2),
            net_post_tax_maturity=round(request.amount + tds_info["net_interest"], 2),
            post_tax_annualized_yield=round(tds_info["post_tax_yield"], 2),
            form_15g_15h_advisory=tds_info.get("form_15g_15h_advisory"),
            inflation_rate=request.inflation_rate,
            inflation_adjusted_maturity=round(real_purchasing_power, 2),
            real_rate_of_return=round(real_rate, 2),
            loan_against_fd_eligible=True,
            max_loan_amount=round(request.amount * 0.90, 2),
            loan_interest_rate=round(blended_rate + FD_LOAN_INTEREST_MARGIN, 2),
            premature_penalty_rate=PREMATURE_PENALTY,
            dicgc_analysis=dicgc_info,
            calculation_mode="LADDER",
            ladder_schedule=ladder_tranches,
            comparison=smart_comparison,
            schedule=amortization_schedule,
            institution_or_scheme_name=f"{BANK_METADATA.get(bank, {}).get('name', bank)} 5-Year FD Ladder Strategy",
            regulatory_notes=[
                f"Capital of ₹{request.amount:,.2f} partitioned into 5 equal tranches of ₹{(request.amount/5.0):,.2f}.",
                "Guarantees liquidity event every 12 months with minimal reinvestment rate friction.",
                "DICGC insurance applies per bank across all tranches."
            ] + ([tds_info["form_15g_15h_advisory"]] if tds_info.get("form_15g_15h_advisory") else [])
        )

    # 3. Government Small Savings Schemes
    if request.category == "GOVT_SCHEME":
        scheme_code = request.selected_scheme or "PPF"
        (
            principal,
            maturity_amount,
            interest_earned,
            periodic_payout,
            periodic_frequency,
            cashflow_schedule,
            total_days,
            fractional_years,
            reg_notes
        ) = compute_govt_scheme(scheme_code, request.amount)

        cfg = GOVT_SCHEMES_CONFIG[scheme_code]
        rate = cfg["interest_rate"]
        is_eee = (cfg["tax_status"] == "EEE")

        tds_info = compute_tax_and_tds(interest_earned, fractional_years, request, is_eee=is_eee)
        dicgc_info = compute_dicgc_analysis_and_split(principal, maturity_amount, total_days, request.age, is_bank=False)

        real_purchasing_power = maturity_amount / math.pow(1.0 + request.inflation_rate, max(fractional_years, 0.1))
        real_rate = (((1.0 + (rate / 100.0)) / (1.0 + request.inflation_rate)) - 1.0) * 100.0

        loan_eligible = cfg.get("loan_facility_available", False)
        amortization_schedule = generate_amortization_schedule(
            request=request,
            rate=rate,
            total_days=total_days,
            fractional_years=fractional_years,
            total_months=int(fractional_years * 12),
            principal=principal,
            maturity_amount=maturity_amount
        )

        return CalculationResponse(
            principal=round(principal, 2),
            applicable_interest_rate=round(rate, 2),
            regular_rate=round(rate, 2),
            senior_rate=round(rate, 2),
            super_senior_rate=round(rate, 2),
            apy=round(rate, 2),
            effective_annual_yield=round(rate, 2),
            tenure_display=f"{int(fractional_years)} Years Statutory Lock-in",
            total_tenure_days=total_days,
            fractional_years=fractional_years,
            total_tenure_months=int(fractional_years * 12),
            maturity_amount=round(maturity_amount, 2),
            total_interest_earned=round(interest_earned, 2),
            tax_status=cfg["tax_status"],
            is_tds_applicable=tds_info["is_tds_applicable"],
            estimated_tds_amount=round(tds_info["estimated_tds"], 2),
            estimated_tax_payable=round(tds_info["estimated_tax"], 2),
            net_post_tax_maturity=round(principal + tds_info["net_interest"], 2),
            post_tax_annualized_yield=round(tds_info["post_tax_yield"], 2),
            form_15g_15h_advisory=tds_info.get("form_15g_15h_advisory"),
            inflation_rate=request.inflation_rate,
            inflation_adjusted_maturity=round(real_purchasing_power, 2),
            real_rate_of_return=round(real_rate, 2),
            loan_against_fd_eligible=loan_eligible,
            max_loan_amount=round(principal * 0.85, 2) if loan_eligible else 0.0,
            loan_interest_rate=round(rate + 1.0, 2) if loan_eligible else 0.0,
            premature_penalty_rate=0.0,
            dicgc_analysis=dicgc_info,
            calculation_mode="STANDARD",
            periodic_payout=periodic_payout,
            periodic_payout_frequency=periodic_frequency,
            cashflow_schedule=cashflow_schedule if cashflow_schedule else None,
            comparison=smart_comparison,
            schedule=amortization_schedule,
            institution_or_scheme_name=f"Govt Scheme: {cfg['name']} ({scheme_code})",
            regulatory_notes=reg_notes + ([tds_info["form_15g_15h_advisory"]] if tds_info.get("form_15g_15h_advisory") else [])
        )

    # 4. Bank Recurring Deposit (RD)
    if request.category == "BANK_RD":
        bank = request.selected_bank or "SBI"
        rates = lookup_bank_rates_all_tiers(bank, total_days, request.age)
        app_rate = rates["applicable_rate"]
        apy = compute_apy(app_rate)

        total_invested, maturity_amount, interest_earned = compute_bank_rd(
            request.amount,
            app_rate,
            max(6, total_months)
        )

        tds_info = compute_tax_and_tds(interest_earned, fractional_years, request, is_eee=False)
        dicgc_info = compute_dicgc_analysis_and_split(total_invested, maturity_amount, total_days, request.age, is_bank=True)

        real_purchasing_power = maturity_amount / math.pow(1.0 + request.inflation_rate, max(fractional_years, 0.1))
        real_rate = (((1.0 + (app_rate / 100.0)) / (1.0 + request.inflation_rate)) - 1.0) * 100.0

        bank_comparisons = compute_5_bank_benchmarks(
            request.amount, total_days, fractional_years, total_months, request.age, "BANK_RD", "CUMULATIVE"
        )
        amortization_schedule = generate_amortization_schedule(
            request=request,
            rate=app_rate,
            total_days=total_days,
            fractional_years=fractional_years,
            total_months=total_months,
            principal=total_invested,
            maturity_amount=maturity_amount
        )

        return CalculationResponse(
            principal=round(total_invested, 2),
            applicable_interest_rate=round(app_rate, 2),
            regular_rate=round(rates["regular_rate"], 2),
            senior_rate=round(rates["senior_rate"], 2),
            super_senior_rate=round(rates["super_senior_rate"], 2),
            apy=round(apy, 2),
            effective_annual_yield=round(((maturity_amount / total_invested) ** (1.0 / max(fractional_years, 0.5)) - 1.0) * 100.0, 2),
            tenure_display=f"{request.tenure_years}y {request.tenure_months}m",
            total_tenure_days=total_days,
            fractional_years=fractional_years,
            total_tenure_months=total_months,
            maturity_amount=round(maturity_amount, 2),
            total_interest_earned=round(interest_earned, 2),
            tax_status="TAXABLE_AS_PER_SLAB",
            is_tds_applicable=tds_info["is_tds_applicable"],
            estimated_tds_amount=round(tds_info["estimated_tds"], 2),
            estimated_tax_payable=round(tds_info["estimated_tax"], 2),
            net_post_tax_maturity=round(total_invested + tds_info["net_interest"], 2),
            post_tax_annualized_yield=round(tds_info["post_tax_yield"], 2),
            form_15g_15h_advisory=tds_info.get("form_15g_15h_advisory"),
            inflation_rate=request.inflation_rate,
            inflation_adjusted_maturity=round(real_purchasing_power, 2),
            real_rate_of_return=round(real_rate, 2),
            loan_against_fd_eligible=True,
            max_loan_amount=round(total_invested * 0.90, 2),
            loan_interest_rate=round(app_rate + FD_LOAN_INTEREST_MARGIN, 2),
            premature_penalty_rate=PREMATURE_PENALTY,
            dicgc_analysis=dicgc_info,
            calculation_mode="STANDARD",
            bank_comparisons=bank_comparisons,
            comparison=smart_comparison,
            schedule=amortization_schedule,
            institution_or_scheme_name=f"{BANK_METADATA.get(bank, {}).get('name', bank)} Recurring Deposit (RD)",
            regulatory_notes=[
                f"Monthly installment: ₹{request.amount:,.2f} for {total_months} months.",
                "Compounded quarterly under RBI term deposit regulations.",
                "Section 194A TDS applies on RD interest when annual threshold is breached."
            ] + ([tds_info["form_15g_15h_advisory"]] if tds_info.get("form_15g_15h_advisory") else [])
        )

    # 5. Bank Fixed Deposit (FD) - Standard
    bank = request.selected_bank or "SBI"
    rates = lookup_bank_rates_all_tiers(bank, total_days, request.age)
    app_rate = rates["applicable_rate"]
    apy = compute_apy(app_rate)

    (
        maturity_amount,
        interest_earned,
        periodic_payout,
        periodic_frequency,
        cashflow_schedule
    ) = compute_bank_fd(
        request.amount,
        app_rate,
        total_days,
        fractional_years,
        request.payout_type
    )

    tds_info = compute_tax_and_tds(interest_earned, fractional_years, request, is_eee=False)
    dicgc_info = compute_dicgc_analysis_and_split(request.amount, maturity_amount, total_days, request.age, is_bank=True)

    nominal_mat = maturity_amount if request.payout_type == "CUMULATIVE" else (request.amount + interest_earned)
    real_purchasing_power = nominal_mat / math.pow(1.0 + request.inflation_rate, max(fractional_years, 0.1))
    real_rate = (((1.0 + (app_rate / 100.0)) / (1.0 + request.inflation_rate)) - 1.0) * 100.0

    # 5-Bank Simultaneous Comparator
    bank_comparisons = compute_5_bank_benchmarks(
        request.amount, total_days, fractional_years, total_months, request.age, "BANK_FD", request.payout_type
    )

    # Quick Break vs Loan Preview (Assume emergency cash = 50% principal, 6 months elapsed)
    break_vs_loan_preview = None
    if total_months >= 6 and request.amount >= 50000:
        elapsed_m = max(1, min(6, total_months - 1))
        break_vs_loan_preview = analyze_break_vs_loan(
            BreakVsLoanRequest(
                principal=request.amount,
                contracted_rate=app_rate,
                total_tenure_months=max(6, total_months),
                elapsed_months=elapsed_m,
                emergency_cash_needed=round(request.amount * 0.50, 2),
                loan_duration_months=6,
                age=request.age,
                selected_bank=bank
            )
        )

    tenure_str_parts = []
    if request.tenure_years > 0:
        tenure_str_parts.append(f"{request.tenure_years}y")
    if request.tenure_months > 0:
        tenure_str_parts.append(f"{request.tenure_months}m")
    if request.tenure_days > 0:
        tenure_str_parts.append(f"{request.tenure_days}d")
    tenure_display = " ".join(tenure_str_parts) if tenure_str_parts else f"{total_days} Days"

    effective_yield = ((nominal_mat / request.amount) ** (1.0 / max(fractional_years, 0.08)) - 1.0) * 100.0 if request.payout_type == "CUMULATIVE" else app_rate

    amortization_schedule = generate_amortization_schedule(
        request=request,
        rate=app_rate,
        total_days=total_days,
        fractional_years=fractional_years,
        total_months=total_months,
        principal=request.amount,
        maturity_amount=maturity_amount
    )

    return CalculationResponse(
        principal=round(request.amount, 2),
        applicable_interest_rate=round(app_rate, 2),
        regular_rate=round(rates["regular_rate"], 2),
        senior_rate=round(rates["senior_rate"], 2),
        super_senior_rate=round(rates["super_senior_rate"], 2),
        apy=round(apy, 2),
        effective_annual_yield=round(effective_yield, 2),
        tenure_display=tenure_display,
        total_tenure_days=total_days,
        fractional_years=round(fractional_years, 4),
        total_tenure_months=total_months,
        maturity_amount=round(maturity_amount, 2),
        total_interest_earned=round(interest_earned, 2),
        tax_status="TAXABLE_AS_PER_SLAB",
        is_tds_applicable=tds_info["is_tds_applicable"],
        estimated_tds_amount=round(tds_info["estimated_tds"], 2),
        estimated_tax_payable=round(tds_info["estimated_tax"], 2),
        net_post_tax_maturity=round(request.amount + tds_info["net_interest"], 2),
        post_tax_annualized_yield=round(tds_info["post_tax_yield"], 2),
        form_15g_15h_advisory=tds_info.get("form_15g_15h_advisory"),
        inflation_rate=request.inflation_rate,
        inflation_adjusted_maturity=round(real_purchasing_power, 2),
        real_rate_of_return=round(real_rate, 2),
        loan_against_fd_eligible=True,
        max_loan_amount=round(request.amount * 0.90, 2),
        loan_interest_rate=round(app_rate + FD_LOAN_INTEREST_MARGIN, 2),
        premature_penalty_rate=PREMATURE_PENALTY,
        dicgc_analysis=dicgc_info,
        calculation_mode="STANDARD",
        periodic_payout=periodic_payout,
        periodic_payout_frequency=periodic_frequency,
        cashflow_schedule=cashflow_schedule if cashflow_schedule else None,
        bank_comparisons=bank_comparisons,
        comparison=smart_comparison,
        break_vs_loan_preview=break_vs_loan_preview,
        schedule=amortization_schedule,
        institution_or_scheme_name=f"{BANK_METADATA.get(bank, {}).get('name', bank)} Fixed Deposit",
        regulatory_notes=[
            f"Applicable rate {app_rate:.2f}% p.a. extracted from {bank} slab matrix for {total_days} days.",
            f"Senior privilege (+0.50%) or Super Senior privilege (+0.80%) applied if eligible." if request.age >= 60 else "Standard public rate applied.",
            "Quarterly compounding applied as per RBI term deposit conventions." if total_days >= 180 else "Simple interest applied for tenures under 180 days."
        ] + ([tds_info["form_15g_15h_advisory"]] if tds_info.get("form_15g_15h_advisory") else [])
    )


# ============================================================================
# 11. Target Goal Planner (Reverse Engineering) Engine
# ============================================================================

def compute_goal_planner(request: GoalPlannerRequest) -> GoalPlannerResponse:
    """
    Reverse Wealth Engineering Engine:
    Computes required one-time lump-sum deposit today and required monthly RD installment
    to achieve the investor's target corpus (A) over specified tenure (t).

    Mathematical Foundation:
    1. Lump Sum (RBI Quarterly Compounding):
       A = P * (1 + r/400)**(4 * T)  =>  P = A / (1 + r/400)**(4 * T)
       (If tenure < 180 days: simple interest P = A / (1 + (r * D) / 36500))
    2. Monthly Recurring Deposit (RBI Installment Compounding Series):
       A = sum_{k=1}^M [ PMT * (1 + r/400)**(k / 3.0) ]
       => PMT = A / ( sum_{k=1}^M (1 + r/400)**(k / 3.0) )
    """
    target = float(request.target_amount)
    total_days, fractional_years, total_months = standardize_tenure(
        request.tenure_years,
        request.tenure_months,
        request.tenure_days
    )
    if total_days < 7:
        total_days = 365
        fractional_years = 1.0
        total_months = 12

    tenure_display = f"{request.tenure_years}y {request.tenure_months}m" if request.tenure_years > 0 or request.tenure_months > 0 else f"{total_days} Days"
    total_m = max(6, total_months)

    options: List[GoalOptionItem] = []

    # 1. 5 Commercial Banks (SBI, PNB, BOB, HDFC, ICICI)
    banks = ["SBI", "PNB", "BOB", "HDFC", "ICICI"]
    for b_code in banks:
        b_info = BANK_METADATA.get(b_code, {"name": b_code, "type": "Commercial Bank"})
        rates = lookup_bank_rates_all_tiers(b_code, total_days, request.age)
        rate = rates["applicable_rate"]

        # Lump sum required
        if total_days < 180:
            req_lump = target / (1.0 + (rate / 100.0) * fractional_years)
        else:
            req_lump = target / math.pow(1.0 + (rate / 400.0), fractional_years * 4.0)

        lump_interest = target - req_lump

        # Monthly RD installment required
        denom_sum = sum(math.pow(1.0 + (rate / 400.0), k / 3.0) for k in range(1, total_m + 1))
        req_monthly = target / denom_sum if denom_sum > 0 else (target / total_m)
        rd_tot_inv = req_monthly * total_m
        rd_interest = target - rd_tot_inv

        options.append(GoalOptionItem(
            institution_or_scheme=f"{b_info['name']} Deposit",
            scheme_code=b_code,
            category="Commercial Bank",
            applicable_rate=round(rate, 2),
            tenure_display=tenure_display,
            required_lump_sum=round(req_lump, 2),
            lump_sum_interest_earned=round(lump_interest, 2),
            required_monthly_rd=round(req_monthly, 2),
            monthly_rd_total_invested=round(rd_tot_inv, 2),
            monthly_rd_interest_earned=round(rd_interest, 2)
        ))

    # 2. Post Office Time Deposit (POTD) & Post Office RD
    matched_potd_years = 1 if fractional_years < 1.75 else 2 if fractional_years < 2.75 else 3 if fractional_years < 4.5 else 5
    potd_rate = POTD_RATES.get(matched_potd_years, 7.10)
    potd_lump = target / math.pow(1.0 + (potd_rate / 400.0), fractional_years * 4.0)
    potd_interest = target - potd_lump

    # Post Office RD (6.70% p.a.)
    po_rd_rate = 6.70
    po_denom = sum(math.pow(1.0 + (po_rd_rate / 400.0), k / 3.0) for k in range(1, total_m + 1))
    po_monthly = target / po_denom if po_denom > 0 else (target / total_m)
    po_tot_inv = po_monthly * total_m

    options.append(GoalOptionItem(
        institution_or_scheme=f"Post Office Deposit ({matched_potd_years}Y POTD / RD)",
        scheme_code="POST_OFFICE",
        category="Post Office",
        applicable_rate=round(potd_rate, 2),
        tenure_display=tenure_display,
        required_lump_sum=round(potd_lump, 2),
        lump_sum_interest_earned=round(potd_interest, 2),
        required_monthly_rd=round(po_monthly, 2),
        monthly_rd_total_invested=round(po_tot_inv, 2),
        monthly_rd_interest_earned=round(target - po_tot_inv, 2)
    ))

    # Identify best lump sum pick (lowest required lump sum today)
    best_lump = min(options, key=lambda x: x.required_lump_sum)
    best_lump.is_best_lump_sum = True

    # Identify best monthly pick (lowest required monthly installment)
    best_monthly = min(options, key=lambda x: x.required_monthly_rd if x.required_monthly_rd else float("inf"))
    best_monthly.is_best_monthly = True

    return GoalPlannerResponse(
        target_amount=round(target, 2),
        tenure_display=tenure_display,
        total_months=total_m,
        total_days=total_days,
        fractional_years=round(fractional_years, 2),
        best_lump_sum_option=best_lump,
        best_monthly_option=best_monthly,
        options=options
    )


