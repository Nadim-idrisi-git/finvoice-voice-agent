import { Icon } from "./Icon";

// Voice-first hero: the call is the product, so it leads the page.

const VOICES = [
  { id: "marin", label: "Marin · female" },
  { id: "cedar", label: "Cedar · male" },
  { id: "coral", label: "Coral · female" },
  { id: "sage", label: "Sage · female" },
  { id: "ash", label: "Ash · male" },
  { id: "verse", label: "Verse · male" },
];

const STATUS = {
  IDLE: { label: "Ready for your weekly money call", hint: "Tap the button and speak in Hinglish, Hindi, or English." },
  CONNECTING: { label: "Connecting…", hint: "Allow the microphone if your browser asks." },
  LISTENING: { label: "Listening", hint: "Bolo, main sun rahi hoon." },
  USER_SPEAKING: { label: "Listening to you", hint: "Take your time." },
  PROCESSING: { label: "Checking your records…", hint: "Every number comes from your SMS and statements." },
  ASSISTANT_SPEAKING: { label: "Finvoice is speaking", hint: "Interrupt anytime, just start talking." },
  INTERRUPTED: { label: "Go ahead", hint: "I stopped so you can speak." },
  RECONNECTING: { label: "Reconnecting…", hint: "" },
  ERROR: { label: "Voice unavailable", hint: "You can still type below." },
  DISCONNECTED: { label: "Call ended", hint: "Start again anytime." },
};

function Orb({ state, live }) {
  const speaking = state === "ASSISTANT_SPEAKING";
  const user = state === "USER_SPEAKING";
  const thinking = state === "PROCESSING" || state === "CONNECTING";
  return (
    <div className="relative grid size-[170px] place-items-center xs:size-[200px] md:size-[220px]">
      {/* glow rings */}
      <span
        className={`absolute inset-0 rounded-full bg-[#52b788]/15 ${live ? "animate-orb-breathe" : ""} ${user ? "scale-110 bg-[#52b788]/25" : ""} transition-transform duration-300`}
      />
      <span className={`absolute inset-[14px] rounded-full bg-[#52b788]/20 ${live ? "animate-orb-breathe [animation-delay:400ms]" : ""}`} />
      {thinking && <span className="absolute inset-[6px] animate-spin rounded-full border-2 border-transparent border-t-[#2f8a5f] border-r-[#2f8a5f]/40" />}
      {/* core */}
      <div
        className={`relative grid size-[58%] place-items-center rounded-full bg-gradient-to-br from-[#3aa572] to-[#1f6b47] text-white shadow-[0_18px_50px_-12px_#1f6b4799] transition-transform duration-300 ${user ? "scale-105" : ""}`}
      >
        {speaking ? (
          <div className="flex h-10 items-center gap-[5px]" aria-hidden="true">
            {[0, 1, 2, 3, 4].map((i) => (
              <span key={i} className="w-[5px] animate-voice-bar rounded-full bg-white" style={{ animationDelay: `${i * 110}ms` }} />
            ))}
          </div>
        ) : (
          <Icon name={live ? "AudioLines" : "Mic"} size={38} />
        )}
      </div>
    </div>
  );
}

