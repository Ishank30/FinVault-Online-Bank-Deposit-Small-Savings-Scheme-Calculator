# FinVault India 🇮🇳
### Institutional Bank Fixed Deposit & Sovereign Small Savings Calculator

FinVault India is a production-grade full-stack financial engineering platform tailored to the Indian banking and statutory savings ecosystem. Built with **FastAPI** (Python 3.11+) and **React 18** (Vite + Tailwind CSS), it provides multi-tier interest rate modeling, automated statutory validation, DICGC deposit insurance optimization, and emergency liquidity decision analysis.

---

## 🏛️ Key Domain Engines & Highlights

### 1. RBI Quarterly Compounding & Annuity Series
- **Bank Fixed Deposits (FD):** Strictly adheres to Reserve Bank of India (RBI) compounding conventions:
  - Tenures $< 180$ days: Simple interest $A = P \times \left(1 + \frac{r \times D}{365 \times 100}\right)$
  - Tenures $\ge 180$ days: Quarterly compounding $A = P \times \left(1 + \frac{r}{400}\right)^{4 \times T}$
  - Supports Cumulative, Monthly Payout, and Quarterly Payout options.
- **Recurring Deposits (RD):** Computes monthly compounding installment series per RBI Master Directions:
  $$A = \sum_{k=1}^{M} \left[ P \times \left(1 + \frac{r}{400}\right)^{\frac{k}{3}} \right]$$

### 2. Multi-Tier Dynamic Rate Matrices & Age Privileges
- Integrates live rate slabs for **5 Scheduled Commercial Banks**:
  - **State Bank of India (SBI)** (including 444-day *Amrit Vrishti* @ 7.25% & *SBI WeCare* 5-10y @ 7.50%)
  - **Punjab National Bank (PNB)** (including 400-day high-yield bucket @ 7.25% & dedicated 80+ super-senior slabs)
  - **Bank of Baroda (BOB)** (including 399-day *Monsoon Dhamaka* @ 7.15%)
  - **HDFC Bank** (Private sector benchmark up to 7.25%)
  - **ICICI Bank** (Private sector benchmark up to 7.20%)
- **Investor Age Categories:**
  - **Regular Citizens (< 60 years):** Base commercial rate.
  - **Senior Citizens (60 – 79 years):** Standard +0.50% spread (+1.00% on special long-term tenures).
  - **Super Senior Citizens (80+ years):** Enhanced +0.80% spread / specialized super-senior rate matrices.

### 3. Sovereign Small Savings Schemes & Statutory Guardrails
- **Public Provident Fund (PPF):** 7.10% compounded annually, 15-year statutory lock-in, exempt under EEE tax status, strictly capped at ₹1,50,000/year.
- **Sukanya Samriddhi Yojana (SSY):** 8.20% compounded annually, 21-year tenure (15y deposit), restricted strictly to female child beneficiaries aged $\le 10$ years, EEE tax status, capped at ₹1,50,000/year.
- **Senior Citizen Savings Scheme (SCSS):** 8.20% quarterly payout, statutory 5-year lock-in, strictly mandates age $\ge 60$ years, maximum deposit ₹30,00,000.
- **Post Office Monthly Income Scheme (POMIS):** 7.40% monthly payout, 5-year tenure, statutory caps: ₹9,00,000 (Single) / ₹15,00,000 (Joint).
- **National Savings Certificate (NSC):** 7.70% compounded annually (deemed reinvested under Section 80C), 5-year tenure.

### 4. Smart Scheme Comparison & Recommendation Engine
- Simultaneously evaluates user eligibility (age, gender, deposit amount, tax slab) across all 5 commercial banks and 5 sovereign schemes.
- Computes **Post-Tax Effective Yield** and ranks products by net maturity returns.
- Assigns institutional **Liquidity Scores** (*High*, *Medium*, *Low*) and outputs tailored investment rationales (e.g. Sovereign EEE tax efficiency vs. commercial bank liquidity).

### 5. DICGC ₹5,00,000 Concentration Risk Alert & Auto-Splitter
- Under the *Deposit Insurance and Credit Guarantee Corporation (DICGC) Act*, deposits (Principal + Interest) are insured up to ₹5,00,000 per depositor per bank.
- If total projected maturity exceeds ₹5,00,000, FinVault flags uninsured exposure and automatically computes an **Auto-Split Plan**, allocating capital across top-tier scheduled banks with safe principal caps ($\le ₹4,25,000$ per bank) to ensure 100% of principal and interest are insured.

### 6. Section 194A TDS & Real Return Modeling
- Applies statutory TDS thresholds under Section 194A of the Income Tax Act:
  - **Regular Citizens:** ₹40,000 annual interest threshold.
  - **Senior Citizens:** ₹50,000 threshold under Section 80TTB.
  - Applies 10% TDS with PAN (or 0% when Form 15G / Form 15H is submitted).
