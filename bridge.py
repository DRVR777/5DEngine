"""
5DEngine bridge — dispatch + fallback using protocol-adapter dispatch module.
Handles peer messages even when directory is unreachable.
"""

import asyncio, json, os, sys, time, subprocess

def get_dispatch_result(peer_id, message):
    """Call into Node.js dispatch module. Falls back to ack-only if JS fails."""
    try:
        result = subprocess.run(
            ["node", "--input-type=module", "-e", f"""
            const {{ handlePeerMessage }} = await import('./packages/protocol-adapter/dispatch.js');
            const result = handlePeerMessage(null, '{peer_id}', {json.dumps(message)});
            console.log(JSON.stringify(result));
            """],
            capture_output=True, text=True, timeout=5, cwd=os.path.dirname(os.path.abspath(__file__))
        )
        return json.loads(result.stdout.strip())
    except Exception:
        return {"handled": False, "response": None}

async def bridge_main(node_ws_url, peer_id, agent_name):
    """Main bridge loop with infinite retry on disconnect."""
    retry = 0
    while True:
        try:
            import websockets
            async with websockets.connect(node_ws_url, ping_interval=15) as ws:
                retry = 0
                print(f"[{agent_name}] Connected to node {node_ws_url}")
                while True:
                    try:
                        msg = await asyncio.wait_for(ws.recv(), timeout=60)
                        data = json.loads(msg)
                        if data.get("from") == peer_id:
                            result = get_dispatch_result(peer_id, data.get("message", ""))
                            if result.get("response"):
                                await ws.send(json.dumps({"to": peer_id, "message": result["response"]}))
                    except asyncio.TimeoutError:
                        await ws.send(json.dumps({"type": "ping"}))
                    except json.JSONDecodeError:
                        pass
        except Exception as e:
            retry += 1
            wait = min(0.5 * (2 ** (retry - 1)), 30)
            print(f"[{agent_name}] Disconnected: {e}. Retry {retry} in {wait:.1f}s...")
            await asyncio.sleep(wait)

if __name__ == "__main__":
    import argparse
    p = argparse.ArgumentParser()
    p.add_argument("--node-ws", required=True)
    p.add_argument("--peer", required=True)
    p.add_argument("--name", default="bridge")
    args = p.parse_args()
    asyncio.run(bridge_main(args.node_ws, args.peer, args.name))
