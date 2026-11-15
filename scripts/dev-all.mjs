/**
 * One command to run rply on your own computer with a public HTTPS link (needed by Meta):
 *   1) opens a free Cloudflare quick tunnel (or uses PUBLIC_URL if you set one in .env)
 *   2) writes that link into .env as APP_URL
 *   3) runs the web app (next start) + the worker, and restarts them when .env changes
 *   4) prints every URL you have to paste into the Meta App Dashboard (also saved to meta-urls.txt)
 */
import { spawn, execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(root);
const isWin = process.platform === "win32";
const PORT = 3000;

const readEnvText = () => (fs.existsSync(".env") ? fs.readFileSync(".env", "utf8") : "");
function parseEnv() {
  const o = {};
  for (const line of readEnvText().split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m) o[m[1]] = m[2].replace(/\s+#.*$/, "").trim();
  }
  return o;
}
let selfWrite = false;
function setEnv(key, value) {
  let s = readEnvText();
  const re = new RegExp(`^${key}=.*$`, "m");
  s = re.test(s) ? s.replace(re, `${key}=${value}`) : `${s.trimEnd()}\n${key}=${value}\n`;
  selfWrite = true;
  fs.writeFileSync(".env", s);
}

// ── 1. public URL
let env = parseEnv();
let publicUrl = env.PUBLIC_URL;
let tunnel;
if (!publicUrl) {
  const { bin, install, Tunnel } = await import("cloudflared");
  if (!fs.existsSync(bin)) { console.log("⬇  Downloading cloudflared (one time)…"); await install(bin); }
  console.log("🌐 Opening a public HTTPS tunnel…");
  tunnel = Tunnel.quick(`http://localhost:${PORT}`);
  publicUrl = await new Promise((resolve, reject) => {
    tunnel.once("url", resolve);
    tunnel.once("error", reject);
    setTimeout(() => reject(new Error("Tunnel did not start in 60s. Check your internet and run start.bat again.")), 60_000);
  });
}
publicUrl = publicUrl.replace(/\/$/, "");
setEnv("APP_URL", publicUrl);
env = parseEnv();

// ── 2. children
const procs = {};
function start(name, args) {
  const child = spawn(isWin ? "npx.cmd" : "npx", args, { env: { ...process.env, ...parseEnv() }, shell: isWin, stdio: ["ignore", "pipe", "pipe"] });
  const out = (d) => String(d).split(/\r?\n/).filter(Boolean).forEach((l) => console.log(`[${name}] ${l}`));
  child.stdout.on("data", out); child.stderr.on("data", out);
  child.on("exit", (code) => { if (!child.killedByUs) console.log(`[${name}] exited (${code})`); });
  procs[name] = child;
}
function stop(name) {
  const c = procs[name]; if (!c || c.exitCode !== null) return;
  c.killedByUs = true;
  try { isWin ? execSync(`taskkill /pid ${c.pid} /T /F`, { stdio: "ignore" }) : c.kill("SIGTERM"); } catch {}
}
const startAll = () => { start("web", ["next", "start", "-p", String(PORT)]); start("worker", ["tsx", "worker/index.ts"]); };
const stopAll = () => { stop("web"); stop("worker"); };
startAll();

// restart when you edit .env (e.g. after pasting Meta / OpenAI keys)
let last = readEnvText();
fs.watchFile(".env", { interval: 1500 }, () => {
  const now = readEnvText();
  if (now === last) return;
  last = now;
  if (selfWrite) { selfWrite = false; return; }
  console.log("♻  .env changed, restarting…");
  stopAll(); setTimeout(startAll, 1500);
});

// ── 3. the URLs Meta needs
const urls = [
  ["Your dashboard", `${publicUrl}/login?mode=signup`],
  ["App domain", new URL(publicUrl).host],
  ["Privacy policy URL", `${publicUrl}/privacy`],
  ["Data deletion callback URL", `${publicUrl}/api/meta/data-deletion`],
  ["Facebook Login redirect URI", `${publicUrl}/api/meta/callback/facebook`],
  ["Instagram Login redirect URL", `${publicUrl}/api/meta/callback/instagram`],
  ["Webhooks callback URL", `${publicUrl}/api/webhooks/meta`],
  ["Webhooks verify token", env.META_WEBHOOK_VERIFY_TOKEN || "(set META_WEBHOOK_VERIFY_TOKEN in .env)"],
];
const text = urls.map(([k, v]) => `${k.padEnd(30)} ${v}`).join("\n");
fs.writeFileSync("meta-urls.txt", text + "\n");
console.log(`\n════════════════ rply is running ════════════════\n${text}\n══════════════════════════════════════════════════`);
console.log("Keep this window open. Closing it stops rply and the public link.\n");

const quit = () => { stopAll(); try { tunnel?.stop(); } catch {} process.exit(0); };
process.on("SIGINT", quit); process.on("SIGTERM", quit);
