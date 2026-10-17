import { useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";
import { formatRupees as money } from "../lib/format";

const SEEN_KEY = "finvoice.seenNotifications";
const shortDate = (iso) =>
  new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });

function readSeen() {
  try {
    return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) ?? "[]"));
  } catch {
    return new Set();
  }
}

// Builds the notification list from data the app already has: this week's findings,
// actions waiting for confirmation, recently confirmed actions, and the next bills.
function buildNotifications(dashboard, actions) {
  const items = [];
  for (const a of actions.filter((a) => a.status === "AWAITING_CONFIRMATION")) {
    items.push({ id: `action-${a.id}`, icon: "FileClock", tone: "bg-[#fff4e5] text-[#b5772a]", title: `Confirm: ${a.title}`, body: "Waiting for your confirmation.", page: "Actions" });
  }
  (dashboard?.briefing?.topFindings ?? []).forEach((f, i) => {
    items.push({ id: `finding-${i}-${f.title}`, icon: "Sparkles", tone: "bg-mint text-[#3b8258]", title: f.title, body: f.whyItMatters, page: "Overview" });
  });
  for (const b of (dashboard?.bills ?? []).slice(0, 3)) {
    items.push({ id: `bill-${b.id}`, icon: "CalendarDays", tone: "bg-[#eef3fb] text-[#4f6fa3]", title: `${b.name}: ${money(b.amountPaise)}`, body: `${new Date(b.dueAt) < new Date() ? "Was due" : "Due"} ${shortDate(b.dueAt)}`, page: "Upcoming" });
  }
  for (const a of actions.filter((a) => a.status === "SUCCEEDED").slice(0, 3)) {
    items.push({ id: `done-${a.id}`, icon: "Check", tone: "bg-[#edf7ef] text-[#397752]", title: a.title, body: `Confirmed${a.confirmedAt ? ` on ${shortDate(a.confirmedAt)}` : ""}.`, page: "Actions" });
  }
  return items;
}

export function NotificationsMenu({ dashboard, actions, onOpenPage }) {
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState(readSeen);
  const ref = useRef(null);
  const items = buildNotifications(dashboard, actions);
  const unread = items.filter((n) => !seen.has(n.id)).length;

  useEffect(() => {
    if (!open) return;
    const onClick = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function markSeen(ids) {
    const next = new Set([...seen, ...ids]);
    setSeen(next);
    try {
      localStorage.setItem(SEEN_KEY, JSON.stringify([...next]));
    } catch {
      // Storage can be unavailable (private mode); read state then lasts only for this visit.
    }
  }

  function select(n) {
    markSeen([n.id]);
    setOpen(false);
    onOpenPage(n.page);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        className="relative p-[3px] text-[#79847e] xs:p-[5px]"
        aria-label={`Notifications${unread ? ` (${unread} unread)` : ""}`}
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <Icon name="Bell" size={18} />
        {unread > 0 && <i className="absolute top-1 right-1 size-1.5 rounded-full bg-[#55b581]" />}
      </button>
      {open && (
        <section className="absolute top-full right-[-40px] z-30 mt-2 w-[calc(100vw-80px)] max-w-[340px] overflow-hidden rounded-[11px] border border-[#e8ece8] bg-white shadow-[0_16px_50px_#14221a26] xs:right-0">
          <div className="flex items-center justify-between border-b border-[#eef1ee] px-4 py-3">
            <b className="text-[11px] text-[#26312b]">
              Notifications{unread > 0 && <span className="ml-1.5 font-semibold text-[#55b581]">{unread} new</span>}
            </b>
            {unread > 0 && (
              <button className="text-[9px] font-semibold text-[#559270]" onClick={() => markSeen(items.map((n) => n.id))}>
                Mark all read
              </button>
            )}
          </div>
          {items.length === 0 ? (
            <p className="px-4 py-6 text-center text-[10px] text-[#929c96]">You're all caught up.</p>
          ) : (
            <ul className="max-h-[380px] overflow-y-auto">
              {items.map((n) => (
                <li key={n.id}>
                  <button
                    className={`flex w-full gap-3 border-b border-[#f3f5f2] px-4 py-3 text-left hover:bg-[#f8faf7] ${seen.has(n.id) ? "opacity-60" : ""}`}
                    onClick={() => select(n)}
                  >
                    <span className={`grid size-7 shrink-0 place-items-center rounded-lg ${n.tone}`}>
                      <Icon name={n.icon} size={14} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[10px] leading-snug font-semibold text-[#26312b]">{n.title}</span>
                      <span className="mt-0.5 block text-[9px] leading-snug text-[#7d8981]">{n.body}</span>
                    </span>
                    {!seen.has(n.id) && <i className="mt-1 size-1.5 shrink-0 rounded-full bg-[#55b581]" />}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
