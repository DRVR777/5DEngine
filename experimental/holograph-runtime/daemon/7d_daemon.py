#!/usr/bin/env python3
from __future__ import annotations
import argparse, asyncio, json, signal, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from adapters import agent_bus_adapter, db_adapter, docker_adapter, nginx_adapter, process_adapter

async def broadcaster(queue: asyncio.Queue, clients: set) -> None:
    while True:
        event = await queue.get()
        payload = json.dumps(event, separators=(',', ':'))
        dead = []
        for client in clients:
            try:
                await client.send(payload)
            except Exception:
                dead.append(client)
        for client in dead:
            clients.discard(client)

async def run(host: str, port: int) -> None:
    try:
        import websockets
    except ImportError as exc:
        raise SystemExit('websockets package is required; no service was started') from exc
    queue: asyncio.Queue = asyncio.Queue(maxsize=10000)
    clients: set = set()
    async def handler(ws):
        clients.add(ws)
        try:
            await ws.wait_closed()
        finally:
            clients.discard(ws)
    tasks = [
        asyncio.create_task(broadcaster(queue, clients)),
        asyncio.create_task(process_adapter.observe(queue)),
        asyncio.create_task(docker_adapter.observe(queue)),
        asyncio.create_task(nginx_adapter.observe(queue)),
        asyncio.create_task(db_adapter.observe(queue)),
        asyncio.create_task(agent_bus_adapter.observe(queue)),
    ]
    stop = asyncio.Event()
    for sig in (signal.SIGINT, signal.SIGTERM):
        asyncio.get_running_loop().add_signal_handler(sig, stop.set)
    async with websockets.serve(handler, host, port):
        await stop.wait()
    for task in tasks:
        task.cancel()

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='7D Engine read-only broadcast daemon')
    parser.add_argument('--host', default='127.0.0.1')
    parser.add_argument('--port', type=int, default=7700)
    args = parser.parse_args()
    asyncio.run(run(args.host, args.port))
