import { Icon } from "./Icon";
import { kicker } from "../lib/ui";

const prettyState = {
  IDLE: "Ready when you are",
  CONNECTING: "Connecting securely…",
  LISTENING: "Listening",
  USER_SPEAKING: "Listening to you",
  PROCESSING: "Thinking through your records…",
  ASSISTANT_SPEAKING: "Speaking · you can interrupt",
  INTERRUPTED: "Interrupted · listening",
  RECONNECTING: "Reconnecting…",
  ERROR: "Voice unavailable",
  DISCONNECTED: "Voice session ended",
};

const suggestions = ["What should I know this week?", "Draft the IDFC reversal request", "Who keeps auto-debiting me?"];
const squareBtn = "grid size-[30px] place-items-center rounded-[7px]";

export function AssistantPanel({ assistant }) {
  const { messages, input, setInput, sendText, sending, voiceState, voiceError, session, startVoice, stopVoice } =
    assistant;
  const live = voiceState === "LISTENING" || voiceState === "ASSISTANT_SPEAKING";
  return (
    <section
      id="assistant-panel"
      className="mt-[22px] rounded-[11px] border border-[#e7ece8] bg-white p-[15px] shadow-[0_4px_20px_#23362908] sm:px-5 sm:pt-[18px] sm:pb-[11px] xl:mt-6"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className={`${kicker} mb-[7px]`}>
            <Icon name="Sparkles" size={14} /> YOUR FINANCIAL COPILOT
          </div>
          <h2 className="m-0 font-display text-base font-bold tracking-[-0.5px] xs:text-[17px]">Let’s talk money.</h2>
          <p className="mt-1 max-w-[250px] text-[9px] text-muted xs:max-w-none">
            Ask a question or start a voice conversation. I’ll use your synthetic demo data.
          </p>
        </div>
        <div className="flex items-center gap-1.5 pt-1.5 text-[9px] text-[#748079]">
          <span
            className={`size-[9px] rounded-full sm:size-[7px] ${live ? "bg-[#4db17b] shadow-[0_0_0_3px_#e6f4ea]" : "bg-[#c2cac4]"}`}
          />
          <span className="hidden sm:inline">{prettyState[voiceState]}</span>
        </div>
      </div>

      <div className="mt-3.5 grid max-h-[202px] gap-[9px] overflow-auto" aria-live="polite">
        {messages.slice(-5).map((m) => (
          <div className="flex items-start gap-2" key={m.id}>
            <span
              className={`grid size-[22px] shrink-0 place-items-center rounded-[7px] text-[8px] font-bold ${
                m.who === "assistant" ? "bg-mint text-[#438460]" : "bg-[#f0ece6] text-[#806d56]"
              }`}
            >
              {m.who === "assistant" ? <Icon name="Sparkles" size={13} /> : "VG"}
            </span>
            <div className="max-w-[84%]">
              <small className="text-[8px] font-bold text-[#7d8981]">{m.who === "assistant" ? "Finvoice" : "You"}</small>
              <p className="mt-[3px] text-[10px] leading-normal text-body">{m.text}</p>
            </div>
          </div>
        ))}
        {sending && <p className="pl-[30px] text-[9px] text-muted">Thinking…</p>}
        {voiceError && <div className="text-[9px] text-[#b04c40]">{voiceError}</div>}
      </div>

      <div className="my-2.5 flex gap-1.5 overflow-auto">
        {suggestions.map((s) => (
          <button
            key={s}
            onClick={() => setInput(s)}
            className="rounded-full border border-[#e8ede9] bg-[#fafbf9] px-[9px] py-1.5 text-[8px] whitespace-nowrap text-[#707c74] hover:border-[#9bc5a8] hover:text-[#3c7b58]"
          >
            {s}
          </button>
        ))}
      </div>

      <form
        onSubmit={sendText}
        className="flex h-[43px] items-center rounded-lg border border-[#e4eae5] py-1 pr-1.5 pl-[11px] focus-within:border-[#86b799] focus-within:shadow-[0_0_0_3px_#e7f3e9]"
      >
        <input
          id="assistant-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about your finances…"
          aria-label="Ask about your finances"
          className="min-w-0 flex-1 text-[10px] text-[#27342d] outline-none placeholder:text-[#a5aea8]"
        />
        <button
          type="submit"
          aria-label="Send message"
          disabled={!input.trim() || sending}
          className={`${squareBtn} bg-[#edf5ef] text-[#43845e] disabled:bg-[#f4f6f4] disabled:text-[#bdc5bf]`}
        >
          <Icon name="Send" size={17} />
        </button>
        <div className="mx-[7px] h-[18px] border-l border-[#e8ece9]" />
        <button
          type="button"
          aria-label={session ? "Stop voice session" : "Start voice session"}
          onClick={() => (session ? void stopVoice() : void startVoice())}
          className={`${squareBtn} text-white ${voiceState === "ASSISTANT_SPEAKING" ? "animate-pulse-ring bg-[#b24c43]" : "bg-[#27764e]"}`}
        >
          <Icon name={session ? "MicOff" : "Mic"} size={18} />
        </button>
      </form>

      {session && (
        <div className="mt-2 flex flex-wrap items-center gap-[13px] text-[9px] text-[#5a7865] sm:flex-nowrap">
          <span className="flex flex-1 basis-full items-center gap-[5px] sm:basis-auto">
            <Icon name="AudioLines" size={15} /> Live call · speak anytime to interrupt (headphones work best)
          </span>
          <button onClick={() => void stopVoice()} className="flex items-center gap-1 text-[#61736a]">
            <Icon name="X" size={14} /> End session
          </button>
        </div>
      )}

      <div className="mt-2.5 flex justify-between gap-[7px] border-t border-[#f1f3f1] pt-2 text-[7px] text-[#9aa49d] xs:text-[8px]">
        <span className="flex items-center gap-1">
          <Icon name="ShieldCheck" size={13} /> Synthetic demo records only
        </span>
        <span className="text-right">Voice by ElevenLabs; answers checked against your records before they are spoken.</span>
      </div>
    </section>
  );
}
