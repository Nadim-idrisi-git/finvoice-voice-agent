import { Icon } from "../components/Icon";
import { PageHeading } from "../components/PageHeading";
import { card, cardTitle } from "../lib/ui";

const rows = [
  {
    title: "Live voice provider",
    text: "Gemini Live over WebSocket, with natural turn-taking and interruption. Requires a Gemini API key on the backend.",
    end: <span className="rounded-[10px] bg-[#fff4e4] px-[7px] py-[5px] text-[8px] font-bold text-[#9a793f]">Optional</span>,
  },
  {
    title: "AI text assistant",
    text: "A Gemini agent answers using tools over your records. Without a key, a rule-based assistant answers instead.",
    end: <Icon name="Sparkles" size={18} className="shrink-0 text-[#568b68]" />,
  },
  {
    title: "Microphone permissions",
    text: "Browser permission is requested only when you start a voice session.",
    end: <Icon name="Mic" size={18} className="shrink-0 text-[#568b68]" />,
  },
  {
    title: "Privacy & demo data",
    text: "All records shown in this MVP are synthetic and stored for this demo only.",
    end: <Icon name="ShieldCheck" size={18} className="shrink-0 text-[#568b68]" />,
  },
];

export function Settings() {
  return (
    <>
      <PageHeading title="Your preferences" subtitle="Manage your voice and privacy settings." />
      <div className={`${card} p-[19px]`}>
        <h3 className={`${cardTitle} mb-[9px]`}>Assistant</h3>
        {rows.map((row) => (
          <div className="flex items-center justify-between gap-3 border-t border-line-soft px-0.5 py-[15px]" key={row.title}>
            <div>
              <b className="text-[10px]">{row.title}</b>
              <p className="mt-[5px] text-[9px] text-[#87928b]">{row.text}</p>
            </div>
            {row.end}
          </div>
        ))}
      </div>
    </>
  );
}
