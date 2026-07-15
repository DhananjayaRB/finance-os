import type { ExcelMonthlyPlan } from "@/lib/monthly-plan-types";
import { formatCurrency } from "@/lib/utils";

export type PlanAlertType = "critical" | "warning" | "info" | "success";

export interface PlanAlert {
  type: PlanAlertType;
  title: string;
  message: string;
  category: "loan" | "home" | "saving" | "subscription" | "insurance" | "income" | "balance";
}

export function buildPlanAlerts(plan: ExcelMonthlyPlan): PlanAlert[] {
  const alerts: PlanAlert[] = [];
  const t = plan.totals;

  for (const loan of plan.loans) {
    if (loan.paymentStatus === "OVERDUE" && loan.payable > 0) {
      alerts.push({
        type: "critical",
        title: `Overdue EMI — ${loan.name}`,
        message: `${formatCurrency(loan.payable)} past due (EMI date ${loan.emiDate}th)`,
        category: "loan",
      });
    } else if (loan.paymentStatus === "DUE" && loan.payable > 0) {
      alerts.push({
        type: "warning",
        title: `EMI Due — ${loan.name}`,
        message: `${formatCurrency(loan.payable)} due on ${loan.emiDate}th`,
        category: "loan",
      });
    } else if (loan.paymentStatus === "PENDING" && loan.payable > 0) {
      alerts.push({
        type: "info",
        title: `EMI Pending — ${loan.name}`,
        message: `${formatCurrency(loan.payable)} on ${loan.emiDate}th`,
        category: "loan",
      });
    }
  }

  for (const item of [...plan.homeExpenses, ...plan.insurances]) {
    if (item.paymentStatus === "OVERDUE" && item.payable > 0) {
      alerts.push({
        type: "critical",
        title: `Overdue — ${item.name}`,
        message: `Pay ${formatCurrency(item.payable)} immediately`,
        category: item.insuranceType ? "insurance" : "home",
      });
    } else if (item.paymentStatus === "DUE" && item.payable > 0) {
      alerts.push({
        type: "warning",
        title: `Due — ${item.name}`,
        message: `${formatCurrency(item.payable)} due soon`,
        category: item.insuranceType ? "insurance" : "home",
      });
    } else if (item.paymentStatus === "PENDING" && item.payable > 0) {
      alerts.push({
        type: "info",
        title: `Pending — ${item.name}`,
        message: `${formatCurrency(item.payable)} not yet paid`,
        category: item.insuranceType ? "insurance" : "home",
      });
    }
  }

  for (const sub of plan.subscriptions) {
    if (sub.payable > 0 && sub.paymentStatus !== "PAID") {
      const severity: PlanAlertType =
        sub.paymentStatus === "OVERDUE"
          ? "critical"
          : sub.paymentStatus === "DUE"
            ? "warning"
            : "info";
      alerts.push({
        type: severity,
        title: `Subscription — ${sub.name}`,
        message: `${formatCurrency(sub.payable)} — ${sub.statusLabel}`,
        category: "subscription",
      });
    }
  }

  for (const sv of plan.savings) {
    if (sv.payable > 0 && sv.paymentStatus !== "PAID") {
      alerts.push({
        type: sv.paymentStatus === "OVERDUE" ? "critical" : "info",
        title: `Savings due — ${sv.name}`,
        message: `${formatCurrency(sv.payable)} not deposited yet`,
        category: "saving",
      });
    }
  }

  const salary = plan.income.sources.find((i) => i.incomeType === "SALARY");
  if (salary && !salary.isReceived) {
    alerts.push({
      type: "warning",
      title: "Salary not received",
      message: `${formatCurrency(salary.amount)} expected this cycle`,
      category: "income",
    });
  }

  if (t.allPayable > 0) {
    alerts.push({
      type: t.allPayable > t.balance ? "warning" : "info",
      title: "Total payable this month",
      message: `${formatCurrency(t.allPayable)} still to pay (EMI, expenses, savings, subs, insurance)`,
      category: "balance",
    });
  }

  if (t.balance < 0) {
    alerts.push({
      type: "critical",
      title: "Plan shortfall",
      message: `Over budget by ${formatCurrency(Math.abs(t.balance))} on plan commitments (Income − Required)`,
      category: "balance",
    });
  }

  const order: Record<PlanAlertType, number> = { critical: 0, warning: 1, info: 2, success: 3 };
  return alerts.sort((a, b) => order[a.type] - order[b.type]);
}
