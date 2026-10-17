import { useEffect, useState } from "react";
import { Icon } from "./components/Icon";
import { api } from "./services/api";
import { useAssistant } from "./hooks/useAssistant";
import { Sidebar } from "./components/Sidebar";
import { AssistantPanel } from "./components/AssistantPanel";
import { VoiceHero } from "./components/VoiceHero";
import { ReminderModal } from "./components/ReminderModal";
import { NotificationsMenu } from "./components/NotificationsMenu";
import { Overview } from "./pages/Overview";
import { Analytics } from "./pages/Analytics";
import { Subscriptions } from "./pages/Subscriptions";
import { Upcoming } from "./pages/Upcoming";
import { Actions } from "./pages/Actions";
import { Settings } from "./pages/Settings";

// Horizontal padding shared by the top bar and page content, per breakpoint.
const gutter = "px-[11px] xs:px-[15px] sm:px-6 md:px-[42px] xl:px-[55px]";
const banner = "mt-3 flex items-center gap-2 rounded-[7px] px-3 py-2.5 text-[10px]";

export default function App() {
  const [active, setActive] = useState("Overview");
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actions, setActions] = useState([]);
  const [actionModal, setActionModal] = useState(false);
  const [notice, setNotice] = useState("");
  const [analyticsTab, setAnalyticsTab] = useState("This month");

  const reloadActions = () =>
    api
      .actions()
      .then(setActions)
      .catch((e) => setNotice(e instanceof Error ? e.message : "Could not refresh action history."));

  const assistant = useAssistant({
    onActionProposed: (message) => {
      setNotice(message);
      void reloadActions();
    },
  });

  async function refresh({ quiet = false } = {}) {
    if (!quiet) setLoading(true);
    setError("");
    // Free hosting sleeps when idle; the first request can take up to a minute while it wakes.
    const slow = setTimeout(() => setNotice("Waking up the server… the first load can take up to a minute on free hosting."), 4000);
    try {
      const [data, pending] = await Promise.all([api.dashboard(), api.actions()]);
      setDashboard(data);
      setActions(pending);
      setNotice((n) => (n.startsWith("Waking up") ? "" : n));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not connect to the financial data service.");
    } finally {
      clearTimeout(slow);
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);
  useEffect(() => {
    if (active === "Actions") void reloadActions();
  }, [active]);

  async function proposeReminder() {
    try {
      const action = await api.createAction({
        type: "reminder",
        title: "Upcoming bill reminder",
        details: "Remind me 2 days before the next synthetic bill is due.",
      });
      setActions((a) => [action, ...a]);
      setActionModal(false);
      setNotice("Reminder proposal created. Review and confirm it below.");
      setActive("Actions");
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Could not create proposal.");
    }
  }

  async function confirm(id) {
    try {
      await api.confirmAction(id);
      setNotice("Action confirmed and recorded.");
      await refresh({ quiet: true });
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Could not confirm action.");
    }
  }

  function ask(question) {
    assistant.setInput(question);
    document.getElementById("assistant-input")?.focus();
    document.getElementById("assistant-panel")?.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <div className="min-h-screen">
      <Sidebar
        active={active}
        onSelect={setActive}
        hasPendingActions={actions.some((a) => a.status === "AWAITING_CONFIRMATION")}
      />
      <main className="ml-[62px] min-h-screen sm:ml-[205px] md:ml-[244px]">
        <header className={`flex h-14 items-center justify-between border-b border-[#e8ece8] bg-[#fbfcfa] sm:h-[65px] ${gutter}`}>
          <div className="text-[9px] text-[#929c96] xs:text-[10px]">
            Workspace <span className="px-[9px] text-[#c5cbc7]">/</span>{" "}
            <b className="font-semibold text-[#3e4943]">{active}</b>
          </div>
          <div className="flex items-center gap-[7px] xs:gap-2.5 sm:gap-[18px]">
            <div
              className="flex items-center gap-[7px] rounded-full border border-[#e4ebe5] p-1.5 text-[9px] font-semibold whitespace-nowrap text-[#68766e] xs:px-2 xs:py-[5px] sm:px-2.5 sm:py-1.5"
              title="Synthetic demo"
            >
              <span className="size-[7px] rounded-full bg-[#5eaf7e] xs:size-1.5" />
              <span className="hidden xs:inline">Synthetic demo</span>
            </div>
            <button className="p-[3px] text-[#79847e] xs:p-[5px]" aria-label="Search">
              <Icon name="Search" size={18} />
            </button>
            <NotificationsMenu dashboard={dashboard} actions={actions} onOpenPage={setActive} />
            <div className="grid size-[27px] place-items-center rounded-full bg-[#eadcc8] text-[9px] font-bold text-[#765a3a] xs:size-8 xs:text-[11px]">
              VG
            </div>
          </div>
        </header>
        <div className={`max-w-[1800px] pb-5 sm:pb-6 ${gutter}`}>
          {error && (
            <div className={`${banner} bg-[#fff0ed] text-[#9a463a]`}>
              <Icon name="CircleHelp" size={18} />
              {error}
              <button className="ml-auto font-bold" onClick={() => void refresh()}>
                Retry
              </button>
            </div>
          )}
          {notice && (
            <div className={`${banner} bg-[#edf7ef] text-[#397752]`}>
              <Icon name="Check" size={17} />
              {notice}
              <button className="ml-auto" onClick={() => setNotice("")} aria-label="Dismiss">
                <Icon name="X" size={16} />
              </button>
            </div>
          )}
          {active === "Overview" && <VoiceHero assistant={assistant} findings={dashboard?.briefing?.topFindings ?? []} />}
          {active === "Overview" && (
            <Overview
              dashboard={dashboard}
              categories={dashboard?.categories ?? []}
              total={dashboard?.totalPaise ?? 0}
              change={dashboard?.changePercent ?? 0}
              loading={loading}
              onAsk={ask}
              onReminder={() => setActionModal(true)}
            />
          )}
          {active === "Analytics" && <Analytics dashboard={dashboard} tab={analyticsTab} setTab={setAnalyticsTab} />}
          {active === "Subscriptions" && <Subscriptions dashboard={dashboard} />}
          {active === "Upcoming" && <Upcoming dashboard={dashboard} />}
          {active === "Actions" && (
            <Actions
              actions={actions}
              onConfirm={confirm}
              onRefresh={() => void refresh()}
              onCreate={() => setActionModal(true)}
            />
          )}
          {active === "Settings" && <Settings />}
          <AssistantPanel assistant={assistant} />
          <footer className="flex justify-between px-0.5 py-[17px] text-[7px] text-[#a2aaa4] sm:text-[8px]">
            <span>Finvoice · Personal finance, made human</span>
            <span className="hidden xs:inline">Help center &nbsp;·&nbsp; Privacy</span>
          </footer>
        </div>
      </main>
      {actionModal && (
        <ReminderModal
          bill={dashboard?.bills[0]}
          onClose={() => setActionModal(false)}
          onCreate={() => void proposeReminder()}
        />
      )}
    </div>
  );
}
