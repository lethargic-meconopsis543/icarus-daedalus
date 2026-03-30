"""Tool schemas — what the LLM sees."""

FABRIC_RECALL = {
    "name": "fabric_recall",
    "description": (
        "Retrieve relevant memories from the shared fabric. Uses ranked scoring "
        "across keyword match, project/agent affinity, recency, and tier. "
        "Use this when you need context from past sessions, other agents' work, "
        "or cross-platform history. Returns the top matching entries with scores."
    ),
    "parameters": {
        "type": "object",
        "properties": {
            "query": {
                "type": "string",
                "description": "What to search for — a topic, question, or keyword phrase",
            },
            "max_results": {
                "type": "integer",
                "description": "Maximum entries to return (default: 5)",
            },
            "agent": {
                "type": "string",
                "description": "Boost entries from this agent (optional)",
            },
            "project": {
                "type": "string",
                "description": "Boost entries from this project (optional)",
            },
        },
        "required": ["query"],
    },
}

FABRIC_WRITE = {
    "name": "fabric_write",
    "description": (
        "Write a new entry to shared fabric memory. All agents on all platforms "
        "can read it. Linking guidelines:\n"
        "- type='review' + review_of: when you evaluate another agent's work, "
        "link back to the original entry so the chain is traceable.\n"
        "- revises: when you fix or improve an entry after receiving feedback, "
        "link to your original entry so before/after are connected.\n"
        "- status='open' + assigned_to: when handing work to a specific agent.\n"
        "Links improve retrieval, training data quality, and cross-agent awareness. "
        "If you have the source entry ID (from session context or fabric_pending), use it."
    ),
    "parameters": {
        "type": "object",
        "properties": {
            "type": {
                "type": "string",
                "description": "Entry type: task, decision, review, resolution, research, code-session, session, note",
            },
            "content": {
                "type": "string",
                "description": "The full content/body of the entry",
            },
            "summary": {
                "type": "string",
                "description": "One-line summary (shown in listings and search results)",
            },
            "tags": {
                "type": "string",
                "description": "Comma-separated tags (optional)",
            },
            "status": {
                "type": "string",
                "description": "open (requires assigned_to), completed, blocked, or superseded",
            },
            "outcome": {
                "type": "string",
                "description": "Result or conclusion. Most valuable field for training.",
            },
            "review_of": {
                "type": "string",
                "description": "When type='review': the entry you are evaluating, as agent:id (e.g. icarus:a3f29b01). Get the id from session context or fabric_pending.",
            },
            "revises": {
                "type": "string",
                "description": "When resubmitting fixed work: the original entry you are revising, as agent:id. Connects the before/after for training.",
            },
            "customer_id": {
                "type": "string",
                "description": "Customer/account scope. Carry forward from the original entry when resolving a ticket.",
            },
            "assigned_to": {
                "type": "string",
                "description": "When status='open': the agent who should pick this up. Required for the entry to appear in their fabric_pending.",
            },
        },
        "required": ["type", "content", "summary"],
    },
}

FABRIC_PENDING = {
    "name": "fabric_pending",
    "description": (
        "Show work assigned to you. Returns entry metadata including IDs for linking.\n"
        "- open_tasks: work from other agents you need to act on. Could be code to "
        "review, research to implement, a ticket to resolve, or a task to complete. "
        "Check the entry type to decide your response.\n"
        "- reviews_of_my_work: feedback from other agents on your entries. "
        "Use revises to link your fix back to the original.\n"
        "- open_tickets: customer-scoped entries. Carry customer_id forward when resolving.\n"
        "Call at session start to see what needs attention."
    ),
    "parameters": {
        "type": "object",
        "properties": {
            "customer_id": {
                "type": "string",
                "description": "Filter to a specific customer (optional)",
            },
        },
        "required": [],
    },
}

FABRIC_SEARCH = {
    "name": "fabric_search",
    "description": (
        "Keyword search across all fabric entries. Simpler than fabric_recall — "
        "just grep. Use when you know the exact term you're looking for "
        "(a function name, error message, specific ID). Returns matching filenames "
        "and the lines that matched."
    ),
    "parameters": {
        "type": "object",
        "properties": {
            "query": {
                "type": "string",
                "description": "Exact keyword or phrase to search for",
            },
        },
        "required": ["query"],
    },
}

FABRIC_EXPORT = {
    "name": "fabric_export",
    "description": (
        "Export all fabric entries as fine-tuning training pairs. Generates "
        "OpenAI, Together AI, and HuggingFace format JSONL files. Use before "
        "fabric_train to prepare training data. Returns pair count, token "
        "estimate, and breakdown by type."
    ),
    "parameters": {
        "type": "object",
        "properties": {},
        "required": [],
    },
}

FABRIC_TRAIN = {
    "name": "fabric_train",
    "description": (
        "Start a fine-tuning job on Together AI using your fabric entries as "
        "training data. Exports data, uploads, and kicks off training. Returns "
        "immediately with a job ID — use fabric_train_status to check progress. "
        "Requires TOGETHER_API_KEY in the agent's .env."
    ),
    "parameters": {
        "type": "object",
        "properties": {
            "model": {
                "type": "string",
                "description": "Base model (default: Qwen/Qwen2-7B-Instruct)",
            },
            "suffix": {
                "type": "string",
                "description": "Model name suffix (default: agent name)",
            },
            "epochs": {
                "type": "integer",
                "description": "Training epochs (default: 3)",
            },
            "batch_size": {
                "type": "integer",
                "description": "Together batch size, must be >= 8 (default: 8)",
            },
            "learning_rate": {
                "type": "number",
                "description": "Together learning rate, must be > 0 (default: 1e-5)",
            },
            "n_checkpoints": {
                "type": "integer",
                "description": "Together checkpoint count, must be >= 1 (default: 1)",
            },
        },
        "required": [],
    },
}

FABRIC_TRAIN_STATUS = {
    "name": "fabric_train_status",
    "description": (
        "Check the status of a Together AI fine-tuning job. If completed, returns "
        "the output model ID that can be set in .env as LLM_MODEL. "
        "Pass a job ID or omit to check the most recent job."
    ),
    "parameters": {
        "type": "object",
        "properties": {
            "job_id": {
                "type": "string",
                "description": "Fine-tune job ID (omit to check last job)",
            },
        },
        "required": [],
    },
}
