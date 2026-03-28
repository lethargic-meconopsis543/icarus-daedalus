#!/usr/bin/env bash
# setup.sh -- One-command setup for two-agent dialogue with cross-platform memory.
# Creates two hermes instances, configures platforms, runs a test cycle.
#
# Usage: bash setup.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

info()  { echo -e "${CYAN}$1${NC}"; }
ok()    { echo -e "${GREEN}$1${NC}"; }
warn()  { echo -e "${YELLOW}$1${NC}"; }
fail()  { echo -e "${RED}$1${NC}"; exit 1; }
ask()   { echo -en "${BOLD}$1${NC}"; }
strip() { echo "$1" | tr -d ' '; }

echo ""
echo -e "${BOLD}icarus setup${NC}"
echo "two agents, shared brain, every platform"
echo ""

# ── 1. CHECK HERMES ────────────────────────────────────
info "checking hermes..."

if command -v hermes &>/dev/null; then
    HERMES_VERSION=$(hermes version 2>/dev/null | head -1 || echo "unknown")
    ok "hermes found: $HERMES_VERSION"
else
    warn "hermes not installed."
    ask "install hermes-agent now? [Y/n] "
    read -r INSTALL_HERMES
    if [ "$INSTALL_HERMES" = "n" ] || [ "$INSTALL_HERMES" = "N" ]; then
        fail "hermes is required. install from https://github.com/NousResearch/hermes-agent"
    fi
    info "installing hermes-agent..."
    curl -fsSL https://raw.githubusercontent.com/NousResearch/hermes-agent/main/scripts/install.sh -o /tmp/hermes-install.sh || fail "download failed."
    bash /tmp/hermes-install.sh || fail "hermes install failed."
    rm -f /tmp/hermes-install.sh
    export PATH="$HOME/.local/bin:$PATH"
    command -v hermes &>/dev/null || fail "hermes install failed."
    ok "hermes installed"
fi

# ── 2. AGENT NAMES ─────────────────────────────────────
echo ""
AGENT_A_NAME="icarus"
AGENT_B_NAME="daedalus"
AGENT_A_SOUL=$(cat "$SCRIPT_DIR/icarus-SOUL.md")
AGENT_B_SOUL=$(cat "$SCRIPT_DIR/daedalus-SOUL.md")

ask "agent A name [icarus]: "
read -r CUSTOM_A
[ -n "$CUSTOM_A" ] && AGENT_A_NAME="$CUSTOM_A"

ask "agent B name [daedalus]: "
read -r CUSTOM_B
[ -n "$CUSTOM_B" ] && AGENT_B_NAME="$CUSTOM_B"

if [ "$AGENT_A_NAME" != "icarus" ] || [ "$AGENT_B_NAME" != "daedalus" ]; then
    ask "describe $AGENT_A_NAME in one line: "
    read -r A_DESC
    [ -n "$A_DESC" ] && AGENT_A_SOUL="You are $AGENT_A_NAME. $A_DESC"

    ask "describe $AGENT_B_NAME in one line: "
    read -r B_DESC
    [ -n "$B_DESC" ] && AGENT_B_SOUL="You are $AGENT_B_NAME. $B_DESC"
fi

ok "agents: $AGENT_A_NAME + $AGENT_B_NAME"

HERMES_A="$HOME/.hermes-$AGENT_A_NAME"
HERMES_B="$HOME/.hermes-$AGENT_B_NAME"

# ── 3. API KEY ─────────────────────────────────────────
echo ""
ask "anthropic API key (sk-ant-...): "
read -r API_KEY
[ -z "$API_KEY" ] && fail "API key required"

ask "model [claude-sonnet-4-20250514]: "
read -r MODEL_CHOICE
MODEL="${MODEL_CHOICE:-claude-sonnet-4-20250514}"

# ── 4. PLATFORMS ───────────────────────────────────────
echo ""
info "which platforms? (select all you want)"
echo ""
echo "  1) Telegram"
echo "  2) Discord"
echo "  3) Slack"
echo "  4) WhatsApp"
echo "  5) Signal"
echo "  6) Email"
echo ""
ask "enter numbers separated by spaces (e.g. '1 3 6'): "
read -r PLATFORM_NUMS

USE_TELEGRAM=false
USE_DISCORD=false
USE_SLACK=false
USE_WHATSAPP=false
USE_SIGNAL=false
USE_EMAIL=false

