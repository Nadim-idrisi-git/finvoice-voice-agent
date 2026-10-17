import { Icon } from "../components/Icon";
import { PageHeading } from "../components/PageHeading";
import { categoryEmoji, chartSeries, colors, donutGradient } from "../lib/chart";
import { formatRupees as money } from "../lib/format";
import { billTones, card, cardSubtitle, cardTitle, categoryTones, outlineBtn } from "../lib/ui";

const arrowLink = "border-0 bg-transparent p-0.5 text-[9px] font-semibold text-[#568969]";

export function Overview({ dashboard, categories, total, change, loading, onAsk, onReminder }) {
  const graph = chartSeries(dashboard?.dailySpending ?? [], dashboard?.month ?? new Date().toISOString().slice(0, 7));
  const unusual = dashboard?.unusual[0];
  const top = categories[0];
  const changeTone = change > 0 ? "bg-[#fff1eb] text-[#b25b3d]" : change < 0 ? "bg-[#edf7f0] text-[#35835c]" : "bg-[#f0f1ee] text-[#6b7068]";

  return (
    <>
      <PageHeading
        title="Good morning, Nadim"
        subtitle="Here’s your money at a glance. Your demo data is synthetic."
        action={
          <button className={`${outlineBtn} p-2 sm:px-3 sm:py-[9px]`} onClick={onReminder} aria-label="Set a reminder">
            <Icon name="Bell" size={15} />
            <span className="hidden text-[10px] sm:inline">Set a reminder</span>
          </button>
        }
      />
      <div className="grid grid-cols-1 gap-[11px] xs:gap-3.5 sm:grid-cols-[minmax(0,1.4fr)_minmax(225px,1fr)] md:grid-cols-[minmax(0,1.65fr)_minmax(250px,1fr)] xl:grid-cols-[minmax(0,1.8fr)_minmax(290px,1fr)] xl:gap-[17px]">
        <div className="flex flex-col gap-[11px] xs:gap-3.5 xl:gap-[17px]">
          {/* Total spending */}
          <div className="relative h-[214px] overflow-hidden rounded-[10px] border border-line bg-white px-3.5 pt-[17px] xs:h-[226px] xs:px-[19px] xl:h-[245px]">
            <div className="flex items-center justify-between">
              <span className="text-[8px] font-bold tracking-[0.8px] text-[#818c85]">
                TOTAL SPENDING
                <span className="ml-1 inline-grid size-[11px] place-items-center rounded-full border border-[#bac4bd] text-[7px]">
                  i
                </span>
              </span>
              <span className={`${outlineBtn} px-2 py-1.5 text-[9px]`}>
                This month <Icon name="ChevronDown" size={14} />
              </span>
            </div>
            <div className="mt-3.5 font-display text-[29px] font-bold tracking-[-1px]">{loading ? "…" : money(total)}</div>
            <div className="mt-1 flex items-center gap-2">
              <span className={`flex items-center gap-px rounded px-[5px] py-[3px] text-[9px] font-bold ${changeTone}`}>
                {change > 0 && <Icon name="ArrowUpRight" size={14} />}
                {change < 0 && <Icon name="ArrowDownRight" size={14} />} {Math.abs(change)}%
              </span>
              <span className="text-[9px] text-[#929b95]">
                vs. last month <span className="px-[3px]">·</span>{" "}
                {dashboard ? money(dashboard.previousTotalPaise) : "—"}
              </span>
            </div>
            <div className="absolute inset-x-3.5 bottom-[9px] h-[94px] xs:inset-x-[19px]">
              <svg viewBox="0 0 620 96" preserveAspectRatio="none" className="h-[71px] w-full overflow-visible">
                <defs>
                  <linearGradient id="fill" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0" stopColor="#52b788" stopOpacity=".19" />
                    <stop offset="1" stopColor="#52b788" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d={`${graph.line} L620,88 L0,88 Z`} fill="url(#fill)" />
                <path d={graph.line} fill="none" stroke="#49a779" strokeWidth="2.4" vectorEffect="non-scaling-stroke" />
              </svg>
              <div className="flex justify-between text-[8px] text-[#a4ada7]">
                {graph.labels.map((label) => (
                  <span key={label}>{label}</span>
                ))}
              </div>
            </div>
          </div>

          {/* Spending breakdown */}
          <div className={`${card} min-h-[257px] px-3 py-3.5 xs:px-[18px] xs:py-[17px] xl:min-h-[274px]`}>
            <div className="flex items-start justify-between">
              <div>
                <h3 className={cardTitle}>Spending breakdown</h3>
                <p className={cardSubtitle}>Where your money went this month</p>
              </div>
              <button className={arrowLink} onClick={() => onAsk("Break down my spending by category")}>
                See all <span className="pl-1">→</span>
              </button>
            </div>
            <div className="mt-[17px] grid grid-cols-[91px_1fr] items-center gap-[5px] xs:grid-cols-[140px_1fr] xs:gap-[13px] sm:grid-cols-[112px_1fr] sm:gap-[7px] md:grid-cols-[145px_1fr] md:gap-[13px]">
              <div className="grid place-items-center">
                <div
                  className="relative grid size-[82px] place-items-center rounded-full xs:size-[116px] sm:size-[102px] md:size-[127px]"
                  style={{ background: donutGradient(categories) }}
                >
                  <div className="absolute inset-[15%] rounded-full bg-white" />
                  <div className="relative flex flex-col items-center">
                    <b className="font-display text-[15px] font-bold xs:text-[19px]">{categories.length}</b>
                    <span className="mt-0.5 text-[8px] text-[#8d9891]">categories</span>
                  </div>
                </div>
              </div>
              <div className="grid gap-2.5 xs:gap-3">
                {categories.slice(0, 5).map((c, i) => (
                  <div className="flex items-center gap-[5px] md:gap-2" key={c.category}>
                    <span
                      className={`grid size-5 shrink-0 place-items-center rounded-[7px] text-xs font-bold xs:size-[23px] ${categoryTones[i]}`}
                    >
                      {categoryEmoji(c.category)}
                    </span>
                    <div className="min-w-10 flex-1">
                      <div className="mb-[5px] flex justify-between gap-[5px]">
                        <b className="text-[8px] font-semibold xs:text-[9px]">{c.category}</b>
                        <span className="text-[8px] text-[#929b95]">
                          {total ? Math.round((c.amountPaise / total) * 100) : 0}%
                        </span>
                      </div>
                      <div className="h-[3px] overflow-hidden rounded-[3px] bg-[#f0f2ef]">
                        <i
                          className="block h-full rounded-[3px]"
                          style={{ width: `${total ? (c.amountPaise / total) * 100 : 0}%`, background: colors[i % colors.length] }}
                        />
                      </div>
                    </div>
                    <strong className="text-[8px] font-bold whitespace-nowrap md:text-[9px]">{money(c.amountPaise)}</strong>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-[11px] xs:grid-cols-2 xs:gap-3.5 sm:flex sm:flex-col xl:gap-[17px]">
          {/* Insight */}
          <div className="relative min-h-[166px] overflow-hidden rounded-[10px] border border-[#e1efe4] bg-[#e9f4eb] p-[17px] xs:min-h-[200px] sm:min-h-[202px] xl:min-h-[215px]">
            <div className="flex items-center gap-1.5 text-[8px] font-bold tracking-[0.8px] text-[#548564]">
              <span className="grid size-[21px] place-items-center rounded-md bg-[#d7ebdc]">
                <Icon name="Sparkles" size={14} />
              </span>
              A LITTLE INSIGHT
            </div>
            <h3 className="mt-3.5 mb-[7px] max-w-[260px] font-display text-[15px] leading-[1.35] font-bold tracking-[-0.4px] xs:max-w-[220px]">
              {unusual
                ? "One purchase stands out in these demo records."
                : top
                  ? `${top.category} is your top category this month.`
                  : "A clearer picture starts with your spending."}
            </h3>
            <p className="mb-[11px] max-w-[230px] text-[9px] leading-[1.55] text-[#687b6e]">
              {unusual
                ? `${unusual.merchant} shows ${money(unusual.amountPaise)}, well above its usual ${money(unusual.comparisonPaise)}. This is a review candidate, not a fraud finding.`
                : top
                  ? `You’ve spent ${money(top.amountPaise)} on ${top.category.toLowerCase()} so far. Want to compare it with last month?`
                  : "Keep tracking your synthetic demo spending to see more insights."}
            </p>
            <button
              className="relative z-[1] text-[9px] font-bold text-[#347650]"
              onClick={() => onAsk(unusual ? "Identify unusual spending" : "Compare my expenses with last month")}
            >
              Explore insight <span className="pl-[5px]">→</span>
            </button>
            <div className="absolute -right-[17px] -bottom-[37px] rotate-[-15deg] text-[95px] text-[#d8eadb]">✳</div>
          </div>

          {/* Coming up */}
          <div className={`${card} min-h-[200px] px-4 py-[15px] sm:min-h-[211px] xl:min-h-[224px]`}>
            <div className="flex items-start justify-between">
              <div>
                <h3 className={cardTitle}>Coming up</h3>
                <p className={cardSubtitle}>Your next bills & payments</p>
              </div>
            </div>
            {dashboard?.bills.slice(0, 3).map((bill, i) => (
              <div className="flex items-center gap-2 border-b border-[#f0f2f0] py-[11px]" key={bill.id}>
                <div className={`grid size-[30px] shrink-0 place-items-center rounded-lg ${billTones[i]}`}>
                  <Icon name="CalendarDays" size={17} />
                </div>
                <div className="flex flex-1 flex-col gap-1">
                  <b className="text-[9px]">{bill.name}</b>
                  <span className="text-[8px] text-[#929c96]">
                    Due {new Date(bill.dueAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                  </span>
                </div>
                <strong className="text-[9px]">{money(bill.amountPaise)}</strong>
              </div>
            ))}
            <button className={`${arrowLink} block pt-[11px]`} onClick={() => onAsk("What bills are coming up?")}>
              View all upcoming <span className="pl-1">→</span>
            </button>
          </div>

          {/* Quick actions */}
          <div className="grid grid-cols-2 gap-[9px] xs:col-span-2 sm:col-span-1">
            {[
              { label: "Spending summary", icon: "Wallet", tone: "bg-mint text-[#54916c]", onClick: () => onAsk("How much did I spend this month?") },
              { label: "Set a reminder", icon: "Bell", tone: "bg-[#f4eef8] text-[#9472a1]", onClick: onReminder },
            ].map((qa) => (
              <button
                key={qa.label}
                onClick={qa.onClick}
                className="flex items-center gap-[7px] rounded-lg border border-[#e8ede9] bg-white px-2 py-[9px] text-left"
              >
                <span className={`grid size-6 place-items-center rounded-md ${qa.tone}`}>
                  <Icon name={qa.icon} size={17} />
                </span>
                <b className="flex-1 text-[8px] font-semibold">{qa.label}</b>
                <span className="text-[11px] text-[#9aa49e]">↗</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
