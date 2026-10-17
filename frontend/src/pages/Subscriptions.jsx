import { Icon } from "../components/Icon";
import { PageHeading } from "../components/PageHeading";
import { formatRupees as money } from "../lib/format";
import { card, cardSubtitle, cardTitle, emptyState, listRow, noticeInline } from "../lib/ui";

export function Subscriptions({ dashboard }) {
  const subscriptions = dashboard?.subscriptions ?? [];
  return (
    <>
      <PageHeading
        title="Recurring payments"
        subtitle="Autopays, mandates, and SIPs found in your bank SMS and investment records. No cancellation integration is connected."
      />
      <div className={`${card} mt-4 p-[19px]`}>
        <div className="mb-[7px] flex items-start justify-between">
          <div>
            <h3 className={cardTitle}>Who debits you regularly</h3>
            <p className={cardSubtitle}>From mandates and autopay SMS; amounts are totals over the last 30 days</p>
          </div>
          <span className="rounded-full border border-[#e4ebe5] px-2.5 py-1.5 text-[9px] font-semibold whitespace-nowrap text-[#68766e]">
            {subscriptions.length} found
          </span>
        </div>
        {subscriptions.length ? (
          subscriptions.map((s) => (
            <div className={`${listRow} gap-2 xs:gap-3`} key={s.merchant}>
              <span className="grid size-[35px] shrink-0 place-items-center rounded-[10px] bg-mint font-bold text-[#38805a]">
                {s.merchant.slice(0, 1)}
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <b className="text-[10px]">{s.merchant}</b>
                <small className="text-[8px] leading-snug text-[#939d96]">
                  {s.kind
                    ? `${s.kind} · about ${Math.round(s.perWeek * 10) / 10} times a week${s.accounts?.length ? ` · from account ${s.accounts.join(", ")}` : ""}`
                    : `Seen in ${s.occurrences} months · synthetic transaction pattern`}
                </small>
              </div>
              <strong className="flex flex-col items-end gap-[3px] text-[10px]">
                {money(s.last30DaysPaise ?? s.typicalAmountPaise ?? s.monthlyAmountPaise)}
                <small className="text-[8px] font-normal text-[#939d96]">
                  {s.last30DaysPaise != null ? "last 30 days" : s.typicalAmountPaise != null ? "per debit" : "/ month avg."}
                </small>
              </strong>
            </div>
          ))
        ) : (
          <div className={emptyState}>No recurring subscriptions found in these records.</div>
        )}
      </div>
      <div className={noticeInline}>
        <Icon name="ShieldCheck" size={17} /> Finvoice can prepare a cancellation workflow, but cannot cancel real
        subscriptions in this demo.
      </div>
    </>
  );
}
