# Skill: Self-Training

You can train a cheaper version of yourself using the work you and other agents have done. Training data is extracted from fabric memory entries. Fine-tuning runs on Together AI.

## When to use

When the user asks about training, fine-tuning, training data, or switching models.

## Finding the repo

```bash
ls ~/icarus-daedalus/scripts/self-train.sh 2>/dev/null || find ~ -maxdepth 3 -name "self-train.sh" -path "*/scripts/*" 2>/dev/null | head -1
```

## Commands

### Check training data

```bash
python3 <REPO>/export-training.py --output /tmp/icarus-training-check/
```

Report: total pairs, review pairs, cross-platform pairs, estimated tokens.

### Train a cheaper version

Before starting, report the model and params that will be used:

```bash
echo "model: ${TOGETHER_MODEL:-Qwen/Qwen2-7B-Instruct}"
echo "batch_size: ${TOGETHER_BATCH_SIZE:-8}"
echo "learning_rate: ${TOGETHER_LR:-1e-5}"
echo "n_checkpoints: ${TOGETHER_CHECKPOINTS:-1}"
echo "n_epochs: ${TOGETHER_EPOCHS:-3}"
```

Then run:

```bash
bash <REPO>/scripts/self-train.sh
```

To use a different model, set TOGETHER_MODEL before running:

```bash
TOGETHER_MODEL=meta-llama/Meta-Llama-3-8B-Instruct bash <REPO>/scripts/self-train.sh
```

### Switch to fine-tuned model

Use atomic file replacement:

```bash
cp "$HERMES_HOME/.env" "$HERMES_HOME/.env.backup"

python3 -c "
import sys
lines = open(sys.argv[1]).readlines()
keep = [l for l in lines if not l.startswith(('HERMES_INFERENCE_PROVIDER=','LLM_MODEL=','OPENAI_BASE_URL=','OPENAI_API_KEY='))]
keep.append('HERMES_INFERENCE_PROVIDER=openai\n')
keep.append('OPENAI_BASE_URL=https://api.together.xyz/v1\n')
keep.append('OPENAI_API_KEY=' + sys.argv[2] + '\n')
keep.append('LLM_MODEL=' + sys.argv[3] + '\n')
open(sys.argv[1] + '.tmp', 'w').writelines(keep)
" "$HERMES_HOME/.env" "$TOGETHER_API_KEY" "<FINE_TUNED_MODEL_ID>"

mv "$HERMES_HOME/.env.tmp" "$HERMES_HOME/.env"
```

If anything fails: `cp $HERMES_HOME/.env.backup $HERMES_HOME/.env`

### Switch back / Rollback

```bash
cp "$HERMES_HOME/.env.backup" "$HERMES_HOME/.env"
```

### What have you learned

```bash
source <REPO>/fabric-adapter.sh && fabric_read "" "hot"
```

## Important: model availability

Model availability is account-dependent on Together AI:

- **Qwen/Qwen2-7B-Instruct** is the validated default on this account
- Llama 3.x models may not be enabled for fine-tuning on all accounts
- Set `TOGETHER_MODEL` to override if your account has different models

## Important: hyperparameters

Together rejects requests where hyperparameters are omitted (they default to zero):

- `batch_size` must be >= 8
- `learning_rate` must be > 0 (default: 1e-5)
- `n_checkpoints` must be >= 1

The script sets all of these explicitly. Override via env vars: `TOGETHER_BATCH_SIZE`, `TOGETHER_LR`, `TOGETHER_CHECKPOINTS`, `TOGETHER_EPOCHS`.

## Requirements

- TOGETHER_API_KEY must be set in .env or environment
- Minimum 20 training pairs recommended
- Fine-tuning takes 10-30 minutes

## Troubleshooting

- **"batch size is zero"**: hyperparameters were omitted. The script now sets them explicitly. If you still see this, check that your training data has enough tokens per sample.
- **"model not found in configuration"**: the model isn't enabled for fine-tuning on your account. Try `TOGETHER_MODEL=Qwen/Qwen2-7B-Instruct`.
- **Upload succeeds but train fails**: verify model entitlement and params. Run `together files check your-file.jsonl` to validate the data format.
- **"number of checkpoints is less than one"**: set `n_checkpoints` >= 1 and ensure enough training steps (more epochs or more data).
- **Lock directory exists**: another training job is running. Wait or `rm -rf /tmp/icarus-self-train.lock/`.
