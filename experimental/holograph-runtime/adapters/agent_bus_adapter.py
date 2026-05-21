from __future__ import annotations
import asyncio, time
from pathlib import Path

async def observe(queue: asyncio.Queue, path: Path = Path('/home/migration-staging/7d-engine-integration')) -> None:
    seen: set[Path] = set()
    while True:
        for file in path.glob('*.md'):
            if file in seen:
                continue
            seen.add(file)
            await queue.put({'type': 'spawn', 'thing': {'id': f'agent-message/{file.name}', 'kind': 'agent-message', 'name': file.name, 'created_at': now(), 'facets': [{'name': 'agent-message', 'data': {'agent': 'codex', 'message': file.name, 'path': str(file)}}, {'name': 'ttl', 'data': {'remaining': 300}}]}})
        await asyncio.sleep(15)

def now() -> str:
    return time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
