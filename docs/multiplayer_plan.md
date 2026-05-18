# 5DEngine — Multiplayer Design Plan

## Core Philosophy (from user)

**Peer-to-peer through the router — no centralized authority.**
No dedicated server making decisions. Each client is authoritative over its own
character. Packets stream continuously between peers via the router (LAN or
NAT-traversal for internet play).

**Local experience is always correct.**
If you shoot someone and it hits on your screen, it hit. The other player gets
a damage notification packet — they don't get teleported back to where they were
when the bullet connected. Movement is never corrected by remote state.

**No rollback / no rewind.**
Rollback netcode (used in fighting games) replays your local simulation when a
misprediction is corrected. We don't want that — the stuttering and micro-teleports
it creates would feel terrible in an open-world game. Accept that two players may
see slightly different positions; prioritize smoothness over perfect consistency.

**Car / vehicle interaction goal.**
If player A is driving and player B is standing nearby, player B should be able
to see the car coming and jump on it. Vehicle positions stream continuously so
the gap between perceived and actual position stays small enough that the
interaction feels real.

**Damage is informational, not corrective.**
- Player A shoots player B.
- On A's screen: bullet hits B at position X. A's client records the hit locally
  and sends `mp_event { type: "damage", target_id, amount, pos }`.
- On B's screen: B receives the damage packet and loses HP where B currently
  stands — no position correction, no teleport, no rewind.
- Result: both screens feel smooth. The only "wrong" thing is B might be
  visually one step to the side of where A saw the hit. That's acceptable.

**Continuous packet streaming.**
Position packets at ~20Hz (already implemented in game_server.py). Discrete
events (damage, kill, wave state, item pickup) sent immediately as `mp_event`.
No polling, no request-response — always fire and forget.

---

## What's Already Built

- `game_server.py` — Flask-SocketIO LAN relay server (port 5050)
  - `mp_welcome` — snapshot of current peers on connect
  - `mp_player_joined` / `mp_player_left` — lifecycle events
  - `mp_name` — display name announcement
  - `mp_pos` — high-frequency position relay (~20Hz)
  - `mp_event` — discrete game events (enemy kills, wave state, etc.)
- `_mp` IIFE in index.html — client-side multiplayer object
  - `_mp.tick(dt)` called every frame in the game loop
  - Remote players rendered as ghost meshes

---

## What Needs to Be Built

### 1. Remote player interpolation (smooth movement)
Instead of snapping remote players to the last received position (causes
teleporting), lerp toward the target position each frame:
```js
// In _mp.tick(dt):
for (const [id, peer] of _mp.peers) {
  const mesh = peer.mesh;
  const target = peer.targetPos;  // last received packet
  mesh.position.lerp(target, Math.min(1, dt * 12));  // 12 = lerp speed
}
```
This hides up to ~80ms of jitter completely. No rollback needed.

### 2. Heading interpolation
Same idea for rotation — lerp toward received heading so remote players
don't snap when turning.

### 3. Damage event handling
On receiving `mp_event { type: "damage", amount }`:
- Apply HP reduction locally to peer's displayed HP bar.
- Spawn a damage number at the peer's CURRENT local position (not the
  position in the packet — avoids visual teleport).
- Do NOT move the peer mesh.

### 4. Hit confirmation (optional, cosmetic)
On the shooter's side, when they fire a bullet that hits a remote player's
hitbox locally, send `mp_event { type: "hit", target_id, weapon, amount }`.
The target plays a hit reaction animation. The target's client decides
whether the damage is valid (for anti-cheat if we ever want it).

### 5. NAT traversal / internet play (future)
Current setup requires same LAN. For internet play:
- Option A: TURN relay (WebRTC-style) — route through a lightweight relay
  server but keep game logic peer-to-peer.
- Option B: Direct peer-to-peer with hole-punching via a signaling server.
- Option C: Keep the Flask relay but host it on a VPS (simplest).

### 6. Entity authority rules
| Entity       | Who's authoritative |
|--------------|---------------------|
| Hero movement| Local client always |
| Remote player position | Last received packet + lerp |
| Bullets      | Shooter's client (fire-and-forget) |
| Enemy AI     | Host player (first to connect = host) |
| Wave state   | Host player — broadcast via mp_event |
| Pickups      | First to collect wins (send mp_event, others despawn locally) |

### 7. Host election
When a player connects, check `mp_welcome.peers.length === 0`. If true,
this client is host. Host runs enemy AI and wave manager; broadcasts state
diffs via `mp_event { type: "wave_state" | "enemy_state" }`. Clients who
are not host suppress their local enemy AI.

### 8. Dead-reckoning for vehicles
Vehicles move fast. Between 20Hz position packets, dead-reckon forward:
```
predictedPos = lastReceivedPos + lastReceivedVelocity * timeSincePacket
```
Lerp from predicted toward newly received on each packet. Keeps cars from
stuttering even at 50ms LAN latency.

---

## Things That Would Make the Game Feel Laggy (avoid all of these)

- **Snapping remote positions** — replace with lerp (see §1 above).
- **Applying position corrections from remote packets to local player** — never do this.
- **Waiting for server ACK before registering a local action** — fire and forget.
- **Sending damage AND position correction together** — damage only; no position.
- **Running remote enemy AI on every client** — only host runs it.
- **High-frequency full-state syncs** — diff-only; only send what changed.
- **Blocking the render loop waiting for socket data** — socket events are
  async; they update a state buffer that tick() reads.

---

## Sequencing Decision

**Option A — Finish optimization loop first, then add multiplayer.**
Pro: Cleaner codebase to build multiplayer on top of.
Con: Multiplayer reveals new perf problems that need fixing anyway.

**Option B — Wire multiplayer now, optimize as needed.**
Pro: Earlier feedback on what actually causes lag with two players.
Con: More moving parts while optimizing.

**Recommendation:** finish Phase 2-3 of the optimization loop (B5–C5), then
implement multiplayer items 1–4 above as a dedicated loop pass. Everything
saved here will be the starting point.

---

## Notes on the Combinatorics Tangent

(You were describing why the enemy-pair check is O(n²).)
- n elements → n*(n-1)/2 unique pairs = O(n²) because Big-O drops constants
  and lower-order terms: (n²-n)/2 → the n² term dominates.
- To detect two pairs with the same sum: compute each pair's sum and insert
  into a **hash set**. If the sum is already in the set → collision → you found
  two pairs with the same sum. O(n²) time, O(n²) space. One lookup per pair.
