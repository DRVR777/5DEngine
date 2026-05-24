# One-Shot Migration Prompt

Generated: 2026-05-24T03:55:03.031Z

You are continuing the 5DEngine migration. Do not use `data/legacy` file count as success.
Success is increasing true `game.html` mount coverage and preserving behavior.

Read first:
- `CLAUDE.md`
- `docs/codex/GAME_HTML_FUNCTIONALITY_BACKLOG.md`
- `tools/audit_migration.mjs`
- `tools/test_legacy_bridge.mjs`

Execution rules:
1. Pick the next highest-leverage non-DONE mount from the backlog.
2. If it is `HOSTED_BIND_ONLY`, add a deterministic semantic bridge test first and update its `migration.status` to `HOSTED_SEMANTIC_PROVEN`.
3. If it is `HOSTED_SEMANTIC_PROVEN`, build the native Ankhor facet/kind, move constants into tuning, wire it into kind/spawn data, add a native parity phase, and mark `NATIVE_VERIFIED`.
4. Only after native parity passes, delete the legacy JSON and remove its world ref in a separate commit.
5. After the batch, run `node tools/test_legacy_bridge.mjs`, `node tools/test_boot_full.mjs`, and `node tools/audit_migration.mjs`.
6. Regenerate this backlog and prompt with `node tools/generate_functionality_backlog.mjs`.

Current top non-DONE rows:

1. mountAmmoPickupTick [FACET_OR_KIND] -> Verify whether existing facet/kind is complete; add parity test or mark gaps explicitly.
2. mountAmmoReloadTick [UNHOSTED] -> Create data/legacy spec or native facet from cloned mount source; add semantic proof.
3. mountAppMultiplayerWiring [UNHOSTED] -> Create data/legacy spec or native facet from cloned mount source; add semantic proof.
4. mountArmorShardTick [FACET_OR_KIND] -> Verify whether existing facet/kind is complete; add parity test or mark gaps explicitly.
5. mountArmorVestTick [UNHOSTED] -> Create data/legacy spec or native facet from cloned mount source; add semantic proof.
6. mountAssetBootstrap [UNHOSTED] -> Create data/legacy spec or native facet from cloned mount source; add semantic proof.
7. mountBarrelSystem [FACET_OR_KIND] -> Verify whether existing facet/kind is complete; add parity test or mark gaps explicitly.
8. mountBossBarTick [UNHOSTED] -> Create data/legacy spec or native facet from cloned mount source; add semantic proof.
9. mountBuilderUiRefresh [UNHOSTED] -> Create data/legacy spec or native facet from cloned mount source; add semantic proof.
10. mountBulletEnemyHitFeedbackTick [FACET_OR_KIND] -> Verify whether existing facet/kind is complete; add parity test or mark gaps explicitly.
11. mountBulletEnemyKillTick [FACET_OR_KIND] -> Verify whether existing facet/kind is complete; add parity test or mark gaps explicitly.
12. mountBulletGeo [FACET_OR_KIND] -> Verify whether existing facet/kind is complete; add parity test or mark gaps explicitly.
13. mountBulletPhysicsTick [FACET_OR_KIND] -> Verify whether existing facet/kind is complete; add parity test or mark gaps explicitly.
14. mountBulletWorldHitTick [FACET_OR_KIND] -> Verify whether existing facet/kind is complete; add parity test or mark gaps explicitly.
15. mountCamDistTick [UNHOSTED] -> Create data/legacy spec or native facet from cloned mount source; add semantic proof.
16. mountCamPitchSprings [HOSTED_BIND_ONLY] -> Add a semantic bridge test first; then build native if the behavior is small.
17. mountCamShakeTick [HOSTED_BIND_ONLY] -> Add a semantic bridge test first; then build native if the behavior is small.
18. mountCamVectors [UNHOSTED] -> Create data/legacy spec or native facet from cloned mount source; add semantic proof.
19. mountCameraPosTick [UNHOSTED] -> Create data/legacy spec or native facet from cloned mount source; add semantic proof.
20. mountCameraZoneTick [UNHOSTED] -> Create data/legacy spec or native facet from cloned mount source; add semantic proof.
21. mountCanvasPrimaryAction [UNHOSTED] -> Create data/legacy spec or native facet from cloned mount source; add semantic proof.
22. mountClockHudTick [HOSTED_SEMANTIC_PROVEN] -> Build native facet, add native parity test, then flip authority.
23. mountCoinDropTick [FACET_OR_KIND] -> Verify whether existing facet/kind is complete; add parity test or mark gaps explicitly.
24. mountCombatAmbientTick [UNHOSTED] -> Create data/legacy spec or native facet from cloned mount source; add semantic proof.
25. mountCombatHudTick [FACET_OR_KIND] -> Verify whether existing facet/kind is complete; add parity test or mark gaps explicitly.
26. mountComboAnnouncer [UNHOSTED] -> Create data/legacy spec or native facet from cloned mount source; add semantic proof.
27. mountComboHudTick [FACET_OR_KIND] -> Verify whether existing facet/kind is complete; add parity test or mark gaps explicitly.
28. mountComputerMesh [UNHOSTED] -> Create data/legacy spec or native facet from cloned mount source; add semantic proof.
29. mountComputerUI [UNHOSTED] -> Create data/legacy spec or native facet from cloned mount source; add semantic proof.
30. mountConfigEditor [UNHOSTED] -> Create data/legacy spec or native facet from cloned mount source; add semantic proof.
31. mountCrateSystem [FACET_OR_KIND] -> Verify whether existing facet/kind is complete; add parity test or mark gaps explicitly.
32. mountCrosshairTick [UNHOSTED] -> Create data/legacy spec or native facet from cloned mount source; add semantic proof.
33. mountCrouchSpeedTick [HOSTED_BIND_ONLY] -> Add a semantic bridge test first; then build native if the behavior is small.
34. mountDamageFeedback [UNHOSTED] -> Create data/legacy spec or native facet from cloned mount source; add semantic proof.
35. mountDebugHudTick [FACET_OR_KIND] -> Verify whether existing facet/kind is complete; add parity test or mark gaps explicitly.
36. mountDecalSystem [FACET_OR_KIND] -> Verify whether existing facet/kind is complete; add parity test or mark gaps explicitly.
37. mountDevConsoleGame [UNHOSTED] -> Create data/legacy spec or native facet from cloned mount source; add semantic proof.
38. mountDeviceBusTick [UNHOSTED] -> Create data/legacy spec or native facet from cloned mount source; add semantic proof.
39. mountDeviceGraphWiring [UNHOSTED] -> Create data/legacy spec or native facet from cloned mount source; add semantic proof.
40. mountDifficultySelect [UNHOSTED] -> Create data/legacy spec or native facet from cloned mount source; add semantic proof.
