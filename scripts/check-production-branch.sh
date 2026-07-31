#!/usr/bin/env bash
# Fail production deploys from unexpected branches.
# BulSU fork: allow main and feat/bulsu-campus (GitHub default during cutover).
set -euo pipefail

CURRENT_BRANCH="${VERCEL_GIT_COMMIT_REF:-$(git branch --show-current 2>/dev/null || echo "unknown")}"

if [[ "${VERCEL_ENV:-}" != "production" ]]; then
  echo "Skipping production branch check (VERCEL_ENV=${VERCEL_ENV:-local})."
  exit 0
fi

case "$CURRENT_BRANCH" in
  main | feat/bulsu-campus)
    echo "Production branch check passed ($CURRENT_BRANCH)."
    exit 0
    ;;
esac

echo "ERROR: Production builds must deploy from main or feat/bulsu-campus."
echo "Current branch: $CURRENT_BRANCH"
exit 1
