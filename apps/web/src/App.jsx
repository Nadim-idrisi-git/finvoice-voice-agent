import { useEffect, useMemo, useRef, useState } from "react";
import { Activity, ArrowDownRight, ArrowUpRight, AudioLines, Bell, CalendarDays, Check, ChevronDown, CircleHelp, CreditCard, FileClock, LayoutDashboard, Mic, MicOff, MoreHorizontal, Search, Send, Settings, ShieldCheck, Sparkles, Wallet, X } from "lucide-react";
import { api, money } from "./services/api";
import { LiveVoiceSession } from "./services/voice";
const nav = [{ label: "Overview", icon: LayoutDashboard }, { label: "Analytics", icon: Activity }, { label: "Subscriptions", icon: CreditCard }, { label: "Upcoming", icon: CalendarDays }, { label: "Actions", icon: FileClock }, { label: "Settings", icon: Settings }];
const prettyState = { IDLE: "Ready when you are", CONNECTING: "Connecting securely\u2026", LISTENING: "Listening", USER_SPEAKING: "Listening to you", PROCESSING: "Thinking through your records\u2026", ASSISTANT_SPEAKING: "Speaking \xB7 you can interrupt", INTERRUPTED: "Interrupted \xB7 listening", RECONNECTING: "Reconnecting\u2026", ERROR: "Voice unavailable", DISCONNECTED: "Voice session ended" };
function App() {
  const [active, setActive] = useState("Overview");
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [messages, setMessages] = useState([{ id: 0, who: "assistant", text: "Hi Nadim, I\u2019m your financial copilot. Ask me about this month\u2019s spending, subscriptions, bills, or EMIs. These demo records are synthetic." }]);
  const [input, setInput] = useState("");
  const [voiceState, setVoiceState] = useState("IDLE");
  const [voiceError, setVoiceError] = useState("");
  const [session, setSession] = useState(null);
  const sessionRef = useRef(null);
  const [actions, setActions] = useState([]);
  const [actionModal, setActionModal] = useState(false);
  const [notice, setNotice] = useState("");
  const [analyticsTab, setAnalyticsTab] = useState("This month");
  const refresh = async ({ quiet = false } = {}) => {
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
  };
  useEffect(() => {
    void refresh();
    return () => {
      void sessionRef.current?.stop();
    };
  }, []);
  useEffect(() => {
    if (active === "Actions") void api.actions().then(setActions).catch((e) => setNotice(e instanceof Error ? e.message : "Could not refresh action history."));
  }, [active]);
  const total = dashboard?.totalPaise ?? 0;
  const currentChange = dashboard?.changePercent ?? 0;
  const categories = useMemo(() => dashboard?.categories ?? [], [dashboard]);
  function addMessage(who, text) {
    setMessages((m) => [...m, { id: Date.now() + Math.random(), who, text }]);
  }
  async function sendText(e) {
    e?.preventDefault();
    const text = input.trim();
    if (!text) return;
    setInput("");
    addMessage("you", text);
    try {
      const answer = await api.message(text);
      addMessage("assistant", answer.answer);
      if (answer.actionProposal) {
        setNotice("An action proposal is ready. Review and confirm it in Actions.");
        void api.actions().then(setActions);
      }
    } catch (err) {
      addMessage("assistant", err instanceof Error ? err.message : "I could not reach your financial data.");
    }
  }
  async function startVoice() {
    setVoiceError("");
    const live = new LiveVoiceSession({ state: setVoiceState, transcript: (who, text) => addMessage(who, text), error: (message) => {
      setVoiceError(message);
      sessionRef.current = null;
      setSession(null);
    }, actionProposed: () => {
      void api.actions().then(setActions);
      setNotice("The assistant prepared an action. Review and confirm it in Actions.");
    } });
    sessionRef.current = live;
    setSession(live);
    await live.start();
  }
  async function stopVoice() {
    await session?.stop();
    sessionRef.current = null;
    setSession(null);
  }
  async function proposeReminder() {
    try {
      const action = await api.createAction({ type: "reminder", title: "Upcoming bill reminder", details: "Remind me 2 days before the next synthetic bill is due." });
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
  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><span className="brand-icon"><AudioLines size={18} /></span><span>finvoice<span className="brand-dot">.</span></span></div>
      <div className="workspace-label">WORKSPACE</div>
      <div className="profile-chip"><div className="avatar">NI</div><div className="profile-name"><b>Nadim Idrisi</b><small>Personal account</small></div><ChevronDown size={15} className="muted" /></div>
      <div className="nav-caption">YOUR MONEY</div>
      <nav>{nav.map(({ label, icon: Icon }) => <button key={label} aria-label={label} aria-current={active === label ? "page" : void 0} className={`nav-item ${active === label ? "selected" : ""}`} onClick={() => setActive(label)}><Icon size={17} /><span>{label}</span>{label === "Actions" && actions.some((a) => a.status === "AWAITING_CONFIRMATION") && <i className="nav-badge" />}</button>)}</nav>
      <div className="sidebar-bottom"><div className="privacy-card"><ShieldCheck size={17} /><div><b>Synthetic demo data</b><span>No real bank account connected</span></div></div><div className="sidebar-footer"><span className="avatar tiny">NI</span><div><b>Nadim Idrisi</b><small>Free plan · Demo</small></div><MoreHorizontal size={18} /></div></div>
    </aside>

    <main className="main-area">
      <header className="topbar"><div className="breadcrumb">Workspace <span>/</span> <b>{active}</b></div><div className="top-actions"><div className="demo-pill"><span />Synthetic demo</div><button className="icon-btn" aria-label="Search"><Search size={18} /></button><button className="icon-btn notification" aria-label="Notifications"><Bell size={18} /><i /></button><div className="avatar small">NI</div></div></header>
      {error && <div className="error-banner"><CircleHelp size={18} />{error}<button onClick={() => void refresh()}>Retry</button></div>}
      {notice && <div className="notice-banner"><Check size={17} />{notice}<button onClick={() => setNotice("")} aria-label="Dismiss"><X size={16} /></button></div>}
      {active === "Overview" && <Overview dashboard={dashboard} categories={categories} total={total} change={currentChange} loading={loading} onAsk={(s) => {
    setInput(s);
    document.getElementById("assistant-input")?.focus();
    document.getElementById("assistant-panel")?.scrollIntoView({ behavior: "smooth" });
  }} onReminder={() => setActionModal(true)} />}
      {active === "Analytics" && <Analytics dashboard={dashboard} tab={analyticsTab} setTab={setAnalyticsTab} />}
      {active === "Subscriptions" && <Subscriptions dashboard={dashboard} />}
      {active === "Upcoming" && <Upcoming dashboard={dashboard} />}
      {active === "Actions" && <Actions actions={actions} onConfirm={confirm} onRefresh={() => void refresh()} onCreate={() => setActionModal(true)} />}
      {active === "Settings" && <SettingsPage />}
      <section className="assistant-panel" id="assistant-panel">
        <div className="assistant-head"><div><div className="section-kicker"><Sparkles size={14} /> YOUR FINANCIAL COPILOT</div><h2>Let’s talk money.</h2><p>Ask a question or start a voice conversation. I’ll use your synthetic demo data.</p></div><div className="voice-status"><span className={`status-light ${voiceState === "LISTENING" || voiceState === "ASSISTANT_SPEAKING" ? "live" : ""}`} />{prettyState[voiceState]}</div></div>
        <div className="conversation" aria-live="polite">{messages.slice(-5).map((m) => <div className={`message ${m.who}`} key={m.id}><span className="message-avatar">{m.who === "assistant" ? <Sparkles size={13} /> : "NI"}</span><div><small>{m.who === "assistant" ? "Finvoice" : "You"}</small><p>{m.text}</p></div></div>)}{voiceError && <div className="voice-error">{voiceError}</div>}</div>
        <div className="prompt-chips">{["How much did I spend this month?", "Compare with last month", "Find my subscriptions"].map((s) => <button key={s} onClick={() => {
    setInput(s);
  }}>{s}</button>)}</div>
        <form className="composer" onSubmit={sendText}><input id="assistant-input" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask about your finances…" aria-label="Ask about your finances" /><button className="send-btn" type="submit" aria-label="Send message" disabled={!input.trim()}><Send size={17} /></button><div className="composer-divider" /><button type="button" className={`mic-btn ${voiceState === "ASSISTANT_SPEAKING" ? "speaking" : ""}`} aria-label={session ? "Stop voice session" : "Start voice session"} onClick={() => session ? void stopVoice() : void startVoice()}>{session ? <MicOff size={18} /> : <Mic size={18} />}</button></form>
        {session && <div className="voice-controls"><span><AudioLines size={15} /> Live conversation · speak anytime to interrupt</span><button onClick={() => void stopVoice()}><X size={14} /> End session</button></div>}
        <div className="assistant-foot"><span><ShieldCheck size={13} /> Synthetic demo records only</span><span>Live voice sends audio to Gemini when configured. Verify important details.</span></div>
      </section>
      <footer className="page-footer"><span>Finvoice · Personal finance, made human</span><span>Help center &nbsp;·&nbsp; Privacy</span></footer>
    </main>
    {actionModal && <div className="modal-backdrop" role="presentation" onClick={() => setActionModal(false)}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="action-title" onClick={(e) => e.stopPropagation()}><button className="modal-close" onClick={() => setActionModal(false)} aria-label="Close"><X size={18} /></button><div className="modal-icon"><Bell size={20} /></div><span className="section-kicker">ACTION PROPOSAL</span><h2 id="action-title">Set a bill reminder?</h2><p>Finvoice will add a reminder two days before your next synthetic bill. This is an in-app demo reminder; it will not send a notification outside this app.</p><div className="action-detail"><b>Next bill</b><span>{dashboard?.bills[0]?.name ?? "Upcoming bill"} · {dashboard ? money(dashboard.bills[0]?.amountPaise ?? 0) : "\u2014"}</span></div><div className="modal-buttons"><button className="secondary-btn" onClick={() => setActionModal(false)}>Cancel</button><button className="primary-btn" onClick={() => void proposeReminder()}>Create proposal</button></div></section></div>}
  </div>;
}
function PageHeading({ title, subtitle, action }) {
  return <div className="page-heading"><div><div className="section-kicker">PERSONAL FINANCE</div><h1>{title}</h1><p>{subtitle}</p></div>{action}</div>;
}
function Overview({ dashboard, categories, total, change, loading, onAsk, onReminder }) {
  const graph = chartSeries(dashboard?.dailySpending ?? [], dashboard?.month ?? (/* @__PURE__ */ new Date()).toISOString().slice(0, 7));
  return <><PageHeading title="Good morning, Nadim" subtitle="Here’s your money at a glance. Your demo data is synthetic." action={<button className="outline-btn" onClick={onReminder}><Bell size={15} /> Set a reminder</button>} />
  <div className="overview-grid"><div className="left-column">
    <div className="summary-card"><div className="summary-top"><span className="summary-label">TOTAL SPENDING <span className="info-dot">i</span></span><button className="period-btn">This month <ChevronDown size={14} /></button></div><div className="summary-amount">{loading ? "\u2026" : money(total)}</div><div className="summary-bottom"><span className={`change-pill ${change > 0 ? "up" : change < 0 ? "down" : "flat"}`}>{change > 0 ? <ArrowUpRight size={14} /> : change < 0 ? <ArrowDownRight size={14} /> : null} {Math.abs(change)}%</span><span className="comparison">vs. last month <span className="bullet">·</span> {dashboard ? money(dashboard.previousTotalPaise) : "\u2014"}</span></div><div className="sparkline"><svg viewBox="0 0 620 96" preserveAspectRatio="none"><defs><linearGradient id="fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#52b788" stopOpacity=".19" /><stop offset="1" stopColor="#52b788" stopOpacity="0" /></linearGradient></defs><path d={`${graph.line} L620,88 L0,88 Z`} fill="url(#fill)" /><path d={graph.line} fill="none" stroke="#49a779" strokeWidth="2.4" vectorEffect="non-scaling-stroke" /></svg><div className="chart-labels">{graph.labels.map((label) => <span key={label}>{label}</span>)}</div></div></div>
    <div className="card category-card"><div className="card-title-row"><div><h3>Spending breakdown</h3><p>Where your money went this month</p></div><button className="text-btn" onClick={() => onAsk("Break down my spending by category")}>See all <span>→</span></button></div><div className="category-content"><div className="donut-wrap"><div className="donut" style={{ background: donutGradient(categories) }}><div><b>{categories.length}</b><span>categories</span></div></div></div><div className="category-list">{categories.slice(0, 5).map((c, i) => <div className="category-line" key={c.category}><span className={`category-icon ci-${i}`}>{categoryEmoji(c.category)}</span><div className="category-info"><div><b>{c.category}</b><span>{total ? Math.round(c.amountPaise / total * 100) : 0}%</span></div><div className="progress"><i style={{ width: `${total ? c.amountPaise / total * 100 : 0}%`, background: colors[i % colors.length] }} /></div></div><strong>{money(c.amountPaise)}</strong></div>)}</div></div></div>
  </div><div className="right-column"><div className="card insight-card"><div className="insight-label"><span className="insight-spark"><Sparkles size={14} /></span> A LITTLE INSIGHT</div><h3>{dashboard?.unusual[0] ? "One purchase stands out in these demo records." : categories[0] ? `${categories[0].category} is your top category this month.` : "A clearer picture starts with your spending."}</h3><p>{dashboard?.unusual[0] ? `${dashboard.unusual[0].merchant} shows ${money(dashboard.unusual[0].amountPaise)}, above its synthetic history. This is a review candidate, not a fraud finding.` : categories.length ? `You\u2019ve spent ${categories[0] ? money(categories[0].amountPaise) : "\u2014"} on ${categories[0]?.category.toLowerCase()} so far. Want to compare it with last month?` : "Keep tracking your synthetic demo spending to see more insights."}</p><button onClick={() => onAsk(dashboard?.unusual[0] ? "Identify unusual spending" : "Compare my expenses with last month")}>Explore insight <span>→</span></button><div className="insight-decoration">✳</div></div>
  <div className="card upcoming-card"><div className="card-title-row"><div><h3>Coming up</h3><p>Your next bills & payments</p></div><button className="dots-btn" aria-label="More upcoming items">···</button></div>{dashboard?.bills.slice(0, 3).map((bill, i) => <div className="upcoming-row" key={bill.id}><div className={`bill-icon bi-${i}`}><CalendarDays size={17} /></div><div className="bill-info"><b>{bill.name}</b><span>Due {new Date(bill.dueAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span></div><strong>{money(bill.amountPaise)}</strong></div>)}<button className="view-all" onClick={() => onAsk("What bills are coming up?")}>View all upcoming <span>→</span></button></div>
  <div className="quick-actions"><button onClick={() => onAsk("How much did I spend this month?")}><span className="qa-icon qa-mint"><Wallet size={17} /></span><b>Spending summary</b><span className="qa-arrow">↗</span></button><button onClick={onReminder}><span className="qa-icon qa-lavender"><Bell size={17} /></span><b>Set a reminder</b><span className="qa-arrow">↗</span></button></div></div></div></>;
}
const colors = ["#59a880", "#82c6a2", "#b6ddc7", "#dae9df", "#92ae9e"];
function chartSeries(daily, month) {
  const [year, monthNumber] = month.split("-").map(Number);
  const days = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const cumulative = /* @__PURE__ */ new Map();
  let sum = 0;
  for (const row of [...daily].sort((a, b) => a.day - b.day)) {
    sum += row.amountPaise;
    cumulative.set(row.day, sum);
  }
  const max = Math.max(sum, 1);
  const points = [[0, 82]];
  for (let day = 1; day <= days; day++) {
    if (cumulative.has(day)) {
      points.push([(day - 1) / (days - 1) * 620, 82 - cumulative.get(day) / max * 65]);
    }
  }
  if (points.length === 1) points.push([620, 82]);
  const line = points.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const labels = [1, 7, 14, 21, days].filter((d, i, a) => d <= days && a.indexOf(d) === i).map((d) => `${new Date(Date.UTC(year, monthNumber - 1, d)).toLocaleDateString("en-IN", { month: "short" })} ${String(d).padStart(2, "0")}`);
  return { line, labels };
}
function donutGradient(categories) {
  const total = categories.reduce((s, c) => s + c.amountPaise, 0) || 1;
  let cursor = 0;
  const stops = categories.slice(0, 5).map((c, i) => {
    const from = cursor;
    cursor += c.amountPaise / total * 100;
    return `${colors[i]} ${from}% ${cursor}%`;
  });
  return `conic-gradient(${stops.join(",")})`;
}
function categoryEmoji(s) {
  return s.includes("Food") ? "\u25C9" : s.includes("Transport") ? "\u2197" : s.includes("Subscriptions") ? "\u25A3" : s.includes("Bill") ? "\u03DF" : s.includes("Grocer") ? "\u2667" : "\u25C8";
}
function Analytics({ dashboard, tab, setTab }) {
  const [previous, setPrevious] = useState(null);
  const currentMonthValue = dashboard?.month ?? (/* @__PURE__ */ new Date()).toISOString().slice(0, 7);
  const currentDate = /* @__PURE__ */ new Date(`${currentMonthValue}-01T00:00:00Z`);
  currentDate.setUTCMonth(currentDate.getUTCMonth() - 1);
  const previousMonthValue = `${currentDate.getUTCFullYear()}-${String(currentDate.getUTCMonth() + 1).padStart(2, "0")}`;
  useEffect(() => {
    if (tab === "Last month") {
      void api.analyticsMonth(previousMonthValue).then(setPrevious).catch(() => setPrevious(null));
    }
  }, [tab, previousMonthValue]);
  const shown = tab === "Last month" ? previous : null;
  const categories = shown?.categories ?? dashboard?.categories ?? [];
  const total = shown?.totalPaise ?? dashboard?.totalPaise ?? 0;
  const label = shown?.month ?? currentMonthValue;
  return <><PageHeading title="Your spending, in focus" subtitle="Explore the patterns behind your everyday spending." action={<button className="period-btn">{(/* @__PURE__ */ new Date(`${label}-01T00:00:00Z`)).toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" })}<ChevronDown size={14} /></button>} /><div className="tab-switch">{["This month", "Last month"].map((t) => <button className={t === tab ? "active" : ""} key={t} onClick={() => setTab(t)}>{t}</button>)}</div><div className="analytics-kpis"><div className="card kpi"><span>Total expenses</span><b>{tab === "Last month" && !previous ? "\u2026" : money(total)}</b><small>{label} synthetic records</small></div><div className="card kpi"><span>Top category</span><b>{categories[0]?.category ?? "\u2014"}</b><small>{categories[0] ? money(categories[0].amountPaise) : "No expense records"}</small></div><div className="card kpi"><span>Categories</span><b>{categories.length}</b><small>Calculated from recorded expenses</small></div></div><div className="card analytics-card"><div className="card-title-row"><div><h3>Category breakdown</h3><p>Amounts are calculated from synthetic transaction records.</p></div></div>{categories.map((c, i) => <div className="analytics-category" key={c.category}><div><span className={`category-icon ci-${i}`}>{categoryEmoji(c.category)}</span><b>{c.category}</b><span>{total ? Math.round(c.amountPaise / total * 100) : 0}%</span></div><strong>{money(c.amountPaise)}</strong><div className="progress"><i style={{ width: `${total ? c.amountPaise / total * 100 : 0}%`, background: colors[i % colors.length] }} /></div></div>)}</div></>;
}
function Subscriptions({ dashboard }) {
  return <><PageHeading title="Recurring subscriptions" subtitle="Merchants appearing in multiple synthetic months. No cancellation integration is connected." /><div className="card list-card"><div className="card-title-row"><div><h3>Your subscriptions</h3><p>Recurring pattern candidates, not confirmed contracts</p></div><span className="demo-pill">{dashboard?.subscriptions.length ?? 0} found</span></div>{dashboard?.subscriptions.length ? dashboard.subscriptions.map((s) => <div className="subscription-row" key={s.merchant}><span className="subscription-logo">{s.merchant.slice(0, 1)}</span><div><b>{s.merchant}</b><small>Seen in {s.occurrences} months · synthetic transaction pattern</small></div><strong>{money(s.monthlyAmountPaise)}<small>/ month avg.</small></strong></div>) : <div className="empty-state">No recurring subscriptions found in these records.</div>}</div><div className="notice-inline"><ShieldCheck size={17} /> Finvoice can prepare a cancellation workflow, but cannot cancel real subscriptions in this demo.</div></>;
}
function Upcoming({ dashboard }) {
  return <><PageHeading title="Upcoming payments" subtitle="Bills and EMI schedules from your synthetic demo records." /><div className="upcoming-columns"><div className="card list-card"><h3>Upcoming bills</h3>{dashboard?.bills.map((b) => <div className="payment-row" key={b.id}><span className="bill-icon"><CalendarDays size={17} /></span><div><b>{b.name}</b><small>Due {new Date(b.dueAt).toLocaleDateString("en-IN", { day: "numeric", month: "long" })}</small></div><strong>{money(b.amountPaise)}</strong></div>)}</div><div className="card list-card"><h3>EMI schedule</h3>{dashboard?.emis.map((e) => <div className="payment-row" key={e.id}><span className="bill-icon bi-2"><CreditCard size={17} /></span><div><b>{e.name}</b><small>Next {new Date(e.nextDueAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} · {e.remainingInstallments} left</small></div><strong>{money(e.installmentPaise)}</strong></div>)}</div></div></>;
}
function Actions({ actions, onConfirm, onRefresh, onCreate }) {
  return <><PageHeading title="Actions & reminders" subtitle="Review proposals and see what Finvoice recorded." action={<button className="primary-btn" onClick={onCreate}><Bell size={15} /> New reminder</button>} /><div className="card list-card action-list"><div className="card-title-row"><div><h3>Action history</h3><p>Every action requires explicit confirmation.</p></div><button className="text-btn" onClick={onRefresh}>Refresh ↻</button></div>{actions.length ? actions.map((a) => <div className="action-row" key={a.id}><span className={`action-state ${a.status === "SUCCEEDED" ? "done" : ""}`}>{a.status === "SUCCEEDED" ? <Check size={14} /> : <FileClock size={14} />}</span><div className="action-copy"><b>{a.title}</b><p>{a.details}</p><small>{a.type.replace("_", " ")} · {new Date(a.createdAt).toLocaleString()}</small></div><div className="action-end"><span className={`status-badge ${a.status === "SUCCEEDED" ? "success" : ""}`}>{a.status.replace("_", " ")}</span>{a.status === "AWAITING_CONFIRMATION" && <button className="primary-btn compact" onClick={() => onConfirm(a.id)}>Confirm</button>}</div></div>) : <div className="empty-state">No actions yet. Create a reminder proposal to get started.</div>}</div><div className="notice-inline"><ShieldCheck size={17} /> Confirmation applies only to this exact demo action. External payments and subscription changes are unavailable.</div></>;
}
function SettingsPage() {
  return <><PageHeading title="Your preferences" subtitle="Manage your voice and privacy settings." /><div className="card settings-card"><h3>Voice assistant</h3><div className="settings-row"><div><b>Live voice provider</b><p>Gemini Live with native audio and interruption handling. Requires API credentials.</p></div><span className="status-badge">Optional</span></div><div className="settings-row"><div><b>Microphone permissions</b><p>Browser permission is requested only when you start a voice session.</p></div><Mic size={18} /></div><div className="settings-row"><div><b>Privacy & demo data</b><p>All records shown in this MVP are synthetic and stored for this demo only.</p></div><ShieldCheck size={18} /></div></div></>;
}
var App_default = App;
export {
  App_default as default
};
