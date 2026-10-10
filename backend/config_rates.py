"""
Indian Bank Deposit & Government Small Savings Scheme Data Configuration
Phase 1: Multi-tier rate matrices, statutory constraints, and financial parameters.
"""

from typing import Dict, List, Tuple, Any, Optional

# ============================================================================
# 1. Feature Constants & Statutory Regulatory Parameters
# ============================================================================
# Deposit Insurance and Credit Guarantee Corporation (DICGC) cover limit per depositor per bank
DICGC_LIMIT: float = 500_000.0

# Recommended safe principal limit to keep Principal + Accrued Interest below ₹5,00,000
SAFE_PRINCIPAL_PER_BANK: float = 425_000.0

# Standard loan against FD margin (typically loan interest rate is Base FD rate + 1.00%)
FD_LOAN_INTEREST_MARGIN: float = 1.00

# Regulatory penalty on premature withdrawal (reduces contracted rate by 1.00% or applicable slab)
PREMATURE_PENALTY: float = 1.00

# TDS Thresholds under Section 194A of Income Tax Act
TDS_THRESHOLD_REGULAR: float = 40_000.0       # For individuals < 60 years
TDS_THRESHOLD_SENIOR: float = 50_000.0        # Section 80TTB for seniors >= 60 years
TDS_RATE_WITH_PAN: float = 0.10              # 10% TDS with PAN
TDS_RATE_WITHOUT_PAN: float = 0.20           # 20% TDS without PAN


# ============================================================================
# 2. Commercial Bank Fixed Deposit Slabs (7 days to 10 years / 3653 days)
# Format: [min_days, max_days, regular_rate, senior_rate (60-79), super_senior_rate (80+)]
#
# Incorporating:
# - Standard Senior Citizen spread (+0.50%)
# - Super Senior Citizen spread (+0.80% or specialized bank slabs)
# - Special tenures (e.g. 400d/444d high-yield buckets, SBI WeCare >5 yrs)
# ============================================================================