for num in $PLATFORM_NUMS; do
    case "$num" in
        1) USE_TELEGRAM=true ;;
        2) USE_DISCORD=true ;;
        3) USE_SLACK=true ;;
        4) USE_WHATSAPP=true ;;
        5) USE_SIGNAL=true ;;
        6) USE_EMAIL=true ;;
    esac
done

# platform-specific env lines accumulator
ENV_PLATFORMS_A=""
ENV_PLATFORMS_B=""

# ── 4a. TELEGRAM ───────────────────────────────────────
TG_TOKEN_A=""
TG_TOKEN_B=""
TG_GROUP_ID=""

if $USE_TELEGRAM; then
    echo ""
    info "telegram setup"
    echo ""
    echo "  step 1: message @BotFather on Telegram"
    echo "  step 2: /newbot, name it '$AGENT_A_NAME', save the token"
    echo "  step 3: /newbot again, name it '$AGENT_B_NAME', save the token"
    echo "  step 4: create a group, add both bots as admins"
    echo "  step 5: send a message in the group, then visit:"
    echo "          https://api.telegram.org/bot<TOKEN>/getUpdates"
    echo "          to find the group chat ID (negative number)"
    echo ""
    ask "$AGENT_A_NAME telegram bot token: "
    read -r TG_TOKEN_A
    TG_TOKEN_A=$(strip "$TG_TOKEN_A")
    [ -z "$TG_TOKEN_A" ] && fail "bot token required"

    ask "$AGENT_B_NAME telegram bot token: "
    read -r TG_TOKEN_B
    TG_TOKEN_B=$(strip "$TG_TOKEN_B")
    [ -z "$TG_TOKEN_B" ] && fail "bot token required"

    ask "group chat ID (negative number): "
    read -r TG_GROUP_ID
    TG_GROUP_ID=$(strip "$TG_GROUP_ID")
    [ -z "$TG_GROUP_ID" ] && fail "group chat ID required"

    ENV_PLATFORMS_A="${ENV_PLATFORMS_A}
TELEGRAM_BOT_TOKEN=$TG_TOKEN_A
TELEGRAM_HOME_CHANNEL=$TG_GROUP_ID"
    ENV_PLATFORMS_B="${ENV_PLATFORMS_B}
TELEGRAM_BOT_TOKEN=$TG_TOKEN_B
TELEGRAM_HOME_CHANNEL=$TG_GROUP_ID"
    ok "telegram configured"
fi

# ── 4b. DISCORD ────────────────────────────────────────
if $USE_DISCORD; then
    echo ""
    info "discord setup"
    echo ""
    echo "  step 1: go to https://discord.com/developers/applications"
    echo "  step 2: create two applications (one per agent)"
    echo "  step 3: Bot tab -> copy the bot token for each"
    echo "  step 4: OAuth2 -> URL Generator -> scopes: bot"
    echo "          permissions: Send Messages, Read Message History"
    echo "  step 5: invite both bots to your server using the generated URLs"
    echo "  step 6: enable Developer Mode in Discord settings"
    echo "  step 7: right-click a channel -> Copy Channel ID"
    echo "  step 8: right-click your username -> Copy User ID"
    echo ""
    ask "$AGENT_A_NAME discord bot token: "
    read -r DC_TOKEN_A
    DC_TOKEN_A=$(strip "$DC_TOKEN_A")
    [ -z "$DC_TOKEN_A" ] && fail "bot token required"

    ask "$AGENT_B_NAME discord bot token: "
    read -r DC_TOKEN_B
    DC_TOKEN_B=$(strip "$DC_TOKEN_B")
    [ -z "$DC_TOKEN_B" ] && fail "bot token required"

    ask "discord channel ID: "
    read -r DC_CHANNEL
    DC_CHANNEL=$(strip "$DC_CHANNEL")

    ask "your discord user ID: "
    read -r DC_USER
    DC_USER=$(strip "$DC_USER")

    ENV_PLATFORMS_A="${ENV_PLATFORMS_A}
DISCORD_BOT_TOKEN=$DC_TOKEN_A
DISCORD_ALLOWED_USERS=$DC_USER
DISCORD_HOME_CHANNEL=$DC_CHANNEL"
    ENV_PLATFORMS_B="${ENV_PLATFORMS_B}
