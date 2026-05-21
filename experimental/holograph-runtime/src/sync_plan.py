from __future__ import annotations


def append_only_sync_plan(source: str, target: str) -> dict[str, object]:
    return {
        "mode": "propose_only",
        "delete": False,
        "source": source,
        "target": target,
        "flags": ["--archive", "--human-readable"],
        "forbidden_flags": ["--delete"],
    }
