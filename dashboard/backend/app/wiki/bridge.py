"""Import the Hermes icarus plugin's wiki module so the dashboard can reuse it.

The plugin's `wiki.py` (init_wiki, ingest, lint, query, ask, llm_status) is
the source of truth. The dashboard must never duplicate that logic.
"""
from __future__ import annotations

import importlib.util
import os
import sys
from pathlib import Path
from types import ModuleType


def _plugin_dir() -> Path:
    override = os.environ.get("ICARUS_PLUGIN_DIR")
    if override:
        return Path(override).expanduser()
    return Path.home() / ".hermes" / "plugins" / "icarus"


_plugin: ModuleType | None = None


def load() -> ModuleType:
    global _plugin
    if _plugin is not None:
        return _plugin
    base = _plugin_dir()
    if not base.exists():
        raise RuntimeError(f"icarus plugin dir not found: {base}")

    pkg_name = "icarus_plugin_bridge"
    if pkg_name not in sys.modules:
        pkg_spec = importlib.util.spec_from_file_location(
            pkg_name, base / "__init__.py",
            submodule_search_locations=[str(base)],
        )
        if pkg_spec is None or pkg_spec.loader is None:
            raise RuntimeError(f"cannot build spec for {pkg_name}")
        pkg_mod = importlib.util.module_from_spec(pkg_spec)
        sys.modules[pkg_name] = pkg_mod
        pkg_spec.loader.exec_module(pkg_mod)

    wiki_name = f"{pkg_name}.wiki"
    if wiki_name in sys.modules:
        _plugin = sys.modules[wiki_name]
        return _plugin

    wiki_spec = importlib.util.spec_from_file_location(wiki_name, base / "wiki.py")
    if wiki_spec is None or wiki_spec.loader is None:
        raise RuntimeError(f"cannot build spec for {wiki_name}")
    wiki_mod = importlib.util.module_from_spec(wiki_spec)
    sys.modules[wiki_name] = wiki_mod
    wiki_spec.loader.exec_module(wiki_mod)
    _plugin = wiki_mod
    return _plugin


def ingest(source_path, fabric_dir):
    return load().ingest(str(source_path), Path(fabric_dir))


def lint(fabric_dir):
    return load().lint(Path(fabric_dir))


def llm_status(live: bool = False):
    return load().llm_status(live=live)


def init_wiki(fabric_dir):
    return load().init_wiki(Path(fabric_dir))
