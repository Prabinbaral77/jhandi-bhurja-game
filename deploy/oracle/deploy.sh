#!/usr/bin/env bash
# Build and (re)start everything. Run as root on the VM after setup.sh, and after every git push:
#   sudo bash /srv/jhandi/deploy/oracle/deploy.sh
set -euo pipefail
cd /srv/jhandi
sudo -u jhandi git pull --ff-only
sudo -u jhandi pnpm install --frozen-lockfile
sudo -u jhandi pnpm -r typecheck
sudo -u jhandi pnpm db:migrate
# Web build reads VITE_* from /srv/jhandi/.env
sudo -u jhandi pnpm --filter @jhandi/web build
rsync -a --delete apps/web/dist/ /var/www/jhandi/
systemctl restart jhandi-api jhandi-game
sleep 3
systemctl --no-pager --lines=5 status jhandi-api jhandi-game || true
curl -fsS "http://127.0.0.1:4000/v1/trpc/health.check" >/dev/null && echo "api ok"
curl -fsS "http://127.0.0.1:2567/health" >/dev/null && echo "game server ok"
