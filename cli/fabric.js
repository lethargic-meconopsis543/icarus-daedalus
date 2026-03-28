#!/usr/bin/env node
// fabric CLI -- one command to set up shared agent memory.
//
// npx icarus-fabric init     creates ~/fabric/, installs Claude Code hooks
// npx icarus-fabric status   shows entries, agents, tiers
// npx icarus-fabric context  prints relevant context for current project
// npx icarus-fabric sync     git push/pull ~/fabric/

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const HOME = process.env.HOME || process.env.USERPROFILE;
const FABRIC = path.join(HOME, "fabric");
const REPO = path.resolve(__dirname, "..");
const cmd = process.argv[2];

function run(c, opts) {
  try { return execSync(c, { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"], ...opts }).trim(); }
  catch { return ""; }
}

// ── init ──────────────────────────────────────────────
function init() {
  // create ~/fabric/
  fs.mkdirSync(FABRIC, { recursive: true });
  fs.mkdirSync(path.join(FABRIC, "cold"), { recursive: true });
  console.log("created " + FABRIC);

  // install Claude Code hooks
  const settingsDir = path.join(HOME, ".claude");
  fs.mkdirSync(settingsDir, { recursive: true });

  const settingsFile = path.join(settingsDir, "settings.json");
  let settings = {};
  try { settings = JSON.parse(fs.readFileSync(settingsFile, "utf-8")); } catch {}

  if (!settings.hooks) settings.hooks = {};

  const hooksDir = path.join(REPO, "hooks");

  // Stop hook: auto-write to fabric after each response
  if (!settings.hooks.Stop) settings.hooks.Stop = [];
  const hasStop = settings.hooks.Stop.some(h =>
    h.hooks && h.hooks.some(hk => hk.command && hk.command.includes("on-stop.sh"))
  );
  if (!hasStop) {
    settings.hooks.Stop.push({
      matcher: "",
      hooks: [{
        type: "command",
        command: path.join(hooksDir, "on-stop.sh"),
        async: true,
      }]
    });
    console.log("installed Stop hook (auto-write to fabric)");
  }

  // SessionStart hook: load relevant context
  if (!settings.hooks.SessionStart) settings.hooks.SessionStart = [];
  const hasStart = settings.hooks.SessionStart.some(h =>
    h.hooks && h.hooks.some(hk => hk.command && hk.command.includes("on-start.sh"))
  );
  if (!hasStart) {
    settings.hooks.SessionStart.push({
      matcher: "startup",
      hooks: [{
        type: "command",
        command: path.join(hooksDir, "on-start.sh"),
      }]
    });
    console.log("installed SessionStart hook (load context from fabric)");
  }

  fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2));
  console.log("updated " + settingsFile);

  // init git in fabric dir
  if (!fs.existsSync(path.join(FABRIC, ".git"))) {
    run("git init", { cwd: FABRIC });
    fs.writeFileSync(path.join(FABRIC, ".gitignore"), "cold/\n*.tmp\n");
    run("git add -A && git commit -m 'init fabric' --allow-empty", { cwd: FABRIC });
    console.log("initialized git repo in " + FABRIC);
  }

  console.log("\nfabric is ready.");
  console.log("  memory auto-captures after every Claude Code session");
  console.log("  context auto-loads at session start");
  console.log("  entries stored in " + FABRIC);
  console.log("\nfor cross-machine sync:");
  console.log("  cd ~/fabric && git remote add origin <your-repo>");
  console.log("  bash " + path.join(REPO, "fabric-sync.sh") + " watch");
}

// ── status ────────────────────────────────────────────
function status() {
  if (!fs.existsSync(FABRIC)) {
    console.log("fabric not initialized. run: npx icarus-fabric init");
    return;
  }

  const files = fs.readdirSync(FABRIC).filter(f => f.endsWith(".md"));
  const coldFiles = fs.existsSync(path.join(FABRIC, "cold"))
    ? fs.readdirSync(path.join(FABRIC, "cold")).filter(f => f.endsWith(".md"))
    : [];

  const agents = new Set();
  const platforms = new Set();
  let hot = 0, warm = 0, cold = coldFiles.length;

  for (const f of files) {
    const content = fs.readFileSync(path.join(FABRIC, f), "utf-8").slice(0, 500);
    const agent = (content.match(/^agent: (.+)$/m) || [])[1];
    const platform = (content.match(/^platform: (.+)$/m) || [])[1];
    const tier = (content.match(/^tier: (.+)$/m) || [])[1];
    if (agent) agents.add(agent);
    if (platform) platforms.add(platform);
    if (tier === "hot") hot++;
    else if (tier === "warm") warm++;
  }

  console.log("fabric: " + FABRIC);
  console.log("  entries: " + (files.length + coldFiles.length) + " (" + hot + " hot, " + warm + " warm, " + cold + " cold)");
  console.log("  agents:  " + (agents.size > 0 ? [...agents].join(", ") : "none"));
  console.log("  platforms: " + (platforms.size > 0 ? [...platforms].join(", ") : "none"));

  // Show last 5 entries
  if (files.length > 0) {
    console.log("\n  recent:");
    const sorted = files
      .map(f => ({ name: f, mtime: fs.statSync(path.join(FABRIC, f)).mtimeMs }))
      .sort((a, b) => b.mtime - a.mtime)
      .slice(0, 5);
    for (const f of sorted) {
      const content = fs.readFileSync(path.join(FABRIC, f.name), "utf-8").slice(0, 500);
      const summary = (content.match(/^summary: (.+)$/m) || [])[1] || f.name;
      const agent = (content.match(/^agent: (.+)$/m) || [])[1] || "?";
      console.log("    " + agent + ": " + summary);
    }
  }

  // Git status
  if (fs.existsSync(path.join(FABRIC, ".git"))) {
    const remote = run("git remote get-url origin", { cwd: FABRIC });
    console.log("\n  git: " + (remote || "no remote"));
  }
}

// ── context ───────────────────────────────────────────
function context() {
  if (!fs.existsSync(FABRIC)) {
    console.log("fabric not initialized");
    return;
  }

  const project = path.basename(process.cwd());
  const files = fs.readdirSync(FABRIC).filter(f => f.endsWith(".md"));

  const relevant = [];
  for (const f of files) {
    const content = fs.readFileSync(path.join(FABRIC, f), "utf-8");
    const head = content.slice(0, 500);

    // Relevant if: matches project name, is hot tier, or is from claude-code
    const isHot = head.includes("tier: hot");
    const matchesProject = content.includes(project);
    const isClaudeCode = head.includes("agent: claude-code");

    if (isHot || matchesProject || isClaudeCode) {
      const summary = (head.match(/^summary: (.+)$/m) || [])[1];
      const agent = (head.match(/^agent: (.+)$/m) || [])[1] || "?";
      const ts = (head.match(/^timestamp: (.+)$/m) || [])[1] || "";
      relevant.push({ agent, ts, summary: summary || f, content });
    }
  }

  if (relevant.length === 0) {
    console.log("no relevant context for " + project);
    return;
  }

  console.log("# fabric context for " + project);
  console.log("");
  for (const r of relevant.slice(0, 10)) {
    console.log("[" + r.ts + "] " + r.agent + ": " + r.summary);
  }
}

// ── sync ──────────────────────────────────────────────
function sync() {
  const script = path.join(REPO, "fabric-sync.sh");
  if (!fs.existsSync(script)) {
    console.log("fabric-sync.sh not found at " + script);
    return;
  }
  try {
    execSync("bash " + script + " sync", { stdio: "inherit" });
  } catch {}
}

// ── main ──────────────────────────────────────────────
switch (cmd) {
  case "init":    init(); break;
  case "status":  status(); break;
  case "context": context(); break;
  case "sync":    sync(); break;
  default:
    console.log("icarus-fabric: shared memory for AI agents\n");
    console.log("  npx icarus-fabric init      set up ~/fabric/ + Claude Code hooks");
    console.log("  npx icarus-fabric status    show entries, agents, tiers");
    console.log("  npx icarus-fabric context   print relevant context for this project");
    console.log("  npx icarus-fabric sync      git push/pull ~/fabric/");
}
