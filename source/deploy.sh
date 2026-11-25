#!/bin/sh
# one-shot build + deploy: sh source/deploy.sh "commit message"
set -e
cd "$(dirname "$0")"
# Linux: tools in /tmp/tools. Windows (Git Bash): tools in source/.tools, which is gitignored.
case "$(uname -s)" in MINGW*|MSYS*|CYGWIN*) TOOLS="$(pwd -W)/.tools" ;; *) TOOLS=/tmp/tools ;; esac
export DS_TOOLS="$TOOLS" PYTHONUTF8=1  # Windows Python defaults to cp1252
[ -e "$TOOLS/node_modules/.bin/esbuild" ] || (mkdir -p "$TOOLS" && cd "$TOOLS" && echo '{"name":"tools","private":true}' > package.json && npm i -s purgecss@6 esbuild >/dev/null)
# first Python that actually runs (Windows has a python3 stub that only opens the Store)
for PY in python3 py python; do "$PY" -c "import sys" >/dev/null 2>&1 && break; done
"$PY" build.py | tail -1
cp -r dist/* ..
cd ..
git add -A
git -c user.name="Dylan Mahal" -c user.email="DylanMahal@users.noreply.github.com" commit -q -m "${1:-update}"
git -c push.negotiate=true push -q origin HEAD 2>&1 | grep -iv "moved\|new location\|dylans-system.git" || true
git log --oneline -1
