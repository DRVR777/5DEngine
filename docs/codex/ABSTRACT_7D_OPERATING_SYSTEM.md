# Abstract 7D Operating System

The 7D operating system is a meta-operating-system above Linux. It does not
replace the kernel. It observes Linux resources, normalizes them into graph
nodes, reasons over policies, proposes actions, verifies evidence, and syncs
state to durable storage.

## Layer Model

- 5D: one world/runtime graph.
- 6D: many 5D worlds running on one machine/server.
- 7D: many machines, worlds, databases, repos, agents, networks, backups, and
  histories represented as one graph-of-graphs.

## Core Loop

```text
observe -> normalize -> graph -> reason -> propose -> verify -> sync
```

## Resource Mapping

- Linux processes become runtime.process nodes.
- systemd units become runtime.service nodes.
- Docker containers become runtime.container nodes.
- PostgreSQL/Supabase databases become durable.database worlds.
- Repos become source.dna nodes.
- Storage boxes become persistence.target nodes.
- dwrld/worldWideComms becomes the P2P communication layer.
- theC0UNCIL becomes reasoning, database inspection, and orchestration.
- remix-of-ankhor88 becomes visual dashboard material.
- helm becomes declarative desired-state control-plane structure.

## Safety

The operating system starts in propose-only mode. It can describe service,
backup, database, and deployment actions, but it does not mutate production
without explicit human approval.