DISCORD_BOT_TOKEN=$DC_TOKEN_B
DISCORD_ALLOWED_USERS=$DC_USER
DISCORD_HOME_CHANNEL=$DC_CHANNEL"
    ok "discord configured"
fi

# ── 4c. SLACK ──────────────────────────────────────────
if $USE_SLACK; then
    echo ""
    info "slack setup"
    echo ""
    echo "  step 1: https://api.slack.com/apps -> Create New App -> From Scratch"
    echo "  step 2: enable Socket Mode, create App-Level Token (xapp-...)"
    echo "  step 3: add bot scopes: chat:write, app_mentions:read,"
    echo "          channels:history, channels:read, im:history, im:read, im:write"
    echo "  step 4: subscribe to events: message.im, message.channels, app_mention"
    echo "  step 5: install to workspace, copy Bot Token (xoxb-...)"
    echo "  step 6: /invite @YourBot in the channel"
    echo "  step 7: click your profile -> Copy member ID"
    echo ""
    echo "  note: both agents can share the same Slack app, or use separate apps."
    echo ""
    ask "slack bot token (xoxb-...): "
    read -r SLACK_BOT
    SLACK_BOT=$(strip "$SLACK_BOT")
    [ -z "$SLACK_BOT" ] && fail "bot token required"

    ask "slack app token (xapp-...): "
    read -r SLACK_APP
    SLACK_APP=$(strip "$SLACK_APP")
    [ -z "$SLACK_APP" ] && fail "app token required"

    ask "your slack member ID: "
    read -r SLACK_USER
    SLACK_USER=$(strip "$SLACK_USER")

    SLACK_VARS="
SLACK_BOT_TOKEN=$SLACK_BOT
SLACK_APP_TOKEN=$SLACK_APP
SLACK_ALLOWED_USERS=$SLACK_USER"
    ENV_PLATFORMS_A="${ENV_PLATFORMS_A}${SLACK_VARS}"
    ENV_PLATFORMS_B="${ENV_PLATFORMS_B}${SLACK_VARS}"

    # also ask for webhook (for dialogue.sh posting)
    ask "slack webhook URL (optional, for dialogue posts): "
    read -r SLACK_WEBHOOK
    SLACK_WEBHOOK=$(strip "$SLACK_WEBHOOK")
    if [ -n "$SLACK_WEBHOOK" ]; then
        ENV_PLATFORMS_A="${ENV_PLATFORMS_A}
SLACK_WEBHOOK_URL=$SLACK_WEBHOOK"
        ENV_PLATFORMS_B="${ENV_PLATFORMS_B}
SLACK_WEBHOOK_URL=$SLACK_WEBHOOK"
    fi
    ok "slack configured"
fi

# ── 4d. WHATSAPP ───────────────────────────────────────
if $USE_WHATSAPP; then
    echo ""
    info "whatsapp setup"
    echo ""
    echo "  hermes uses the WhatsApp Web bridge."
    echo "  on first gateway start, scan the QR code with your phone."
    echo "  each agent needs its own phone number."
    echo ""
    ENV_PLATFORMS_A="${ENV_PLATFORMS_A}
WHATSAPP_ENABLED=true"
    ENV_PLATFORMS_B="${ENV_PLATFORMS_B}
WHATSAPP_ENABLED=true"
    ok "whatsapp will be configured on first gateway start (QR code scan)"
fi

# ── 4e. SIGNAL ─────────────────────────────────────────
if $USE_SIGNAL; then
    echo ""
    info "signal setup"
    echo ""
    echo "  hermes connects to signal-cli-rest-api."
    echo "  step 1: run signal-cli-rest-api (docker recommended):"
    echo "          docker run -p 8080:8080 bbernhard/signal-cli-rest-api"
    echo "  step 2: register a phone number through the API"
    echo ""
    ask "signal-cli API URL [http://localhost:8080]: "
    read -r SIGNAL_URL
    SIGNAL_URL="${SIGNAL_URL:-http://localhost:8080}"

    ask "signal phone number (+1234567890): "
    read -r SIGNAL_ACCOUNT
    SIGNAL_ACCOUNT=$(strip "$SIGNAL_ACCOUNT")

    SIGNAL_VARS="
