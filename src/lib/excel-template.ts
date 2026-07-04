/** Fixed template data matching "July-2026 Planned" Excel sheet */

export const EXCEL_PLAN_TEMPLATE = {
  planIncome: 135000,
  salaryDay: 7,

  loans: [
    { name: "IDFC(4)", emiAmount: 11300, outstanding: 115000, pendingEmi: 11, emiDate: 2, interestRate: 17, payableAmount: 0, loanType: "PERSONAL" as const },
    { name: "DMI(5)", emiAmount: 11000, outstanding: 321000, pendingEmi: 43, emiDate: 5, interestRate: 21.75, payableAmount: 11000, loanType: "PERSONAL" as const },
    { name: "Flexy Salary(1)", emiAmount: 9700, outstanding: 90000, pendingEmi: 11, emiDate: 7, interestRate: 35, payableAmount: 9700, loanType: "APP" as const },
    { name: "Cashee", emiAmount: 9000, outstanding: 80102, pendingEmi: 9, emiDate: 5, interestRate: 18, payableAmount: 0, loanType: "APP" as const },
    { name: "RBL(2)", emiAmount: 10000, outstanding: 70000, pendingEmi: 7, emiDate: 2, interestRate: 18, payableAmount: 0, loanType: "PERSONAL" as const },
    { name: "BEL", emiAmount: 9220, outstanding: 90000, pendingEmi: 10, emiDate: 10, interestRate: 24.75, payableAmount: 9220, loanType: "APP" as const },
    { name: "MP", emiAmount: 2357, outstanding: 20000, pendingEmi: 9, emiDate: 17, interestRate: 18, payableAmount: 0, loanType: "APP" as const },
    { name: "MV", emiAmount: 9041, outstanding: 170000, pendingEmi: 19, emiDate: 5, interestRate: 43, payableAmount: 9041, loanType: "APP" as const },
    { name: "HDFC Rupay", emiAmount: 6000, outstanding: 59000, pendingEmi: 12, emiDate: 21, interestRate: 24, payableAmount: 6000, loanType: "CREDIT_CARD" as const },
    { name: "HDFC Milania", emiAmount: 2000, outstanding: 26000, pendingEmi: 7, emiDate: 2, interestRate: 24, payableAmount: 0, loanType: "CREDIT_CARD" as const },
  ],

  homeExpenses: [
    { name: "Dhanu Home Rent", amount: 10000, payableAmount: 9000, dueDay: 5, category: "HOME" },
    { name: "Parents", amount: 0, payableAmount: 0, dueDay: 7, category: "HOME" },
    { name: "Poornima", amount: 25000, payableAmount: 0, dueDay: 10, category: "HOME" },
    { name: "Dhanu Expense", amount: 10000, payableAmount: 10000, dueDay: 15, category: "HOME" },
    { name: "Others", amount: 5000, payableAmount: 5000, dueDay: 20, category: "HOME" },
  ],

  savings: [
    { name: "Gold", amount: 5000, payableAmount: 0, type: "GOLD" as const },
    { name: "SIP", amount: 0, payableAmount: 0, type: "SIP" as const },
  ],

  monthlyFixedExpenses: [
    { name: "Bank EMI", amount: 80000, category: "MONTHLY_FIXED" },
    { name: "Dhanu Expense", amount: 20000, category: "MONTHLY_FIXED" },
    { name: "Poornima", amount: 25000, category: "MONTHLY_FIXED" },
    { name: "Others", amount: 10000, category: "MONTHLY_FIXED" },
  ],

  incomeSources: [
    { source: "HDFC", incomeType: "HDFC" as const, amount: 49000, isRecurring: true },
    { source: "CANARA", incomeType: "CANARA" as const, amount: 1500, isRecurring: true },
    { source: "GOLD", incomeType: "GOLD" as const, amount: 5500, isRecurring: false },
    { source: "PF", incomeType: "PF" as const, amount: 0, isRecurring: true },
    { source: "Salary", incomeType: "SALARY" as const, amount: 134000, isRecurring: true },
  ],

  subscriptions: [
    { name: "Netflix", amount: 500, renewalDay: 1 },
    { name: "Prime", amount: 200, renewalDay: 5 },
    { name: "Jio", amount: 50, renewalDay: 10 },
    { name: "Youtube", amount: 300, renewalDay: 12 },
    { name: "Airtel Wifi1", amount: 1200, renewalDay: 15 },
    { name: "Airtel Wifi2", amount: 800, renewalDay: 18 },
    { name: "Recharge(5)", amount: 1500, renewalDay: 25 },
  ],

  insurances: [
    { name: "Star Health Medical", provider: "Star Health", insuranceType: "MEDICAL" as const, premium: 18000, coverageAmount: 500000, cycle: "YEARLY" as const, renewalDay: 15, payableAmount: 1500 },
    { name: "LIC Life Cover", provider: "LIC", insuranceType: "LIFE" as const, premium: 24000, coverageAmount: 1000000, cycle: "YEARLY" as const, renewalDay: 20, payableAmount: 0 },
    { name: "Term Plan", provider: "HDFC Life", insuranceType: "TERM" as const, premium: 12000, coverageAmount: 5000000, cycle: "YEARLY" as const, renewalDay: 10, payableAmount: 1000 },
  ],

  budget: {
    totalIncome: 135000,
    emiAmount: 79618,
    fixedExpense: 50000,
    subscriptionAmount: 4550,
    needAmount: 68000,
    wantAmount: 15000,
    luxuryAmount: 7000,
    savingsAmount: 5000,
    investmentAmount: 10000,
    carryForward: 382,
  },
};

export const INCOME_TYPE_LABELS: Record<string, string> = {
  SALARY: "Salary",
  HDFC: "HDFC",
  CANARA: "CANARA",
  GOLD: "Gold",
  PF: "PF",
  INTEREST: "Interest",
  BONUS: "Bonus",
  RENTAL: "Rental",
  OTHER: "Other",
};
