from __future__ import annotations

import argparse
import json
import time
from pathlib import Path

from ..db import SessionLocal
from ..models import IngestCursor
from .handlers import dispatch


def _cursor(db, source: str) -> IngestCursor:
    row = db.get(IngestCursor, source)
    if row is None:
        row = IngestCursor(source=source, byte_offset=0)
        db.add(row)
        db.flush()
    return row


def ingest_once(path: Path) -> int:
    count = 0
    db = SessionLocal()
    try:
        cur = _cursor(db, str(path))
        if not path.exists():
            return 0
        size = path.stat().st_size
        if cur.byte_offset > size:
            cur.byte_offset = 0
        with path.open("rb") as f:
            f.seek(cur.byte_offset)
            while True:
                line = f.readline()
                if not line:
                    break
                if not line.strip():
                    cur.byte_offset = f.tell()
                    continue
                try:
                    evt = json.loads(line)
                except json.JSONDecodeError:
                    cur.byte_offset = f.tell()
                    continue
                dispatch(db, evt)
                db.flush()
                cur.byte_offset = f.tell()
                count += 1
        db.commit()
        return count
    finally:
        db.close()


def watch(path: Path, interval: float = 2.0) -> None:
    while True:
        n = ingest_once(path)
        if n:
            print(f"[ingest] applied {n} events from {path}", flush=True)
        time.sleep(interval)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--file", required=True)
    ap.add_argument("--once", action="store_true")
    ap.add_argument("--interval", type=float, default=2.0)
    args = ap.parse_args()
    path = Path(args.file).expanduser()
    if args.once:
        print(f"[ingest] {ingest_once(path)} events applied")
    else:
        watch(path, interval=args.interval)


if __name__ == "__main__":
    main()
