#!/usr/bin/env bash
# Publish this folder to a NEW private GitHub repo.
# Cloud GitHub App tokens cannot create sibling repos — run this with a PAT
# that has `repo` scope (or from a machine where `gh` can create repos).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OWNER="${GITHUB_OWNER:-venkateshwareinstein-svg}"
NAME="${GITHUB_REPO:-spark-ledger-demo}"
FULL="$OWNER/$NAME"

cd "$ROOT"
npm test

if gh repo view "$FULL" >/dev/null 2>&1; then
  echo "Repo already exists: https://github.com/$FULL"
else
  echo "Creating private repo $FULL …"
  gh repo create "$FULL" --private \
    --description "Spark Ledger lead-demo — fictional hospital-group ledger (Spark Strategy)" \
    --disable-wiki --source "$ROOT" --remote origin-demo --push
  echo "Created and pushed: https://github.com/$FULL"
  exit 0
fi

if git remote get-url origin-demo >/dev/null 2>&1; then
  git remote set-url origin-demo "https://github.com/$FULL.git"
else
  git remote add origin-demo "https://github.com/$FULL.git"
fi

git push -u origin-demo HEAD:main
echo "Pushed to https://github.com/$FULL"
