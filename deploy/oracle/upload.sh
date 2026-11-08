#!/usr/bin/env bash
# Run on YOUR computer (not the VM): copies this project to the VM without node_modules/.git.
#   bash deploy/oracle/upload.sh ~/Downloads/ssh-key.key 1.2.3.4
# Re-run after every code change, then on the VM: sudo bash /srv/jhandi/deploy/oracle/deploy.sh
set -euo pipefail
KEY="${1:?usage: upload.sh <path to ssh private key> <vm ip>}"
IP="${2:?usage: upload.sh <path to ssh private key> <vm ip>}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
chmod 600 "$KEY"
ssh -i "$KEY" "ubuntu@$IP" 'sudo mkdir -p /srv/jhandi && sudo chown -R ubuntu /srv/jhandi'
rsync -az --delete \
  --exclude node_modules --exclude .git --exclude dist --exclude .env --exclude '.turbo' \
  -e "ssh -i $KEY" "$ROOT/" "ubuntu@$IP:/srv/jhandi/"
echo "uploaded to ubuntu@$IP:/srv/jhandi"
