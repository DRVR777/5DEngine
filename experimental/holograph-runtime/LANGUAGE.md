# HGRL

HGRL is the Holographic Graph Runtime Language. It describes worlds, dimensions,
nodes, links, adapters, policies, views, desired state, verification rules, and
sync plans as data.

```hgrl
world "any" {
  dimensions {
    x = identity
    y = dependency
    z = runtime_depth
    u = world
    v = machine
    w = replication
    t = time
  }

  safety {
    default_mode = propose_only
    destructive_actions = forbidden
    secrets = redact
  }
}
```
