# Skill: Self-Training

You can train a cheaper version of yourself using the work you and other agents have done. Training data is extracted from fabric memory entries. Fine-tuning runs on Together AI.

## When to use

When the user asks about training, fine-tuning, training data, or switching models.

## Finding the repo

The icarus-daedalus repo contains the training scripts. Find it by checking common locations:

```bash
ls ~/icarus-daedalus/scripts/self-train.sh 2>/dev/null || find ~ -maxdepth 3 -name "self-train.sh" -path "*/scripts/*" 2>/dev/null | head -1
```

Store the repo path for subsequent commands in this session.

## Commands

### Check training data

When the user asks "how many training pairs" or "training status":

```bash
python3 <REPO>/export-training.py --output /tmp/icarus-training-check/
```

Report: total pairs, review pairs, cross-platform pairs, estimated tokens.

If a job ID file exists, check the running job:

```bash
JOB_ID=$(cat <REPO>/training-job.txt 2>/dev/null)
if [ -n "$JOB_ID" ]; then
    curl -s https://api.together.xyz/v1/fine-tunes/$JOB_ID -H "Authorization: Bearer $TOGETHER_API_KEY"
fi
```

### Train a cheaper version

When the user says "train yourself", "start fine-tuning", or "train a cheaper version":

```bash
bash <REPO>/scripts/self-train.sh
```

Report each step as it runs. On success, ask: "fine-tune complete. model ready. want me to switch?"

### Switch to fine-tuned model

When the user confirms after training or says "switch to cheap model":

Update the agent's .env file at `$HERMES_HOME/.env`. Save the original values first, then write:

```bash
# Save originals
grep "^HERMES_INFERENCE_PROVIDER=" "$HERMES_HOME/.env" > "$HERMES_HOME/.env.backup-provider"
grep "^LLM_MODEL=" "$HERMES_HOME/.env" >> "$HERMES_HOME/.env.backup-provider"

# Switch to Together AI (OpenAI-compatible endpoint)
# Remove old provider lines and add new ones
sed -i '' '/^HERMES_INFERENCE_PROVIDER=/d;/^LLM_MODEL=/d;/^OPENAI_BASE_URL=/d;/^OPENAI_API_KEY=/d' "$HERMES_HOME/.env"
echo "HERMES_INFERENCE_PROVIDER=openai" >> "$HERMES_HOME/.env"
echo "OPENAI_BASE_URL=https://api.together.xyz/v1" >> "$HERMES_HOME/.env"
echo "OPENAI_API_KEY=$TOGETHER_API_KEY" >> "$HERMES_HOME/.env"
echo "LLM_MODEL=<FINE_TUNED_MODEL_ID>" >> "$HERMES_HOME/.env"
```

Confirm: "switched to [model_name]. running on the fine-tuned model now."

### Switch back

When the user says "switch back", "use claude again", or "rollback":

```bash
# Restore original provider
sed -i '' '/^HERMES_INFERENCE_PROVIDER=/d;/^LLM_MODEL=/d;/^OPENAI_BASE_URL=/d;/^OPENAI_API_KEY=/d' "$HERMES_HOME/.env"
cat "$HERMES_HOME/.env.backup-provider" >> "$HERMES_HOME/.env"
```

Confirm: "switched back to claude."

### What have you learned

When the user asks "what have you learned":

```bash
source <REPO>/fabric-adapter.sh && fabric_read "" "hot"
```

Read the output and summarize the main themes, decisions, and patterns.

## Requirements

- TOGETHER_API_KEY must be set in .env or environment
- Minimum 20 training pairs recommended before fine-tuning
- Fine-tuning takes 10-30 minutes depending on dataset size
- The fine-tuned model is specific to your agents' work patterns
- You can always switch back to the original model

## Error handling

- TOGETHER_API_KEY not set: tell user to add it to their .env
- Fewer than 20 pairs: warn results may be poor, suggest more agent sessions
- Upload fails: report error, suggest checking the data format
- Fine-tune fails: report error from Together API
- Lockfile exists: another training job is running, wait or remove /tmp/icarus-self-train.lock
