import { ArrowDownRight, ArrowUpRight, Bell, CalendarDays, ChevronDown, Sparkles, Wallet } from "lucide-react";
import { PageHeading } from "../components/PageHeading";
import { colors, chartSeries, donutGradient, categoryEmoji } from "../lib/chart";
import { formatRupees as money } from "@finance-agent/shared/format";

export function Overview({ dashboard, categories, total, change, loading, onAsk, onReminder }) {
  const graph = chartSeries(dashboard?.dailySpending ?? [], dashboard?.month ?? new Date().toISOString().slice(0, 7));
  return (
    <>
      <PageHeading
        title="Good morning, Nadim"
        subtitle="Here’s your money at a glance. Your demo data is synthetic."
        action={
          <button className="outline-btn" onClick={onReminder}>
            <Bell size={15} /> Set a reminder
          </button>
        }
      />
      <div className="overview-grid">
        <div className="left-column">
          <div className="summary-card">
            <div className="summary-top">
              <span className="summary-label">
                TOTAL SPENDING <span className="info-dot">i</span>
              </span>
              <button className="period-btn">
                This month <ChevronDown size={14} />
              </button>
            </div>
            <div className="summary-amount">{loading ? "\u2026" : money(total)}</div>
            <div className="summary-bottom">
              <span className={`change-pill ${change > 0 ? "up" : change < 0 ? "down" : "flat"}`}>
                {change > 0 ? <ArrowUpRight size={14} /> : change < 0 ? <ArrowDownRight size={14} /> : null}{" "}
                {Math.abs(change)}%
              </span>
              <span className="comparison">
                vs. last month <span className="bullet">·</span>{" "}
                {dashboard ? money(dashboard.previousTotalPaise) : "\u2014"}
              </span>
            </div>
            <div className="sparkline">
              <svg viewBox="0 0 620 96" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="fill" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0" stopColor="#52b788" stopOpacity=".19" />
                    <stop offset="1" stopColor="#52b788" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d={`${graph.line} L620,88 L0,88 Z`} fill="url(#fill)" />
                <path d={graph.line} fill="none" stroke="#49a779" strokeWidth="2.4" vectorEffect="non-scaling-stroke" />
              </svg>
              <div className="chart-labels">
                {graph.labels.map((label) => (
                  <span key={label}>{label}</span>
                ))}
              </div>
            </div>
          </div>
          <div className="card category-card">
            <div className="card-title-row">
              <div>
                <h3>Spending breakdown</h3>
                <p>Where your money went this month</p>
              </div>
              <button className="text-btn" onClick={() => onAsk("Break down my spending by category")}>
                See all <span>→</span>
              </button>
            </div>
            <div className="category-content">
              <div className="donut-wrap">
                <div className="donut" style={{ background: donutGradient(categories) }}>
                  <div>
                    <b>{categories.length}</b>
                    <span>categories</span>
                  </div>
                </div>
              </div>
              <div className="category-list">
                {categories.slice(0, 5).map((c, i) => (
                  <div className="category-line" key={c.category}>
                    <span className={`category-icon ci-${i}`}>{categoryEmoji(c.category)}</span>
                    <div className="category-info">
                      <div>
                        <b>{c.category}</b>
                        <span>{total ? Math.round((c.amountPaise / total) * 100) : 0}%</span>
                      </div>
                      <div className="progress">
                        <i
                          style={{
                            width: `${total ? (c.amountPaise / total) * 100 : 0}%`,
                            background: colors[i % colors.length],
                          }}
                        />
                      </div>
                    </div>
                    <strong>{money(c.amountPaise)}</strong>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="right-column">
          <div className="card insight-card">
            <div className="insight-label">
              <span className="insight-spark">
                <Sparkles size={14} />
              </span>{" "}
              A LITTLE INSIGHT
            </div>
            <h3>
              {dashboard?.unusual[0]
                ? "One purchase stands out in these demo records."
                : categories[0]
                  ? `${categories[0].category} is your top category this month.`
                  : "A clearer picture starts with your spending."}
            </h3>
            <p>
              {dashboard?.unusual[0]
                ? `${dashboard.unusual[0].merchant} shows ${money(dashboard.unusual[0].amountPaise)}, above its synthetic history. This is a review candidate, not a fraud finding.`
                : categories.length
                  ? `You\u2019ve spent ${categories[0] ? money(categories[0].amountPaise) : "\u2014"} on ${categories[0]?.category.toLowerCase()} so far. Want to compare it with last month?`
                  : "Keep tracking your synthetic demo spending to see more insights."}
            </p>
            <button
              onClick={() =>
                onAsk(dashboard?.unusual[0] ? "Identify unusual spending" : "Compare my expenses with last month")
              }
            >
              Explore insight <span>→</span>
            </button>
            <div className="insight-decoration">✳</div>
          </div>
          <div className="card upcoming-card">
            <div className="card-title-row">
              <div>
                <h3>Coming up</h3>
                <p>Your next bills & payments</p>
              </div>
              <button className="dots-btn" aria-label="More upcoming items">
                ···
              </button>
            </div>
            {dashboard?.bills.slice(0, 3).map((bill, i) => (
              <div className="upcoming-row" key={bill.id}>
                <div className={`bill-icon bi-${i}`}>
                  <CalendarDays size={17} />
                </div>
                <div className="bill-info">
                  <b>{bill.name}</b>
                  <span>
                    Due {new Date(bill.dueAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                  </span>
                </div>
                <strong>{money(bill.amountPaise)}</strong>
              </div>
            ))}
            <button className="view-all" onClick={() => onAsk("What bills are coming up?")}>
              View all upcoming <span>→</span>
            </button>
          </div>
          <div className="quick-actions">
            <button onClick={() => onAsk("How much did I spend this month?")}>
              <span className="qa-icon qa-mint">
                <Wallet size={17} />
              </span>
              <b>Spending summary</b>
              <span className="qa-arrow">↗</span>
            </button>
            <button onClick={onReminder}>
              <span className="qa-icon qa-lavender">
                <Bell size={17} />
              </span>
              <b>Set a reminder</b>
              <span className="qa-arrow">↗</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
