from __future__ import annotations

import os
from pathlib import Path
from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, sessionmaker

DB_PATH = Path(os.environ.get("ICARUS_DB", Path(__file__).resolve().parents[1] / "icarus.db"))
DB_URL = f"sqlite:///{DB_PATH}"

engine = create_engine(DB_URL, future=True, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(engine, autoflush=False, autocommit=False, future=True)


class Base(DeclarativeBase):
    pass


@event.listens_for(engine, "connect")
def _fk_on(dbapi_conn, _):
    cur = dbapi_conn.cursor()
    cur.execute("PRAGMA foreign_keys=ON")
    cur.close()


def get_db():
    s = SessionLocal()
    try:
        yield s
    finally:
        s.close()
