/** Client-safe plan types — no DB / Prisma imports. */

export type PlanPaymentStatus =
  | "PAID"
  | "PENDING"
  | "DUE"
  | "OVERDUE"
  | "CLOSED";

export interface ExcelPlanItem {
  id: string;
  name: string;
  amount: number;
  outstanding?: number;
  pendingEmi?: number;
  emiDate?: number;
  interestRate?: number;
  payable: number;
  paymentStatus: PlanPaymentStatus;
  statusLabel: string;
  statusColor: string;
  beforeSalary: boolean;
  loanType?: string;
  incomeType?: string;
  insuranceType?: string;
  savingType?: string;
  savingSource?: "plan" | "entry";
  savingKind?: "DEPOSIT" | "WITHDRAWAL" | "MISSED";
  isReceived?: boolean;
  category?: string;
}

export interface ExcelMonthlyPlan {
  month: number;
  year: number;
  monthLabel: string;
  salaryCycle: string;
  salaryDay: number;
  currentDay: number;

  income: {
    planTotal: number;
    sources: ExcelPlanItem[];
    breakdownTotal: number;
    subTotalOther: number;
  };

  loans: ExcelPlanItem[];
  homeExpenses: ExcelPlanItem[];
  savings: ExcelPlanItem[];
  monthlyFixedExpenses: ExcelPlanItem[];
  subscriptions: ExcelPlanItem[];
  insurances: ExcelPlanItem[];
  actualSavings: {
    total: number;
    deposited: number;
    withdrawn: number;
    missed: number;
    entries: {
      id: string;
      name: string;
      type: string;
      kind: string;
      amount: number;
      date: string;
    }[];
    byType: { type: string; total: number }[];
  };
  otherSpend: {
    total: number;
    need: number;
    want: number;
    luxury: number;
    savings: number;
    items: ExcelPlanItem[];
  };

  totals: {
    loanEmi: number;
    loanOutstanding: number;
    loanPayable: number;
    homeTotal: number;
    homePayable: number;
    savingsTotal: number;
    savingsPayable: number;
    fixedTotal: number;
    fixedPayable: number;
    subscriptionTotal: number;
    subscriptionPayable: number;
    insuranceTotal: number;
    insurancePayable: number;
    otherSpendTotal: number;
    allPayable: number;
    totalRequired: number;
    balance: number;
    savingsDeposited: number;
    savingsWithdrawn: number;
    savingsMissed: number;
    savingsNetSaved: number;
    savingsStillToSave: number;
    beforeSalary: {
      loan: number;
      home: number;
      savings: number;
      fixed: number;
      subscriptions: number;
      insurance: number;
      total: number;
    };
    afterSalary: {
      loan: number;
      home: number;
      savings: number;
      fixed: number;
      subscriptions: number;
      insurance: number;
      total: number;
    };
  };

  insights: { type: string; title: string; message: string; action?: string }[];
  history: { label: string; planned: number; actual: number; gap: number }[];
  salaryBreakdown: {
    incomeReceived: number;
    salaryReceived: number;
    planIncome: number;
    emi: number;
    homeExpense: number;
    fixedExpense: number;
    subscriptions: number;
    insurance: number;
    savingsLogged: number;
    otherExpenses: number;
    totalSpent: number;
    remaining: number;
  };
  consolidated: {
    bankBalance: number;
    cashInHand: number;
    totalLiquidity: number;
  };
  planAlerts: { type: string; title: string; message: string; category: string }[];
}

export type PlanItemType =
  | "loan"
  | "home"
  | "saving"
  | "income"
  | "subscription"
  | "monthly_fixed"
  | "insurance";