SIGNAL_HTTP_URL=$SIGNAL_URL
SIGNAL_ACCOUNT=$SIGNAL_ACCOUNT"
    ENV_PLATFORMS_A="${ENV_PLATFORMS_A}${SIGNAL_VARS}"
    ENV_PLATFORMS_B="${ENV_PLATFORMS_B}${SIGNAL_VARS}"
    ok "signal configured"
fi

# ── 4f. EMAIL ──────────────────────────────────────────
if $USE_EMAIL; then
    echo ""
    info "email setup"
    echo ""
    echo "  each agent needs its own email account."
    echo "  for Gmail: enable 2FA, then create an App Password at"
    echo "  https://myaccount.google.com/apppasswords"
    echo ""
    ask "$AGENT_A_NAME email address: "
    read -r EMAIL_A
    ask "$AGENT_A_NAME email password (or app password): "
    read -r EMAIL_PASS_A
    ask "IMAP host [imap.gmail.com]: "
    read -r EMAIL_IMAP
    EMAIL_IMAP="${EMAIL_IMAP:-imap.gmail.com}"
    ask "SMTP host [smtp.gmail.com]: "
    read -r EMAIL_SMTP
    EMAIL_SMTP="${EMAIL_SMTP:-smtp.gmail.com}"
    ask "allowed sender emails (comma-separated): "
    read -r EMAIL_ALLOWED

    ENV_PLATFORMS_A="${ENV_PLATFORMS_A}
EMAIL_ADDRESS=$EMAIL_A
EMAIL_PASSWORD=$EMAIL_PASS_A
EMAIL_IMAP_HOST=$EMAIL_IMAP
EMAIL_SMTP_HOST=$EMAIL_SMTP
EMAIL_ALLOWED_USERS=$EMAIL_ALLOWED"

    echo ""
    ask "$AGENT_B_NAME email address: "
    read -r EMAIL_B
    ask "$AGENT_B_NAME email password (or app password): "
    read -r EMAIL_PASS_B

    ENV_PLATFORMS_B="${ENV_PLATFORMS_B}
EMAIL_ADDRESS=$EMAIL_B
EMAIL_PASSWORD=$EMAIL_PASS_B
EMAIL_IMAP_HOST=$EMAIL_IMAP
EMAIL_SMTP_HOST=$EMAIL_SMTP
EMAIL_ALLOWED_USERS=$EMAIL_ALLOWED"
    ok "email configured"
fi

# ── 5. CREATE DIRECTORIES ─────────────────────────────
echo ""
info "creating agent instances..."

for DIR in "$HERMES_A" "$HERMES_B"; do
    mkdir -p "$DIR"/{cron,sessions,logs,memories,skills,hooks}
done

# ── 6. WRITE SOUL FILES ───────────────────────────────
echo "$AGENT_A_SOUL" > "$HERMES_A/SOUL.md"
echo "$AGENT_B_SOUL" > "$HERMES_B/SOUL.md"
ok "wrote SOUL.md for both agents"

# ── 7. COPY CONFIG ─────────────────────────────────────
HERMES_DEFAULT_CONFIG="$HOME/.hermes/config.yaml"
if [ -f "$HERMES_DEFAULT_CONFIG" ]; then
    for DIR in "$HERMES_A" "$HERMES_B"; do
        [ -f "$DIR/config.yaml" ] || cp "$HERMES_DEFAULT_CONFIG" "$DIR/config.yaml"
    done
    ok "copied config.yaml"
fi

# ── 8. WRITE .ENV FILES ───────────────────────────────
cat > "$HERMES_A/.env" << ENVEOF
# $AGENT_A_NAME agent
ANTHROPIC_API_KEY=$API_KEY
HERMES_INFERENCE_PROVIDER=anthropic
LLM_MODEL=$MODEL
GATEWAY_ALLOW_ALL_USERS=true${ENV_PLATFORMS_A}
ENVEOF

cat > "$HERMES_B/.env" << ENVEOF
# $AGENT_B_NAME agent
ANTHROPIC_API_KEY=$API_KEY
HERMES_INFERENCE_PROVIDER=anthropic
LLM_MODEL=$MODEL
GATEWAY_ALLOW_ALL_USERS=true${ENV_PLATFORMS_B}
ENVEOF

ok "wrote .env for both agents"

# ── 9. INITIALIZE MEMORY ──────────────────────────────
for DIR in "$HERMES_A" "$HERMES_B"; do
    touch "$DIR/memories/MEMORY.md"
