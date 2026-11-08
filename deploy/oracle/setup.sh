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
DEBIAN_FRONTEND=noninteractive apt-get install -y curl git nginx redis-server certbot python3-certbot-nginx rsync
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs
corepack enable
corepack prepare pnpm@10 --activate

echo "== firewall: Oracle's Ubuntu image ships iptables rules that reject everything but 22"
# (the VCN Security List must ALSO allow 80/443 — done in the Oracle web console)
DEBIAN_FRONTEND=noninteractive apt-get install -y iptables-persistent
for port in 80 443; do
  iptables -C INPUT -p tcp --dport "$port" -j ACCEPT 2>/dev/null || \
    iptables -I INPUT 5 -p tcp --dport "$port" -m state --state NEW -j ACCEPT
done
netfilter-persistent save

echo "== redis: local only, no persistence needed for caches/limits"
sed -i 's/^# maxmemory .*/maxmemory 128mb/; s/^# maxmemory-policy .*/maxmemory-policy allkeys-lru/' /etc/redis/redis.conf
systemctl enable --now redis-server

echo "== app user + repo"
id -u jhandi >/dev/null 2>&1 || useradd --system --create-home --shell /bin/bash jhandi
# Code arrives either by `git clone` (if the repo is on GitHub) or by upload.sh from your Mac.
if [ ! -f /srv/jhandi/package.json ]; then
  git clone "$REPO" /srv/jhandi || { echo "!! no code in /srv/jhandi: run deploy/oracle/upload.sh from your computer, then re-run setup.sh"; exit 1; }
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
