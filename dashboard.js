const http = require("http");
const fs = require("fs");
const path = require("path");
const { execSync, exec } = require("child_process");

const PORT = 3000;
const ROOT = __dirname;
const HOME = process.env.HOME || process.env.USERPROFILE;
if (!HOME) { console.error("error: HOME not set"); process.exit(1); }

const FABRIC = path.join(HOME, "fabric");
const AGENTS_FILE = path.join(ROOT, "agents.yml");

function safe(p) { try { return fs.readFileSync(p, "utf-8"); } catch { return ""; } }
function json(p) { try { return JSON.parse(fs.readFileSync(p, "utf-8")); } catch { return null; } }
function run(c) { try { return execSync(c, { encoding: "utf-8", timeout: 5000 }).trim(); } catch { return ""; } }

function parseAgents() {
  const yml = safe(AGENTS_FILE);
  const agents = [];
  let cur = null;
  for (const line of yml.split("\n")) {
    const l = line.trim();
    if (l.startsWith("- name:")) { if (cur) agents.push(cur); cur = { name: l.split(":")[1].trim() }; }
    else if (l.startsWith("role:") && cur) cur.role = l.split(":").slice(1).join(":").trim();
    else if (l.startsWith("home:") && cur) cur.home = l.split(":").slice(1).join(":").trim().replace("~", HOME);
  }
  if (cur) agents.push(cur);
  return agents;
}

