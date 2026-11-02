#!/usr/bin/env bash
# ==============================================================================
# Fiambrería Costanera POS — Actualizador seguro desde GitHub (Manual y Cron)
# Uso:
#   ./update.sh          -> Actualización manual inmediata
#   ./update.sh --auto   ->Modo silencioso para cron: sólo actualiza y reinicia
#                          si detecta commits nuevos en main o nueva imagen en GHCR
# ==============================================================================
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOCK_FILE="/tmp/fiambreria-pos-update.lock"
IMAGE_REF="ghcr.io/santi-gs/fiambreria-main:latest"

log_msg() {
  printf '[%s] [UPDATE] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"
}

run_update() {
  local mode="${1:-manual}"
  cd "${SCRIPT_DIR}"

  local git_changed="false"
  local image_changed="false"

  # 1. Revisar si hay cambios en la rama main de Git
  if [[ -d ".git" ]] && command -v git >/dev/null 2>&1; then
    if git fetch origin main --quiet 2>/dev/null; then
      local local_sha remote_sha
      local_sha="$(git rev-parse HEAD 2>/dev/null || true)"
      remote_sha="$(git rev-parse origin/main 2>/dev/null || true)"
      if [[ -n "${local_sha}" && -n "${remote_sha}" && "${local_sha}" != "${remote_sha}" ]]; then
        git_changed="true"
      fi
    fi
  fi

  # 2. Verificar si existe una nueva imagen publicada en GitHub Container Registry
  local before_img after_img
  before_img="$(docker image inspect -f '{{.Id}}' "${IMAGE_REF}" 2>/dev/null || true)"

  if [[ "${mode}" == "--auto" ]]; then
    docker compose pull --quiet web worker >/dev/null 2>&1 || docker compose pull web worker
  else
    log_msg "Consultando última imagen en GitHub Container Registry..."
    docker compose pull
  fi

  after_img="$(docker image inspect -f '{{.Id}}' "${IMAGE_REF}" 2>/dev/null || true)"
  if [[ -n "${after_img}" && "${before_img}" != "${after_img}" ]]; then
    image_changed="true"
  fi

  # En modo automático (--auto), si no cambió ni el repo ni la imagen, no reiniciar nada
  if [[ "${mode}" == "--auto" && "${git_changed}" == "false" && "${image_changed}" == "false" ]]; then
    exit 0
  fi

  log_msg "=========================================="
  log_msg " Aplicando actualización de Fiambrería POS"
  log_msg " (git_changed=${git_changed}, image_changed=${image_changed})"
  log_msg "=========================================="

  # 3. Backup preventivo antes de tocar contenedores o migraciones
  if [[ -x "${SCRIPT_DIR}/scripts/backup.sh" ]]; then
    log_msg "-> 1. Creando copia de seguridad preventiva antes de actualizar..."
    "${SCRIPT_DIR}/scripts/backup.sh" || log_msg "[WARN] El backup previo devolvió advertencia; continuando actualización."
  fi

  # 4. Actualizar scripts y docker-compose.yml desde origin/main si el árbol está limpio
  if [[ "${git_changed}" == "true" ]]; then
    if [[ -z "$(git status --porcelain --untracked-files=no 2>/dev/null || true)" ]]; then
      log_msg "-> 2. Sincronizando archivos de configuración desde GitHub (origin/main)..."
      git pull --ff-only origin main
      # Refrescar imágenes por si cambió docker-compose.yml
      docker compose pull
    else
      log_msg "[WARN] Hay modificaciones locales en archivos rastreados por Git; omitiendo git pull."
    fi
  fi

  # 5. Recrear contenedores sin compilar localmente (aplica prisma migrate deploy al iniciar)
  log_msg "-> 3. Reiniciando contenedores con la nueva versión (--no-build)..."
  docker compose up -d --no-build --remove-orphans

  # 6. Limpiar capas antiguas de imágenes para cuidar el SSD
  log_msg "-> 4. Liberando imágenes antiguas en disco..."
  docker image prune -f >/dev/null 2>&1 || true

  if [[ "${mode}" != "--auto" ]]; then
    log_msg "-> 5. Estado actual de los servicios:"
    docker compose ps
  fi

  log_msg "¡Actualización completada exitosamente!"
}

main() {
  local mode="${1:-manual}"
  if command -v flock >/dev/null 2>&1; then
    exec 9>"${LOCK_FILE}"
    if ! flock -n 9; then
      log_msg "Ya hay otra actualización en curso. Saliendo."
      exit 0
    fi
    run_update "${mode}"
  else
    run_update "${mode}"
  fi
}

main "$@"
