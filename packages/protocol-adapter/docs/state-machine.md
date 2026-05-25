# Protocol State Machine

## Peer States

```
UNKNOWN → DISCOVERED → ROUTABLE → HANDSHAKING → SECURE → ACTIVE
                                                    ↓         ↓
                                                 STALE    RECOVERING
                                                    ↓         ↓
                                               UNKNOWN ← SECURE
```

## Transitions

| From | Event | To | Condition |
|------|-------|----|-----------|
| UNKNOWN | directory discovery | DISCOVERED | peer in directory API |
| DISCOVERED | relay route confirmed | ROUTABLE | relay lists peer |
| ROUTABLE | handshake sent | HANDSHAKING | Hello dispatched |
| HANDSHAKING | KEM exchanged | SECURE | Challenge+Response verified |
| SECURE | app msg delivered | ACTIVE | first decrypted message |
| ACTIVE | heartbeat missed | STALE | no msg in keepalive period |
| STALE | reset | RECOVERING | explicit or timeout |
| STALE | timeout | UNKNOWN | TCP dropped |
| RECOVERING | re-handshake | SECURE | fresh handshake |

## Impossible States (detected and handled)

1. Relay message, peer unknown → auto-handshake (patched)
2. Peer exists, no channel → re-handshake
3. Session established, process dead → TCP keepalive (patched)
4. Bridge connected, crypto not ready → wait for peer_ready

## Readiness Signal

```json
{"type":"peer_ready","peer_id":"X","secure":true}
```

Emitted only when state == ACTIVE.

## Agent Message Envelope

```json
{
  "msg_id": "uuid",
  "conversation_id": "uuid", 
  "reply_to": "msg_id",
  "task_id": "uuid",
  "priority": "normal|high|bulk",
  "ttl_ms": 300000,
  "idempotency_key": "hash",
  "capability_claim": "web_search",
  "payload": {}
}
```
