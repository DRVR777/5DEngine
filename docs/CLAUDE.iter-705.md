# CONTINUATION INSTRUCTION - Read This First

You just tried to grep `index.html` for more extractable blocks. Stop. The user corrected the direction.

## What Was Wrong

1. You were on the local Windows path. Work on the server. The authoritative writable mirror is `/home/migration-staging/7d-engine-integration/repos-cache/5DEngine`.
2. You were looking for more lines to extract from `index.html`. Extraction has reached its floor. The next phase is abstraction.
3. You were treating the task as "shrink one file." The real task is "build the runtime that makes every entity, process, service, website, request, database row, and agent message a Thing in one universal graph."

## Direction

The 5D engine becomes the visual control surface for the 7D engine. The in-game computer stops being a fake prop and becomes a real terminal into the server process graph. The screens around the player are real screens of real things happening on the actual server.

Fixed Thing format:

```yaml
id: string
kind: string
name: string
parent: string optional
created_at: ISO timestamp
facets: list
```

This instruction is itself a Thing:

```yaml
id: continuation/abstractify-into-7d
kind: instruction
name: Abstractify 5DEngine into 7D Server Engine
facets: [direction, prior_art, deliverables, refusals, bridge, screens]
```

## Concrete Requirements

- Do not extract more lines from `index.html`.
- Build a registry runtime where game Things and server Things share one row store, facet store, kind registry, reverse facet index, and tick loop.
- Produce five spec Things in `docs/codex/specs/`.
- Add read-only server adapters and a WebSocket daemon scaffold.
- Add browser bridge and server-room screen renderer modules.
- Do not run install scripts, restart services, edit production config, change firewall rules, or delete legacy gameplay files.
- Run `npm test` and `npm run browser-check` before claiming runtime success. If dependencies are unavailable, document that explicitly.