done
ok "initialized MEMORY.md"

# ── 10. COPY SKILLS ───────────────────────────────────
if [ -d "$SCRIPT_DIR/skills" ]; then
    for DIR in "$HERMES_A" "$HERMES_B"; do
        cp -r "$SCRIPT_DIR/skills/"* "$DIR/skills/" 2>/dev/null || true
    done
    ok "copied skills"
fi

# ── 11. START GATEWAYS ────────────────────────────────
echo ""
ANY_PLATFORM=false
$USE_TELEGRAM && ANY_PLATFORM=true
$USE_DISCORD && ANY_PLATFORM=true
$USE_SLACK && ANY_PLATFORM=true
$USE_WHATSAPP && ANY_PLATFORM=true
$USE_SIGNAL && ANY_PLATFORM=true
$USE_EMAIL && ANY_PLATFORM=true

if $ANY_PLATFORM; then
    info "starting gateways..."
    HERMES_HOME="$HERMES_A" nohup hermes gateway run > /dev/null 2>&1 &
    PID_A=$!
    sleep 3
    HERMES_HOME="$HERMES_B" nohup hermes gateway run > /dev/null 2>&1 &
    PID_B=$!
    sleep 3

    if kill -0 $PID_A 2>/dev/null && kill -0 $PID_B 2>/dev/null; then
        ok "both gateways running (PIDs: $PID_A, $PID_B)"
    else
        warn "gateway startup may have failed. check with: ps aux | grep hermes"
    fi
else
    info "no platforms configured, skipping gateway start"
fi

# ── 12. TEST CYCLE ─────────────────────────────────────
echo ""
ask "run a test dialogue cycle? [Y/n] "
read -r RUN_TEST

if [ "$RUN_TEST" != "n" ] && [ "$RUN_TEST" != "N" ]; then
    info "running test cycle..."
    if $USE_TELEGRAM; then
        export SLACK_WEBHOOK_URL="${SLACK_WEBHOOK:-}"
        bash "$SCRIPT_DIR/dialogue.sh" && ok "test cycle complete" || warn "test cycle failed"
    else
        info "dialogue.sh requires Telegram tokens. skipping test."
    fi
fi

# ── 13. CRON SETUP ─────────────────────────────────────
echo ""
ask "set up automated dialogue every 3 hours? [y/N] "
read -r SETUP_CRON

if [ "$SETUP_CRON" = "y" ] || [ "$SETUP_CRON" = "Y" ]; then
    CRON_CMD="0 */3 * * * cd \"$SCRIPT_DIR\" && bash dialogue.sh >> cron.log 2>&1"
    (crontab -l 2>/dev/null | grep -v "icarus-daedalus"; echo "$CRON_CMD") | crontab -
    ok "cron job added: every 3 hours"
fi

# ── 14. SUMMARY ────────────────────────────────────────
echo ""
echo "────────────────────────────────────────────"
echo ""
ok "setup complete"
echo ""
echo -e "  ${BOLD}agents${NC}"
echo "    $AGENT_A_NAME: $HERMES_A"
echo "    $AGENT_B_NAME: $HERMES_B"
echo ""

echo -e "  ${BOLD}platforms${NC}"
$USE_TELEGRAM && echo "    telegram: configured"
$USE_DISCORD  && echo "    discord: configured"
$USE_SLACK    && echo "    slack: configured"
$USE_WHATSAPP && echo "    whatsapp: QR code on first start"
$USE_SIGNAL   && echo "    signal: configured"
$USE_EMAIL    && echo "    email: configured"
echo ""

echo -e "  ${BOLD}shared brain${NC}"
echo "    memory written to ~/fabric/ after every cycle"
echo "    any platform can read any other platform's work"
echo "    memory files: $HERMES_A/memories/MEMORY.md"
echo ""

echo -e "  ${BOLD}commands${NC}"
echo "    run dialogue:     bash $SCRIPT_DIR/dialogue.sh"
echo "    dashboard:        node $SCRIPT_DIR/dashboard.js"
echo "    run tests:        bash $SCRIPT_DIR/test.sh"
echo "    stop gateways:    pkill -f 'hermes gateway run'"
echo "    restart gateways: HERMES_HOME=$HERMES_A hermes gateway run &"
echo "                      HERMES_HOME=$HERMES_B hermes gateway run &"
echo ""
