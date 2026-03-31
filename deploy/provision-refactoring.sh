#!/usr/bin/env bash
# deploy/provision-refactoring.sh
#
# Add the Refactoring Factory instance to an already-provisioned VPS.
# The VPS already has: Nginx, UV, deploy user, systemd, firewall, certbot.
# This script just clones the repo, installs deps, and wires up the service.
#
# Usage (as root on the VPS):
#   bash /tmp/provision-refactoring.sh
#
# Or from your local machine:
#   scp deploy/provision-refactoring.sh root@157.245.36.85:/tmp/
#   ssh root@157.245.36.85 "bash /tmp/provision-refactoring.sh"

set -euo pipefail

REPO="https://github.com/martinhewing/twilio-refactoring-plan.git"
APP_DIR="/app/refactoring-factory"
SERVICE_NAME="refactoring-factory"
DOMAIN="twilio-refactoring-plan.connectaiml.com"

echo "═══════════════════════════════════════"
echo " Refactoring Factory — Instance Setup"
echo " Port 8394"
echo "═══════════════════════════════════════"

# ── Clone repo ─────────────────────────────────────────────────────────────
if [ ! -d "$APP_DIR" ]; then
    echo "Cloning repository..."
    sudo -u deploy mkdir -p "$APP_DIR"
    sudo -u deploy git clone "$REPO" "$APP_DIR"
else
    echo "Directory exists — pulling latest..."
    sudo -u deploy bash -c "cd $APP_DIR && git pull origin main"
fi

# ── Install Python deps ───────────────────────────────────────────────────
echo "Installing Python dependencies..."
sudo -u deploy bash -c "cd $APP_DIR && uv sync --frozen --no-dev"

# ── Install Node deps + build frontend ────────────────────────────────────
echo "Building frontend..."
sudo -u deploy bash -c "cd $APP_DIR && npm ci && npm run build"

# Verify static/ was created
if [ ! -f "$APP_DIR/static/index.html" ]; then
    echo "ERROR: npm run build did not produce static/index.html"
    exit 1
fi

# ── Check ffmpeg (needed for /api/transcribe) ─────────────────────────────
if ! command -v ffmpeg &> /dev/null; then
    echo "Installing ffmpeg..."
    apt-get install -y --no-install-recommends ffmpeg
fi

# ── Environment file ──────────────────────────────────────────────────────
if [ ! -f "$APP_DIR/.env" ]; then
    cat > "$APP_DIR/.env" << 'ENV'
# Refactoring Factory — production environment
# Edit these values before starting the service.

ANTHROPIC_API_KEY=sk-ant-...
CARTESIA_API_KEY=
CARTESIA_EXAMINER_VOICE_ID=79a125e8-cd45-4c13-8a67-188112f4dd22
CARTESIA_MODEL=sonic-2
ENV
    chown deploy:deploy "$APP_DIR/.env"
    chmod 600 "$APP_DIR/.env"
    echo ""
    echo "⚠  $APP_DIR/.env created — edit it now:"
    echo "   nano $APP_DIR/.env"
fi

# ── Systemd service ───────────────────────────────────────────────────────
echo "Installing systemd service..."
cp "$APP_DIR/deploy/refactoring-factory.service" "/etc/systemd/system/$SERVICE_NAME.service"
systemctl daemon-reload
systemctl enable "$SERVICE_NAME"

# ── Nginx site ────────────────────────────────────────────────────────────
echo "Configuring Nginx..."
cp "$APP_DIR/deploy/nginx-refactoring-factory" "/etc/nginx/sites-available/$SERVICE_NAME"
ln -sf "/etc/nginx/sites-available/$SERVICE_NAME" "/etc/nginx/sites-enabled/$SERVICE_NAME"

nginx -t && systemctl reload nginx

echo ""
echo "═══════════════════════════════════════"
echo " Instance ready."
echo ""
echo " Next steps:"
echo " 1. Edit $APP_DIR/.env — set API keys"
echo " 2. Start:  systemctl start $SERVICE_NAME"
echo " 3. Check:  curl http://localhost:8394/api/health"
echo " 4. SSL:    certbot --nginx -d $DOMAIN"
echo " 5. DNS:    A record $DOMAIN → 157.245.36.85"
echo "═══════════════════════════════════════"
