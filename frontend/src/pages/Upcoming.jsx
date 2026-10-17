import { Icon } from "../components/Icon";
import { PageHeading } from "../components/PageHeading";
import { formatRupees as money } from "../lib/format";
import { billTones, card, cardTitle } from "../lib/ui";

const date = (iso, month) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month });

function PaymentRow({ icon, tone, title, note, amountPaise }) {
  return (
    <div className="flex items-center gap-3 border-t border-line-soft py-[13px]">
      <span className={`grid size-[30px] shrink-0 place-items-center rounded-lg ${tone}`}>
        <Icon name={icon} size={17} />
      </span>
      <div className="flex flex-1 flex-col gap-1">
        <b className="text-[10px]">{title}</b>
        <small className="text-[8px] text-[#939d96]">{note}</small>
      </div>
      <strong className="text-[10px]">{money(amountPaise)}</strong>
    </div>
  );
}

export function Upcoming({ dashboard }) {
  return (
    <>
      <PageHeading title="Upcoming payments" subtitle="Bills and EMI schedules from your synthetic demo records." />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-[13px]">
        <div className={`${card} p-[19px]`}>
          <h3 className={`${cardTitle} mb-3`}>Upcoming bills</h3>
          {dashboard?.bills.map((b) => (
            <PaymentRow
              key={b.id}
              icon="CalendarDays"
              tone={billTones[0]}
              title={b.name}
              note={`Due ${date(b.dueAt, "long")}`}
              amountPaise={b.amountPaise}
            />
          ))}
        </div>
        <div className={`${card} p-[19px]`}>
          <h3 className={`${cardTitle} mb-3`}>EMI schedule</h3>
          {dashboard?.emis.map((e) => (
            <PaymentRow
              key={e.id}
              icon="CreditCard"
              tone={billTones[2]}
              title={e.name}
              note={`Next ${date(e.nextDueAt, "short")} · ${e.remainingInstallments} left`}
              amountPaise={e.installmentPaise}
            />
          ))}
        </div>
      </div>
    </>
  );
}
