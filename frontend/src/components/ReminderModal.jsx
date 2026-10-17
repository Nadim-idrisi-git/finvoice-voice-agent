import { Icon } from "./Icon";
import { formatRupees as money } from "../lib/format";
import { primaryBtn, secondaryBtn } from "../lib/ui";

export function ReminderModal({ bill, onClose, onCreate }) {
  return (
    <div className="fixed inset-0 z-20 grid place-items-center bg-[#14221ab0] p-4" role="presentation" onClick={onClose}>
      <section
        className="relative w-full max-w-[410px] rounded-[13px] bg-white p-6 shadow-[0_20px_80px_#14221a38]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="action-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button className="absolute top-3.5 right-3.5 text-[#7d8981]" onClick={onClose} aria-label="Close">
          <Icon name="X" size={18} />
        </button>
        <div className="mb-4 grid size-[39px] place-items-center rounded-[11px] bg-mint text-[#3b8258]">
          <Icon name="Bell" size={20} />
        </div>
        <span className="text-[8px] font-bold tracking-[1px] text-[#559270]">ACTION PROPOSAL</span>
        <h2 id="action-title" className="mt-1 mb-[9px] font-display text-lg font-bold">
          Set a bill reminder?
        </h2>
        <p className="mb-4 text-[10px] leading-[1.65] text-[#718077]">
          Finvoice will add a reminder two days before your next synthetic bill. This is an in-app demo reminder; it
          will not send a notification outside this app.
        </p>
        <div className="flex flex-col gap-[5px] rounded-lg bg-[#f6f8f5] p-3 text-[9px]">
          <b>Next bill</b>
          <span className="text-[#68766e]">
            {bill?.name ?? "Upcoming bill"} · {bill ? money(bill.amountPaise) : "—"}
          </span>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button className={secondaryBtn} onClick={onClose}>
            Cancel
          </button>
          <button className={primaryBtn} onClick={onCreate}>
            Create proposal
          </button>
        </div>
      </section>
    </div>
  );
}
