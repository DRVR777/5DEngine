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

**Foundation total: 52/52 tests passing.**

## Up next (from MASTER_PLAN.md)

- **iter 7** — ECS-lite registry: one entity table, `$header/$facets`
  envelope. Refactor hero/car/NPCs/coins onto it. (FOUNDATION — required
  for all later iters.)
- **iter 8** — AABB hitboxes + collision response (no walking through walls).
- **iter 9** — Per-world physics profile (gravity, time scale).
- **iter 10** — Health facet + damage events.

## Wakeup checklist

1. `cat 5DEngine/MASTER_PLAN.md`
2. `cat 5DEngine/STATUS.md` (this file)
3. `bash 5DEngine/smoke.sh` — must be green before starting
4. Pick next unfinished iter from MASTER_PLAN
5. PLAN → CODE → TEST → REVISE → COMMIT → PUSH
6. Append a row to "Shipped" above
