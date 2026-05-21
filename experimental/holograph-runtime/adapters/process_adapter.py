from __future__ import annotations
import asyncio, time
from pathlib import Path

async def observe(queue: asyncio.Queue, interval: float = 5.0) -> None:
    seen: set[str] = set()
    while True:
        live: set[str] = set()
        for proc in Path('/proc').iterdir():
            if not proc.name.isdigit():
                continue
            try:
                name = (proc / 'comm').read_text(errors='ignore').strip()
            except Exception:
                continue
            thing_id = f'server-process/{proc.name}'
            live.add(thing_id)
            await queue.put({'type': 'spawn', 'thing': {'id': thing_id, 'kind': 'server-process', 'name': name, 'created_at': now(), 'facets': [{'name': 'process-observer', 'data': {'pid': int(proc.name), 'name': name, 'cpu_pct': 0, 'mem_mb': 0}}]}})
        for gone in seen - live:
            await queue.put({'type': 'despawn', 'id': gone, 'reason': 'process-exit'})
        seen = live
        await asyncio.sleep(interval)

def now() -> str:
    return time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
