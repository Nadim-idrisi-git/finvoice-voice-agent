import crypto from "node:crypto";

/** Small console logger. Never logs bodies, headers, transcripts, or financial details. */
export function createLogger({ silent = false } = {}) {
  const write = (level) => (fields, message) => {
    if (!silent) console[level === "error" ? "error" : "log"](JSON.stringify({ level, time: new Date().toISOString(), message, ...fields }));
  };
  return { info: write("info"), warn: write("warn"), error: write("error") };
}

/** Assigns a request id and logs method, path, status, and duration. */
export function requestLog(log) {
  return (req, res, next) => {
    req.id = req.get("x-request-id") ?? crypto.randomUUID();
    res.set("X-Request-Id", req.id);
    const started = process.hrtime.bigint();
    res.on("finish", () => {
      const ms = Number(process.hrtime.bigint() - started) / 1e6;
      log.info({ requestId: req.id, method: req.method, path: req.path, status: res.statusCode, ms: Math.round(ms) }, "request");
    });
    next();
  };
}
