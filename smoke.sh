#!/usr/bin/env bash
# 5DEngine smoke runner — runs every iteration test in order.
set +e   # don't bail on first failure; we want a complete tally
cd "$(dirname "$0")"

ANY_FAIL=0
for t in test_iter_*.js; do
  echo ""
  echo "==== $t ===="
  if ! node "$t"; then
    ANY_FAIL=1
  fi
done

echo ""
if [ $ANY_FAIL -eq 0 ]; then
  echo "5DENGINE SMOKE: PASS"
else
  echo "5DENGINE SMOKE: FAIL"
  exit 1
fi
