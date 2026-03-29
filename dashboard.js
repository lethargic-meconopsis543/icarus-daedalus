const http = require("http");
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");

const PORT = 3000, ROOT = __dirname, HOME = process.env.HOME, FABRIC = path.join(HOME, "fabric"), AGENTS_FILE = path.join(ROOT, "agents.yml"), START = Date.now();
if (!HOME) { console.error("HOME not set"); process.exit(1); }

function safe(p) { try { return fs.readFileSync(p, "utf-8"); } catch { return ""; } }
function jf(p) { try { return JSON.parse(fs.readFileSync(p, "utf-8")); } catch { return null; } }

function parseAgents() {
  const yml = safe(AGENTS_FILE), agents = []; let c = null;
  for (const l of yml.split("\n")) { const t = l.trim();
    if (t.startsWith("- name:")) { if (c) agents.push(c); c = { name: t.split(":")[1].trim() }; }
    else if (t.startsWith("role:") && c) c.role = t.split(":").slice(1).join(":").trim();
    else if (t.startsWith("home:") && c) c.home = t.split(":").slice(1).join(":").trim().replace("~", HOME);
  } if (c) agents.push(c); return agents;
}

function parseCycles(md) {
  const out = [];
  for (const b of md.split(/^---$/m)) { const m = b.match(/## Cycle (\d+)/); if (!m) continue;
    const ts = (b.match(/(\d{4}-\d{2}-\d{2} \d{2}:\d{2} UTC)/)||[])[1]||"";
    const thought = (b.match(/\*\*Thought:\*\* ([\s\S]*?)(?=\n\n\*\*|\n*$)/)||[])[1]||"";
    const response = (b.match(/\*\*Response:\*\* ([\s\S]*?)(?=\n\n|\n*$)/)||[])[1]||"";
    out.push({ cycle: +m[1], timestamp: ts, thought: thought.trim(), response: response.trim() });
  } return out;
}

function scanFabric() {
  if (!fs.existsSync(FABRIC)) return [];
  const entries = [], dirs = [[FABRIC, null], [path.join(FABRIC, "cold"), "cold"]];
  for (const [dir, forceTier] of dirs) { if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir).filter(f => f.endsWith(".md"))) {
      const fp = path.join(dir, f), content = safe(fp), h = content.slice(0, 600);
      entries.push({ file: f, agent: (h.match(/^agent: (.+)$/m)||[])[1]||"", platform: (h.match(/^platform: (.+)$/m)||[])[1]||"",
        type: (h.match(/^type: (.+)$/m)||[])[1]||"", tier: forceTier||(h.match(/^tier: (.+)$/m)||[])[1]||"",
        timestamp: (h.match(/^timestamp: (.+)$/m)||[])[1]||"", summary: (h.match(/^summary: (.+)$/m)||[])[1]||"",
        refs: (h.match(/^refs: \[(.+)\]$/m)||[])[1]||"", body: content.split("---").slice(2).join("---").trim(), size: Buffer.byteLength(content) });
    }
  } return entries.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

function agentData(a) {
  const home = a.home || path.join(HOME, ".hermes-" + a.name);
  const gw = jf(path.join(home, "gateway_state.json")); let online = false, plats = {};
  if (gw) { try { process.kill(gw.pid, 0); online = true; } catch {} plats = gw.platforms || {}; }
  const env = safe(path.join(home, ".env")), soul = safe(path.join(home, "SOUL.md"));
  const cp = [];
  if (env.includes("TELEGRAM_BOT_TOKEN")) cp.push({ name: "telegram", abbr: "T", state: plats.telegram?.state||"offline", color: "#229ED9" });
  if (env.includes("DISCORD_BOT_TOKEN")) cp.push({ name: "discord", abbr: "D", state: plats.discord?.state||"offline", color: "#5865F2" });
  if (env.includes("SLACK_BOT_TOKEN")) cp.push({ name: "slack", abbr: "S", state: plats.slack?.state||"offline", color: "#611f69" });
  if (env.includes("WHATSAPP_ENABLED")) cp.push({ name: "whatsapp", abbr: "W", state: "configured", color: "#25D366" });
  if (env.includes("SIGNAL_HTTP_URL")) cp.push({ name: "signal", abbr: "Sg", state: "configured", color: "#3A76F0" });
  if (env.includes("EMAIL_ADDRESS")) cp.push({ name: "email", abbr: "E", state: "configured", color: "#888" });
  const log = path.join(ROOT, a.name + "-log.md"), cycles = parseCycles(safe(log));
  const entries = scanFabric().filter(e => e.agent === a.name);
  const lastPlatform = entries.length > 0 ? entries[0].platform : "";
  return { name: a.name, role: a.role||"", online, platforms: cp, soul, home, cycles, entries,
    totalEntries: entries.length, lastActive: cycles.length > 0 ? cycles[cycles.length-1].timestamp : "",
    lastPlatform, lastOutput: cycles.length > 0 ? (cycles[cycles.length-1].thought||cycles[cycles.length-1].response||"") : "" };
}

