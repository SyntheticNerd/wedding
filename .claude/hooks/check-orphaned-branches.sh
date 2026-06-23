#!/usr/bin/env bash
# check-orphaned-branches.sh — backstop against losing knowledge to unmerged branches.
#
# Lists docs / memory / data files that exist on a remote branch but are ABSENT
# from main, so cross-session knowledge is never stranded ("orphaned") on a
# branch that might later be deleted. Uses a tip-to-tip, added-only diff, so
# squash-merged branches (whose content IS on main) do NOT false-alarm.
set -uo pipefail
ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || exit 0
cd "$ROOT" || exit 0

git fetch --quiet --prune origin '+refs/heads/*:refs/remotes/origin/*' 2>/dev/null || true
git rev-parse --verify --quiet origin/main >/dev/null 2>&1 || exit 0
CURRENT="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo '')"

# Durable-knowledge paths worth protecting (not transient code).
PATHS=( '*.md' 'docs/**' 'memory/**' '*.jsonl' )

report=""; count=0
for ref in $(git for-each-ref --format='%(refname:short)' refs/remotes/origin 2>/dev/null); do
  branch="${ref#origin/}"
  [[ "$branch" == "main" || "$branch" == "HEAD" || "$branch" == "$CURRENT" ]] && continue
  files="$(git diff --name-only --diff-filter=A origin/main "$ref" -- "${PATHS[@]}" 2>/dev/null || true)"
  [[ -z "$files" ]] && continue
  count=$((count+1))
  report+=$'\n'"  ⚠️  branch '$branch' has files NOT on main:"$'\n'
  report+="$(printf '%s\n' "$files" | sed 's/^/        • /')"$'\n'
done

if [[ "$count" -gt 0 ]]; then
  echo ""
  echo "════════════════════════════════════════════════════════════════════"
  echo "  ORPHANED-WORK CHECK — knowledge lives only on feature branches."
  echo "  These files are NOT on main and will be LOST if the branch is deleted:"
  echo "$report"
  echo "  → Rescue: merge that branch's PR to main, or copy the files onto main,"
  echo "    then confirm  git diff origin/main <branch> -- <file>  is empty."
  echo "════════════════════════════════════════════════════════════════════"
fi
exit 0
