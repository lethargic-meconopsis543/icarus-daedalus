"""Read wiki markdown files from disk."""
from __future__ import annotations

import os
import re
from datetime import datetime, timezone
from pathlib import Path

SUBDIRS = ("entities", "topics", "sources", "indexes", "notes")
WIKILINK_RE = re.compile(r"\[\[([^\[\]]+?)\]\]")
FM_RE = re.compile(r"^---\s*\n(.*?)\n---\s*\n(.*)$", re.S)
FM_SCALAR_RE = re.compile(r'^([A-Za-z_][A-Za-z0-9_]*):\s*(.*?)\s*$')


def fabric_dir() -> Path:
    return Path(os.environ.get("FABRIC_DIR", Path.home() / "fabric")).expanduser()


def wiki_root() -> Path:
    return fabric_dir() / "wiki"


def _safe_path(rel: str) -> Path:
    root = wiki_root().resolve()
    target = (root / rel).resolve()
    if not str(target).startswith(str(root) + os.sep) and target != root:
        raise ValueError("path escapes wiki root")
    return target


def _parse_fm(text: str) -> tuple[dict, str]:
    m = FM_RE.match(text)
    if not m:
        return {}, text
    meta: dict = {}
    for line in m.group(1).splitlines():
        sm = FM_SCALAR_RE.match(line)
        if not sm:
            continue
        k, v = sm.group(1), sm.group(2).strip()
        if v.startswith('"') and v.endswith('"'):
            v = v[1:-1]
        elif v.startswith("[") and v.endswith("]"):
            v = [x.strip().strip('"') for x in v[1:-1].split(",") if x.strip()]
        meta[k] = v
    return meta, m.group(2)


def _slug(title: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", str(title).lower()).strip("-")
    return s or "untitled"


def _all_pages() -> list[Path]:
    root = wiki_root()
    if not root.exists():
        return []
    out: list[Path] = []
    for sub in SUBDIRS:
        d = root / sub
        if not d.exists():
            continue
        out.extend(p for p in d.glob("*.md") if not p.name.startswith("."))
    return out


def tree() -> dict:
    root = wiki_root()
    subdirs = []
    total = 0
    latest: datetime | None = None
    for sub in SUBDIRS:
        d = root / sub
        count = 0
        if d.exists():
            for p in d.glob("*.md"):
                count += 1
                mt = datetime.fromtimestamp(p.stat().st_mtime, tz=timezone.utc)
                if latest is None or mt > latest:
                    latest = mt
        subdirs.append({"name": sub, "count": count})
        total += count
    return {
        "subdirs": subdirs,
        "total_pages": total,
        "updated_at": latest.isoformat() if latest else None,
        "wiki_dir": str(root),
    }


def pages(subdir: str, limit: int = 100, offset: int = 0) -> list[dict]:
    if subdir not in SUBDIRS:
        raise ValueError(f"unknown subdir: {subdir}")
    d = wiki_root() / subdir
    if not d.exists():
        return []
    items = []
    for p in d.glob("*.md"):
        if p.name.startswith("."):
            continue
        st = p.stat()
        meta, _ = _parse_fm(p.read_text("utf-8", errors="replace"))
        items.append({
            "slug": f"{subdir}/{p.stem}",
            "path": f"{subdir}/{p.name}",
            "title": str(meta.get("title") or p.stem),
            "updated_at": datetime.fromtimestamp(st.st_mtime, tz=timezone.utc).isoformat(),
            "size_bytes": st.st_size,
        })
    items.sort(key=lambda x: x["updated_at"], reverse=True)
    return items[offset:offset + limit]


def _wikilink_targets(body: str) -> list[str]:
    return [m.group(1).strip() for m in WIKILINK_RE.finditer(body) if m.group(1).strip()]


def _resolve_target(target: str) -> tuple[str | None, bool]:
    """Resolve a wikilink target to a page-path like 'entities/foo.md'."""
    t = target.strip()
    if "/" in t:
        parts = t.split("/", 1)
        sub = parts[0]
        rest = parts[1].removesuffix(".md")
        candidate = wiki_root() / sub / f"{_slug(rest)}.md"
        if candidate.exists():
            return f"{sub}/{candidate.name}", True
        return f"{sub}/{_slug(rest)}.md", False
    # No subdir — search all subdirs
    slug = _slug(t)
    for sub in SUBDIRS:
        candidate = wiki_root() / sub / f"{slug}.md"
        if candidate.exists():
            return f"{sub}/{candidate.name}", True
    return None, False


def page(path: str) -> dict:
    """Fetch one page. path is relative to wiki_root, e.g. 'entities/foo.md'."""
    full = _safe_path(path)
    if not full.exists() or not full.is_file():
        raise FileNotFoundError(path)
    text = full.read_text("utf-8", errors="replace")
    meta, body = _parse_fm(text)
    rel = str(full.relative_to(wiki_root()))

    forward_links = []
    seen = set()
    for target in _wikilink_targets(body):
        if target in seen:
            continue
        seen.add(target)
        resolved_path, ok = _resolve_target(target)
        forward_links.append({
            "target": target,
            "path": resolved_path,
            "resolved": ok,
        })

    backlinks = []
    for p in _all_pages():
        if p == full:
            continue
        p_text = p.read_text("utf-8", errors="replace")
        for t in _wikilink_targets(p_text):
            res_path, ok = _resolve_target(t)
            if ok and res_path == rel:
                p_meta, _ = _parse_fm(p_text)
                backlinks.append({
                    "path": str(p.relative_to(wiki_root())),
                    "title": str(p_meta.get("title") or p.stem),
                })
                break

    sources = []
    raw_refs = meta.get("sources") or meta.get("source_refs") or []
    if isinstance(raw_refs, list):
        for ref in raw_refs:
            sources.append({"ref": str(ref)})

    return {
        "path": rel,
        "slug": rel.removesuffix(".md"),
        "title": str(meta.get("title") or full.stem),
        "body_md": body.strip(),
        "forward_links": forward_links,
        "backlinks": backlinks,
        "sources": sources,
        "updated_at": datetime.fromtimestamp(full.stat().st_mtime, tz=timezone.utc).isoformat(),
        "frontmatter": {
            k: v for k, v in meta.items()
            if k in ("type", "summary", "created_at", "updated_at", "extraction_mode", "tags", "aliases")
        },
    }
