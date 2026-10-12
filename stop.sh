#!/bin/sh
# Arrête Flow Coach lancé par start.sh.
cd "$(dirname "$0")"
if [ -f flow-coach.pid ] && kill "$(cat flow-coach.pid)" 2>/dev/null; then
  echo "Flow Coach arrêté"
else
  echo "Flow Coach n'était pas lancé"
fi
rm -f flow-coach.pid
