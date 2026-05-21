---
id: spec/feel-preservation
kind: spec
name: Feel Preservation Protocol
refs: [spec/migration-sequence, spec/kind-catalog]
created_at: 2026-05-21T00:00:00Z
facets: [tuning, shadow-run, authority-flip]
---

# Feel Preservation Protocol

Every numeric constant that affects feel becomes a `tuning` Thing with a `provenance` facet.

Shadow run: legacy and registry systems run together for one kind. Each tick records `{ kind, id, state_hash, tick_N }`.

Authority flip: only after shadow run and browser checks pass can the legacy mount call be removed. The barrel definition exists now, but authority remains with the legacy system until shadow comparison exists.
