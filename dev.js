// Starts the backend and frontend dev servers together; Ctrl+C stops both.
import { spawn } from "node:child_process";

const apps = [
  { name: "backend", color: 34 },
  { name: "frontend", color: 32 },
];

const children = apps.map(({ name, color }) => {
  const child = spawn("npm", ["run", "dev", "--prefix", name], { stdio: ["ignore", "pipe", "pipe"] });
  const prefix = `\x1b[${color}m[${name}]\x1b[0m `;
  const relay = (stream, out) =>
    stream.on("data", (chunk) => out.write(chunk.toString().replace(/^(?=.)/gm, prefix)));
  relay(child.stdout, process.stdout);
  relay(child.stderr, process.stderr);
  child.on("exit", (code) => {
    console.log(`${prefix}exited with code ${code}`);
    shutdown(code ?? 0);
  });
  return child;
});

let stopping = false;
function shutdown(code) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill("SIGTERM");
  process.exit(code);
}
process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
