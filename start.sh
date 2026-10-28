#!/bin/bash
# Redémarre le serveur + le tunnel et affiche l'URL publique
cd "$(dirname "$0")"
pkill -f supervise.sh; pkill -f "node server.js"; pkill -f "cloudflared tunnel"; sleep 1
nohup setsid ./supervise.sh >/dev/null 2>&1 &
nohup ./bin/cloudflared tunnel --url http://localhost:3000 --no-autoupdate --protocol http2 > tunnel.log 2>&1 &
for i in $(seq 1 30); do URL=$(grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' tunnel.log | head -1); [ -n "$URL" ] && break; sleep 1; done
echo "$URL" > url.txt; echo "URL publique : $URL"
for i in $(seq 1 40); do grep -q "Registered tunnel connection" tunnel.log && break; sleep 1; done; sleep 3
