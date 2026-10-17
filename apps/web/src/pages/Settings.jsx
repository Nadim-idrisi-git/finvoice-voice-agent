import { Mic, ShieldCheck } from "lucide-react";
import { PageHeading } from "../components/PageHeading";

export function Settings() {
  return (
    <>
      <PageHeading title="Your preferences" subtitle="Manage your voice and privacy settings." />
      <div className="card settings-card">
        <h3>Voice assistant</h3>
        <div className="settings-row">
          <div>
            <b>Live voice provider</b>
            <p>Gemini Live with native audio and interruption handling. Requires API credentials.</p>
          </div>
          <span className="status-badge">Optional</span>
        </div>
        <div className="settings-row">
          <div>
            <b>Microphone permissions</b>
            <p>Browser permission is requested only when you start a voice session.</p>
          </div>
          <Mic size={18} />
        </div>
        <div className="settings-row">
          <div>
            <b>Privacy & demo data</b>
            <p>All records shown in this MVP are synthetic and stored for this demo only.</p>
          </div>
          <ShieldCheck size={18} />
        </div>
      </div>
    </>
  );
}
