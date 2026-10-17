import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { PageHeading } from "../components/PageHeading";
import { colors, categoryEmoji } from "../lib/chart";
import { api } from "../services/api";
import { currentMonth, formatRupees as money, monthName, previousMonth } from "@finance-agent/shared/format";

export function Analytics({ dashboard, tab, setTab }) {
  const [previous, setPrevious] = useState(null);
  const currentMonthValue = dashboard?.month ?? currentMonth();
  const previousMonthValue = previousMonth(currentMonthValue);
  useEffect(() => {
    if (tab === "Last month") {
      void api
        .analyticsMonth(previousMonthValue)
        .then(setPrevious)
        .catch(() => setPrevious(null));
    }
  }, [tab, previousMonthValue]);
  const shown = tab === "Last month" ? previous : null;
  const categories = shown?.categories ?? dashboard?.categories ?? [];
  const total = shown?.totalPaise ?? dashboard?.totalPaise ?? 0;
  const label = shown?.month ?? currentMonthValue;
  return (
    <>
      <PageHeading
        title="Your spending, in focus"
        subtitle="Explore the patterns behind your everyday spending."
        action={
          <button className="period-btn">
            {monthName(label)}
            <ChevronDown size={14} />
          </button>
        }
      />
      <div className="tab-switch">
        {["This month", "Last month"].map((t) => (
          <button className={t === tab ? "active" : ""} key={t} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>
      <div className="analytics-kpis">
        <div className="card kpi">
          <span>Total expenses</span>
          <b>{tab === "Last month" && !previous ? "\u2026" : money(total)}</b>
          <small>{label} synthetic records</small>
        </div>
        <div className="card kpi">
          <span>Top category</span>
          <b>{categories[0]?.category ?? "\u2014"}</b>
          <small>{categories[0] ? money(categories[0].amountPaise) : "No expense records"}</small>
        </div>
        <div className="card kpi">
          <span>Categories</span>
          <b>{categories.length}</b>
          <small>Calculated from recorded expenses</small>
        </div>
      </div>
      <div className="card analytics-card">
        <div className="card-title-row">
          <div>
            <h3>Category breakdown</h3>
            <p>Amounts are calculated from synthetic transaction records.</p>
          </div>
        </div>
        {categories.map((c, i) => (
          <div className="analytics-category" key={c.category}>
            <div>
              <span className={`category-icon ci-${i}`}>{categoryEmoji(c.category)}</span>
              <b>{c.category}</b>
              <span>{total ? Math.round((c.amountPaise / total) * 100) : 0}%</span>
            </div>
            <strong>{money(c.amountPaise)}</strong>
            <div className="progress">
              <i
                style={{
                  width: `${total ? (c.amountPaise / total) * 100 : 0}%`,
                  background: colors[i % colors.length],
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
