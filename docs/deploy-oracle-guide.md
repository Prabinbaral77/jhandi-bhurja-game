# Oracle Cloud step-by-step (beginner guide)

> Zero-cost hosting of the whole game on one Oracle "Always Free" VM in Mumbai. Nothing here needs
> prior server experience. Budget about 1–2 hours the first time. Terms used: **VM** = a Linux
> computer in Oracle's data centre; **SSH** = typing commands on it from your Mac's Terminal.
> Technical reference: `docs/deploy.md`; scripts: `deploy/oracle/`.

## What you need before starting

- A credit/debit card (for Oracle's identity check; Always Free is never charged).
- Your Supabase **session pooler** connection string (Supabase → Connect → Session pooler, port 5432).
- `GOOGLE_CLIENT_ID` (Google Cloud → APIs & Services → Credentials).
- Access to the DNS of `prabinbaral.com.np` (where you can add an A record).
- This project on your Mac (it is not on GitHub yet, so you will upload it with `upload.sh`).

## Step 1 — Create the Oracle account (10 min)

1. Go to <https://www.oracle.com/cloud/free/> → **Start for free**.
2. Country Nepal, your e-mail, verify the code. Account name: anything (e.g. `prabinbaral`).
3. **Home region: choose "India West (Mumbai)"** — it cannot be changed later and the database is there.
4. Add the card (a small temporary hold is placed and released). Finish. Activation can take up to a few hours; you get an e-mail.

## Step 2 — Create the VM (10 min)

1. Sign in at <https://cloud.oracle.com> → top-left menu **☰ → Compute → Instances → Create instance**.
2. Name: `jhandi`. Compartment: leave default.
3. **Image and shape → Edit**: Image **Canonical Ubuntu 24.04**. Shape → **Ampere → VM.Standard.A1.Flex**, 2 OCPUs, 12 GB memory (shows "Always Free-eligible").
   - If creation later fails with _Out of capacity_: try again in a few hours, pick another Availability Domain, or use shape **VM.Standard.E2.1.Micro** (also free, slower but enough to start).
4. **Networking**: "Create new virtual cloud network", "Create new public subnet", **Assign a public IPv4 address: yes**.
5. **Add SSH keys → Generate a key pair for me → Save private key**. It downloads `ssh-key-….key`. Keep it; it is the only way in. Move it to `~/.ssh/jhandi.key`.
6. **Create**. Wait until the state is **Running**. Copy the **Public IP address** (e.g. `140.x.x.x`).

## Step 3 — Open ports 80 and 443 (5 min)

1. On the instance page click the **Subnet** link → click the **Default Security List**.
2. **Add Ingress Rules**: Source CIDR `0.0.0.0/0`, IP protocol TCP, Destination port range `80`. Add.
3. Repeat with destination port `443`.
   (Port 22 for SSH is already open.)

## Step 4 — Point the domain (5 min, then wait)

At the DNS provider of `prabinbaral.com.np` add: **Type A, Name `game`, Value = the Public IP**, TTL 5 min.
Check from your Mac: `dig +short game.prabinbaral.com.np` must print the IP (may take 5–30 min).

## Step 5 — Upload the code and run the installer (15 min)

On your Mac, in Terminal, inside the project folder:

```bash
cd "/Users/baral/Documents/Decode Tech/dashain game"
chmod 600 ~/.ssh/jhandi.key
bash deploy/oracle/upload.sh ~/.ssh/jhandi.key 140.x.x.x        # ← your IP
ssh -i ~/.ssh/jhandi.key ubuntu@140.x.x.x
```

(First time it asks "Are you sure you want to continue connecting?" → `yes`.) Now you are on the VM. Run:

```bash
sudo bash /srv/jhandi/deploy/oracle/setup.sh game.prabinbaral.com.np YOUR-EMAIL@gmail.com
```

This installs Node, pnpm, nginx, Redis, the firewall rules, the HTTPS certificate (Let's Encrypt;
needs Step 4 done) and the two background services. It ends with "Done".

## Step 6 — Fill in the secrets (5 min)

```bash
sudo nano /srv/jhandi/.env
```

Change these lines (arrow keys to move, `Ctrl+O` Enter to save, `Ctrl+X` to exit):

- `DATABASE_URL=` your Supabase session pooler string
- `AUTH_SECRET=` paste the output of `openssl rand -hex 32` (run it in another Terminal tab)
- `GOOGLE_CLIENT_ID=` and `VITE_GOOGLE_CLIENT_ID=` the same client ID
- `ADMIN_EMAILS=` your Google e-mail (the only admin)

Everything else is already set for `game.prabinbaral.com.np`.

## Step 7 — Build and start (5 min)

```bash
sudo bash /srv/jhandi/deploy/oracle/deploy.sh
```

Expected last lines: `api ok` and `game server ok`. If not: `sudo journalctl -u jhandi-api -n 50` shows the reason (usually a wrong `.env` value).

## Step 8 — Google and Supabase settings (5 min)

- Google Cloud → APIs & Services → Credentials → your OAuth client → **Authorized JavaScript origins** → add `https://game.prabinbaral.com.np` → Save. Also publish the OAuth consent screen (Audience → Publish app) so any Google account can sign in.
- Supabase → Project Settings → **Data API: off**. Database → Connection pooling → Pool size 15 or more.

## Step 9 — Test

Open <https://game.prabinbaral.com.np> on your phone: sign in with Google, you should see 5,000 coins, host a room, roll a round, send a friend the invite link. `https://game.prabinbaral.com.np/admin` shows the admin panel for the e-mail in `ADMIN_EMAILS`.

## Later: updating the game

On your Mac: `bash deploy/oracle/upload.sh ~/.ssh/jhandi.key 140.x.x.x`
On the VM: `sudo bash /srv/jhandi/deploy/oracle/deploy.sh`

## If something goes wrong

| Symptom                                  | Check                                                                                                  |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Browser can't reach the site             | Step 3 ingress rules; `dig` shows the right IP; on VM `sudo systemctl status nginx`                    |
| "Not secure" / certificate error         | DNS not ready when setup ran → `sudo certbot --nginx -d game.prabinbaral.com.np`                       |
| Sign-in button missing or 400 error      | Step 8 Google origin; `VITE_GOOGLE_CLIENT_ID` in `.env`, then re-run `deploy.sh`                       |
| "Something went wrong" after sign-in     | `sudo journalctl -u jhandi-api -n 50` — usually `DATABASE_URL`; Supabase project paused?               |
| Room won't open                          | `sudo journalctl -u jhandi-game -n 50`; `WEB_ORIGIN` must be exactly `https://game.prabinbaral.com.np` |
| Supabase paused (free tier, 7 idle days) | Supabase dashboard → Restore project                                                                   |