function parseCycles(md) {
  const cycles = [];
  for (const block of md.split(/^---$/m)) {
    const m = block.match(/## Cycle (\d+)/);
    if (!m) continue;
    const ts = (block.match(/(\d{4}-\d{2}-\d{2} \d{2}:\d{2} UTC)/)||[])[1] || "";
    const thought = (block.match(/\*\*Thought:\*\* ([\s\S]*?)(?=\n\n\*\*|\n*$)/)||[])[1] || "";
    const response = (block.match(/\*\*Response:\*\* ([\s\S]*?)(?=\n\n|\n*$)/)||[])[1] || "";
    cycles.push({ cycle: +m[1], timestamp: ts, thought: thought.trim(), response: response.trim() });
  }
  return cycles;
}

function getFabricEntries() {
  if (!fs.existsSync(FABRIC)) return [];
  const entries = [];
  for (const f of fs.readdirSync(FABRIC).filter(f => f.endsWith(".md"))) {
    const content = safe(path.join(FABRIC, f));
    const head = content.slice(0, 600);
    entries.push({
      file: f,
      agent: (head.match(/^agent: (.+)$/m)||[])[1] || "",
      platform: (head.match(/^platform: (.+)$/m)||[])[1] || "",
      type: (head.match(/^type: (.+)$/m)||[])[1] || "",
      tier: (head.match(/^tier: (.+)$/m)||[])[1] || "",
      timestamp: (head.match(/^timestamp: (.+)$/m)||[])[1] || "",
      summary: (head.match(/^summary: (.+)$/m)||[])[1] || "",
      body: content.split("---").slice(2).join("---").trim().slice(0, 200),
    });
  }
  // cold entries
  const cold = path.join(FABRIC, "cold");
  if (fs.existsSync(cold)) {
    for (const f of fs.readdirSync(cold).filter(f => f.endsWith(".md"))) {
      const head = safe(path.join(cold, f)).slice(0, 400);
      entries.push({
        file: f, agent: (head.match(/^agent: (.+)$/m)||[])[1] || "",
        platform: (head.match(/^platform: (.+)$/m)||[])[1] || "",
        type: (head.match(/^type: (.+)$/m)||[])[1] || "",
        tier: "cold", timestamp: (head.match(/^timestamp: (.+)$/m)||[])[1] || "",
        summary: (head.match(/^summary: (.+)$/m)||[])[1] || "", body: "",
      });
    }
  }
  return entries.sort((a,b) => b.timestamp.localeCompare(a.timestamp));
}

function fabricSize() {
  if (!fs.existsSync(FABRIC)) return 0;
  let total = 0;
  for (const f of fs.readdirSync(FABRIC)) {
    try { total += fs.statSync(path.join(FABRIC, f)).size; } catch {}
  }
  return total;
}

function getAgentStatus(agent) {
  const home = agent.home || path.join(HOME, ".hermes-" + agent.name);
  const gw = json(path.join(home, "gateway_state.json"));
  let online = false;
  let platforms = {};
  if (gw) {
    try { process.kill(gw.pid, 0); online = true; } catch {}
    platforms = gw.platforms || {};
  }
  const env = safe(path.join(home, ".env"));
  const configuredPlatforms = [];
  if (env.includes("TELEGRAM_BOT_TOKEN")) configuredPlatforms.push({ name: "telegram", state: platforms.telegram?.state || (online ? "configured" : "offline") });
  if (env.includes("DISCORD_BOT_TOKEN")) configuredPlatforms.push({ name: "discord", state: platforms.discord?.state || (online ? "configured" : "offline") });
  if (env.includes("SLACK_BOT_TOKEN")) configuredPlatforms.push({ name: "slack", state: platforms.slack?.state || (online ? "configured" : "offline") });
  if (env.includes("WHATSAPP_ENABLED")) configuredPlatforms.push({ name: "whatsapp", state: platforms.whatsapp?.state || "configured" });
  if (env.includes("SIGNAL_HTTP_URL")) configuredPlatforms.push({ name: "signal", state: platforms.signal?.state || "configured" });
  if (env.includes("EMAIL_ADDRESS")) configuredPlatforms.push({ name: "email", state: platforms.email?.state || "configured" });
  if (env.includes("SLACK_WEBHOOK_URL") && !env.includes("SLACK_BOT_TOKEN")) configuredPlatforms.push({ name: "slack-webhook", state: "configured" });

  // Find last log entry
  const logFile = path.join(ROOT, agent.name + "-log.md");
  const logContent = safe(logFile);
  const lastTs = (logContent.match(/(\d{4}-\d{2}-\d{2} \d{2}:\d{2} UTC)/g)||[]).pop() || "";

  // Find last platform from fabric
  const fabricEntries = getFabricEntries().filter(e => e.agent === agent.name);
  const lastPlatform = fabricEntries.length > 0 ? fabricEntries[0].platform : "";

  return {
    name: agent.name,
    role: agent.role || "",
    online,
    platforms: configuredPlatforms,
    lastActive: lastTs,
    lastPlatform,
    cycles: parseCycles(logContent),
  };
}

function getCompaction() {
  const raw = safe(path.join(ROOT, "compaction-history.md"));
  const events = [];
  for (const block of raw.split(/^---$/m)) {
    const m = block.match(/## (.+)/);
    if (!m) continue;
    const lines = block.split("\n").filter(l => l.trim() && !l.startsWith("##"));
    events.push({ timestamp: m[1].trim(), details: lines.map(l => l.trim()) });
  }
  return events.reverse().slice(0, 5);
}

function getData() {
  const agents = parseAgents();
  const agentStatuses = agents.map(getAgentStatus);
  const fabricEntries = getFabricEntries();
  const hot = fabricEntries.filter(e => e.tier === "hot").length;
  const warm = fabricEntries.filter(e => e.tier === "warm").length;
  const cold = fabricEntries.filter(e => e.tier === "cold").length;
  const totalCycles = Math.max(...agentStatuses.map(a => a.cycles.length), 0);
  const allPlatforms = [...new Set(agentStatuses.flatMap(a => a.platforms.map(p => ({ ...p }))))];

  // Feed: last cycle from each agent
  const feed = [];
  for (const a of agentStatuses) {
    if (a.cycles.length > 0) {
      const last = a.cycles[a.cycles.length - 1];
      feed.push({ agent: a.name, cycle: last.cycle, timestamp: last.timestamp, thought: last.thought, response: last.response });
    }
  }

  // Timeline: entries per day per agent
  const timeline = {};
  for (const e of fabricEntries) {
    const day = e.timestamp.slice(0, 10);
    if (!day) continue;
    if (!timeline[day]) timeline[day] = {};
    timeline[day][e.agent] = (timeline[day][e.agent] || 0) + 1;
  }

  return {
    agents: agentStatuses,
    fabricEntries: fabricEntries.slice(0, 20),
    feed: feed.sort((a,b) => b.cycle - a.cycle),
    stats: {
      activeAgents: agentStatuses.filter(a => a.online).length,
      totalAgents: agentStatuses.length,
      totalCycles,
      memoryEntries: fabricEntries.length,
      hot, warm, cold,
      platformsConnected: agentStatuses.flatMap(a => a.platforms.filter(p => p.state === "connected")).length,
      allPlatforms: [...new Set(agentStatuses.flatMap(a => a.platforms.map(p => p.name)))],
      brainSize: fabricSize(),
    },
    compaction: getCompaction(),
    timeline,
    lastCycleTs: feed.length > 0 ? feed[0].timestamp : "",
  };
}

// SSE
const clients = new Set();
function broadcast() {
  const d = JSON.stringify(getData());
  for (const c of clients) c.write("data: " + d + "\n\n");
}

const watched = new Set();
function watchAll() {
  const paths = [
    AGENTS_FILE,
    path.join(ROOT, "compaction-history.md"),
    ...parseAgents().map(a => path.join(ROOT, a.name + "-log.md")),
    ...parseAgents().map(a => path.join(a.home || path.join(HOME, ".hermes-" + a.name), "gateway_state.json")),
  ];
  if (fs.existsSync(FABRIC)) paths.push(FABRIC);
  for (const p of paths) {
    if (watched.has(p)) continue;
    try { fs.watch(p, { persistent: false }, () => broadcast()); watched.add(p); } catch {}
  }
}
watchAll();
setInterval(watchAll, 10000);

const HTML = safe(path.join(ROOT, "dashboard.html"));

const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");

  if (url.pathname === "/api/data") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(getData()));
    return;
  }
  if (url.pathname === "/api/stream") {
    res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
    res.write("data: " + JSON.stringify(getData()) + "\n\n");
    clients.add(res);
    req.on("close", () => clients.delete(res));
    return;
  }

  // Actions
  if (req.method === "POST") {
    if (url.pathname === "/api/action/cycle") {
      exec("bash " + path.join(ROOT, "dialogue.sh") + " >> " + path.join(ROOT, "cron.log") + " 2>&1");
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end('{"ok":true,"action":"cycle started"}');
      return;
    }
    if (url.pathname === "/api/action/compact") {
      exec("FORCE_COMPACT=1 bash " + path.join(ROOT, "dialogue.sh") + " >> " + path.join(ROOT, "cron.log") + " 2>&1");
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end('{"ok":true,"action":"compaction started"}');
      return;
    }
    if (url.pathname === "/api/action/add-agent") {
      let body = "";
      req.on("data", c => body += c);
      req.on("end", () => {
        try {
          const { name, role } = JSON.parse(body);
          exec("bash " + path.join(ROOT, "add-agent.sh") + " --name " + name + " --role '" + role + "'");
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end('{"ok":true,"action":"agent ' + name + ' added"}');
        } catch (e) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end('{"error":"invalid request"}');
        }
      });
      return;
    }
  }

  res.writeHead(200, { "Content-Type": "text/html" });
  res.end(HTML);
});

server.listen(PORT, () => console.log("dashboard: http://localhost:" + PORT));
