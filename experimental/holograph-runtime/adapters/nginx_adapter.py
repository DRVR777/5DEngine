from __future__ import annotations
import asyncio, re, time
from pathlib import Path

PATTERN = re.compile(r'^(?P<ip>\S+) .*? "(?P<method>[A-Z]+) (?P<path>[^ ]+) [^"]+" (?P<status>\d+) (?P<bytes>\S+)')

async def observe(queue: asyncio.Queue, path: Path = Path('/var/log/nginx/access.log')) -> None:
    if not path.exists():
        return
    with path.open('r', errors='ignore') as fh:
        fh.seek(0, 2)
        while True:
            line = fh.readline()
            if not line:
                await asyncio.sleep(0.5)
                continue
            match = PATTERN.search(line)
            if not match:
                continue
            data = match.groupdict()
            await queue.put({'type': 'spawn', 'thing': {'id': f"http-request/{int(time.time() * 1000)}", 'kind': 'http-request', 'name': f"{data['method']} {data['path']}", 'created_at': now(), 'facets': [{'name': 'request-stream', 'data': {'method': data['method'], 'path': data['path'], 'status': int(data['status']), 'ip': data['ip'], 'bytes': data['bytes']}}, {'name': 'ttl', 'data': {'remaining': 5}}]}})

def now() -> str:
    return time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
