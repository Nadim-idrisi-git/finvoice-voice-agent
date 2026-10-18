import { once } from "node:events";
import { createApp } from "../src/app.js";
import { loadConfig } from "../src/config.js";

/** Starts an isolated app on a random port. `deps.fetch` replaces the Gemini network calls. */
export async function startApp(env = {}, deps = {}) {
  const app = createApp({ config: loadConfig({ NODE_ENV: "test", ...env }), ...deps });
  const server = app.listen(0);
  await once(server, "listening");
  const base = `http://127.0.0.1:${server.address().port}`;
  return {
    base,
    async request(path, { method = "GET", body } = {}) {
      const response = await fetch(base + path, {
        method: body === undefined ? method : "POST",
        headers: body === undefined ? {} : { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      return { status: response.status, headers: response.headers, body: await response.json() };
    },
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

/** Fake fetch that returns queued JSON responses and records each call. */
export function fakeFetch(...responses) {
  const calls = [];
  const fn = async (url, init) => {
    calls.push({ url, init, body: JSON.parse(init.body) });
    const next = responses.shift();
    if (next instanceof Error) throw next;
    return { ok: next?.ok ?? true, status: next?.status ?? 200, json: async () => next?.json ?? next };
  };
  fn.calls = calls;
  return fn;
}

export const tx = (overrides) => ({
  ownerId: "u",
  currency: "INR",
  kind: "expense",
  merchant: "Cafe",
  category: "Food",
  ...overrides,
});
