// Accept VITE_API_URL with or without the /api/v1 suffix or a trailing slash.
const API = (import.meta.env.VITE_API_URL || "http://localhost:4100/api/v1").replace(/\/+$/, "").replace(/(\/api\/v1)?$/, "/api/v1");
async function request(path, init) {
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const data = await response.json().catch(() => {
    throw new Error(`The API returned a non-JSON response (${response.status}). Check VITE_API_URL.`);
  });
  if (!response.ok) throw new Error(data.error ?? `Request failed (${response.status})`);
  return data;
}
const api = {
  dashboard: () => request("/dashboard"),
  analyticsMonth: (month) => request(`/analytics/month?month=${encodeURIComponent(month)}`),
  message: (message) => request("/assistant/message", { method: "POST", body: JSON.stringify({ message }) }),
  voiceSession: (voice) => request("/voice/session", { method: "POST", body: JSON.stringify({ voice }) }),
  runTool: (name, args, callId, userTranscript) =>
    request(`/tools/${encodeURIComponent(name)}`, {
      method: "POST",
      body: JSON.stringify({ args, callId, userTranscript }),
    }),
  createAction: (input) => request("/actions", { method: "POST", body: JSON.stringify(input) }),
  confirmAction: (id) =>
    request(`/actions/${id}/confirm`, { method: "POST", body: JSON.stringify({ confirmation: true }) }),
  actions: () => request("/actions"),
  validateVoice: (transcript, userTranscript) =>
    request("/voice/validate", { method: "POST", body: JSON.stringify({ transcript, userTranscript }) }),
};
export { api };
