/**
 * Statutory Scheme Rules and Regulatory Boundaries
 * Aligned with Reserve Bank of India (RBI) directives, Government Small Savings
 * statutory gazettes (Ministry of Finance), and Department of Posts regulations.
 */

export const SCHEME_RULES = {
  BANK_FD: {
    code: 'BANK_FD',
    name: 'Commercial Bank Fixed Deposit',
    minAmount: 1000,
    maxAmount: null,
    minAge: 0,
    maxAge: null,
    requiredGender: null,
    ageHint: 'All ages eligible (Guardian required for minors)',
    amountUnit: 'deposit',
    statutoryRef: 'RBI Master Direction - Term Deposits'
  },
  BANK_RD: {
    code: 'BANK_RD',
    name: 'Bank Recurring Deposit',
    minAmount: 500,
    maxAmount: null,
    minAge: 0,
    maxAge: null,
    requiredGender: null,
    ageHint: 'All ages eligible',
    amountUnit: 'month',
    statutoryRef: 'RBI Recurring Deposit Guidelines'
  },
  PPF: {
    code: 'PPF',
    name: 'Public Provident Fund',
    minAmount: 500,
    maxAmount: 150000,
    minAge: 0,
    maxAge: null,
    requiredGender: null,
    ageHint: 'No age bar (Adult or minor via legal guardian)',
    amountUnit: 'year',
    statutoryRef: 'Public Provident Fund Scheme, 2019'
  },
  SSY: {
    code: 'SSY',
    name: 'Sukanya Samriddhi Yojana',
    minAmount: 250,
    maxAmount: 150000,
    minAge: 0,
    maxAge: 10, // Strict statutory upper limit
    requiredGender: 'FEMALE',
    ageHint: 'Girl child up to 10 years of age',
    amountUnit: 'year',
    statutoryRef: 'Sukanya Samriddhi Account Rules, 2019'
  },
  SCSS: {
    code: 'SCSS',
    name: 'Senior Citizen Savings Scheme',
    minAmount: 1000,
    maxAmount: 3000000,
    minAge: 60, // Strict statutory lower limit
    maxAge: null,
    requiredGender: null,
    ageHint: 'Senior Citizens (60+ years)',
    amountUnit: 'deposit',
    statutoryRef: 'Senior Citizen Savings Scheme Rules, 2019 (Finance Act 2023 limit ₹30L)'
  },
  POMIS: {
    code: 'POMIS',
    name: 'Post Office Monthly Income Scheme',
    minAmount: 1000,
    singleCap: 900000,
    jointCap: 1500000,
    maxAmount: 900000, // Dynamically computed based on account holding mode
    minAge: 10, // Self-operated minor account minimum age
    maxAge: null,
    requiredGender: null,
    ageHint: 'Minimum age 10 years',
    amountUnit: 'deposit',
    statutoryRef: 'Post Office (Monthly Income Account) Rules, 2019 (revised caps 2023)'
  },
  NSC: {
    code: 'NSC',
    name: 'National Savings Certificate (VIII Issue)',
    minAmount: 1000,
    maxAmount: null,
    minAge: 0,
    maxAge: null,
    requiredGender: null,
    ageHint: 'All ages eligible',
    amountUnit: 'deposit',
    statutoryRef: 'National Savings Certificates (VIII Issue) Rules, 2019'
  }
};

/**
 * Resolves the statutory rule definition for any given investment category and scheme.
 * Handles dynamic account ceilings such as POMIS Single (₹9L) vs Joint (₹15L).
 *
 * @param {string} category - 'BANK_FD' | 'BANK_RD' | 'GOVT_SCHEME'
 * @param {string} selectedScheme - 'PPF' | 'SSY' | 'SCSS' | 'POMIS' | 'NSC'
 * @param {string} accountType - 'SINGLE' | 'JOINT'
 * @returns {object} Statutory rule definition object
 */
export function getSchemeRule(category, selectedScheme, accountType = 'SINGLE') {
  if (category === 'BANK_RD') {
    return SCHEME_RULES.BANK_RD;
  }
  if (category === 'GOVT_SCHEME') {
    if (selectedScheme === 'POMIS') {
      const cap = accountType === 'JOINT' ? SCHEME_RULES.POMIS.jointCap : SCHEME_RULES.POMIS.singleCap;
      return {
        ...SCHEME_RULES.POMIS,
        maxAmount: cap
      };
    }
    return SCHEME_RULES[selectedScheme] || SCHEME_RULES.BANK_FD;
  }
  return SCHEME_RULES.BANK_FD;
}

/**
 * Formats a clean statutory amount limit string for display in UI helper labels.
 *
 * @param {object} rule - Statutory rule definition
 * @returns {string} e.g., "Min: ₹500 | Max: ₹1,50,000" or "Min: ₹1,000 | No statutory upper limit"
 */
export function formatAmountLimitLabel(rule) {
  if (!rule) return '';
  const minStr = `Min: ₹${Number(rule.minAmount).toLocaleString('en-IN')}`;
  if (rule.maxAmount !== null && rule.maxAmount !== undefined) {
    const maxStr = `Max: ₹${Number(rule.maxAmount).toLocaleString('en-IN')}`;
    return `${minStr} | ${maxStr}`;
  }
  return `${minStr} | No statutory upper limit`;
}
