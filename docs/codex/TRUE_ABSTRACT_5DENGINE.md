# True Abstract 5D Engine

## Principle

Everything is a world. Every world is a graph. Every graph has configurable
dimensions. Every node has state. Every edge has meaning. Every behavior is a
policy. Every runtime integration is an adapter. Every action is proposed before
mutation.

## Universal 5D Model

A true 5D engine does not hardcode a game, a server, a path, a port, or a host.
It interprets manifests that describe nodes, links, dimensions, adapters,
policies, views, desired state, and verification rules.

The same substrate can represent:

- a game world
- a server
- a process tree
- a database graph
- a repo graph
- a network graph
- a backup graph
- an agent swarm
- a visual control plane
- an operating-system state

## Configurable Dimensions

Dimensions are data, not fixed class fields:

```hgrl
dimensions {
  x = identity
  y = dependency
  z = runtime_depth
  u = world_membership
  v = machine_membership
  w = network_replication
  t = time_version_history
}
```

## Rendering As A View

Three.js, Markdown, Mermaid, JSON, and a dashboard are all views over the same
graph. The renderer should never own the truth. The graph owns the truth, and
views choose how to reveal it.

## Server As World

A server is a graph-world containing process nodes, service nodes, socket nodes,
database nodes, repo nodes, log nodes, backup nodes, and agent nodes. A process
tree, database schema, or P2P topology can be treated as a nested world.
