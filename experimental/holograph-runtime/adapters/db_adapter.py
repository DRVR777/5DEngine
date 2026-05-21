from __future__ import annotations
import asyncio, os, shutil, subprocess, time

async def observe(queue: asyncio.Queue, interval: float = 10.0) -> None:
    if not shutil.which('psql'):
        return
    query = "select datname, count(*), count(*) filter (where state='active') from pg_stat_activity group by datname;"
    while True:
        proc = subprocess.run(['psql', '-Atqc', query], text=True, capture_output=True, env=os.environ.copy())
        if proc.returncode == 0:
            for line in proc.stdout.splitlines():
                parts = line.split('|')
                if len(parts) < 3:
                    continue
                dbname, conns, active = parts[:3]
                await queue.put({'type': 'spawn', 'thing': {'id': f'database/{dbname}', 'kind': 'database', 'name': dbname, 'created_at': now(), 'facets': [{'name': 'db-connection', 'data': {'dbname': dbname, 'connections': int(conns), 'active_queries': int(active)}}]}})
        await asyncio.sleep(interval)

def now() -> str:
    return time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
