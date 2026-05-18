# 5DEngine — Multiplayer Design Plan

## Core Philosophy

**Peer-to-peer through the router — no centralized authority.**
No dedicated server making decisions. Each client is authoritative over its own
character. Packets stream continuously between peers via the router (LAN or
NAT-traversal for internet play).

**Your position is NEVER touched by the network. Period.**
Getting shot does not move you. Getting hit by a car does not move you. A packet
from another player's computer has zero authority over your local position — ever.
The only thing that moves you is your own input. Network lag is lag. It is not
a correction signal. There is no scenario where receiving a packet should result
in your character being repositioned. Damage packets say "you took X HP." That's
it. They contain no position data worth acting on.

**Local experience is always correct.**
If you shoot someone and it hits on your screen, it hit. The other player's
client receives a damage notification and subtracts HP from wherever THEY
currently are standing. The bullet's impact position on their screen may be
slightly offset due to network lag — that's fine and expected. Both screens
feel smooth.

**No rollback / no rewind.**
Rollback netcode (used in fighting games) corrects mispredictions by replaying
the simulation. We don't want it. In an open-world game it causes visible
stuttering and micro-teleports. Accept that two clients may see slightly different
world states; smoothness wins over perfect consistency.

**Dead-reckoning must be invisible.**
Between 20Hz position packets, predict where a remote object is by continuing
its last known trajectory. The prediction is always lerped (smoothly blended)
with the next received packet — never snapped. A remote car should slide
smoothly across both screens even between packets. If dead-reckoning ever
produces a visible pop or stutter, the lerp parameters need tuning, not removal.

**Continuous packet streaming.**
Position packets at ~20Hz. Discrete events (damage, kill, wave state, pickup)
sent immediately as `mp_event`. Always fire and forget — no ACK waiting, no
round-trip before acting locally.

---

## Shared Build Mode (Collaborative World State)

Both players can enter build mode simultaneously. Objects spawned, moved, or
deleted by either player are immediately visible to all connected peers.

### How it works

Every build action emits an `mp_event` with a build sub-type:

```js
// Spawn object
mp_event { type: "build", action: "spawn", spec: { id, primitive, pos, rot, scale, material } }

// Move / transform object
mp_event { type: "build", action: "transform", id, pos, rot, scale }

// Delete object
mp_event { type: "build", action: "delete", id }

// Material change
mp_event { type: "build", action: "material", id, color, opacity }
```

On receive, the peer's `worldBuilder` applies the same operation to its local
scene. Object IDs are assigned by the originating client (`${peerId}_${Date.now()}_${Math.random()}`)
so they never collide between two peers generating IDs simultaneously.

### Consistency rule
Build events are fire-and-forget, same as position packets. If a packet is
lost, the object won't appear on the other screen — that's acceptable for a
LAN game. We don't need a full CRDT or operational transform system. If
consistency becomes a problem, add a periodic full-state sync on `mp_welcome`
(send the entire current scene JSON to a newly-joining player).

### Join-late sync
When a player joins mid-session:
- Host sends `mp_event { type: "build", action: "sync", scene: worldBuilder.exportScene() }`
- Joining client calls `worldBuilder.rehydrate(scene)` to catch up.

### Authority
Build mode has no authority — both players can edit simultaneously. If they
both move the same object at the same time, last-write-wins (whoever's packet
arrives last). That's fine.

---

## What's Already Built

- `game_server.py` — Flask-SocketIO LAN relay server (port 5050)
  - `mp_welcome` — snapshot of current peers on connect
  - `mp_player_joined` / `mp_player_left` — lifecycle events
  - `mp_name` — display name announcement
  - `mp_pos` — high-frequency position relay (~20Hz)
  - `mp_event` — discrete game events (relay pass-through, any shape)
- `_mp` IIFE in index.html — client-side multiplayer object
  - `_mp.tick(dt)` called every frame
  - Remote players rendered as ghost meshes

---

## What Needs to Be Built

### 1. Remote player interpolation (smooth movement)
Lerp toward received position each frame — never snap:
```js
for (const [id, peer] of _mp.peers) {
  peer.mesh.position.lerp(peer.targetPos, Math.min(1, dt * 12));
  peer.mesh.rotation.y += angleDiff(peer.mesh.rotation.y, peer.targetHeading) * Math.min(1, dt * 10);
}
```
Hides up to ~80ms of jitter. No rollback needed.

### 2. Dead-reckoning for vehicles
```js
// On packet receive:
peer.lastPos = receivedPos;
peer.velocity = (receivedPos - peer.prevPos) / timeSinceLastPacket;
peer.prevPos = receivedPos;

// In tick():
const predicted = peer.lastPos.clone().addScaledVector(peer.velocity, timeSincePacket);
peer.mesh.position.lerp(predicted, Math.min(1, dt * 8));
```
Car feels smooth even between 50ms packets.

### 3. Damage handling
```js
// On mp_event { type: "damage", amount }:
// → subtract HP from peer's displayed bar
// → spawn damage number at peer.mesh.position (current local position, not packet position)
// → play hit reaction animation
// → NOTHING ELSE. Do not touch position.
```

### 4. Build mode sync
- Hook `worldBuilder` spawn/move/delete to emit `mp_event { type: "build", ... }`
- On receive: call corresponding `worldBuilder` method with the received spec
- On `mp_welcome`: if host, send `mp_event { type: "build", action: "sync", scene }` to new peer

### 5. Host election
```js
const isHost = mp_welcome.peers.length === 0;
// Host runs: enemy AI, wave manager, broadcasts wave_state / enemy_state diffs
// Guest suppresses: local enemy AI spawn, local wave advancement
```

### 6. Entity authority table
| Entity              | Authority                          |
|---------------------|------------------------------------|
| Local player pos    | Local client — never touched by net |
| Remote player pos   | Last packet + lerp                 |
| Bullets             | Shooter's client — fire and forget  |
| Enemy AI            | Host only                          |
| Wave state          | Host → broadcast mp_event           |
| Pickups             | First collector wins, broadcast despawn |
| Build objects       | Last writer wins                   |

### 7. NAT / internet play (future)
- Simplest: host the Flask relay on a VPS, both players connect to it
- Real P2P: WebRTC with a signaling server for hole-punching
- For now: LAN only (same WiFi / router) — no port forwarding needed

---

## Things That Would Make the Game Feel Laggy — Avoid All Of These

- Snapping remote positions instead of lerping
- Moving the local player based on any remote packet — ever
- Waiting for a server ACK before processing a local action
- Including position data in damage packets and acting on it
- Running enemy AI on every client (duplicate spawns, desync)
- Full scene syncs every tick — diff only, sync on join
- Blocking render loop for socket I/O — always async buffer reads

---

## Sequencing

Finish Phase 2–3 of the optimization loop (B5–C5), then implement multiplayer
in order: §1 lerp → §3 damage → §4 build sync → §5 host election → §2 dead-reckoning.

---

## Notes on the Combinatorics Tangent

n elements → n*(n-1)/2 unique pairs = O(n²) because Big-O drops constants and
lower-order terms: (n²-n)/2 → n² dominates. To detect two pairs with the same
sum: iterate all pairs, compute each sum, check a hash set for collision. One
lookup per pair. O(n²) time, O(n²) space.
