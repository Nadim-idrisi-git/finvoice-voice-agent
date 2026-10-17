import { Router } from "express";
import { isValidMonth } from "@finance-agent/shared/format";
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
} from "../modules/analytics.js";
import { HttpError } from "../http.js";
import { loadFinance } from "../store/finance.js";

// Read-only, owner-scoped views over the user's financial records.
export function financeRoutes({ store }) {
  const router = Router();
  const data = (res) => loadFinance(store, res.locals.user.id);

  router.get("/session", (_req, res) => res.json({ user: res.locals.user, mode: "synthetic-demo" }));

  router.get("/dashboard", async (_req, res) => {
    const { transactions, bills, emis } = await data(res);
    const month = currentMonth();
    const inMonth = transactions.filter((t) => t.occurredAt.slice(0, 7) === month);
    const compare = compareMonths(transactions, month, previousMonth(month));
    const dayTotals = new Map();
    for (const tx of inMonth) {
      if (tx.kind !== "expense") continue;
      const day = Number(tx.occurredAt.slice(8, 10));
      dayTotals.set(day, (dayTotals.get(day) ?? 0) + tx.amountPaise);
    }
    res.json({
      user: res.locals.user,
      month,
      totalPaise: compare.currentPaise,
      previousTotalPaise: compare.previousPaise,
      changePercent: compare.changePercent,
      categories: categoryTotals(transactions, month),
      transactions: [...inMonth].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)).slice(0, 8),
      dailySpending: [...dayTotals].sort((a, b) => a[0] - b[0]).map(([day, amountPaise]) => ({ day, amountPaise })),
      unusual: unusualSpending(transactions),
      subscriptions: recurringSubscriptions(transactions),
      bills,
      emis,
      synthetic: true,
    });
  });

  router.get("/analytics/summary", async (_req, res) => {
    const { transactions } = await data(res);
    const month = currentMonth();
    res.json({ month, totalPaise: expenseTotal(transactions, month), incomePaise: incomeTotal(transactions, month) });
  });
  router.get("/analytics/categories", async (_req, res) =>
    res.json(categoryTotals((await data(res)).transactions, currentMonth())),
  );
  router.get("/analytics/month", async (req, res) => {
    const month = req.query.month;
    if (!isValidMonth(month)) throw new HttpError(400, "A valid YYYY-MM month is required.");
    const { transactions } = await data(res);
    res.json({ month, totalPaise: expenseTotal(transactions, month), categories: categoryTotals(transactions, month) });
  });
  router.get("/analytics/compare", async (_req, res) =>
    res.json(compareMonths((await data(res)).transactions, currentMonth(), previousMonth(currentMonth()))),
  );
  router.get("/analytics/merchants", async (_req, res) =>
    res.json(merchantTotals((await data(res)).transactions, currentMonth())),
  );
  router.get("/analytics/unusual", async (_req, res) => res.json(unusualSpending((await data(res)).transactions)));
  router.get("/subscriptions", async (_req, res) => res.json(recurringSubscriptions((await data(res)).transactions)));
  router.get("/bills", async (_req, res) => res.json(await store.bills(res.locals.user.id)));
  router.get("/emis", async (_req, res) => res.json(await store.emis(res.locals.user.id)));
  router.get("/audit", async (_req, res) => res.json(await store.audit.list(res.locals.user.id)));
  router.get("/reminders", async (_req, res) => res.json(await store.reminders.list(res.locals.user.id)));
  router.get("/alerts", async (_req, res) => res.json(await store.alerts.list(res.locals.user.id)));

  return router;
}
