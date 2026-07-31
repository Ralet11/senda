#!/usr/bin/env bash

set -Eeuo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_ROOT="$(dirname "$APP_DIR")/backups"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
PREVIOUS_COMMIT=""
BACKUP_DIR=""
DEPLOY_COMPLETE=false

log() {
  printf '[senda deploy] %s\n' "$*"
}

rollback() {
  local exit_code=$?
  trap - ERR

  if [[ "$DEPLOY_COMPLETE" == true || -z "$PREVIOUS_COMMIT" || -z "$BACKUP_DIR" ]]; then
    exit "$exit_code"
  fi

  log "Deploy fallido. Restaurando Senda al commit $PREVIOUS_COMMIT."
  set +e
  cd "$APP_DIR"
  git reset --hard "$PREVIOUS_COMMIT"

  if [[ -d node_modules ]]; then
    mv node_modules "$BACKUP_DIR/node_modules.failed"
  fi
  cp -al "$BACKUP_DIR/node_modules" node_modules

  if [[ -d .next ]]; then
    mv .next "$BACKUP_DIR/next.failed"
  fi
  cp -a "$BACKUP_DIR/next" .next

  pm2 restart senda --update-env
  log "Rollback terminado. Backup conservado en $BACKUP_DIR."
  exit "$exit_code"
}

trap rollback ERR

cd "$APP_DIR"

if [[ "$(id -un)" != "ubuntu" ]]; then
  log "Este script debe ejecutarse como el usuario ubuntu del EC2."
  exit 1
fi

if [[ ! -f .env.production ]]; then
  log "Falta .env.production; se cancela el deploy."
  exit 1
fi

if [[ ! -d node_modules || ! -d .next ]]; then
  log "Faltan node_modules o .next. Recupera el checkout antes de usar este script."
  exit 1
fi

if [[ -n "$(git status --porcelain)" ]]; then
  log "El checkout tiene cambios sin commitear; se cancela el deploy."
  exit 1
fi

git fetch origin main
PREVIOUS_COMMIT="$(git rev-parse HEAD)"
TARGET_COMMIT="$(git rev-parse origin/main)"

if [[ "$PREVIOUS_COMMIT" == "$TARGET_COMMIT" ]]; then
  log "Senda ya esta en $PREVIOUS_COMMIT. No hay cambios para desplegar."
  exit 0
fi

BACKUP_DIR="$BACKUP_ROOT/$TIMESTAMP-$PREVIOUS_COMMIT"
mkdir -p "$BACKUP_DIR"
cp -a .next "$BACKUP_DIR/next"
cp -al node_modules "$BACKUP_DIR/node_modules"
printf '%s\n' "$PREVIOUS_COMMIT" > "$BACKUP_DIR/previous-commit"
log "Backup creado en $BACKUP_DIR."

git merge --ff-only origin/main
nice -n 10 npm ci --loglevel=error --no-audit --no-fund
npm run db:generate

set -a
. ./.env.production
set +a
npx prisma migrate deploy

nice -n 10 npm run build

pm2 restart senda --update-env
sleep 5
curl -fsS --connect-timeout 10 http://127.0.0.1:3010/login > /dev/null
pm2 save

DEPLOY_COMPLETE=true
log "Deploy completado en $(git rev-parse --short HEAD). Backup conservado en $BACKUP_DIR."
