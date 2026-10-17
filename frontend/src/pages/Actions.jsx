import { Icon } from "../components/Icon";
import { PageHeading } from "../components/PageHeading";
import { card, cardSubtitle, cardTitle, emptyState, noticeInline, primaryBtn } from "../lib/ui";

export function Actions({ actions, onConfirm, onRefresh, onCreate }) {
  return (
    <>
      <PageHeading
        title="Actions & reminders"
        subtitle="Review proposals and see what Finvoice recorded."
        action={
          <button className={primaryBtn} onClick={onCreate}>
            <Icon name="Bell" size={15} /> New reminder
          </button>
        }
      />
      <div className={`${card} mt-4 p-[19px]`}>
        <div className="mb-[7px] flex items-start justify-between">
          <div>
            <h3 className={cardTitle}>Action history</h3>
            <p className={cardSubtitle}>Every action requires explicit confirmation.</p>
          </div>
          <button className="p-0.5 text-[9px] font-semibold text-[#568969]" onClick={onRefresh}>
            Refresh ↻
          </button>
        </div>
        {actions.length ? (
          actions.map((a) => {
            const done = a.status === "SUCCEEDED";
            return (
              <div className="flex items-start gap-2 border-t border-line-soft px-0.5 py-3.5 sm:gap-3" key={a.id}>
                <span
                  className={`grid size-7 shrink-0 place-items-center rounded-full ${done ? "bg-mint text-[#42845e]" : "bg-[#fff5e5] text-[#a9803d]"}`}
                >
                  <Icon name={done ? "Check" : "FileClock"} size={14} />
                </span>
                <div className="flex-1">
                  <b className="text-[10px]">{a.title}</b>
                  <p className="my-[5px] text-[9px] leading-snug whitespace-pre-line text-[#68756d]">{a.details}</p>
                  <small className="text-[8px] text-[#939d96]">
                    {a.type.replace("_", " ")} · {new Date(a.createdAt).toLocaleString()}
                  </small>
                </div>
                <div className="grid max-w-[90px] justify-items-end gap-[7px] xs:max-w-none">
                  <span
                    className={`rounded-[10px] px-[7px] py-[5px] text-center text-[7px] font-bold tracking-[0.3px] sm:text-[8px] ${
                      done ? "bg-mint text-[#398057]" : "bg-[#fff4e4] text-[#9a793f]"
                    }`}
                  >
                    {a.status.replace("_", " ")}
                  </span>
                  {a.status === "AWAITING_CONFIRMATION" && (
                    <button className={`${primaryBtn} px-2.5 py-[7px] text-[8px]`} onClick={() => onConfirm(a.id)}>
                      Confirm
                    </button>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <div className={emptyState}>No actions yet. Create a reminder proposal to get started.</div>
        )}
      </div>
      <div className={noticeInline}>
        <Icon name="ShieldCheck" size={17} /> Confirmation applies only to this exact demo action. External payments and
        subscription changes are unavailable.
      </div>
    </>
  );
}
