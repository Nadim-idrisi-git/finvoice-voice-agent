import { AudioLines, Mic, MicOff, Send, ShieldCheck, Sparkles, X } from "lucide-react";

const prettyState = {
  IDLE: "Ready when you are",
  CONNECTING: "Connecting securely\u2026",
  LISTENING: "Listening",
  USER_SPEAKING: "Listening to you",
  PROCESSING: "Thinking through your records\u2026",
  ASSISTANT_SPEAKING: "Speaking \xB7 you can interrupt",
  INTERRUPTED: "Interrupted \xB7 listening",
  RECONNECTING: "Reconnecting\u2026",
  ERROR: "Voice unavailable",
  DISCONNECTED: "Voice session ended",
};

const suggestions = ["How much did I spend this month?", "Compare with last month", "Find my subscriptions"];

export function AssistantPanel({ assistant }) {
  const { messages, input, setInput, sendText, voiceState, voiceError, session, startVoice, stopVoice } = assistant;
  return (
    <section className="assistant-panel" id="assistant-panel">
      <div className="assistant-head">
        <div>
          <div className="section-kicker">
            <Sparkles size={14} /> YOUR FINANCIAL COPILOT
          </div>
          <h2>Let’s talk money.</h2>
          <p>Ask a question or start a voice conversation. I’ll use your synthetic demo data.</p>
        </div>
        <div className="voice-status">
          <span
            className={`status-light ${voiceState === "LISTENING" || voiceState === "ASSISTANT_SPEAKING" ? "live" : ""}`}
          />
          {prettyState[voiceState]}
        </div>
      </div>
      <div className="conversation" aria-live="polite">
        {messages.slice(-5).map((m) => (
          <div className={`message ${m.who}`} key={m.id}>
            <span className="message-avatar">{m.who === "assistant" ? <Sparkles size={13} /> : "NI"}</span>
            <div>
              <small>{m.who === "assistant" ? "Finvoice" : "You"}</small>
              <p>{m.text}</p>
            </div>
          </div>
        ))}
        {voiceError && <div className="voice-error">{voiceError}</div>}
      </div>
      <div className="prompt-chips">
        {suggestions.map((s) => (
          <button
            key={s}
            onClick={() => {
              setInput(s);
            }}
          >
            {s}
          </button>
        ))}
      </div>
      <form className="composer" onSubmit={sendText}>
        <input
          id="assistant-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about your finances…"
          aria-label="Ask about your finances"
        />
        <button className="send-btn" type="submit" aria-label="Send message" disabled={!input.trim()}>
          <Send size={17} />
        </button>
        <div className="composer-divider" />
        <button
          type="button"
          className={`mic-btn ${voiceState === "ASSISTANT_SPEAKING" ? "speaking" : ""}`}
          aria-label={session ? "Stop voice session" : "Start voice session"}
          onClick={() => (session ? void stopVoice() : void startVoice())}
        >
          {session ? <MicOff size={18} /> : <Mic size={18} />}
        </button>
      </form>
      {session && (
        <div className="voice-controls">
          <span>
            <AudioLines size={15} /> Live conversation · speak anytime to interrupt
          </span>
          <button onClick={() => void stopVoice()}>
            <X size={14} /> End session
          </button>
        </div>
      )}
      <div className="assistant-foot">
        <span>
          <ShieldCheck size={13} /> Synthetic demo records only
        </span>
        <span>Live voice sends audio to Gemini when configured. Verify important details.</span>
      </div>
    </section>
  );
}