- Discloses post-tax maturity wealth and discounts future maturity values by investor-selected inflation rates (default 6.0%).

### 7. 5-Year FD Ladder Strategy
- Partitions capital into 5 equal 20% tranches maturing sequentially across Years 1, 2, 3, 4, and 5.
- Balances high multi-year interest yield with predictable annual liquidity to minimize reinvestment friction.

### 8. Emergency Liquidity Analyzer: Break FD vs. Overdraft Loan
- Models the financial tradeoff during liquidity emergencies:
  - **Option A (Break FD):** Calculates retro-applied slab rates minus 1.00% premature liquidation penalty and computes forfeited terminal interest.
  - **Option B (Loan against FD):** Computes cost of borrowing via bank overdraft at $(r_{contracted} + 1.00\%)$ while preserving the original compounding FD.
  - Provides a definitive mathematical verdict (`TAKE_LOAN` vs. `BREAK_FD`) with exact rupee net savings.

---

## 🛠️ Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Backend** | Python 3.11+, FastAPI, Pydantic V2, Uvicorn, Pytest, HTTPX |
| **Frontend** | React 18, Vite, Tailwind CSS, Lucide React, Recharts |
| **Design System** | Institutional Dark Theme (Slate 950 / Emerald / Indigo), Glassmorphic Cards |
| **Export Suite** | Amortization Ledger CSV Generator, Clean White-Background `@media print` PDF Handler |

---

## 🚀 Local Setup & Execution Guide

### Prerequisites
- **Python 3.11+** installed
- **Node.js 18+** and `npm` installed

---

### Step 1: Backend Setup (FastAPI)

1. Open a terminal in the root project folder:
   ```bash
   cd "Bank and Government schemes"
   ```

2. Create and activate a Python virtual environment:
   ```bash
   # Windows PowerShell
   python -m venv .venv
   .\.venv\Scripts\Activate.ps1
   ```

3. Install backend dependencies:
   ```bash
   pip install -r backend/requirements.txt
   pip install pytest httpx
   ```

4. Launch the FastAPI backend server:
   ```bash
   python -m uvicorn backend.main:app --reload --port 8000
   ```
   *FastAPI server will run at: `http://localhost:8000`*  
   *Interactive OpenAPI Docs: `http://localhost:8000/docs`*

---

### Step 2: Frontend Setup (React + Vite)

1. Open a second terminal window:
   ```bash
   cd "Bank and Government schemes/frontend"
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Launch the Vite development server:
   ```bash
   npm run dev
   ```
   *Frontend interface will run at: `http://localhost:5173`*

4. Optional - Build for production:
   ```bash
   npm run build
   ```

---

## 🧪 Running the Automated Test Suite

The test suite validates financial math parity, statutory guardrails, and risk triggers via `pytest`:

```bash
# Run all tests with verbose output
.\.venv\Scripts\pytest backend/tests/test_calculations.py -v
```

### Verified Test Cases:
- ✅ **Quarterly Compounding Parity:** ₹1,00,000 for 1 year @ 6.75% matches $A = P \times (1 + r/400)^4$ ($A = ₹1,06,922.79$).
- ✅ **Senior & Super Senior Rates:** Verifies +0.50% senior citizen spread and +0.80% super-senior bracket lookups.
- ✅ **Statutory Rejections (HTTP 422):**
  - SCSS underage (< 60 years) rejected.
  - SSY male beneficiary rejected.
  - SSY over-age (> 10 years) rejected.
  - PPF over-limit (> ₹1,50,000) rejected.
- ✅ **DICGC Risk Trigger:** Flags uninsured risk and generates auto-splitter when projected maturity $> ₹5,00,000$.
- ✅ **Break FD vs. Loan Analyzer:** Accurately compares penalty costs against overdraft interest.

---

## 📄 Export & Reporting Suite

- **Export CSV:** Downloads a ledger named `FinVault_Amortization_<Scheme>_<Timestamp>.csv` containing:
  `Year, Opening Balance, Deposit Added, Interest Credited, TDS Deducted, Closing Balance`
- **Print PDF:** Click "Print PDF" or press `Ctrl + P`. Dedicated `@media print` Tailwind styling automatically removes form controls, toggles, and navigation buttons, presenting an institutional white-background report with safety status, charts, and amortization tables.

---

## ⚖️ Regulatory Disclaimer
*FinVault India is engineered in accordance with published guidelines from the Reserve Bank of India (RBI), Indian Post Office Small Savings Directorates, and the Central Board of Direct Taxes (CBDT). Rates and statutory parameters are subject to quarterly notifications by the Ministry of Finance and respective commercial banks.*
