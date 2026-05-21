# Holographic Graph

## Dimensions

- `x` = `identity`
- `y` = `dependency`
- `z` = `runtime_depth`
- `u` = `world_membership`
- `v` = `machine_membership`
- `w` = `network_replication`
- `t` = `time_version_history`

## Nodes

- `server_example` (server)
- `world_alpha` (world)
- `process_alpha` (runtime.process)
- `database_alpha` (database)
- `repo_5dengine` (repo)
- `peer_dwrld` (network.peer)
- `agent_council` (agent)
- `backup_storage` (backup)
- `dashboard_visual` (visual.dashboard)

## Links

- `server_example` --hosts--> `world_alpha`
- `world_alpha` --runs_as--> `process_alpha`
- `world_alpha` --uses_state--> `database_alpha`
- `repo_5dengine` --defines--> `world_alpha`
- `peer_dwrld` --communicates--> `server_example`
- `agent_council` --inspects--> `database_alpha`
- `backup_storage` --preserves--> `database_alpha`
- `dashboard_visual` --views--> `server_example`
