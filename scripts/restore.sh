#!/usr/bin/env bash
# ==============================================================================
# Fiambrería Costanera POS — Restauración de base de datos PostgreSQL (.sql.gz)
# ==============================================================================
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${PROJECT_ROOT}/.env"
DB_BACKUP_DIR="${PROJECT_ROOT}/backups/db"

read_env_var() {
  local key="$1"
  local default_val="${2:-}"
  if [[ ! -f "${ENV_FILE}" ]]; then
    printf '%s' "${default_val}"
    return 0
  fi
  local line
  line="$(grep -E "^${key}=" "${ENV_FILE}" | tail -n 1 || true)"
  if [[ -z "${line}" ]]; then
    printf '%s' "${default_val}"
    return 0
  fi
  local val="${line#*=}"
  val="${val%\"}"
  val="${val#\"}"
  val="${val%\'}"
  val="${val#\'}"
  printf '%s' "${val}"
}

main() {
  cd "${PROJECT_ROOT}"

  local backup_file="${1:-}"
  local auto_confirm="${2:-}"

  if [[ -z "${backup_file}" ]]; then
    printf 'Uso: ./scripts/restore.sh <ruta-al-archivo.sql.gz> [--yes]\n\n'
    printf 'Respaldos disponibles en %s:\n' "${DB_BACKUP_DIR}"
    if [[ -d "${DB_BACKUP_DIR}" ]]; then
      ls -1t "${DB_BACKUP_DIR}"/fiambreria-db-*.sql.gz 2>/dev/null || printf '  (ninguno encontrado)\n'
    else
      printf '  (carpeta de respaldos aún no creada)\n'
    fi
    exit 1
  fi

  if [[ ! -f "${backup_file}" ]]; then
    printf '[ERROR] No existe el archivo: %s\n' "${backup_file}" >&2
    exit 1
  fi

  if ! gzip -t "${backup_file}" >/dev/null 2>&1; then
    printf '[ERROR] El archivo %s está corrupto o no es un .gz válido.\n' "${backup_file}" >&2
    exit 1
  fi

  if [[ "${auto_confirm}" != "--yes" ]]; then
    printf '============================================================\n'
    printf ' ATENCIÓN: Se reemplazará la base de datos actual con:\n'
    printf '   %s\n' "${backup_file}"
    printf '============================================================\n'
    read -r -p "Escribe RESTAURAR en mayúsculas para confirmar: " confirmation
    if [[ "${confirmation}" != "RESTAURAR" ]]; then
      printf 'Operación cancelada.\n'
      exit 0
    fi
  fi

  local pg_db pg_user
  pg_db="$(read_env_var "POSTGRES_DB" "vertex_pos")"
  pg_user="$(read_env_var "POSTGRES_USER" "posuser")"

  printf '-> 1. Creando respaldo preventivo del estado actual antes de restaurar...\n'
  "${SCRIPT_DIR}/backup.sh" || printf '[WARN] No se pudo crear respaldo previo (continuando restauración)...\n'

  printf '-> 2. Deteniendo temporalmente web y worker...\n'
  docker compose stop web worker || true

  printf '-> 3. Asegurando que PostgreSQL esté activo...\n'
  docker compose up -d --no-build db

  printf '-> 4. Restaurando datos desde %s...\n' "${backup_file}"
  gunzip -c "${backup_file}" | docker compose exec -T db psql -v ON_ERROR_STOP=1 -U "${pg_user}" -d "${pg_db}"

  printf '-> 5. Levantando servicios y aplicando migraciones pendientes...\n'
  docker compose up -d --no-build

  printf '\n[OK] Restauración completada exitosamente.\n'
}

main "$@"

