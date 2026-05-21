# sample-7d-os

## Nodes
- `server-alpha` (server)
- `world-alpha` (world.5d)
- `process-alpha` (runtime.process)
- `database-alpha` (database.postgres)
- `repo-5dengine` (repo.git)
- `dwrld-peer-alpha` (network.peer)
- `council-agent-alpha` (agent.council)
- `backup-alpha` (storage.backup)
- `dashboard-alpha` (visual.dashboard)

## Links
- `server-alpha` --hosts--> `world-alpha`
- `world-alpha` --runs_as--> `process-alpha`
- `world-alpha` --persists_to--> `database-alpha`
- `repo-5dengine` --defines--> `world-alpha`
- `world-alpha` --communicates_via--> `dwrld-peer-alpha`
- `council-agent-alpha` --observes--> `server-alpha`
- `database-alpha` --backed_up_by--> `backup-alpha`
- `dashboard-alpha` --visualizes--> `server-alpha`
