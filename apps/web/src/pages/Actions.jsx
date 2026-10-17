import { Bell, Check, FileClock, ShieldCheck } from "lucide-react";
import { PageHeading } from "../components/PageHeading";

export function Actions({ actions, onConfirm, onRefresh, onCreate }) {
  return (
    <>
      <PageHeading
        title="Actions & reminders"
        subtitle="Review proposals and see what Finvoice recorded."
        action={
          <button className="primary-btn" onClick={onCreate}>
            <Bell size={15} /> New reminder
          </button>
        }
      />
      <div className="card list-card action-list">
        <div className="card-title-row">
          <div>
            <h3>Action history</h3>
            <p>Every action requires explicit confirmation.</p>
          </div>
          <button className="text-btn" onClick={onRefresh}>
            Refresh ↻
          </button>
        </div>
        {actions.length ? (
          actions.map((a) => (
            <div className="action-row" key={a.id}>
              <span className={`action-state ${a.status === "SUCCEEDED" ? "done" : ""}`}>
                {a.status === "SUCCEEDED" ? <Check size={14} /> : <FileClock size={14} />}
              </span>
              <div className="action-copy">
                <b>{a.title}</b>
                <p>{a.details}</p>
                <small>
                  {a.type.replace("_", " ")} · {new Date(a.createdAt).toLocaleString()}
                </small>
              </div>
              <div className="action-end">
                <span className={`status-badge ${a.status === "SUCCEEDED" ? "success" : ""}`}>
                  {a.status.replace("_", " ")}
                </span>
                {a.status === "AWAITING_CONFIRMATION" && (
                  <button className="primary-btn compact" onClick={() => onConfirm(a.id)}>
                    Confirm
                  </button>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="empty-state">No actions yet. Create a reminder proposal to get started.</div>
        )}
      </div>
      <div className="notice-inline">
        <ShieldCheck size={17} /> Confirmation applies only to this exact demo action. External payments and
        subscription changes are unavailable.
      </div>
    </>
  );
}
