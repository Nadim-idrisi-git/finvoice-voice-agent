import { useEffect, useState } from "react";
import { Bell, Check, CircleHelp, Search, X } from "lucide-react";
import { api } from "./services/api";
import { useAssistant } from "./hooks/useAssistant";
import { Sidebar } from "./components/Sidebar";
import { AssistantPanel } from "./components/AssistantPanel";
import { ReminderModal } from "./components/ReminderModal";
import { Overview } from "./pages/Overview";
import { Analytics } from "./pages/Analytics";
import { Subscriptions } from "./pages/Subscriptions";
import { Upcoming } from "./pages/Upcoming";
import { Actions } from "./pages/Actions";
import { Settings } from "./pages/Settings";

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
    try {
      const [data, pending] = await Promise.all([api.dashboard(), api.actions()]);
      setDashboard(data);
      setActions(pending);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not connect to the financial data service.");
    } finally {
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
    <div className="app-shell">
      <Sidebar
        active={active}
        onSelect={setActive}
        hasPendingActions={actions.some((a) => a.status === "AWAITING_CONFIRMATION")}
      />
      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumb">
            Workspace <span>/</span> <b>{active}</b>
          </div>
          <div className="top-actions">
            <div className="demo-pill">
              <span />
              Synthetic demo
            </div>
            <button className="icon-btn" aria-label="Search">
              <Search size={18} />
            </button>
            <button className="icon-btn notification" aria-label="Notifications">
              <Bell size={18} />
              <i />
            </button>
            <div className="avatar small">NI</div>
          </div>
        </header>
        {error && (
          <div className="error-banner">
            <CircleHelp size={18} />
            {error}
            <button onClick={() => void refresh()}>Retry</button>
          </div>
        )}
        {notice && (
          <div className="notice-banner">
            <Check size={17} />
            {notice}
            <button onClick={() => setNotice("")} aria-label="Dismiss">
              <X size={16} />
            </button>
          </div>
        )}
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
        <footer className="page-footer">
          <span>Finvoice · Personal finance, made human</span>
          <span>Help center &nbsp;·&nbsp; Privacy</span>
        </footer>
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