BANK_FD_SLABS: Dict[str, List[List[float]]] = {
    # ------------------------------------------------------------------------
    # State Bank of India (SBI)
    # Includes special 444-day Amrit Vrishti (7.25%) and SBI WeCare (5-10 yrs)
    # ------------------------------------------------------------------------
    "SBI": [
        # [min_days, max_days, regular_rate, senior_rate, super_senior_rate]
        [7, 45, 3.50, 4.00, 4.30],
        [46, 179, 5.50, 6.00, 6.30],
        [180, 210, 6.25, 6.75, 7.05],
        [211, 364, 6.50, 7.00, 7.30],
        [365, 443, 6.80, 7.30, 7.60],
        [444, 444, 7.25, 7.75, 8.05],        # Special 444-Day Amrit Vrishti Slab
        [445, 729, 6.80, 7.30, 7.60],        # 1 Year to < 2 Years
        [730, 1094, 7.00, 7.50, 7.80],       # 2 Years to < 3 Years
        [1095, 1825, 6.75, 7.25, 7.55],      # 3 Years to < 5 Years
        [1826, 3653, 6.50, 7.50, 7.80],      # 5 to 10 Years (SBI WeCare: +100 bps for seniors)
    ],

    # ------------------------------------------------------------------------
    # Punjab National Bank (PNB)
    # PNB offers dedicated +0.80% rate differential to super senior citizens (80+)
    # Includes 400-day high yield slab (7.25%)
    # ------------------------------------------------------------------------
    "PNB": [
        [7, 14, 3.50, 4.00, 4.30],
        [15, 45, 3.50, 4.00, 4.30],
        [46, 90, 4.50, 5.00, 5.30],
        [91, 179, 5.50, 6.00, 6.30],
        [180, 270, 6.00, 6.50, 6.80],
        [271, 299, 6.25, 6.75, 7.05],
        [300, 300, 7.05, 7.55, 7.85],        # Special 300-day slab
        [301, 364, 6.25, 6.75, 7.05],
        [365, 399, 6.80, 7.30, 7.60],
        [400, 400, 7.25, 7.75, 8.05],        # Special 400-day slab
        [401, 729, 6.80, 7.30, 7.60],
        [730, 1095, 7.00, 7.50, 7.80],       # 2 to 3 Years
        [1096, 1825, 6.50, 7.00, 7.30],      # 3 to 5 Years
        [1826, 3653, 6.50, 7.30, 7.60],      # 5 to 10 Years (PNB Uttam / Senior booster)
    ],

    # ------------------------------------------------------------------------
    # Bank of Baroda (BOB)
    # Includes BOB 399-Day & 444-Day high yield bucket
    # ------------------------------------------------------------------------
    "BOB": [
        [7, 14, 4.25, 4.75, 5.05],
        [15, 45, 4.50, 5.00, 5.30],
        [46, 90, 5.50, 6.00, 6.30],
        [91, 180, 5.60, 6.10, 6.40],
        [181, 270, 5.75, 6.25, 6.55],
        [271, 364, 6.15, 6.65, 6.95],
        [365, 398, 6.85, 7.35, 7.65],
        [399, 399, 7.15, 7.65, 7.95],        # BOB 399-Day Baroda Tiranga Plus
        [400, 443, 6.85, 7.35, 7.65],
        [444, 444, 7.30, 7.80, 8.10],        # BOB 444-Day Bob Square
        [445, 729, 6.85, 7.35, 7.65],
        [730, 1095, 7.15, 7.65, 7.95],       # 2 to 3 Years
        [1096, 1825, 6.50, 7.15, 7.45],      # 3 to 5 Years
        [1826, 3653, 6.50, 7.50, 7.80],      # 5 to 10 Years
    ],

    # ------------------------------------------------------------------------
    # HDFC Bank (Private Sector)
    # Includes 35-month & 55-month high-yield slabs and Senior Care benefits
    # ------------------------------------------------------------------------
    "HDFC": [
        [7, 14, 3.00, 3.50, 3.80],
        [15, 29, 3.00, 3.50, 3.80],
        [30, 45, 3.50, 4.00, 4.30],
        [46, 60, 4.50, 5.00, 5.30],
        [61, 89, 4.50, 5.00, 5.30],
        [90, 179, 5.25, 5.75, 6.05],
        [180, 270, 5.75, 6.25, 6.55],
        [271, 364, 6.00, 6.50, 6.80],
        [365, 455, 6.60, 7.10, 7.40],        # 1 Year to < 15 Months
        [456, 547, 7.10, 7.60, 7.90],        # 15 Months to < 18 Months
        [548, 638, 7.25, 7.75, 8.05],        # 18 Months to < 21 Months
        [639, 884, 7.00, 7.50, 7.80],        # 21 Months to 2 Years 11 Months
        [885, 1065, 7.15, 7.65, 7.95],       # 2 Years 11 Months to 35 Months
        [1066, 1825, 7.00, 7.50, 7.80],      # 3 Years to < 5 Years
        [1826, 3653, 7.00, 7.75, 8.00],      # 5 to 10 Years (Senior Citizen Care: +75 bps)
    ],

    # ------------------------------------------------------------------------
    # ICICI Bank (Private Sector)
    # Includes 15-month to 2-year peak slab and Golden Years FD for seniors
    # ------------------------------------------------------------------------
    "ICICI": [
        [7, 14, 3.00, 3.50, 3.80],
        [15, 29, 3.00, 3.50, 3.80],
        [30, 45, 3.50, 4.00, 4.30],
        [46, 60, 4.25, 4.75, 5.05],
        [61, 90, 4.50, 5.00, 5.30],
        [91, 184, 4.75, 5.25, 5.55],
        [185, 270, 5.75, 6.25, 6.55],
        [271, 364, 6.00, 6.50, 6.80],
        [365, 455, 6.70, 7.20, 7.50],        # 1 Year to 15 Months
        [456, 729, 7.20, 7.75, 8.05],        # 15 Months to < 2 Years (Peak yield)
        [730, 1825, 7.00, 7.50, 7.80],       # 2 Years to 5 Years
        [1826, 3653, 6.90, 7.50, 7.75],      # 5 to 10 Years (Golden Years FD: +60 bps)
    ]
}


# ============================================================================
# 3. Government Small Savings Schemes Configuration
# Multi-attribute dictionary with statutory lock-in, eligibility, compounding,
# and tax classification rules under the Indian Income Tax Act.
# ============================================================================

