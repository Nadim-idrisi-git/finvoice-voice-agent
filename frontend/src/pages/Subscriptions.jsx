import { Icon } from "../components/Icon";
import { PageHeading } from "../components/PageHeading";
import { formatRupees as money } from "../lib/format";
import { card, cardSubtitle, cardTitle, emptyState, listRow, noticeInline } from "../lib/ui";

export function Subscriptions({ dashboard }) {
  const subscriptions = dashboard?.subscriptions ?? [];
  return (
    <>
      <PageHeading
        title="Recurring subscriptions"
        subtitle="Merchants appearing in multiple synthetic months. No cancellation integration is connected."
      />
      <div className={`${card} mt-4 p-[19px]`}>
        <div className="mb-[7px] flex items-start justify-between">
          <div>
            <h3 className={cardTitle}>Your subscriptions</h3>
            <p className={cardSubtitle}>Recurring pattern candidates, not confirmed contracts</p>
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
                  Seen in {s.occurrences} months · synthetic transaction pattern
                </small>
              </div>
              <strong className="flex flex-col items-end gap-[3px] text-[10px]">
                {money(s.monthlyAmountPaise)}
                <small className="text-[8px] font-normal text-[#939d96]">/ month avg.</small>
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
