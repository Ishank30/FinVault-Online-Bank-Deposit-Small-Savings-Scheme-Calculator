"""
Pydantic Schemas and Financial Validation Contracts
Phase 1 to Phase 4: Core contracts, strict guardrails, multi-bank benchmarks,
DICGC split models, and Break FD vs Overdraft Loan analysis.
"""

from typing import Optional, List, Literal, Dict, Any
from pydantic import BaseModel, Field, model_validator
from backend.config_rates import (
    DICGC_LIMIT,
    SAFE_PRINCIPAL_PER_BANK,
    GOVT_SCHEMES_CONFIG,
    BANK_FD_SLABS
)

CategoryType = Literal["BANK_FD", "BANK_RD", "GOVT_SCHEME"]
BankType = Literal["SBI", "PNB", "BOB", "HDFC", "ICICI"]
SchemeType = Literal["PPF", "SSY", "SCSS", "POMIS", "NSC", "POTD"]
CalculationModeType = Literal["STANDARD", "LADDER"]
PayoutType = Literal["CUMULATIVE", "MONTHLY", "QUARTERLY"]
ResidentStatusType = Literal["RESIDENT", "NRI_NRE", "NRI_NRO"]
GenderType = Literal["MALE", "FEMALE", "OTHER"]
AccountType = Literal["SINGLE", "JOINT"]



# ============================================================================
# Core Investment Request Contract
# ============================================================================

