from __future__ import annotations
import asyncio, json, shutil, subprocess, time

async def observe(queue: asyncio.Queue, interval: float = 10.0) -> None:
    if not shutil.which('docker'):
        return
    while True:
        proc = subprocess.run(['docker', 'ps', '-a', '--format', '{{json .}}'], text=True, capture_output=True)
        if proc.returncode == 0:
            for line in proc.stdout.splitlines():
                try:
                    row = json.loads(line)
                except json.JSONDecodeError:
                    continue
                name = row.get('Names') or row.get('ID')
                await queue.put({'type': 'spawn', 'thing': {'id': f'docker-container/{name}', 'kind': 'docker-container', 'name': name, 'created_at': now(), 'facets': [{'name': 'process-observer', 'data': {'name': name, 'image': row.get('Image'), 'status': row.get('Status'), 'ports': row.get('Ports')}}]}})
        await asyncio.sleep(interval)

def now() -> str:
    return time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
