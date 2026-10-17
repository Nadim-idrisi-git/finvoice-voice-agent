import { useEffect, useState } from "react";
import { Icon } from "../components/Icon";
import { PageHeading } from "../components/PageHeading";
import { categoryEmoji, colors } from "../lib/chart";
import { currentMonth, formatRupees as money, monthName, previousMonth } from "../lib/format";
import { api } from "../services/api";
import { card, cardSubtitle, cardTitle, categoryTones, outlineBtn } from "../lib/ui";

const kpiLabel = "text-[8px] text-[#87928b] sm:text-[9px]";

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
  const kpis = [
    { title: "Total expenses", value: tab === "Last month" && !previous ? "…" : money(total), note: `${label} synthetic records` },
    {
      title: "Top category",
      value: categories[0]?.category ?? "—",
      note: categories[0] ? money(categories[0].amountPaise) : "No expense records",
    },
    { title: "Categories", value: categories.length, note: "Calculated from recorded expenses" },
  ];

  return (
    <>
      <PageHeading
        title="Your spending, in focus"
        subtitle="Explore the patterns behind your everyday spending."
        action={
          <span className={`${outlineBtn} p-[7px] text-[8px] xs:px-2 xs:py-1.5 xs:text-[9px]`}>
            {monthName(label)}
            <Icon name="ChevronDown" size={14} />
          </span>
        }
      />
      <div className="mb-[15px] flex w-max gap-[3px] rounded-[7px] bg-[#eff2ef] p-[3px]" role="tablist">
        {["This month", "Last month"].map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={t === tab}
            onClick={() => setTab(t)}
            className={`rounded-[5px] px-3 py-[7px] text-[9px] ${
              t === tab ? "bg-white text-[#355e45] shadow-[0_1px_3px_#15261b12]" : "text-[#78847c]"
            }`}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="mb-3.5 grid grid-cols-1 gap-[7px] xs:grid-cols-3 sm:gap-3">
        {kpis.map((kpi) => (
          <div key={kpi.title} className={`${card} flex flex-col gap-2 p-3 sm:px-[18px] sm:py-[17px]`}>
            <span className={kpiLabel}>{kpi.title}</span>
            <b className="font-display text-[15px] font-bold sm:text-[19px]">{kpi.value}</b>
            <small className={kpiLabel}>{kpi.note}</small>
          </div>
        ))}
      </div>
      <div className={`${card} px-5 py-[18px]`}>
        <h3 className={cardTitle}>Category breakdown</h3>
        <p className={cardSubtitle}>Amounts are calculated from synthetic transaction records.</p>
        {categories.map((c, i) => (
          <div className="mt-[19px] grid grid-cols-[1fr_auto] items-center gap-x-[15px] gap-y-[9px]" key={c.category}>
            <div className="flex items-center gap-[9px]">
              <span
                className={`grid size-[23px] shrink-0 place-items-center rounded-[7px] text-xs font-bold ${categoryTones[i % categoryTones.length]}`}
              >
                {categoryEmoji(c.category)}
              </span>
              <b className="text-[10px]">{c.category}</b>
              <span className="ml-auto text-[9px] text-[#94a098]">
                {total ? Math.round((c.amountPaise / total) * 100) : 0}%
              </span>
            </div>
            <strong className="text-[10px]">{money(c.amountPaise)}</strong>
            <div className="col-span-full h-[5px] overflow-hidden rounded-[3px] bg-[#f0f2ef]">
              <i
                className="block h-full rounded-[3px]"
                style={{ width: `${total ? (c.amountPaise / total) * 100 : 0}%`, background: colors[i % colors.length] }}
              />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