function getData() {
  const agents = parseAgents().map(agentData), entries = scanFabric(), today = new Date().toISOString().slice(0, 10);
  const hot = entries.filter(e => e.tier === "hot").length, warm = entries.filter(e => e.tier === "warm").length, cold = entries.filter(e => e.tier === "cold").length;
  // cross-platform recalls: entries where agent has entries on multiple platforms
  let xRecalls = 0;
  const agentPlats = {};
  entries.forEach(e => { if (!agentPlats[e.agent]) agentPlats[e.agent] = new Set(); agentPlats[e.agent].add(e.platform); });
  Object.values(agentPlats).forEach(s => { if (s.size > 1) xRecalls += s.size - 1; });
  // timeline
  const timeline = {};
  for (let i = 13; i >= 0; i--) { const d = new Date(Date.now() - i * 864e5).toISOString().slice(0, 10); timeline[d] = {}; agents.forEach(a => timeline[d][a.name] = 0); }
  entries.forEach(e => { const d = e.timestamp.slice(0, 10); if (timeline[d]) timeline[d][e.agent] = (timeline[d][e.agent]||0) + 1; });
  // platform dist
  const platDist = {}; entries.forEach(e => { platDist[e.platform||"cli"] = (platDist[e.platform||"cli"]||0) + 1; });
  // type dist
  const typeDist = {}; entries.forEach(e => { typeDist[e.type||"other"] = (typeDist[e.type||"other"]||0) + 1; });
  // compaction
  const compRaw = safe(path.join(ROOT, "compaction-history.md")), compaction = [];
  for (const b of compRaw.split(/^---$/m)) { const m = b.match(/## (.+)/); if (!m) continue;
    compaction.push({ timestamp: m[1].trim(), details: b.split("\n").filter(l => l.trim() && !l.startsWith("##")).map(l => l.trim()) }); }
  // ticker
  const ticker = [];
  entries.slice(0, 4).forEach(e => ticker.push({ text: e.agent + " wrote memory on " + (e.platform||"cli"), time: e.timestamp, type: "write" }));
  compaction.slice(-1).forEach(c => ticker.push({ text: "compaction ran", time: c.timestamp, type: "system" }));
  // cross-platform detail
  const xplatDetail = [];
  entries.forEach(e => { entries.forEach(e2 => {
    if (e.agent === e2.agent && e.platform !== e2.platform && e.platform && e2.platform) {
      const k = e.agent+e.platform+e2.platform;
      xplatDetail.push({ agent: e.agent, from: e.platform, to: e2.platform, fromTs: e.timestamp, toTs: e2.timestamp });
    }
  })});
  // platform matrix
  const platMatrix = {};
  entries.forEach(e => { if (!e.platform) return;
    entries.forEach(e2 => { if (!e2.platform || e.agent !== e2.agent || e.file === e2.file) return;
      const k = e.platform + "→" + e2.platform; platMatrix[k] = (platMatrix[k]||0) + 1;
    });
  });

  return {
    agents, entries: entries.slice(0, 100), ticker, xplatDetail: xplatDetail.slice(0, 20), platMatrix,
    stats: { totalAgents: agents.length, activeAgents: agents.filter(a => a.online).length,
      totalCycles: Math.max(...agents.map(a => a.cycles.length), 0), totalEntries: entries.length,
      entriesToday: entries.filter(e => e.timestamp.startsWith(today)).length, hot, warm, cold,
      brainSize: (() => { let t = 0; try { fs.readdirSync(FABRIC).forEach(f => { try { t += fs.statSync(path.join(FABRIC, f)).size } catch {} }) } catch {} return t })(),
      platforms: [...new Set(agents.flatMap(a => a.platforms.map(p => p.name)))],
      uptime: Math.floor((Date.now() - START) / 1000), xRecalls },
    timeline, platDist, typeDist, compaction: compaction.reverse().slice(0, 10),
    lastCycleTs: agents.reduce((best, a) => { const l = a.lastActive; return l > best ? l : best; }, ""),
    cronTail: safe(path.join(ROOT, "cron.log")).split("\n").filter(l => l.trim()).slice(-10),
  };
}

function getSys() {
  const agents = parseAgents();
  return { node: process.version, platform: process.platform + "/" + process.arch,
    fabricSize: (() => { let t = 0; try { fs.readdirSync(FABRIC).forEach(f => { try { t += fs.statSync(path.join(FABRIC, f)).size } catch {} }) } catch {} return t })(),
    agentsYml: safe(AGENTS_FILE),
    envStatus: agents.map(a => { const h = a.home || path.join(HOME, ".hermes-" + a.name); const env = safe(path.join(h, ".env"));
      return { name: a.name, home: h, vars: { API_KEY: env.includes("ANTHROPIC_API_KEY")?"SET":"NOT SET", TELEGRAM: env.includes("TELEGRAM_BOT_TOKEN")?"SET":"NOT SET",
        DISCORD: env.includes("DISCORD_BOT_TOKEN")?"SET":"NOT SET", SLACK: env.includes("SLACK_BOT_TOKEN")?"SET":"NOT SET" }};
    }),
    cronLog: safe(path.join(ROOT, "cron.log")).split("\n").filter(l => l.trim()).slice(-20),
  };
}

const clients = new Set();
function broadcast() { const d = JSON.stringify(getData()); for (const c of clients) c.write("data: " + d + "\n\n"); }
const watched = new Set();
function watchAll() {
  const ps = [AGENTS_FILE, path.join(ROOT, "compaction-history.md")];
  parseAgents().forEach(a => { ps.push(path.join(ROOT, a.name + "-log.md")); ps.push(path.join(a.home || path.join(HOME, ".hermes-" + a.name), "gateway_state.json")); });
  if (fs.existsSync(FABRIC)) ps.push(FABRIC);
  for (const p of ps) { if (watched.has(p)) continue; try { fs.watch(p, { persistent: false }, () => broadcast()); watched.add(p); } catch {} }
}
watchAll(); setInterval(watchAll, 10000);

const HTML = safe(path.join(ROOT, "dashboard.html"));
const server = http.createServer((req, res) => {
  const u = new URL(req.url, "http://localhost");
  const j = d => { res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify(d)); };
  if (u.pathname === "/api/data") return j(getData());
  if (u.pathname === "/api/system") return j(getSys());
  if (u.pathname === "/api/events") { res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" }); res.write("data: " + JSON.stringify(getData()) + "\n\n"); clients.add(res); req.on("close", () => clients.delete(res)); return; }
  if (req.method === "POST") {
    const act = c => { exec(c); res.writeHead(200, { "Content-Type": "application/json" }); res.end('{"ok":true}'); };
    if (u.pathname === "/api/cycle") return act("bash " + path.join(ROOT, "dialogue.sh") + " >> " + path.join(ROOT, "cron.log") + " 2>&1 &");
    if (u.pathname === "/api/compact") return act("FORCE_COMPACT=1 bash " + path.join(ROOT, "dialogue.sh") + " >> " + path.join(ROOT, "cron.log") + " 2>&1 &");
    if (u.pathname === "/api/sync") return act("bash " + path.join(ROOT, "fabric-sync.sh") + " sync 2>&1 &");
    if (u.pathname === "/api/agent") { let b = ""; req.on("data", c => b += c); req.on("end", () => { try { const { name, role } = JSON.parse(b); act("bash " + path.join(ROOT, "add-agent.sh") + " --name " + name + " --role '" + role + "'"); } catch { res.writeHead(400); res.end("{}"); } }); return; }
  }
  res.writeHead(200, { "Content-Type": "text/html" }); res.end(HTML);
});
server.listen(PORT, () => console.log("http://localhost:" + PORT));
