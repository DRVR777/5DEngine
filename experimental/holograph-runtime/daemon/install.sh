#!/usr/bin/env bash
set -euo pipefail
cat <<'NOTE'
This installer is intentionally inert in Codex runs.
Creating a systemd unit, starting a daemon, or editing nginx requires human approval.
NOTE
exit 2
