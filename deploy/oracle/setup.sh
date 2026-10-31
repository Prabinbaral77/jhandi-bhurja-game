#!/usr/bin/env bash
# One-shot setup of a fresh Ubuntu 22.04/24.04 VM (Oracle Cloud Always Free, Mumbai) for
# Jhandi Burja: Node 22, pnpm, nginx, Redis, certbot, the repo under /srv/jhandi, two systemd
# services. Run as root:  sudo bash setup.sh game.prabinbaral.com.np you@example.com
# Afterwards edit /srv/jhandi/.env (see .env.production.example), then: bash deploy.sh
set -euo pipefail

DOMAIN="${1:?usage: setup.sh <domain> <letsencrypt e-mail>}"
EMAIL="${2:?usage: setup.sh <domain> <letsencrypt e-mail>}"
REPO="${REPO:-https://github.com/Prabinbaral77/dashain-game.git}"
HERE="$(cd "$(dirname "$0")" && pwd)"

echo "== packages"
apt-get update -y
apt-get install -y curl git nginx redis-server certbot python3-certbot-nginx ufw
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs
corepack enable
corepack prepare pnpm@10 --activate

echo "== firewall (Oracle also needs ingress rules for 80/443 in the VCN security list)"
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

echo "== redis: local only, no persistence needed for caches/limits"
sed -i 's/^# maxmemory .*/maxmemory 128mb/; s/^# maxmemory-policy .*/maxmemory-policy allkeys-lru/' /etc/redis/redis.conf
systemctl enable --now redis-server

echo "== app user + repo"
id -u jhandi >/dev/null 2>&1 || useradd --system --create-home --shell /bin/bash jhandi
if [ ! -d /srv/jhandi/.git ]; then
  git clone "$REPO" /srv/jhandi
fi
chown -R jhandi:jhandi /srv/jhandi
if [ ! -f /srv/jhandi/.env ]; then
  cp "$HERE/.env.production.example" /srv/jhandi/.env
  sed -i "s/game.prabinbaral.com.np/$DOMAIN/g" /srv/jhandi/.env
  chmod 600 /srv/jhandi/.env
  chown jhandi:jhandi /srv/jhandi/.env
  echo "!! Edit /srv/jhandi/.env: DATABASE_URL, AUTH_SECRET, GOOGLE_CLIENT_ID(s), ADMIN_EMAILS"
fi

echo "== web root"
mkdir -p /var/www/jhandi
chown -R jhandi:jhandi /var/www/jhandi

echo "== nginx"
sed "s/game.prabinbaral.com.np/$DOMAIN/g" "$HERE/nginx-game.conf" > /etc/nginx/sites-available/jhandi
ln -sf /etc/nginx/sites-available/jhandi /etc/nginx/sites-enabled/jhandi
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

echo "== TLS (Let's Encrypt, free, auto-renews)"
certbot --nginx --non-interactive --agree-tos -m "$EMAIL" -d "$DOMAIN" --redirect || \
  echo "!! certbot failed: is the DNS A record for $DOMAIN pointing at this VM yet? Re-run: certbot --nginx -d $DOMAIN"

echo "== systemd services"
cp "$HERE/jhandi-api.service" "$HERE/jhandi-game.service" /etc/systemd/system/
systemctl daemon-reload
systemctl enable jhandi-api jhandi-game

echo
echo "Done. Next: edit /srv/jhandi/.env, then run:  sudo bash /srv/jhandi/deploy/oracle/deploy.sh"
