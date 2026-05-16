#!/usr/bin/env bash
# gta_demo smoke runner — runs every iteration test in order.
set -e
cd "$(dirname "$0")/.."

ANY_FAIL=0
for t in gta_demo/test_iter_*.js; do
  echo ""
  echo "==== $t ===="
  if ! node "$t"; then
    ANY_FAIL=1
  fi
done

echo ""
if [ $ANY_FAIL -eq 0 ]; then
  echo "GTA_DEMO SMOKE: PASS"
else
  echo "GTA_DEMO SMOKE: FAIL"
  exit 1
fi
