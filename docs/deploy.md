# Deployment

> How to put Jhandi Burja on a real domain. Security steps are in `docs/security.md`.

## 0. The free stack (chosen for launch)

Everything below costs nothing per month:

| Need                        | Free service                                                                                                 | Limits that matter                                                                                                                   |
| --------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| Server for API + game + web | **Oracle Cloud Always Free** VM in **Mumbai** (ap-mumbai-1): Ampere A1 up to 4 OCPU / 24 GB, or 2× AMD micro | Card needed for identity check, never charged on Always Free. ARM capacity in Mumbai is sometimes "out"; retry or take the AMD micro |
| Database                    | **Supabase Free** (already in use)                                                                           | 500 MB, pooler Pool Size 15, project **pauses after 7 days without activity** (restore from dashboard)                               |
| Redis                       | `redis-server` on the same VM                                                                                | none (Upstash free = 10k commands/day, too few for rate limits)                                                                      |
| TLS                         | Let's Encrypt via certbot                                                                                    | auto-renews                                                                                                                          |
| DNS                         | your registrar, or Cloudflare Free                                                                           | one A record `game.prabinbaral.com.np → VM IP`                                                                                       |
| Google sign-in              | Google Identity Services                                                                                     | free                                                                                                                                 |
| Errors / uptime (optional)  | Sentry Free, UptimeRobot Free                                                                                | 5k errors/month; 50 monitors                                                                                                         |

URL: **https://game.prabinbaral.com.np** — web at `/`, API at `/api/`, game server at `/ws/`,
all on the one VM behind nginx. (Serving it at `prabinbaral.com.np/game` instead needs the
host of the main site to proxy `/game/*` to this VM; if the domain moves to Cloudflare Free a
Worker route can do that. §2 layout A has that config.)

Why not Render/Railway/Fly free tiers: they sleep after inactivity or expire (first player waits
~1 min for the server to wake), have no Mumbai region on free, and a WebSocket game server must
stay up. A free always-on VM next to the database is the only free option that plays well.

### Steps

1. **Oracle Cloud**: create an Always Free account → Compute → Create instance → Image Ubuntu 24.04, Shape "Always Free eligible" (VM.Standard.A1.Flex 2 OCPU/12 GB is plenty), region Mumbai, add your SSH key. In the VCN's **Security List** add ingress rules for TCP 80 and 443 from 0.0.0.0/0.
2. **DNS**: A record `game` → the VM's public IP at your domain registrar (TTL short).
3. **On the VM**:
   ```bash
   ssh ubuntu@<ip>
   sudo git clone https://github.com/Prabinbaral77/dashain-game.git /srv/jhandi
   sudo bash /srv/jhandi/deploy/oracle/setup.sh game.prabinbaral.com.np you@example.com
   sudo nano /srv/jhandi/.env     # DATABASE_URL, AUTH_SECRET, GOOGLE ids, ADMIN_EMAILS
   sudo bash /srv/jhandi/deploy/oracle/deploy.sh
   ```
   `setup.sh` installs Node 22, pnpm, nginx, Redis, certbot, the firewall, the systemd services
   and the nginx site; `deploy.sh` pulls, builds, migrates and restarts (run it after every push).
4. **Google Cloud** → Credentials → OAuth client → Authorized JavaScript origins: `https://game.prabinbaral.com.np`.
5. **Supabase**: Data API off, Pool Size ≥ 15 (API 5 + game 5 + headroom).
6. Open the site on a phone: Google sign-in → host a room → play. Admin at `/admin`.

Files: `deploy/oracle/{setup.sh,deploy.sh,nginx-game.conf,jhandi-api.service,jhandi-game.service,.env.production.example}`.

## 0b. Netlify for the web + Render for the servers (quickest, also free)

The web app is static, so Netlify serves it well. **Netlify cannot run the API or the game
server** (long-running Node + WebSocket), so those still need a host: the Oracle VM (§0, best) or
Render's free plan (sleeps after 15 min idle, wakes in ~1 min, Singapore region; good enough to
test the deployed stack, not for a busy evening). The repo carries `netlify.toml`, `public/_redirects`
and `render.yaml` for this.

