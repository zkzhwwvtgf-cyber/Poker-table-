#!/bin/bash
# Relance le serveur automatiquement s'il plante
cd "$(dirname "$0")"
while true; do node server.js >> server.log 2>&1; echo "$(date) serveur arrêté, relance dans 2 s" >> server.log; sleep 2; done
