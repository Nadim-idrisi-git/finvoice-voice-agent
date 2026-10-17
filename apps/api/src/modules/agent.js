import { z } from "zod";
import { categoryTotals, compareMonths, currentMonth, expenseTotal, merchantTotals, previousMonth, recurringSubscriptions, unusualSpending, rupees } from "./analytics.js";
import { syntheticBills, syntheticEmis } from "../data/seed.js";
const querySchema = z.object({ category: z.string().max(60).optional(), month: z.string().regex(/^\d{4}-\d{2}$/).optional() });
function answerFinancialQuestion(message, rows) {
  const q = message.toLocaleLowerCase();
  const defaultMonth = currentMonth();
  const hindiScript = /[\u0900-\u097F]/.test(message);
  const hinglish = /\b(mera|mere|meri|kitne|kharch|kharcha|batao|dikhao|khaane)\b/i.test(message);
  const hindi = hindiScript;
  const hindiPhrases = hindi || hinglish;
  const requested = q.match(/food|khana|khaane|खाना|खाने|grocer(?:y|ies)|transport|travel|bill|subscription|healthcare|shopping/)?.[0];
  const categoryMap = { khana: "Food & Dining", khaane: "Food & Dining", \u0916\u093E\u0928\u093E: "Food & Dining", \u0916\u093E\u0928\u0947: "Food & Dining", food: "Food & Dining", grocery: "Groceries", groceries: "Groceries", travel: "Transport", transport: "Transport", bill: "Bills", subscription: "Subscriptions", healthcare: "Healthcare", shopping: "Shopping" };
  const parsed = querySchema.safeParse({ category: requested ? categoryMap[requested] ?? requested : void 0, month: q.match(/\b\d{4}-\d{2}\b/)?.[0] });
  if (!parsed.success) return { answer: "I could not interpret that request. Try asking about spending, categories, merchants, subscriptions, upcoming bills, or EMIs.", data: null, intent: "unknown" };
  const month = parsed.data.month ?? defaultMonth;
  if (/subscription|recurring/.test(q)) {
    const found = recurringSubscriptions(rows);
    return { answer: found.length ? hindiPhrases ? `Synthetic records mein ${found.length} recurring subscriptions mile: ${found.map((x) => `${x.merchant}, lagbhag ${rupees(x.monthlyAmountPaise)} per month`).join("; ")}.` : `I found ${found.length} recurring subscription merchants in the synthetic records: ${found.map((x) => `${x.merchant}, about ${rupees(x.monthlyAmountPaise)} per month`).join("; ")}.` : hindiPhrases ? "Available records mein recurring subscriptions nahi mile." : "I did not find recurring subscriptions in the available records.", data: found, intent: "subscriptions" };
  }
  if (/unusual|unexpected|spike|fraud/.test(q)) {
    const candidates = unusualSpending(rows);
    return { answer: candidates.length ? `I found ${candidates.length} unusual spending candidate in synthetic records: ${candidates.map((x) => `${x.merchant} for ${rupees(x.amountPaise)} on ${x.category}`).join("; ")}. This is a review candidate, not a fraud finding.` : "I did not find an unusual spending candidate in the available records.", data: candidates, intent: "unusual_spending" };
  }
  if (/compare|last month|month.over.month|previous month/.test(q)) {
    const comparison = compareMonths(rows, month, previousMonth(month));
    const verb = comparison.changePaise > 0 ? "up" : comparison.changePaise < 0 ? "down" : "unchanged";
    return { answer: hindiPhrases ? `Is mahine aapka kharch ${rupees(comparison.currentPaise)} hai, pichhle mahine ${rupees(comparison.previousPaise)} tha. Kharch ${comparison.changePaise > 0 ? "bada" : comparison.changePaise < 0 ? "kam" : "barabar"} hai${comparison.changePercent === null ? "." : ` (${Math.abs(comparison.changePercent)}%).`}` : `Spending this month is ${rupees(comparison.currentPaise)}, compared with ${rupees(comparison.previousPaise)} last month. That is ${verb} ${rupees(Math.abs(comparison.changePaise))}${comparison.changePercent === null ? "." : ` (${Math.abs(comparison.changePercent)}%).`}`, data: comparison, intent: "comparison" };
  }
  const category = parsed.data.category;
  if (category && !/bill|due|payment|emi|installment|किस्त|बिल/.test(q)) {
    const matches = categoryTotals(rows, month).filter((x) => x.category.toLowerCase().includes(category.toLowerCase()));
    const total = matches.reduce((s, x) => s + x.amountPaise, 0);
    return { answer: matches.length ? hindiPhrases ? `Is mahine aapka ${category} par kharch ${rupees(total)} hai.` : `Your ${category} spending this month is ${rupees(total)}.` : hindiPhrases ? `Is mahine ke synthetic records mein ${category} ka kharch nahi hai.` : `There is no ${category} spending in this month's synthetic records.`, data: { category, amountPaise: total, breakdown: matches }, intent: "category" };
  }
  if (/merchant|where|spent most|top/.test(q)) {
    const top = merchantTotals(rows, month).slice(0, 5);
    return { answer: top.length ? hindiPhrases ? `Is mahine aapke top merchants hain: ${top.map((x) => `${x.merchant}, ${rupees(x.amountPaise)}`).join(", ")}.` : `Your top merchants this month are ${top.map((x) => `${x.merchant} at ${rupees(x.amountPaise)}`).join(", ")}.` : hindiPhrases ? "Is mahine koi kharch record nahi hai." : "There are no expenses recorded this month.", data: top, intent: "merchants" };
  }
  if (/bill|due|payment|emi|installment|किस्त|बिल/.test(q)) {
    if (/emi|installment|किस्त/.test(q)) {
      const rows2 = syntheticEmis;
      return { answer: hindiPhrases ? `Aapki agali EMI ${new Date(rows2[0].nextDueAt).toLocaleDateString("en-IN", { day: "numeric", month: "long" })} ko due hai: ${rows2[0].name}, ${rupees(rows2[0].installmentPaise)}.` : `Your next EMI is ${rows2[0].name} for ${rupees(rows2[0].installmentPaise)}, due ${new Date(rows2[0].nextDueAt).toLocaleDateString("en-IN", { day: "numeric", month: "long" })}.`, data: rows2, intent: "emis" };
    }
    return { answer: hindiPhrases ? `Aapka agla bill ${syntheticBills[0].name} ka hai, ${rupees(syntheticBills[0].amountPaise)}, due ${new Date(syntheticBills[0].dueAt).toLocaleDateString("en-IN", { day: "numeric", month: "long" })}.` : `Your next bill is ${syntheticBills[0].name} for ${rupees(syntheticBills[0].amountPaise)}, due ${new Date(syntheticBills[0].dueAt).toLocaleDateString("en-IN", { day: "numeric", month: "long" })}.`, data: syntheticBills, intent: "bills" };
  }
  if (/spend|expense|spent|kharch|kitne|total|खर्च|कितना|खर्चा/.test(q)) {
    const total = expenseTotal(rows, month);
    return { answer: hindiPhrases ? `Is mahine aapka total kharch ${rupees(total)} hai, ${rows.filter((t) => t.occurredAt.slice(0, 7) === month && t.kind === "expense").length} synthetic expense records ke hisaab se.` : `Your total spending this month is ${rupees(total)} across ${rows.filter((t) => t.occurredAt.slice(0, 7) === month && t.kind === "expense").length} synthetic expense records.`, data: { month, amountPaise: total }, intent: "spending_summary" };
  }
  return { answer: "I can help with your spending, category breakdown, monthly comparison, subscriptions, bills, EMI schedule, or a reminder. What would you like to check?", data: null, intent: "help" };
}
export {
  answerFinancialQuestion
};
