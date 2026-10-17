import {
  Activity,
  AudioLines,
  CalendarDays,
  ChevronDown,
  CreditCard,
  FileClock,
  LayoutDashboard,
  MoreHorizontal,
  Settings,
  ShieldCheck,
} from "lucide-react";

export const nav = [
  { label: "Overview", icon: LayoutDashboard },
  { label: "Analytics", icon: Activity },
  { label: "Subscriptions", icon: CreditCard },
  { label: "Upcoming", icon: CalendarDays },
  { label: "Actions", icon: FileClock },
  { label: "Settings", icon: Settings },
];

export function Sidebar({ active, onSelect, hasPendingActions }) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-icon">
          <AudioLines size={18} />
        </span>
        <span>
          finvoice<span className="brand-dot">.</span>
        </span>
      </div>
      <div className="workspace-label">WORKSPACE</div>
      <div className="profile-chip">
        <div className="avatar">NI</div>
        <div className="profile-name">
          <b>Nadim Idrisi</b>
          <small>Personal account</small>
        </div>
        <ChevronDown size={15} className="muted" />
      </div>
      <div className="nav-caption">YOUR MONEY</div>
      <nav>
        {nav.map(({ label, icon: Icon }) => (
          <button
            key={label}
            aria-label={label}
            aria-current={active === label ? "page" : void 0}
            className={`nav-item ${active === label ? "selected" : ""}`}
            onClick={() => onSelect(label)}
          >
            <Icon size={17} />
            <span>{label}</span>
            {label === "Actions" && hasPendingActions && <i className="nav-badge" />}
          </button>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <div className="privacy-card">
          <ShieldCheck size={17} />
          <div>
            <b>Synthetic demo data</b>
            <span>No real bank account connected</span>
          </div>
        </div>
        <div className="sidebar-footer">
          <span className="avatar tiny">NI</span>
          <div>
            <b>Nadim Idrisi</b>
            <small>Free plan · Demo</small>
          </div>
          <MoreHorizontal size={18} />
        </div>
      </div>
    </aside>
  );
}