export function VoiceHero({ assistant, findings }) {
  const { voiceState, voiceError, session, startVoice, stopVoice, messages, voice, setVoice, muted, toggleMute } = assistant;
  const live = Boolean(session);
  const status =
    live && muted ? { label: "You're muted", hint: "Finvoice can't hear you. Tap Unmute to talk." } : (STATUS[voiceState] ?? STATUS.IDLE);
  const lastAgent = [...messages].reverse().find((m) => m.who === "assistant");
  const lastUser = [...messages].reverse().find((m) => m.who === "you");

  return (
    <section
      aria-label="Voice money call"
      className="mt-5 overflow-hidden rounded-[18px] border border-[#dcebe1] bg-gradient-to-br from-[#f3faf5] via-white to-[#eef7f1] p-5 shadow-[0_10px_40px_-18px_#1f6b4740] sm:p-7"
    >
      <div className="grid items-center gap-6 md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] md:gap-8">
        {/* Call */}
        <div className="flex flex-col items-center text-center">
          <div className="mb-3 flex items-center gap-2 text-[9px] font-bold tracking-[1.2px] text-[#3f8a62]">
            <span className={`size-2 rounded-full ${live ? "bg-[#33b06e] shadow-[0_0_0_4px_#d8f0e1]" : "bg-[#b8c6bd]"}`} />
            {live ? "LIVE CALL" : "VOICE AGENT · HINGLISH · HINDI · ENGLISH"}
          </div>
          <Orb state={voiceState} live={live} />
          <h2 className="mt-4 font-display text-[19px] font-bold tracking-[-0.4px] xs:text-[22px]" aria-live="polite">
            {status.label}
          </h2>
          <p className="mt-1 text-[11px] text-[#6f7f75]">{status.hint}</p>
          <div className="mt-5 flex items-center gap-2.5">
            <button
              onClick={() => (live ? void stopVoice() : void startVoice())}
              aria-label={live ? "End voice call" : "Start voice session"}
              className={`flex items-center gap-2 rounded-full px-6 py-3 text-[13px] font-bold shadow-[0_10px_24px_-10px_#1f6b47aa] transition hover:scale-[1.02] ${
                live ? "bg-[#b24c43] text-white hover:bg-[#9c3f37]" : "bg-[#24744c] text-white hover:bg-[#1d623f]"
              }`}
            >
              <Icon name={live ? "X" : "Mic"} size={17} />
              {live ? "End call" : "Start money call"}
            </button>
            {live && (
              <button
                onClick={toggleMute}
                aria-label={muted ? "Unmute microphone" : "Mute microphone"}
                aria-pressed={muted}
                className={`flex items-center gap-2 rounded-full border px-5 py-3 text-[13px] font-bold transition hover:scale-[1.02] ${
                  muted ? "border-[#e0b3ad] bg-[#fdeeee] text-[#9a463a]" : "border-[#cfe0d5] bg-white text-[#2f5a43]"
                }`}
              >
                <Icon name={muted ? "MicOff" : "Mic"} size={17} />
                {muted ? "Unmute" : "Mute"}
              </button>
            )}
          </div>
          <label className="mt-3 flex items-center gap-2 text-[10px] text-[#6f7f75]">
            Voice
            <select
              value={voice}
              disabled={live}
              onChange={(e) => setVoice(e.target.value)}
              className="rounded-full border border-[#d8e6dc] bg-white px-2.5 py-1 text-[10px] text-[#2f5a43] disabled:opacity-60"
              aria-label="Choose voice"
            >
              {VOICES.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                </option>
              ))}
            </select>
          </label>
          {voiceError && <p className="mt-3 max-w-[420px] text-[10px] text-[#b04c40]">{voiceError}</p>}

          {/* Live captions */}
          {(lastAgent || lastUser) && (
            <div className="mt-6 w-full max-w-[520px] space-y-2 text-left">
              {lastUser && (
                <p className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-[#f0ece6] px-3.5 py-2 text-[11px] text-[#5e4d3b]">
                  {lastUser.text}
                </p>
              )}
              {lastAgent && (
                <p className="w-fit max-w-[92%] rounded-2xl rounded-bl-md bg-white px-3.5 py-2.5 text-[12px] leading-[1.55] text-[#24332b] shadow-[0_2px_10px_-4px_#1f6b4733]">
                  {lastAgent.text}
                </p>
              )}
            </div>
          )}
        </div>

        {/* What the call is about */}
        <div className="rounded-[14px] border border-[#e1efe4] bg-white/80 p-4 backdrop-blur sm:p-5">
          <div className="flex items-center gap-1.5 text-[9px] font-bold tracking-[1px] text-[#548564]">
            <Icon name="Sparkles" size={14} /> THIS WEEK, FROM YOUR SMS & STATEMENTS
          </div>
          {findings.length ? (
            <ol className="mt-3 grid gap-3">
              {findings.map((f, i) => (
                <li key={f.title} className="flex gap-2.5">
                  <span className="grid size-[22px] shrink-0 place-items-center rounded-full bg-[#e3f2e8] text-[10px] font-bold text-[#2f7a52]">
                    {i + 1}
                  </span>
                  <div>
                    <p className="font-display text-[12px] leading-snug font-bold">{f.title}</p>
                    <p className="mt-0.5 text-[10px] leading-[1.5] text-[#687b6e]">{f.whyItMatters}</p>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-3 text-[10px] text-[#687b6e]">Run the data ingest to see this week’s findings.</p>
          )}
          <div className="mt-4 rounded-[10px] bg-[#f4f8f5] px-3 py-2.5 text-[10px] leading-[1.5] text-[#5d7466]">
            <b className="text-[#2f6b4c]">Try saying:</b> “Haan bolo” · “IDFC wala detail mein batao” · “Reversal draft kar do” ·
            “Haan, confirm karo” · “Papa hospital mein admit hain, claim kaise karein?”
          </div>
        </div>
      </div>
    </section>
  );
}
