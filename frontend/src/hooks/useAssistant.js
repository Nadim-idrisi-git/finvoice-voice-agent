import { useEffect, useRef, useState } from "react";
import { api } from "../services/api";
import { LiveVoiceSession } from "../services/voice";

const greeting = {
  id: 0,
  who: "assistant",
  text: "Hi Nadim, I\u2019m your financial copilot. Ask me about this month\u2019s spending, subscriptions, bills, or EMIs. These demo records are synthetic.",
};

/** Conversation and live-voice state. `onActionProposed(message)` fires when the assistant drafts an action. */
export function useAssistant({ onActionProposed }) {
  const [messages, setMessages] = useState([greeting]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [voiceState, setVoiceState] = useState("IDLE");
  const [voiceError, setVoiceError] = useState("");
  const [session, setSession] = useState(null);
  // Ref so the unmount cleanup sees the live session, not the initial null.
  const sessionRef = useRef(null);

  useEffect(() => () => void sessionRef.current?.stop(), []);

  function addMessage(who, text) {
    setMessages((m) => [...m, { id: Date.now() + Math.random(), who, text }]);
  }
  function setLiveSession(live) {
    sessionRef.current = live;
    setSession(live);
  }

  async function sendText(e) {
    e?.preventDefault();
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    addMessage("you", text);
    setSending(true);
    try {
      const answer = await api.message(text);
      addMessage("assistant", answer.answer);
      if (answer.actionProposal) onActionProposed("An action proposal is ready. Review and confirm it in Actions.");
    } catch (err) {
      addMessage("assistant", err instanceof Error ? err.message : "I could not reach your financial data.");
    } finally {
      setSending(false);
    }
  }

  async function startVoice() {
    setVoiceError("");
    const live = new LiveVoiceSession({
      state: setVoiceState,
      transcript: addMessage,
      error: (message) => {
        setVoiceError(message);
        // Provider errors can be recoverable; only drop the session once it has actually failed.
        if (live.machine.state === "ERROR") setLiveSession(null);
      },
      actionProposed: () => onActionProposed("The assistant prepared an action. Review and confirm it in Actions."),
    });
    setLiveSession(live);
    await live.start();
  }

  async function stopVoice() {
    await session?.stop();
    setLiveSession(null);
  }

  return { messages, input, setInput, sendText, sending, voiceState, voiceError, session, startVoice, stopVoice };
}
