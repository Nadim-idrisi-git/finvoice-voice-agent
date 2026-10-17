import { Icon } from "./Icon";

export const nav = [
  { label: "Overview", icon: "LayoutDashboard" },
  { label: "Analytics", icon: "Activity" },
  { label: "Subscriptions", icon: "CreditCard" },
  { label: "Upcoming", icon: "CalendarDays" },
  { label: "Actions", icon: "FileClock" },
  { label: "Settings", icon: "Settings" },
];

const caption = "mb-2.5 hidden px-2 text-[9px] font-bold tracking-[1.1px] text-faint sm:block";
const avatar = "grid shrink-0 place-items-center rounded-full bg-[#eadcc8] font-bold text-[#765a3a]";

/** Collapses to an icon rail below 760px. */
export function Sidebar({ active, onSelect, hasPendingActions }) {
  return (
    <aside className="fixed inset-y-0 left-0 z-10 flex w-[62px] flex-col border-r border-line bg-white px-2 py-[17px] sm:w-[205px] sm:px-[17px] sm:pt-[25px] sm:pb-[13px] md:w-[244px]">
      <div className="flex items-center gap-[9px] px-2 pb-[27px] font-display text-[21px] font-extrabold tracking-[-1px] sm:px-[7px] sm:pb-[35px]">
        <span className="grid size-[29px] shrink-0 place-items-center rounded-[9px] bg-brand text-white">
          <Icon name="AudioLines" size={18} />
        </span>
        <span className="hidden sm:inline">
          finvoice<span className="text-[#55b581]">.</span>
        </span>
      </div>
      <div className={caption}>WORKSPACE</div>
      <div className="mb-[31px] hidden h-[57px] items-center gap-2.5 rounded-[9px] border border-[#edf0ed] p-2 sm:flex">
        <div className={`${avatar} size-[33px] text-[11px]`}>NI</div>
        <div className="flex flex-1 flex-col gap-[3px]">
          <b className="text-[11px]">Nadim Idrisi</b>
          <small className="text-[9px] text-[#89948e]">Personal account</small>
        </div>
        <Icon name="ChevronDown" size={15} className="text-faint" />
      </div>
      <div className={caption}>YOUR MONEY</div>
      <nav className="mt-3 grid gap-[3px] sm:mt-0">
        {nav.map(({ label, icon }) => {
          const selected = active === label;
          return (
            <button
              key={label}
              aria-label={label}
              aria-current={selected ? "page" : undefined}
              onClick={() => onSelect(label)}
              className={`relative flex h-[42px] items-center justify-center gap-3 rounded-[7px] text-left text-[11px] font-semibold sm:h-10 sm:justify-start sm:px-2.5 ${
                selected ? "bg-mint text-[#236b4d]" : "text-[#65716b] hover:bg-[#f5f7f5]"
              }`}
            >
              <Icon name={icon} size={17} className={selected ? "text-brand" : "text-[#849088]"} />
              <span className="hidden sm:inline">{label}</span>
              {label === "Actions" && hasPendingActions && (
                <i className="ml-auto hidden size-1.5 rounded-full bg-[#55b581] sm:block" />
              )}
            </button>
          );
        })}
      </nav>
      <div className="mt-auto flex flex-col">
        <div className="mb-[15px] hidden items-center gap-2.5 rounded-lg bg-[#f2f8f3] px-2.5 py-3 text-[#478264] sm:flex">
          <Icon name="ShieldCheck" size={17} />
          <div className="flex flex-col gap-1">
            <b className="text-[10px] text-[#3d5547]">Synthetic demo data</b>
            <span className="text-[9px] text-[#819389]">No real bank account connected</span>
          </div>
        </div>
        <div className="flex h-[47px] items-center justify-center gap-[9px] border-t border-[#edf0ed] px-0.5 pt-2.5 text-[#87928c] sm:justify-start">
          <span className={`${avatar} size-[29px] text-[11px]`}>NI</span>
          <div className="hidden flex-1 flex-col gap-[3px] sm:flex">
            <b className="text-[11px] text-ink">Nadim Idrisi</b>
            <small className="text-[9px] text-[#89948e]">Free plan · Demo</small>
          </div>
          <Icon name="MoreHorizontal" size={18} className="ml-auto hidden sm:block" />
        </div>
      </div>
    </aside>
  );
}
