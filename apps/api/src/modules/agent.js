import { z } from "zod";
import {
  categoryTotals,
  compareMonths,
  currentMonth,
  expenseTotal,
  incomeTotal,
  merchantTotals,
  previousMonth,
  recurringSubscriptions,
  unusualSpending,
  rupees,
} from "./analytics.js";
import { monthName } from "@finance-agent/shared/format";
const querySchema = z.object({
  category: z.string().max(60).optional(),
  month: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
    .optional(),
});
const categoryMap = {
  khana: "Food & Dining",
  khaane: "Food & Dining",
  खाना: "Food & Dining",
  खाने: "Food & Dining",
  food: "Food & Dining",
  grocery: "Groceries",
  groceries: "Groceries",
  travel: "Transport",
  transport: "Transport",
  bill: "Bills",
  subscription: "Subscriptions",
  healthcare: "Healthcare",
  shopping: "Shopping",
};
const dueDate = (iso) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "long" });
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
/**
 * Deterministic, rule-based answer to a finance question.
 * `data` is the caller's owner-scoped view: { transactions, bills, emis }.
 */
function answerFinancialQuestion(message, { transactions: rows, bills: allBills, emis: allEmis }) {
  const q = message.toLocaleLowerCase();
  const hindiScript = /[ऀ-ॿ]/.test(message);
  const hinglish = /\b(mera|mere|meri|kitne|kitna|kharch|kharcha|batao|dikhao|khaane|kamai)\b/i.test(message);
  const hindiPhrases = hindiScript || hinglish;
  const requested = q.match(
    /food|khana|khaane|खाना|खाने|grocer(?:y|ies)|transport|travel|bill|subscription|healthcare|shopping/,
  )?.[0];
  const parsed = querySchema.safeParse({
    category: requested ? (categoryMap[requested] ?? requested) : void 0,
    month: q.match(/\b\d{4}-\d{2}\b/)?.[0],
  });
  if (!parsed.success)
    return {
      answer:
        "I could not interpret that request. Try asking about spending, categories, merchants, subscriptions, upcoming bills, or EMIs. Months use the YYYY-MM format.",
      data: null,
      intent: "unknown",
    };
  const month = parsed.data.month ?? currentMonth();
  const isCurrent = month === currentMonth();
  // "this month" / "in August 2026", plus the Hinglish equivalents.
  const period = isCurrent ? "this month" : `in ${monthName(month)}`;
  const periodHi = isCurrent ? "Is mahine" : `${monthName(month)} mein`;
  const expensesIn = rows.filter((t) => t.occurredAt.slice(0, 7) === month && t.kind === "expense").length;
  if (/subscription|recurring/.test(q)) {
    const found = recurringSubscriptions(rows);
    return {
      answer: found.length
        ? hindiPhrases
          ? `Synthetic records mein ${found.length} recurring subscriptions mile: ${found.map((x) => `${x.merchant}, lagbhag ${rupees(x.monthlyAmountPaise)} per month`).join("; ")}.`
          : `I found ${plural(found.length, "recurring subscription merchant")} in the synthetic records: ${found.map((x) => `${x.merchant}, about ${rupees(x.monthlyAmountPaise)} per month`).join("; ")}.`
        : hindiPhrases
          ? "Available records mein recurring subscriptions nahi mile."
          : "I did not find recurring subscriptions in the available records.",
      data: found,
      intent: "subscriptions",
    };
  }
  if (/unusual|unexpected|spike|fraud/.test(q)) {
    const candidates = unusualSpending(rows);
    return {
      answer: candidates.length
        ? `I found ${plural(candidates.length, "unusual spending candidate")} in synthetic records: ${candidates.map((x) => `${x.merchant} for ${rupees(x.amountPaise)} on ${x.category} (typical ${rupees(x.comparisonPaise)})`).join("; ")}. This is a review candidate, not a fraud finding.`
        : "I did not find an unusual spending candidate in the available records.",
      data: candidates,
      intent: "unusual_spending",
    };
  }
  if (/compare|last month|month.over.month|previous month/.test(q)) {
    const comparison = compareMonths(rows, month, previousMonth(month));
    const verb = comparison.changePaise > 0 ? "up" : comparison.changePaise < 0 ? "down" : "unchanged";
    const percent = comparison.changePercent === null ? "." : ` (${Math.abs(comparison.changePercent)}%).`;
    const previousLabel = isCurrent ? "last month" : `in ${monthName(previousMonth(month))}`;
    const previousLabelHi = isCurrent ? "pichhle mahine" : `${monthName(previousMonth(month))} mein`;
    return {
      answer: hindiPhrases
        ? `${periodHi} aapka kharch ${rupees(comparison.currentPaise)} hai, ${previousLabelHi} ${rupees(comparison.previousPaise)} tha. Kharch ${comparison.changePaise > 0 ? "bada" : comparison.changePaise < 0 ? "kam" : "barabar"} hai${percent}`
        : `Spending ${period} is ${rupees(comparison.currentPaise)}, compared with ${rupees(comparison.previousPaise)} ${previousLabel}. That is ${verb} ${rupees(Math.abs(comparison.changePaise))}${percent}`,
      data: comparison,
      intent: "comparison",
    };
  }
  if (/break ?down|by category|categories|category.wise|har category/.test(q)) {
    const breakdown = categoryTotals(rows, month);
    const total = breakdown.reduce((s, x) => s + x.amountPaise, 0);
    const list = breakdown
      .map((x) => `${x.category} ${rupees(x.amountPaise)} (${total ? Math.round((x.amountPaise / total) * 100) : 0}%)`)
      .join(", ");
    return {
      answer: breakdown.length
        ? hindiPhrases
          ? `${periodHi} category-wise kharch: ${list}.`
          : `Your spending ${period} by category: ${list}.`
        : hindiPhrases
          ? `${periodHi} koi kharch record nahi hai.`
          : `There are no expenses recorded ${period}.`,
      data: { month, totalPaise: total, categories: breakdown },
      intent: "category_breakdown",
    };
  }
  if (/income|salary|earn|kamai|आय|कमाई/.test(q)) {
    const income = incomeTotal(rows, month);
    return {
      answer: hindiPhrases
        ? `${periodHi} aapki income ${rupees(income)} hai, synthetic records ke hisaab se.`
        : `Your income ${period} is ${rupees(income)} in the synthetic records.`,
      data: { month, amountPaise: income },
      intent: "income",
    };
  }
  const category = parsed.data.category;
  if (category && !/bill|due|payment|emi|installment|किस्त|बिल/.test(q)) {
    const matches = categoryTotals(rows, month).filter((x) =>
      x.category.toLowerCase().includes(category.toLowerCase()),
    );
    const total = matches.reduce((s, x) => s + x.amountPaise, 0);
    return {
      answer: matches.length
        ? hindiPhrases
          ? `${periodHi} aapka ${category} par kharch ${rupees(total)} hai.`
          : `Your ${category} spending ${period} is ${rupees(total)}.`
        : hindiPhrases
          ? `${periodHi} ke synthetic records mein ${category} ka kharch nahi hai.`
          : `There is no ${category} spending ${period} in the synthetic records.`,
      data: { category, amountPaise: total, breakdown: matches },
      intent: "category",
    };
  }
  if (/merchant|where|spent most|top/.test(q)) {
    const top = merchantTotals(rows, month).slice(0, 5);
    return {
      answer: top.length
        ? hindiPhrases
          ? `${periodHi} aapke top merchants hain: ${top.map((x) => `${x.merchant}, ${rupees(x.amountPaise)}`).join(", ")}.`
          : `Your top merchants ${period} are ${top.map((x) => `${x.merchant} at ${rupees(x.amountPaise)}`).join(", ")}.`
        : hindiPhrases
          ? `${periodHi} koi kharch record nahi hai.`
          : `There are no expenses recorded ${period}.`,
      data: top,
      intent: "merchants",
    };
  }
  if (/bill|due|payment|emi|installment|किस्त|बिल/.test(q)) {
    if (/emi|installment|किस्त/.test(q)) {
      const emis = [...allEmis].sort((a, b) => a.nextDueAt.localeCompare(b.nextDueAt));
      const [next, ...rest] = emis;
      const later = rest.length
        ? `, then ${rest.map((e) => `${e.name} (${rupees(e.installmentPaise)}, ${dueDate(e.nextDueAt)})`).join(", ")}`
        : "";
      return {
        answer: hindiPhrases
          ? `Aapki agali EMI ${dueDate(next.nextDueAt)} ko due hai: ${next.name}, ${rupees(next.installmentPaise)}${later}.`
          : `Your next EMI is ${next.name} for ${rupees(next.installmentPaise)}, due ${dueDate(next.nextDueAt)}${later}.`,
        data: emis,
        intent: "emis",
      };
    }
    const bills = [...allBills].sort((a, b) => a.dueAt.localeCompare(b.dueAt));
    const [next, ...rest] = bills;
    const later = rest.length
      ? `, followed by ${rest.map((b) => `${b.name} (${rupees(b.amountPaise)}, ${dueDate(b.dueAt)})`).join(" and ")}`
      : "";
    return {
      answer: hindiPhrases
        ? `Aapka agla bill ${next.name} ka hai, ${rupees(next.amountPaise)}, due ${dueDate(next.dueAt)}${later}.`
        : `Your next bill is ${next.name} for ${rupees(next.amountPaise)}, due ${dueDate(next.dueAt)}${later}.`,
      data: bills,
      intent: "bills",
    };
  }
  if (/spend|expense|spent|kharch|kitne|total|खर्च|कितना|खर्चा/.test(q)) {
    const total = expenseTotal(rows, month);
    return {
      answer: hindiPhrases
        ? `${periodHi} aapka total kharch ${rupees(total)} hai, ${expensesIn} synthetic expense records ke hisaab se.`
        : `Your total spending ${period} is ${rupees(total)} across ${plural(expensesIn, "synthetic expense record")}.`,
      data: { month, amountPaise: total },
      intent: "spending_summary",
    };
  }
  return {
    answer:
      "I can help with your spending, category breakdown, income, monthly comparison, subscriptions, bills, EMI schedule, or a reminder. What would you like to check?",
    data: null,
    intent: "help",
  };
}

/** Returns the in-app action a message asks for (reminder or spending alert), or null. */
function detectActionRequest(message) {
  if (!/remind|reminder|yaad dila|याद दिला|spending alert|configure an alert/i.test(message)) return null;
  const alert = /alert/i.test(message);
  return {
    type: alert ? "spending_alert" : "reminder",
    title: alert ? "Spending alert proposal" : "Reminder proposal",
    details: message.slice(0, 500),
  };
}

export { answerFinancialQuestion, detectActionRequest };
