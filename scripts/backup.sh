#!/usr/bin/env bash
# ==============================================================================
# Fiambrería Costanera POS — Copia de seguridad diaria (Local SSD + Nube rclone)
# ==============================================================================
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${PROJECT_ROOT}/.env"
BACKUP_ROOT="${PROJECT_ROOT}/backups"
DB_BACKUP_DIR="${BACKUP_ROOT}/db"
UPLOADS_BACKUP_DIR="${BACKUP_ROOT}/uploads"

log_info() {
  printf '[%s] [BACKUP] [INFO] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"
}

log_warn() {
  printf '[%s] [BACKUP] [WARN] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*" >&2
}

log_error() {
  printf '[%s] [BACKUP] [ERROR] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*" >&2
}

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
  # Quitar comillas envolventes simples o dobles si existen
  val="${val%\"}"
  val="${val#\"}"
  val="${val%\'}"
  val="${val#\'}"
  printf '%s' "${val}"
}

TMP_SQL_FILE=""
cleanup() {
  if [[ -n "${TMP_SQL_FILE}" && -f "${TMP_SQL_FILE}" ]]; then
    rm -f "${TMP_SQL_FILE}"
  fi
}
trap cleanup EXIT

main() {
  cd "${PROJECT_ROOT}"
  mkdir -p "${DB_BACKUP_DIR}" "${UPLOADS_BACKUP_DIR}"

  local pg_db pg_user retention_days rclone_remote cloud_retention timestamp
  pg_db="$(read_env_var "POSTGRES_DB" "vertex_pos")"
  pg_user="$(read_env_var "POSTGRES_USER" "posuser")"
  retention_days="$(read_env_var "BACKUP_RETENTION_DAYS" "30")"
  rclone_remote="$(read_env_var "RCLONE_REMOTE" "")"
  cloud_retention="$(read_env_var "BACKUP_CLOUD_RETENTION_DAYS" "60")"
  timestamp="$(date '+%Y-%m-%d_%H%M%S')"

  if ! command -v docker >/dev/null 2>&1; then
    log_error "Docker no está instalado o no se encuentra en el PATH."
    exit 1
  fi

  # Verificar que el contenedor de base de datos esté en ejecución
  if [[ -z "$(docker compose ps -q db 2>/dev/null || true)" ]]; then
    log_error "El contenedor 'db' no está en ejecución. Inicia el sistema con 'docker compose up -d --no-build'."
    exit 1
  fi

  local final_sql_file="${DB_BACKUP_DIR}/fiambreria-db-${timestamp}.sql.gz"
  TMP_SQL_FILE="$(mktemp "${DB_BACKUP_DIR}/.tmp-db-XXXXXX.sql.gz")"

  log_info "Generando respaldo comprimido de PostgreSQL (${pg_db})..."
  docker compose exec -T db pg_dump \
    -U "${pg_user}" \
    -d "${pg_db}" \
    --clean \
    --if-exists \
    --no-owner \
    --no-privileges | gzip -9 > "${TMP_SQL_FILE}"

  if [[ ! -s "${TMP_SQL_FILE}" ]] || ! gzip -t "${TMP_SQL_FILE}" >/dev/null 2>&1; then
    log_error "El archivo de respaldo generado está vacío o corrupto."
    exit 1
  fi

  mv "${TMP_SQL_FILE}" "${final_sql_file}"
  TMP_SQL_FILE=""
  chmod 600 "${final_sql_file}"
  log_info "Respaldo de base de datos guardado: ${final_sql_file}"

  # Respaldar imágenes de productos si el contenedor web está activo
  local final_uploads_file="${UPLOADS_BACKUP_DIR}/fiambreria-uploads-${timestamp}.tar.gz"
  if [[ -n "$(docker compose ps -q web 2>/dev/null || true)" ]]; then
    if docker compose exec -T web tar -czf - -C /app/public uploads > "${final_uploads_file}" 2>/dev/null; then
      chmod 600 "${final_uploads_file}"
      log_info "Respaldo de imágenes guardado: ${final_uploads_file}"
    else
      rm -f "${final_uploads_file}"
      log_warn "No se pudieron respaldar imágenes de productos en este ciclo (continuando)."
    fi
  fi

  # Rotación local en SSD
  if [[ "${retention_days}" =~ ^[0-9]+$ ]] && (( retention_days > 0 )); then
    log_info "Limpiando respaldos locales con más de ${retention_days} días..."
    find "${DB_BACKUP_DIR}" -name 'fiambreria-db-*.sql.gz' -type f -mtime +"${retention_days}" -delete
    find "${UPLOADS_BACKUP_DIR}" -name 'fiambreria-uploads-*.tar.gz' -type f -mtime +"${retention_days}" -delete
  fi

  # Subida opcional a la nube con rclone (Google Drive / OneDrive / Dropbox)
  if [[ -n "${rclone_remote}" ]]; then
    if command -v rclone >/dev/null 2>&1; then
      log_info "Subiendo respaldo a la nube (${rclone_remote})..."
      if rclone copy "${final_sql_file}" "${rclone_remote%/}/db/"; then
        if [[ -f "${final_uploads_file}" ]]; then
          rclone copy "${final_uploads_file}" "${rclone_remote%/}/uploads/" || log_warn "No se pudo subir el archivo de imágenes a rclone."
        fi
        if [[ "${cloud_retention}" =~ ^[0-9]+$ ]] && (( cloud_retention > 0 )); then
          rclone delete "${rclone_remote%/}/db/" --min-age "${cloud_retention}d" || true
          rclone delete "${rclone_remote%/}/uploads/" --min-age "${cloud_retention}d" || true
        fi
        log_info "Sincronización en la nube completada correctamente."
      else
        log_warn "Falló la subida a rclone (${rclone_remote}). El respaldo local en el SSD sigue seguro."
      fi
    else
      log_warn "RCLONE_REMOTE está configurado pero 'rclone' no está instalado."
    fi
  fi

  log_info "Proceso de copia de seguridad finalizado con éxito."
}

main "$@"

