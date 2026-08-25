#!/usr/bin/env bash

set -Eeuo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_ROOT="$(dirname "$APP_DIR")/backups"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP_KEEP="${SENDA_BACKUP_KEEP:-3}"
MIN_FREE_KB="${SENDA_MIN_FREE_KB:-3145728}"
RELEASE_MARKER=".senda-release-commit"
PREVIOUS_COMMIT=""
BACKUP_DIR=""
DEPLOY_COMPLETE=false

log() {
  printf '[senda deploy] %s\n' "$*"
}

available_kb() {
  df -Pk "$APP_DIR" | awk 'NR == 2 { print $4 }'
}

ensure_free_space() {
  local available
  available="$(available_kb)"

  if [[ -z "$available" || "$available" -lt "$MIN_FREE_KB" ]]; then
    log "Espacio insuficiente: ${available:-0} KB libres; se requieren $MIN_FREE_KB KB."
    log "No se inicia el deploy para no dejar un release incompleto."
    exit 1
  fi
}

prune_old_backups() {
  local backups=()
  local backup

  [[ -d "$BACKUP_ROOT" ]] || return 0
  mapfile -t backups < <(find "$BACKUP_ROOT" -mindepth 1 -maxdepth 1 -type d -printf '%f\n' | sort -r)

  if (( ${#backups[@]} <= BACKUP_KEEP )); then
    return 0
  fi

  for backup in "${backups[@]:BACKUP_KEEP}"; do
    rm -rf -- "$BACKUP_ROOT/$backup"
    log "Backup antiguo eliminado: $backup."
  done
}

restore_previous_release() {
  log "Restaurando Senda al commit $PREVIOUS_COMMIT."
  cd "$APP_DIR"
  git reset --hard "$PREVIOUS_COMMIT"
  nice -n 10 npm ci --loglevel=error --no-audit --no-fund
  npm run db:generate
  set -a
  . ./.env.production
  set +a
  nice -n 10 npm run build
  pm2 restart senda --update-env
  printf '%s\n' "$PREVIOUS_COMMIT" > "$RELEASE_MARKER"
}

rollback() {
  local exit_code=$?
  trap - ERR

  if [[ "$DEPLOY_COMPLETE" == true || -z "$PREVIOUS_COMMIT" || -z "$BACKUP_DIR" ]]; then
    exit "$exit_code"
  fi

  log "Deploy fallido. Intentando restaurar Senda al commit $PREVIOUS_COMMIT."
  set +e
  restore_previous_release
  log "Rollback terminado. Metadata del backup conservada en $BACKUP_DIR."
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

if [[ "${SENDA_RECOVER:-}" == "1" ]]; then
  if [[ -z "${SENDA_RECOVER_COMMIT:-}" ]]; then
    log "SENDA_RECOVER_COMMIT es obligatorio para recuperar un checkout incompleto."
    exit 1
  fi

  PREVIOUS_COMMIT="$SENDA_RECOVER_COMMIT"
  log "Recuperando el release $PREVIOUS_COMMIT."
  restore_previous_release
  sleep 5
  curl -fsS --connect-timeout 10 http://127.0.0.1:3010/login > /dev/null
  pm2 save
  log "Recuperacion completada en $(git rev-parse --short HEAD)."
  exit 0
fi

if [[ ! -d node_modules || ! -d .next ]]; then
  log "Faltan node_modules o .next. Recupera el checkout antes de usar este script."
  exit 1
fi

if [[ -n "$(git status --porcelain)" ]]; then
  log "El checkout tiene cambios sin commitear; se cancela el deploy."
  exit 1
fi

ensure_free_space

git fetch origin main
PREVIOUS_COMMIT="$(git rev-parse HEAD)"
TARGET_COMMIT="$(git rev-parse origin/main)"
BUILT_COMMIT="$(cat "$RELEASE_MARKER" 2>/dev/null || true)"

if [[ "$PREVIOUS_COMMIT" == "$TARGET_COMMIT" ]]; then
  if [[ "$BUILT_COMMIT" != "$PREVIOUS_COMMIT" ]]; then
    log "El checkout está actualizado pero no hay un build confirmado para este commit; se reconstruirá Senda."
  elif [[ "${SENDA_RELOAD_ENV:-}" == "1" ]]; then
    log "No hay cambios de código; recargando la configuración de Senda."
    pm2 restart senda --update-env
    sleep 5
    curl -fsS --connect-timeout 10 http://127.0.0.1:3010/login > /dev/null
    pm2 save
    log "Configuración de Senda recargada."
    exit 0
  else
    log "Senda ya está en $PREVIOUS_COMMIT. No hay cambios para desplegar."
    exit 0
  fi
fi

BACKUP_DIR="$BACKUP_ROOT/$TIMESTAMP-$PREVIOUS_COMMIT"
mkdir -p "$BACKUP_DIR"
printf '%s\n' "$PREVIOUS_COMMIT" > "$BACKUP_DIR/previous-commit"
printf '%s\n' "$TARGET_COMMIT" > "$BACKUP_DIR/target-commit"
printf '%s\n' "$TIMESTAMP" > "$BACKUP_DIR/created-at"
log "Metadata de rollback creada en $BACKUP_DIR. Los artefactos regenerables no se duplican."

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
printf '%s\n' "$(git rev-parse HEAD)" > "$RELEASE_MARKER"
prune_old_backups
log "Deploy completado en $(git rev-parse --short HEAD). Se conservan $BACKUP_KEEP backups livianos."