1. **Servers first** (their URLs go into the web build):
   - Render → New → Blueprint → this repo → fill `DATABASE_URL` (Supabase session pooler),
     `WEB_ORIGIN` (the Netlify site URL, e.g. `https://jhandi.netlify.app`, or
     `https://game.prabinbaral.com.np`), `GOOGLE_CLIENT_ID`, `ADMIN_EMAILS`. Run `pnpm db:migrate`
     once from your machine. You get `https://jhandi-api.onrender.com` and
     `https://jhandi-game.onrender.com`.
2. **Netlify**: Add new site → Import from Git → this repo. Build settings are read from
   `netlify.toml`. Environment variables: `VITE_API_URL=https://jhandi-api.onrender.com`,
   `VITE_GAME_SERVER_URL=wss://jhandi-game.onrender.com`, `VITE_GOOGLE_CLIENT_ID=…`,
   `VITE_BASE_PATH` empty. Deploy. Custom domain `game.prabinbaral.com.np` under Domain management
   (Netlify issues the certificate).
   - Without Git: build locally with those values in `.env` (`pnpm --filter @jhandi/web build`)
     and drag `apps/web/dist` onto Netlify's Deploys page.
   - To serve it at `prabinbaral.com.np/game` when the main site is also on Netlify: build with
     `VITE_BASE_PATH=/game/`, and in the main site's `_redirects` add
     `/game/*  https://<game-site>.netlify.app/game/:splat  200`.
3. **Google Cloud**: add the final web origin to Authorized JavaScript origins.
4. Open the site, sign in, host a room, play a round; check `/admin`.

## 1. Pieces and where they run

| Piece            | What it is                                 | Runs where                                                       |
| ---------------- | ------------------------------------------ | ---------------------------------------------------------------- |
| Web (`apps/web`) | Static files (Vite build)                  | Any static host or the same nginx that serves prabinbaral.com.np |
| API (`apps/api`) | Node (Express + tRPC), port 4000           | A Linux server/VPS in **Mumbai** (ap-south-1), or Railway/Render |
| Game server      | Node (Colyseus WebSocket), port 2567       | Same server as the API                                           |
| Database         | Supabase Postgres (Mumbai), session pooler | Already exists                                                   |
| Redis            | Rate limits / caches / room registry       | Upstash (Mumbai) or Redis on the same server                     |

The web app is just files, so it can live anywhere, including a folder on the current site. The
API and game server are long-running Node processes; they need a server that stays on. Browsers
need **HTTPS** for the web and API and **WSS** for the game server (Google sign-in and the
`__Secure-` cookie refuse plain HTTP).

## 2. URL layout (choose one)

**A. Everything under one host (recommended when prabinbaral.com.np is served by nginx you control)**

| URL                                     | Goes to                      |
| --------------------------------------- | ---------------------------- |
| `https://prabinbaral.com.np/game/`      | web static files             |
| `https://prabinbaral.com.np/game/api/…` | API on `127.0.0.1:4000`      |
| `wss://prabinbaral.com.np/game/ws`      | game server `127.0.0.1:2567` |

Env for this layout:

```
# web (build time)
VITE_BASE_PATH=/game/
VITE_API_URL=https://prabinbaral.com.np/game/api
VITE_GAME_SERVER_URL=wss://prabinbaral.com.np/game/ws
VITE_GOOGLE_CLIENT_ID=…

# api
NODE_ENV=production
WEB_ORIGIN=https://prabinbaral.com.np
WEB_BASE_PATH=/game
API_PUBLIC_PREFIX=/game/api
TRUST_PROXY=1
# game server
WEB_ORIGIN=https://prabinbaral.com.np
TRUST_PROXY=1
```

**B. Sub-domains for the servers (when the site is on a static host such as Vercel/Netlify/cPanel and
you rent a separate VPS for Node)**

| URL                                | Goes to                                 |
| ---------------------------------- | --------------------------------------- |
| `https://prabinbaral.com.np/game/` | web static files (on the existing host) |
| `https://api.prabinbaral.com.np`   | API                                     |
| `wss://game.prabinbaral.com.np`    | game server                             |

Env: `VITE_BASE_PATH=/game/`, `VITE_API_URL=https://api.prabinbaral.com.np`,
`VITE_GAME_SERVER_URL=wss://game.prabinbaral.com.np`, `WEB_ORIGIN=https://prabinbaral.com.np`,
`WEB_BASE_PATH=/game`, `API_PUBLIC_PREFIX=` (empty). Cookies still work: `SameSite=Lax` treats
sub-domains of one registrable domain as same-site.

