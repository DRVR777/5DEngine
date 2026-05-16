# 5DEngine — STATUS

> **Append-only.** Every iteration adds a row. Wakeups read from the bottom.

## Shipped

| Iter | What                                                          | Tests | Commit  |
|------|---------------------------------------------------------------|-------|---------|
| 1    | Bridge math (engine↔render, camera-relative, chase cam)       | 9     | iter1   |
| 2    | Browser engine + boundary transitions                         | 7     | iter2   |
| 3    | Pointer-lock freelook, 4 NPCs, 8 buildings                    | 6     | iter3   |
| 4    | Drivable car (bicycle physics) + mini-map                     | 11    | iter4   |
| 5    | 8 collectible coins + objective + day/night cycle             | 13    | iter5   |
| 6    | Articulated character + procedural ground + sky shader        | 6     | iter6   |
| 7    | ECS-lite: entity envelope + facet/type/app registries          | 23    | iter7   |
| 8    | AABB hitboxes + substepped collision (no tunneling, slide)     | 17    | iter8   |

**Total: 92/92 tests passing.**

## Up next (from MASTER_PLAN.md)

- **iter 8.5** — Wire collision into index.html (buildings get hitboxes,
  hero blocked from walking into them). Visual integration of iter 8 API.
- **iter 9** — Per-world physics profile (gravity, time scale).
- **iter 10** — Health facet + damage events.
- **iter 11** — 7 gun types as data; bullet entity facet.

## Wakeup checklist

1. `cat 5DEngine/MASTER_PLAN.md`
2. `cat 5DEngine/STATUS.md` (this file)
3. `bash 5DEngine/smoke.sh` — must be green before starting
4. Pick next unfinished iter from MASTER_PLAN
5. PLAN → CODE → TEST → REVISE → COMMIT → PUSH
6. Append a row to "Shipped" above
