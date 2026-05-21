# Architecture

## Core

- `Node`: universal holographic object.
- `Link`: typed relation between nodes.
- `Graph`: node/link store with JSON, Markdown, and Mermaid exports.
- `Policy`: softcoded rule object that proposes actions.
- `Adapter`: declarative observation adapter.

## Engines

- `FiveDEngine`: manages one graph-world.
- `SixDServerEngine`: manages many 5D worlds on one server-like node.
- `SevenDEngine`: manages servers, worlds, databases, repos, backups, agents,
  and network links.
- `SevenDOperatingSystem`: observe/propose model over the 7D engine.

## Safety

The runtime is read-only/propose-only by default. Mutating adapters are outside
this prototype and must require explicit approval.
