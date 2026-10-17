import { Bell, X } from "lucide-react";
import { formatRupees as money } from "@finance-agent/shared/format";

export function ReminderModal({ bill, onClose, onCreate }) {
  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="action-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button className="modal-close" onClick={onClose} aria-label="Close">
          <X size={18} />
        </button>
        <div className="modal-icon">
          <Bell size={20} />
        </div>
        <span className="section-kicker">ACTION PROPOSAL</span>
        <h2 id="action-title">Set a bill reminder?</h2>
        <p>
          Finvoice will add a reminder two days before your next synthetic bill. This is an in-app demo reminder; it
          will not send a notification outside this app.
        </p>
        <div className="action-detail">
          <b>Next bill</b>
          <span>
            {bill?.name ?? "Upcoming bill"} · {bill ? money(bill.amountPaise) : "\u2014"}
          </span>
        </div>
        <div className="modal-buttons">
          <button className="secondary-btn" onClick={onClose}>
            Cancel
          </button>
          <button className="primary-btn" onClick={onCreate}>
            Create proposal
          </button>
        </div>
      </section>
    </div>
  );
}
