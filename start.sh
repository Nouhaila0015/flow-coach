#!/bin/sh
# Lance Flow Coach en arrière-plan sur http://localhost:4200 (le BFF sert aussi le front buildé).
cd "$(dirname "$0")"
if [ -f flow-coach.pid ] && kill -0 "$(cat flow-coach.pid)" 2>/dev/null; then
  echo "Flow Coach déjà lancé sur http://localhost:4200"
  exit 0
fi
[ -f back/dist/server.js ] && [ -f front/dist/index.html ] || ./build.sh
nohup node back/dist/server.js > flow-coach.log 2>&1 &
echo $! > flow-coach.pid
echo "Flow Coach lancé sur http://localhost:4200"
