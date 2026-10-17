import { ShieldCheck } from "lucide-react";
import { PageHeading } from "../components/PageHeading";
import { formatRupees as money } from "@finance-agent/shared/format";

export function Subscriptions({ dashboard }) {
  return (
    <>
      <PageHeading
        title="Recurring subscriptions"
        subtitle="Merchants appearing in multiple synthetic months. No cancellation integration is connected."
      />
      <div className="card list-card">
        <div className="card-title-row">
          <div>
            <h3>Your subscriptions</h3>
            <p>Recurring pattern candidates, not confirmed contracts</p>
          </div>
          <span className="demo-pill">{dashboard?.subscriptions.length ?? 0} found</span>
        </div>
        {dashboard?.subscriptions.length ? (
          dashboard.subscriptions.map((s) => (
            <div className="subscription-row" key={s.merchant}>
              <span className="subscription-logo">{s.merchant.slice(0, 1)}</span>
              <div>
                <b>{s.merchant}</b>
                <small>Seen in {s.occurrences} months · synthetic transaction pattern</small>
              </div>
              <strong>
                {money(s.monthlyAmountPaise)}
                <small>/ month avg.</small>
              </strong>
            </div>
          ))
        ) : (
          <div className="empty-state">No recurring subscriptions found in these records.</div>
        )}
      </div>
      <div className="notice-inline">
        <ShieldCheck size={17} /> Finvoice can prepare a cancellation workflow, but cannot cancel real subscriptions in
        this demo.
      </div>
    </>
  );
}