GOVT_SCHEMES_CONFIG: Dict[str, Dict[str, Any]] = {
    # ------------------------------------------------------------------------
    # Public Provident Fund (PPF)
    # ------------------------------------------------------------------------
    "PPF": {
        "name": "Public Provident Fund",
        "code": "PPF",
        "interest_rate": 7.10,
        "lock_in_years": 15,
        "deposit_frequency": "ANNUAL",       # Annual or monthly contributions up to 15 yrs
        "deposit_period_years": 15,
        "compounding_frequency": "ANNUAL",   # Compounded annually, credited on March 31st
        "interest_payout": "AT_MATURITY",
        "min_deposit": 500.0,
        "max_deposit": 150_000.0,            # Statutory FY cap across all accounts
        "min_age": 0,
        "max_age": None,                     # No statutory upper age limit
        "eligible_genders": ["MALE", "FEMALE", "OTHER"],
        "account_types": ["SINGLE"],
        "resident_eligibility": ["RESIDENT"], # NRIs prohibited from opening fresh accounts
        "tax_status": "EEE",                 # Exempt-Exempt-Exempt (Sec 80C, Accrual, Maturity)
        "section_80c_eligible": True,
        "loan_facility_available": True,     # Available from 3rd to 6th FY
        "partial_withdrawal_available": True,# Available from 7th FY onwards
        "description": "Sovereign 15-year wealth creation backed by Govt of India with full EEE tax exemption."
    },

    # ------------------------------------------------------------------------
    # Sukanya Samriddhi Yojana (SSY)
    # ------------------------------------------------------------------------
    "SSY": {
        "name": "Sukanya Samriddhi Yojana",
        "code": "SSY",
        "interest_rate": 8.20,
        "lock_in_years": 21,                 # Matures 21 years from account opening or on marriage after 18
        "deposit_frequency": "ANNUAL",
        "deposit_period_years": 15,          # Deposits required for only first 15 years
        "compounding_frequency": "ANNUAL",
        "interest_payout": "AT_MATURITY",
        "min_deposit": 250.0,
        "max_deposit": 150_000.0,            # Statutory FY cap
        "min_age": 0,
        "max_age": 10,                       # Strictly girl child <= 10 years old
        "eligible_genders": ["FEMALE"],
        "account_types": ["SINGLE"],
        "resident_eligibility": ["RESIDENT"],
        "tax_status": "EEE",                 # Triple tax exemption under Sec 80C & Sec 10(11A)
        "section_80c_eligible": True,
        "loan_facility_available": False,
        "partial_withdrawal_available": True,# Up to 50% for higher education after girl turns 18
        "description": "High-interest sovereign welfare scheme exclusively for girl children up to 10 years."
    },

    # ------------------------------------------------------------------------
    # Senior Citizen Savings Scheme (SCSS)
    # ------------------------------------------------------------------------
    "SCSS": {
        "name": "Senior Citizen Savings Scheme",
        "code": "SCSS",
        "interest_rate": 8.20,
        "lock_in_years": 5,                  # Extendable by 3 years
        "deposit_frequency": "LUMPSUM",
        "deposit_period_years": 5,
        "compounding_frequency": "QUARTERLY",
        "interest_payout": "QUARTERLY",      # Paid on 1st of April, July, October, January
        "min_deposit": 1000.0,
        "max_deposit": 3_000_000.0,          # Budget revised cap (₹30 Lakhs)
        "min_age": 60,                       # 55+ for VRS/defense retirees
        "max_age": None,                     # No upper age limit for seniors
        "eligible_genders": ["MALE", "FEMALE", "OTHER"],
        "account_types": ["SINGLE", "JOINT"],
        "resident_eligibility": ["RESIDENT"],
        "tax_status": "EET",                 # 80C on deposit, quarterly interest fully taxable
        "section_80c_eligible": True,        # Up to ₹1.5 Lakh under 80C
        "loan_facility_available": False,
        "partial_withdrawal_available": False,
        "description": "Premier sovereign retirement income scheme with quarterly cashflow payout."
    },

    # ------------------------------------------------------------------------
    # Post Office Monthly Income Scheme (POMIS)
    # ------------------------------------------------------------------------
    "POMIS": {
        "name": "Post Office Monthly Income Scheme",
        "code": "POMIS",
        "interest_rate": 7.40,
        "lock_in_years": 5,
        "deposit_frequency": "LUMPSUM",
        "deposit_period_years": 5,
        "compounding_frequency": "MONTHLY",
        "interest_payout": "MONTHLY",        # Predictable monthly income stream
        "min_deposit": 1000.0,
        "max_deposit_single": 900_000.0,     # Statutory single cap: ₹9 Lakhs
        "max_deposit_joint": 1_500_000.0,    # Statutory joint cap: ₹15 Lakhs
        "min_age": 10,                       # Min age 10 for self-operated minor account
        "max_age": None,                     # No upper age limit
        "eligible_genders": ["MALE", "FEMALE", "OTHER"],
        "account_types": ["SINGLE", "JOINT"],
        "resident_eligibility": ["RESIDENT"],
        "tax_status": "TTT",                 # No 80C rebate, monthly interest is fully taxable
        "section_80c_eligible": False,
        "loan_facility_available": False,
        "partial_withdrawal_available": False,
        "description": "Safe, monthly income instrument guaranteed by Ministry of Communications."
    },

    # ------------------------------------------------------------------------
    # National Savings Certificate (NSC - VIII Issue)
    # ------------------------------------------------------------------------
    "NSC": {
        "name": "National Savings Certificate",
        "code": "NSC",
        "interest_rate": 7.70,
        "lock_in_years": 5,
        "deposit_frequency": "LUMPSUM",
        "deposit_period_years": 5,
        "compounding_frequency": "ANNUAL",   # Reinvested annually, paid at maturity
        "interest_payout": "AT_MATURITY",
        "min_deposit": 1000.0,
        "max_deposit": float("inf"),         # No statutory upper investment ceiling
        "min_age": 18,                       # Minors through guardians or 10+
        "max_age": None,                     # No upper age limit
        "eligible_genders": ["MALE", "FEMALE", "OTHER"],
        "account_types": ["SINGLE", "JOINT"],
        "resident_eligibility": ["RESIDENT"],
        "tax_status": "ETE",                 # 80C on deposit, reinvested interest eligible for 80C for yrs 1-4
        "section_80c_eligible": True,
        "loan_facility_available": True,     # Accepted as collateral by all commercial banks
        "partial_withdrawal_available": False,
        "description": "Cumulative 5-year savings certificate qualifying for Section 80C reinvestment benefits."
    },

    # ------------------------------------------------------------------------
    # Post Office Time Deposit (POTD - 1Y, 2Y, 3Y, 5Y)
    # ------------------------------------------------------------------------
    "POTD": {
        "name": "Post Office Time Deposit",
        "code": "POTD",
        "interest_rate": 7.50,               # Peak 5-Year rate (1Y: 6.90%, 2Y: 7.00%, 3Y: 7.10%, 5Y: 7.50%)
        "lock_in_years": 5,
        "deposit_frequency": "LUMPSUM",
        "deposit_period_years": 5,
        "compounding_frequency": "QUARTERLY",# Quarterly compounded, paid annually or at maturity
        "interest_payout": "ANNUAL",
        "min_deposit": 1000.0,
        "max_deposit": float("inf"),
        "min_age": 10,
        "max_age": None,
        "eligible_genders": ["MALE", "FEMALE", "OTHER"],
        "account_types": ["SINGLE", "JOINT"],
        "resident_eligibility": ["RESIDENT"],
        "tax_status": "ETE",
        "section_80c_eligible": True,        # 5-Year POTD qualifies for 80C deduction
        "loan_facility_available": True,
        "partial_withdrawal_available": False,
        "description": "Sovereign fixed deposit backed by Government of India with 1, 2, 3, and 5 year options."
    }
}

