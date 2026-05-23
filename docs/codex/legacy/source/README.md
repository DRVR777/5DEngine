# Legacy Source Clone

Byte-for-byte snapshot of the legacy game source — every file
`game.html` depends on — preserved here so substrate migration
work can diff against an untouched reference at any time.

Per `CLAUDE.md`, the legacy authority must remain readable until
the substrate proves equivalent behavior (shadow-run / authority-
flip discipline from `docs/SECOND_ABSTRACTION_PHASE.md`).

## Contents

- `src/`              — every .js module the legacy includes
- `assets/`           — static assets
- `game.html`         — legacy entry HTML
- `index.html`        — substrate entry HTML (also snapshotted
                        for diff against future rewrites)
- `package.json` /    — pinned dependency versions
  `package-lock.json`
- `MANIFEST.sha256`   — sha256 of every file, used by
                        `tools/clone_legacy_source.mjs` to detect
                        legacy drift on each re-run

## Refresh

```bash
node tools/clone_legacy_source.mjs
```

Idempotent: only files whose hash has changed since the last run
are rewritten. The manifest is always regenerated.

## Per-mount call-site clones

For mechanical extraction at the subsystem level, see
`../mount_calls/` (cloned by `tools/clone_legacy_mounts.mjs`).
