import { CalendarDays, CreditCard } from "lucide-react";
import { PageHeading } from "../components/PageHeading";
import { formatRupees as money } from "@finance-agent/shared/format";

export function Upcoming({ dashboard }) {
  return (
    <>
      <PageHeading title="Upcoming payments" subtitle="Bills and EMI schedules from your synthetic demo records." />
      <div className="upcoming-columns">
        <div className="card list-card">
          <h3>Upcoming bills</h3>
          {dashboard?.bills.map((b) => (
            <div className="payment-row" key={b.id}>
              <span className="bill-icon">
                <CalendarDays size={17} />
              </span>
              <div>
                <b>{b.name}</b>
                <small>Due {new Date(b.dueAt).toLocaleDateString("en-IN", { day: "numeric", month: "long" })}</small>
              </div>
              <strong>{money(b.amountPaise)}</strong>
            </div>
          ))}
        </div>
        <div className="card list-card">
          <h3>EMI schedule</h3>
          {dashboard?.emis.map((e) => (
            <div className="payment-row" key={e.id}>
              <span className="bill-icon bi-2">
                <CreditCard size={17} />
              </span>
              <div>
                <b>{e.name}</b>
                <small>
                  Next {new Date(e.nextDueAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} ·{" "}
                  {e.remainingInstallments} left
                </small>
              </div>
              <strong>{money(e.installmentPaise)}</strong>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