# Post Office Time Deposit (POTD) tenure-to-rate mapping
POTD_RATES: Dict[int, float] = {
    1: 6.90,  # 1-Year POTD: 6.90% p.a.
    2: 7.00,  # 2-Year POTD: 7.00% p.a.
    3: 7.10,  # 3-Year POTD: 7.10% p.a.
    5: 7.50,  # 5-Year POTD: 7.50% p.a.
}



# ============================================================================
# 4. Helper Rate Lookup Utilities
# ============================================================================

def get_bank_fd_rate(bank: str, days: int, age: int) -> float:
    """
    Look up the exact applicable fixed deposit interest rate from the multi-tier slab matrix.
    
    Args:
        bank: Code for the bank ('SBI', 'PNB', 'BOB', 'HDFC', 'ICICI')
        days: Total tenure converted into days
        age: Age of the account holder in years
        
    Returns:
        float: Applicable interest rate in percentage (e.g., 7.25 for 7.25%)
        
    Raises:
        ValueError: If bank is unknown or tenure is out of the 7 to 3653 days range.
    """
    bank_key = bank.upper()
    if bank_key not in BANK_FD_SLABS:
        raise ValueError(f"Unsupported bank '{bank}'. Available banks: {list(BANK_FD_SLABS.keys())}")

    if days < 7 or days > 3653:
        raise ValueError(f"Tenure of {days} days is out of bank FD permissible range [7 days, 3653 days (10 yrs)].")

    slabs = BANK_FD_SLABS[bank_key]
    matched_slab: Optional[List[float]] = None

    for slab in slabs:
        min_d, max_d, reg_r, sen_r, sup_sen_r = slab
        if min_d <= days <= max_d:
            matched_slab = slab
            break

    if not matched_slab:
        # Fallback to the nearest boundary slab if there's any gap in definition
        matched_slab = slabs[-1] if days >= 1826 else slabs[0]

    min_d, max_d, reg_rate, senior_rate, super_senior_rate = matched_slab

    # Apply age differentials:
    # - Age 80+: Super Senior
    # - Age 60 - 79: Senior
    # - Age < 60: Regular
    if age >= 80:
        return float(super_senior_rate)
    elif age >= 60:
        return float(senior_rate)
    else:
        return float(reg_rate)


def get_govt_scheme_rate(scheme_code: str) -> float:
    """
    Retrieve the statutory interest rate for a Government Small Savings Scheme.
    """
    code = scheme_code.upper()
    if code not in GOVT_SCHEMES_CONFIG:
        raise ValueError(f"Unsupported scheme '{scheme_code}'. Available schemes: {list(GOVT_SCHEMES_CONFIG.keys())}")
    return float(GOVT_SCHEMES_CONFIG[code]["interest_rate"])
