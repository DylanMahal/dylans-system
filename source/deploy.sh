#!/bin/sh
# one-shot build + deploy: sh source/deploy.sh "commit message"
set -e
cd "$(dirname "$0")"
[ -x /tmp/tools/node_modules/.bin/esbuild ] || (mkdir -p /tmp/tools && cd /tmp/tools && npm init -y >/dev/null && npm i -s purgecss@6 esbuild >/dev/null)
python3 build.py | tail -1
cp -r dist/* ..
cd ..
git add -A
git -c user.name="Dylan Mahal" -c user.email="DylanMahal@users.noreply.github.com" commit -q -m "${1:-update}"
git -c push.negotiate=true push -q origin HEAD 2>&1 | grep -iv "moved\|new location\|dylans-system.git" || true
git log --oneline -1