class InvestmentRequest(BaseModel):
    """
    Unified input payload for calculating returns, tax liabilities,
    DICGC insurance guardrails, and laddering schedules.
    """
    # Mandatory Core Demographics & Investment Principal
    age: int = Field(
        ...,
        ge=0,
        le=120,
        description="Age of the primary investor (silent sanity check). Determines senior/super senior rate applicability."
    )
    amount: float = Field(
        ...,
        gt=0,
        description="Principal deposit amount in INR. For RD, represents monthly recurring installment."
    )
    tenure_years: int = Field(
        default=0,
        ge=0,
        le=25,
        description="Investment tenure component in years."
    )
    tenure_months: int = Field(
        default=0,
        ge=0,
        le=11,
        description="Investment tenure component in months."
    )
    tenure_days: int = Field(
        default=0,
        ge=0,
        le=3653,
        description="Investment tenure component in days (up to 3,653 days / 10 years)."
    )

    # Product Selectors
    category: CategoryType = Field(
        ...,
        description="Investment category: Commercial Bank FD, Bank RD, or Govt Small Savings Scheme."
    )
    investment_frequency: Optional[str] = Field(
        default=None,
        description="Active investment cadence: LUMP_SUM, MONTHLY, or YEARLY."
    )
    selected_bank: Optional[BankType] = Field(
        default=None,
        description="Scheduled commercial bank: SBI, PNB, BOB, HDFC, or ICICI. Required for BANK_FD and BANK_RD."
    )
    selected_scheme: Optional[SchemeType] = Field(
        default=None,
        description="Government scheme: PPF, SSY, SCSS, POMIS, NSC, or POTD. Required for GOVT_SCHEME."
    )

    # Operating Calculation Modes
    calculation_mode: CalculationModeType = Field(
        default="STANDARD",
        description="STANDARD calculation or 5-Year FD LADDER strategy distribution."
    )

    # Payout, Tax, and Demographics Modifiers
    payout_type: PayoutType = Field(
        default="CUMULATIVE",
        description="Interest payout preference: CUMULATIVE (compounded), MONTHLY, or QUARTERLY."
    )
    resident_status: ResidentStatusType = Field(
        default="RESIDENT",
        description="Tax residency status: Indian Resident, NRI (NRE account), or NRI (NRO account)."
    )
    gender: GenderType = Field(
        default="MALE",
        description="Gender of the account beneficiary (Mandatory FEMALE for SSY)."
    )
    account_type: AccountType = Field(
        default="SINGLE",
        description="Holding mode: SINGLE or JOINT account."
    )
    tax_slab: float = Field(
        default=0.0,
        ge=0.0,
        le=0.30,
        description="Investor's marginal income tax bracket (0.0, 0.05, 0.10, 0.15, 0.20, 0.30)."
    )
    has_form_15g_15h: bool = Field(
        default=False,
        description="Self-declaration form submitted to avoid bank TDS deduction under Section 194A."
    )
    inflation_rate: float = Field(
        default=0.06,
        ge=0.0,
        le=0.20,
        description="Expected long-term annual inflation rate for calculating real purchasing power (default: 6.0%)."
    )

    # Strict Pydantic Model Validators (Statutory Scheme Rules & Boundaries)
    @model_validator(mode="after")
    def validate_financial_guardrails(self) -> "InvestmentRequest":
        total_tenure_days = (self.tenure_years * 365) + (self.tenure_months * 30) + self.tenure_days

        if self.category in ("BANK_FD", "BANK_RD"):
            if not self.selected_bank:
                raise ValueError("A commercial bank ('selected_bank') must be specified for Bank FD or RD.")

            if self.selected_bank not in BANK_FD_SLABS:
                raise ValueError(f"Invalid bank '{self.selected_bank}'. Must be one of: {list(BANK_FD_SLABS.keys())}.")

            if self.category == "BANK_FD":
                if self.amount < 1000.0:
                    raise ValueError(f"Commercial Bank Fixed Deposit requires a minimum deposit of ₹1,000. Specified: ₹{self.amount:,.2f}.")
                if total_tenure_days < 7:
                    raise ValueError("Bank Fixed Deposit tenure must be at least 7 days.")
                if total_tenure_days > 3653:
                    raise ValueError("Bank Fixed Deposit tenure cannot exceed 10 years (3,653 days).")

            if self.category == "BANK_RD":
                if self.amount < 500.0:
                    raise ValueError(f"Recurring Deposit (RD) requires a minimum monthly installment of ₹500. Specified: ₹{self.amount:,.2f}.")
                total_months = (self.tenure_years * 12) + self.tenure_months + (self.tenure_days // 30)
                if total_months < 6:
                    raise ValueError("Recurring Deposit (RD) minimum tenure is 6 months.")
                if total_months > 120:
                    raise ValueError("Recurring Deposit (RD) maximum tenure cannot exceed 10 years (120 months).")

        elif self.category == "GOVT_SCHEME":
            if not self.selected_scheme:
                raise ValueError("A valid government scheme ('selected_scheme') must be specified.")

            if self.selected_scheme not in GOVT_SCHEMES_CONFIG:
                raise ValueError(f"Invalid scheme '{self.selected_scheme}'. Must be one of: {list(GOVT_SCHEMES_CONFIG.keys())}.")

            if self.resident_status in ("NRI_NRE", "NRI_NRO") and self.selected_scheme in ("PPF", "SSY", "SCSS", "POMIS", "NSC"):
                raise ValueError(
                    f"Non-Resident Indians (NRIs) are prohibited from opening fresh {self.selected_scheme} accounts "
                    "under statutory Government of India rules."
                )

            if self.selected_scheme == "PPF":
                if self.amount < 500.0 or self.amount > 150_000.0:
                    raise ValueError(
                        f"Public Provident Fund (PPF) annual contribution must be between ₹500 and ₹1,50,000 per financial year. Specified: ₹{self.amount:,.2f}."
                    )

            elif self.selected_scheme == "SSY":
                if self.gender != "FEMALE":
                    raise ValueError("Sukanya Samriddhi Yojana (SSY) is strictly restricted to girl child beneficiaries (Gender must be Female).")
                if self.age > 10:
                    raise ValueError(f"Sukanya Samriddhi Yojana (SSY) can only be opened for a girl child up to 10 years of age. Current age: {self.age}.")
                if self.amount < 250.0 or self.amount > 150_000.0:
                    raise ValueError(
                        f"Sukanya Samriddhi Yojana (SSY) annual contribution must be between ₹250 and ₹1,50,000 per financial year. Specified: ₹{self.amount:,.2f}."
                    )

            elif self.selected_scheme == "SCSS":
                if self.age < 60:
                    raise ValueError("Senior Citizen Savings Scheme (SCSS) requires age 60 or above.")
                if self.amount < 1000.0 or self.amount > 3_000_000.0:
                    raise ValueError(
                        f"Senior Citizen Savings Scheme (SCSS) deposit must be between ₹1,000 and ₹30,00,000. Specified: ₹{self.amount:,.2f}."
                    )

            elif self.selected_scheme == "POMIS":
                if self.age < 10:
                    raise ValueError("Post Office Monthly Income Scheme (POMIS) requires the account holder to be at least 10 years of age for a self-operated account.")
                if self.amount < 1000.0:
                    raise ValueError("Post Office Monthly Income Scheme (POMIS) minimum deposit is ₹1,000.")
                if self.account_type == "SINGLE" and self.amount > 900_000.0:
                    raise ValueError(f"Post Office Monthly Income Scheme (POMIS) single account ceiling is ₹9,00,000. Specified: ₹{self.amount:,.2f}.")
                if self.account_type == "JOINT" and self.amount > 1_500_000.0:
                    raise ValueError(f"Post Office Monthly Income Scheme (POMIS) joint account ceiling is ₹15,00,000. Specified: ₹{self.amount:,.2f}.")

            elif self.selected_scheme == "NSC":
                if self.amount < 1000.0:
                    raise ValueError(f"National Savings Certificate (NSC) minimum deposit is ₹1,000. Specified: ₹{self.amount:,.2f}.")

            elif self.selected_scheme == "POTD":
                if self.amount < 1000.0:
                    raise ValueError(f"Post Office Time Deposit (POTD) minimum deposit is ₹1,000. Specified: ₹{self.amount:,.2f}.")

        if self.calculation_mode == "LADDER":
            if self.category != "BANK_FD":
                raise ValueError("5-Year Ladder strategy is only applicable for Commercial Bank Fixed Deposits ('BANK_FD').")
            if self.amount < 50000.0:
                raise ValueError("Minimum recommended deposit for creating a 5-Year FD ladder is ₹50,000 (₹10,000 per tranche).")

        return self


# ============================================================================
# Phase 3 & 4 Sub-Models
# ============================================================================

class LadderTranche(BaseModel):
    """Details for a single tranche in a 5-Year FD ladder."""
    tranche_number: int
    tenure_years: int
    principal_allocated: float
    interest_rate: float
    maturity_amount: float
    interest_earned: float
    annual_payout_on_maturity: float


class CashflowItem(BaseModel):
    """Periodic cashflow projection item."""
    period: int
    label: str
    payout_amount: float
    cumulative_interest: float
    remaining_principal: float


class DICGCSplitBank(BaseModel):
    """Allocation recommendation per bank to guarantee 100% DICGC coverage."""
    bank: str
    bank_name: str
    principal_allocated: float
    projected_interest: float
    projected_maturity: float
    is_fully_insured: bool


class DICGCInfo(BaseModel):
    """DICGC Insurance coverage status and risk allocation advisory."""
    total_exposure: float
    insurance_limit: float = DICGC_LIMIT
    is_fully_insured: bool
    uninsured_amount: float
    safe_principal_limit: float = SAFE_PRINCIPAL_PER_BANK
    recommendation: str
    auto_split_plan: Optional[List[DICGCSplitBank]] = None


class BankComparisonItem(BaseModel):
    """Comparison item across the 5 commercial banks."""
    bank_code: str
    bank_name: str
    bank_type: str  # "Public Sector" | "Private Sector"
    regular_rate: float
    senior_rate: float
    super_senior_rate: float
    applicable_rate: float
    apy: float
    maturity_amount: float
    interest_earned: float
    rank: int
    is_best_rate: bool


class BreakVsLoanRequest(BaseModel):
    """Input payload for Break FD vs Overdraft Loan decision engine."""
    principal: float = Field(..., gt=0)
    contracted_rate: float = Field(..., gt=0)
    total_tenure_months: int = Field(..., gt=0)
    elapsed_months: int = Field(..., ge=1)
    emergency_cash_needed: float = Field(..., gt=0)
    loan_duration_months: int = Field(default=6, ge=1, le=36)
    age: int = Field(default=35, ge=0, le=120)
    selected_bank: BankType = "SBI"


class BreakVsLoanResponse(BaseModel):
    """Output verdict from Break FD vs Overdraft Loan analysis."""
    emergency_cash_needed: float
    elapsed_months: int
    loan_duration_months: int
    # Break FD Option
    applicable_slab_rate_at_break: float
    penalized_rate: float
    interest_earned_on_break: float
    maturity_interest_lost: float
    # Loan against FD Option
    loan_interest_rate: float
    loan_interest_cost: float
    fd_full_maturity_proceeds: float
    net_gain_from_keeping_fd: float
    # Verdict
    recommendation: Literal["TAKE_LOAN", "BREAK_FD"]
    financial_difference: float
    verdict_headline: str
    verdict_description: str


class AmortizationRow(BaseModel):
    """Year-by-year ledger entry for wealth accumulation and TDS deduction."""
    year: int
    opening_balance: float
    deposit_added: float
    interest_credited: float
    tds_deducted: float
    closing_balance: float


class SchemeComparisonItem(BaseModel):
    """Individual scheme or bank benchmark item in the Smart Comparison Engine."""
    scheme_code: str
    scheme_name: str
    category: str  # "Commercial Bank FD" | "Commercial Bank RD" | "Govt Small Savings"
    institution_or_issuer: str
    gross_interest_rate: float
    post_tax_effective_yield: float
    estimated_maturity_amount: float
    post_tax_maturity_amount: float
    total_interest_earned: float
    tenure_display: str
    tenure_years: float
    liquidity_score: Literal["High", "Medium", "Low"]
    tax_treatment: str
    badge: Optional[str] = None
    rank: int = 1
    is_best_pick: bool = False
    highlights: List[str] = []
    cadence: Optional[str] = "LUMP_SUM"  # "LUMP_SUM" (or "ONE_TIME") | "MONTHLY" | "YEARLY"
    is_cross_cadence: bool = False
    contextual_tag: Optional[str] = None


class SmartComparisonResponse(BaseModel):
    """Smart Scheme Comparison & Recommendation Engine payload."""
    best_pick: SchemeComparisonItem
    ranked_schemes: List[SchemeComparisonItem]
    recommendation_headline: str
    recommendation_rationale: str
    total_eligible_schemes: int
    user_tax_slab_percent: float
    active_cadence: str = "LUMP_SUM"  # "LUMP_SUM" (or "ONE_TIME") | "MONTHLY" | "YEARLY"
    cross_cadence_reference: Optional[SchemeComparisonItem] = None


# ============================================================================
# Main Output Contract
# ============================================================================

class CalculationResponse(BaseModel):
    """
    Comprehensive financial calculation output contract for Phase 1 - 5.
    """
    # Core Summary
    principal: float
    applicable_interest_rate: float
    regular_rate: float
    senior_rate: float
    super_senior_rate: float
    apy: float
    effective_annual_yield: float
    tenure_display: str
    total_tenure_days: int
    fractional_years: float
    total_tenure_months: int
    maturity_amount: float
    total_interest_earned: float

    # Tax Implications (Section 194A / 80TTB)
    tax_status: str
    is_tds_applicable: bool
    estimated_tds_amount: float
    estimated_tax_payable: float
    net_post_tax_maturity: float
    post_tax_annualized_yield: float
    form_15g_15h_advisory: Optional[str] = None

    # Real Wealth / Inflation Adjustment
    inflation_rate: float
    inflation_adjusted_maturity: float
    real_rate_of_return: float

    # Liquidity & Borrowing Facility
    loan_against_fd_eligible: bool
    max_loan_amount: float
    loan_interest_rate: float
    premature_penalty_rate: float

    # DICGC Advisory & Auto-Splitter
    dicgc_analysis: DICGCInfo

    # Mode-specific data
    calculation_mode: CalculationModeType
    ladder_schedule: Optional[List[LadderTranche]] = None
    periodic_payout: Optional[float] = None
    periodic_payout_frequency: Optional[str] = None
    cashflow_schedule: Optional[List[CashflowItem]] = None

    # Multi-Bank Comparison
    bank_comparisons: Optional[List[BankComparisonItem]] = None

    # Smart Scheme Comparison & Recommendation Engine
    comparison: Optional[SmartComparisonResponse] = None

    # Break vs Loan Quick Benchmark
    break_vs_loan_preview: Optional[BreakVsLoanResponse] = None

    # Phase 5: Amortization Schedule
    schedule: Optional[List[AmortizationRow]] = None

    # Metadata
    institution_or_scheme_name: str
    regulatory_notes: List[str]


# ============================================================================
# Target Goal Planner (Reverse Wealth Engineering) Contracts
# ============================================================================

class GoalOptionItem(BaseModel):
    """Specific commercial bank or post office option required to hit the target corpus."""
    institution_or_scheme: str
    scheme_code: str
    category: str  # "Commercial Bank" | "Post Office"
    applicable_rate: float
    tenure_display: str
    # Lump-Sum Capital Requirements
    required_lump_sum: float
    lump_sum_interest_earned: float
    # Recurring Monthly RD Capital Requirements
    required_monthly_rd: Optional[float] = None
    monthly_rd_total_invested: Optional[float] = None
    monthly_rd_interest_earned: Optional[float] = None
    is_best_lump_sum: bool = False
    is_best_monthly: bool = False


class GoalPlannerRequest(BaseModel):
    """Input payload for reverse-engineering required deposits for a target corpus."""
    target_amount: float = Field(..., gt=0, description="Target financial goal corpus in INR (e.g. ₹10,00,000)")
    tenure_years: int = Field(default=5, ge=0, le=25)
    tenure_months: int = Field(default=0, ge=0, le=11)
    tenure_days: int = Field(default=0, ge=0, le=365)
    age: int = Field(default=35, ge=0, le=120)


class GoalPlannerResponse(BaseModel):
    """Structured reverse calculation output comparing required capital across all institutions."""
    target_amount: float
    tenure_display: str
    total_months: int
    total_days: int
    fractional_years: float
    best_lump_sum_option: GoalOptionItem
    best_monthly_option: Optional[GoalOptionItem] = None
    options: List[GoalOptionItem]


