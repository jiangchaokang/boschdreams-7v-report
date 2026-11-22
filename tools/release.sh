#!/usr/bin/env bash
# One-step release: check the page, commit everything, push to main. The Publish workflow then deploys it to
# https://jiangchaokang.github.io/BoschDreams-7V/  (usage: tools/release.sh ["message"])
set -euo pipefail
cd "$(dirname "$0")/.."
REMOTE=${REMOTE:-https://github.com/jiangchaokang/BoschDreams-7V.git}
for f in src/*.js; do node --check "$f"; done
python3 tools/check_site.py
if [[ ! -d .git ]]; then
  git init -b main
  git remote add origin "$REMOTE"
fi
git config http.postBuffer 524288000  # the media push is large; avoid HTTP 413 / RPC errors
git add -A
git commit -m "${1:-Release $(date +%F)}" || echo "Nothing new to commit."
git push -u origin main
