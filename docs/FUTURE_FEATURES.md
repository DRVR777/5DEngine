# 5DEngine — Future Features Plan

Priority order: finish optimization loop (B7–D3) first, then implement in order below.

---

## F1. Game Mode Select Screen

On first spawn, a computer near the player shows a "Game Modes" OS app:
- Solo
- Co-op Build
- Wave Defense
- (future: custom modes)

Clicking a mode sets a global game mode flag and initializes the session.
Build on the existing DWRLD OS app framework (same panel pattern as Files, etc.).

---

## F2. LAN Server Probe + Friend System

A "Servers" app on the in-game computer/billboard:
- Calls a `/scan` endpoint on game_server.py that discovers other
  running game_server.py instances on the subnet (UDP broadcast or
  known-port scan: check port 5050 across 192.168.x.1–254)
- Shows found servers with player count and host name
- "Join" button → connects via SocketIO to that server
- "Add Friend" → routes through localInternetComms friend request system

Wire localInternetComms (localInternetComms/server.py + its UI) as an
in-game OS app. The in-game computer E-key opens the existing comms UI
inside the DWRLD OS panel (iframe or port the HTML into a canvas app).

---

## F3. Collaborative World Sync

Already fully designed in docs/multiplayer_plan.md §"Shared Build Mode".

Summary:
- Every build action (spawn/move/delete/material) emits mp_event { type: "build", ... }
- Peers apply it to their local worldBuilder instance
- On join: host sends full scene JSON via mp_event { type: "build", action: "sync" }
- Object IDs namespaced by peerId to avoid collisions
- Last-write-wins on simultaneous edits (acceptable for LAN co-op)

---

## F4. Network-Smoothing Pass (after multiplayer is live)

Reference: docs/multiplayer_plan.md
- Remote player lerp (§1) — dt * 12 factor, tune at runtime
- Dead-reckoning for vehicles (§2)
- Damage informational only — no position correction ever
- Jitter buffer if needed (hold 2–3 packets, consume oldest)

---

## Sequencing

```
[NOW]    Optimization loop — B7 particles, B8 multiplayer IIFE,
         C1–C5 structural wiring, D1–D3 orphan audit
[NEXT]   F1 — game mode select screen
[NEXT]   F2 — LAN probe + friend system wired to localInternetComms
[NEXT]   F3 — collaborative world sync (build mode mp_events)
[NEXT]   F4 — network smoothing pass after live testing
```
