from __future__ import annotations

from pathlib import Path


def read_hgrl(path: str | Path) -> dict[str, object]:
    text = Path(path).read_text(encoding="utf-8")
    worlds = []
    for line in text.splitlines():
        line = line.strip()
        if line.startswith("world "):
            worlds.append(line.split('"')[1])
    return {"worlds": worlds, "raw": text}