## 3. Build

```bash
pnpm install --frozen-lockfile
pnpm -r typecheck && pnpm test
# web: reads VITE_* from .env (or the shell) at build time
pnpm --filter @jhandi/web build          # → apps/web/dist
```

Copy `apps/web/dist/*` to the `/game/` folder of the site (layout A: `/var/www/prabinbaral/game/`).
The build already contains the right asset paths (`/game/assets/…`) and the CSP with both
`https://…/game/api` and the game server over `wss://` and `https://`.

## 4. nginx (layout A)

```nginx
server {
  listen 443 ssl http2;
  server_name prabinbaral.com.np;
  # … existing site config and certificates (certbot) …

  # ---- Jhandi Burja web (static, SPA) ----
  location /game/ {
    alias /var/www/prabinbaral/game/;
    try_files $uri $uri/ /game/index.html;
    add_header X-Content-Type-Options nosniff always;
    add_header X-Frame-Options DENY always;
    add_header Referrer-Policy strict-origin-when-cross-origin always;
    add_header Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=(), usb=()" always;
    add_header Content-Security-Policy "frame-ancestors 'none'" always;
  }
  location /game/assets/ {
    alias /var/www/prabinbaral/game/assets/;
    expires 1y;
    add_header Cache-Control "public, immutable";
  }

  # ---- API (prefix stripped: /game/api/v1/trpc → /v1/trpc) ----
  location /game/api/ {
    proxy_pass http://127.0.0.1:4000/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 60s;
  }

  # ---- Game server (WebSocket + matchmaking HTTP) ----
  location /game/ws/ {
    proxy_pass http://127.0.0.1:2567/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header Origin $http_origin;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 3600s;
  }
}
```

Notes: the trailing slash on `proxy_pass` strips the prefix. `Origin` must be forwarded (the game
server refuses foreign origins). HSTS is normally set once for the whole site.

## 5. Running the Node servers (systemd)

```ini
# /etc/systemd/system/jhandi-api.service
[Unit]
Description=Jhandi Burja API
After=network.target
[Service]
WorkingDirectory=/srv/jhandi/apps/api
EnvironmentFile=/srv/jhandi/.env
ExecStart=/usr/bin/node --import tsx src/server.ts
Restart=always
RestartSec=3
User=jhandi
[Install]
WantedBy=multi-user.target
```

Same for `jhandi-game` with `WorkingDirectory=/srv/jhandi/apps/game-server`. Then
`systemctl enable --now jhandi-api jhandi-game`. (Build to JS with `tsc` later if start-up time
matters; `tsx` is fine to begin with.) Stop with `systemctl stop` (SIGTERM) so the DB pool closes
cleanly — see "zombie sessions" in `docs/database.md`.

## 6. One-time setup checklist

1. Server in Mumbai (Node 22+, pnpm, nginx, certbot). Open only 80/443.
2. `.env` from `.env.example`: fresh `AUTH_SECRET` (`openssl rand -hex 32`), Supabase **session pooler** URL, `REDIS_URL`, `GOOGLE_CLIENT_ID`, `ADMIN_EMAILS`, the URL/prefix values from §2, `TRUST_PROXY=1`, `NODE_ENV=production`.
3. `pnpm db:migrate` once.
4. Google Cloud → Credentials → the OAuth client → **Authorized JavaScript origins**: `https://prabinbaral.com.np`. Publish the consent screen.
5. Supabase: Data API off, backups on, pooler Pool Size ≥ API pool + game-server pool + 5.
6. Fill `OPERATOR` in `apps/web/src/content/legal.ts` before building the web.
7. Deploy, then smoke test from a phone: sign in with Google, host a room, play a round, send an invite link (`https://prabinbaral.com.np/game/r/…`), open `/game/admin`.
8. Cron: `pnpm --filter @jhandi/api reconcile` nightly; alert on non-zero exit.
9. Load test from the server itself: `pnpm --filter @jhandi/e2e load 20 10 2` with the raised limits (docs/security.md §8 step 7).

## 7. Updating

```bash
git pull && pnpm install --frozen-lockfile && pnpm -r typecheck && pnpm test
pnpm db:migrate
pnpm --filter @jhandi/web build && rsync -a --delete apps/web/dist/ /var/www/prabinbaral/game/
systemctl restart jhandi-api jhandi-game
```
