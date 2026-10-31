# Deployment

> How to put Jhandi Burja on a real domain. Written for the first launch at
> **https://prabinbaral.com.np/game** (the game under `/game` on an existing site), with the
> same recipe usable for a dedicated domain. Security steps are in `docs/security.md`.

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
