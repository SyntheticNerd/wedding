#!/usr/bin/env bash
# stop-check.sh
# Stop hook — fires when the agent session ends.
# Warns if there are uncommitted changes so work is never lost.

set -euo pipefail

cd "$(git rev-parse --show-toplevel 2>/dev/null)" || exit 0

UNCOMMITTED=$(git status --porcelain 2>/dev/null | grep -v '^??' || true)
UNTRACKED=$(git status --porcelain 2>/dev/null | grep '^??' || true)
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")

if [[ -n "$UNCOMMITTED" ]]; then
  echo ""
  echo "⚠️  SESSION END — uncommitted changes detected on branch: $CURRENT_BRANCH"
  echo ""
  echo "Modified/staged files:"
  echo "$UNCOMMITTED"
  echo ""
  echo "Run: git add <files> && git commit -m 'wip: ...'"
fi

if [[ -n "$UNTRACKED" ]]; then
  echo ""
  echo "ℹ️  Untracked files present (not committed):"
  echo "$UNTRACKED" | head -10
fi
