#!/usr/bin/env bash
# ==============================================================================
# Fiambrería Costanera POS — Instalador Rápido para Ubuntu Server
# Optimizado para servidores de bajos recursos (ej. Celeron N4000 / 4 GB RAM / SSD)
# ==============================================================================
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/.env"
BACKUP_DIR="${SCRIPT_DIR}/backups"

print_banner() {
  printf '\n==============================================================\n'
  printf '   Instalador de Fiambrería Costanera POS (Ubuntu Server)\n'
  printf '==============================================================\n\n'
}

log_step() {
  printf '\n[PASO] %s\n' "$*"
}

log_ok() {
  printf '  [OK] %s\n' "$*"
}

log_warn() {
  printf '  [AVISO] %s\n' "$*" >&2
}

run_root() {
  if [[ "${EUID}" -eq 0 ]]; then
    "$@"
  elif command -v sudo >/dev/null 2>&1; then
    sudo "$@"
  else
    printf '[ERROR] Se requieren permisos de administrador (root o sudo).\n' >&2
    exit 1
  fi
}

detect_lan_ip() {
  local ip=""
  if command -v hostname >/dev/null 2>&1; then
    ip="$(hostname -I 2>/dev/null | awk '{print $1}' || true)"
  fi
  if [[ -z "${ip}" ]] && command -v ip >/dev/null 2>&1; then
    ip="$(ip route get 1.1.1.1 2>/dev/null | awk '{for(i=1;i<=NF;i++) if($i=="src") print $(i+1)}' | head -n 1 || true)"
  fi
  printf '%s' "${ip:-127.0.0.1}"
}

ensure_swap_memory() {
  log_step "1/6 Verificando memoria Swap para estabilidad en equipos de 4 GB de RAM..."
  if [[ ! -f /proc/meminfo ]]; then
    return 0
  fi

  local swap_total_kb
  swap_total_kb="$(awk '/^SwapTotal:/ {print $2}' /proc/meminfo || printf '0')"
  # Si ya tiene al menos ~2 GB de swap, no tocar
  if (( swap_total_kb >= 1900000 )); then
    log_ok "Memoria Swap suficiente detectada ($(( swap_total_kb / 1024 )) MB)."
    return 0
  fi

  if [[ -f /swapfile ]]; then
    log_ok "Archivo /swapfile ya existente."
    return 0
  fi

  printf '  Configurando archivo Swap de 4 GB en el SSD para evitar cierres por falta de RAM...\n'
  if command -v fallocate >/dev/null 2>&1; then
    run_root fallocate -l 4G /swapfile || run_root dd if=/dev/zero of=/swapfile bs=1M count=4096 status=none
  else
    run_root dd if=/dev/zero of=/swapfile bs=1M count=4096 status=none
  fi
  run_root chmod 600 /swapfile
  run_root mkswap /swapfile >/dev/null
  run_root swapon /swapfile
  if ! grep -q '^/swapfile ' /etc/fstab 2>/dev/null; then
    printf '/swapfile none swap sw 0 0\n' | run_root tee -a /etc/fstab >/dev/null
  fi
  log_ok "Swap de 4 GB activada permanentemente."
}

configure_laptop_lid() {
  log_step "2/6 Configuración de tapa de notebook (modo servidor 24/7)..."
  read -r -p "  ¿Estás instalando en una notebook y querés que siga encendida al cerrar la tapa? [S/n]: " lid_choice
  lid_choice="${lid_choice:-S}"
  if [[ "${lid_choice}" =~ ^[SsYy]$ ]]; then
    if [[ -d /etc/systemd ]]; then
      run_root mkdir -p /etc/systemd/logind.conf.d
      cat <<'EOF' | run_root tee /etc/systemd/logind.conf.d/fiambreria-server.conf >/dev/null
[Login]
HandleLidSwitch=ignore
HandleLidSwitchExternalPower=ignore
HandleLidSwitchDocked=ignore
EOF
      run_root systemctl restart systemd-logind || log_warn "Se aplicará al próximo reinicio de Ubuntu."
      log_ok "La notebook ya no se suspenderá al cerrar la pantalla."
    fi
  else
    log_ok "Se mantiene el comportamiento actual de energía."
  fi
}

install_dependencies() {
  log_step "3/6 Verificando Docker, Docker Compose y herramientas de respaldo (rclone)..."

  if command -v apt-get >/dev/null 2>&1; then
    local missing_pkgs=()
    for pkg in curl openssl gzip ca-certificates; do
      if ! command -v "${pkg}" >/dev/null 2>&1 && [[ "${pkg}" != "ca-certificates" ]]; then
        missing_pkgs+=("${pkg}")
      fi
    done
    if (( ${#missing_pkgs[@]} > 0 )); then
      run_root apt-get update -qq
      run_root apt-get install -y "${missing_pkgs[@]}" ca-certificates
    fi
  fi

  if ! command -v docker >/dev/null 2>&1; then
    printf '  Instalando Docker Engine oficial...\n'
    curl -fsSL https://get.docker.com | run_root sh
    run_root systemctl enable --now docker
    if [[ -n "${SUDO_USER:-}" ]]; then
      run_root usermod -aG docker "${SUDO_USER}" || true
    elif [[ "${EUID}" -ne 0 ]]; then
      run_root usermod -aG docker "${USER}" || true
    fi
    log_ok "Docker instalado correctamente."
  else
    run_root systemctl enable --now docker >/dev/null 2>&1 || true
    log_ok "Docker ya se encuentra instalado."
  fi

  if ! command -v rclone >/dev/null 2>&1; then
    printf '  Instalando rclone para copias de seguridad en Google Drive / OneDrive / Dropbox...\n'
    if command -v apt-get >/dev/null 2>&1; then
      run_root apt-get update -qq
      run_root apt-get install -y rclone || curl -fsSL https://rclone.org/install.sh | run_root bash
    else
      curl -fsSL https://rclone.org/install.sh | run_root bash
    fi
    log_ok "rclone instalado."
  else
    log_ok "rclone ya se encuentra instalado."
  fi
}

run_docker_compose() {
  if docker compose version >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
    docker compose "$@"
  else
    run_root docker compose "$@"
  fi
}

configure_env() {
  log_step "4/6 Configurando variables de entorno y cuenta del Primer Administrador..."
  local lan_ip
  lan_ip="$(detect_lan_ip)"

  if [[ -f "${ENV_FILE}" ]]; then
    read -r -p "  Ya existe un archivo .env. ¿Querés conservar la configuración actual? [S/n]: " keep_env
    keep_env="${keep_env:-S}"
    if [[ "${keep_env}" =~ ^[SsYy]$ ]]; then
      log_ok "Conservando archivo .env existente."
      return 0
    fi
  fi

  local admin_name admin_email admin_password admin_password_confirm
  printf '\n  --- Datos del Primer Administrador (creará la tienda y las demás cuentas) ---\n'
  read -r -p "  Nombre del Administrador [Administrador]: " admin_name
  admin_name="${admin_name:-Administrador}"

  while true; do
    read -r -p "  Email del Administrador (ej. admin@fiambreria.com): " admin_email
    admin_email="$(printf '%s' "${admin_email}" | tr '[:upper:]' '[:lower:]' | xargs)"
    if [[ "${admin_email}" =~ ^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$ ]]; then
      break
    fi
    printf '  [!] Ingresa un correo electrónico válido.\n'
  done

  while true; do
    read -r -s -p "  Contraseña del Administrador (mínimo 8 caracteres): " admin_password
    printf '\n'
    if (( ${#admin_password} < 8 )); then
      printf '  [!] La contraseña debe tener al menos 8 caracteres.\n'
      continue
    fi
    if [[ "${admin_password}" == *"'"* ]]; then
      printf '  [!] Por compatibilidad con el archivo .env, evita usar comillas simples (\x27) en la contraseña.\n'
      continue
    fi
    read -r -s -p "  Confirmar contraseña: " admin_password_confirm
    printf '\n'
    if [[ "${admin_password}" != "${admin_password_confirm}" ]]; then
      printf '  [!] Las contraseñas no coinciden. Intenta nuevamente.\n'
      continue
    fi
    break
  done

  printf '\n  --- Acceso en Red Local e Internet (Cloudflare Tunnel) ---\n'
  printf '  IP local detectada de esta notebook: http://%s:3000\n' "${lan_ip}"
  local default_app_url="http://${lan_ip}:3000"
  local app_url cf_token compose_profiles=""
  read -r -p "  URL principal del sistema (ej. https://pos.tudominio.com o Enter para usar ${default_app_url}): " app_url
  app_url="${app_url:-${default_app_url}}"

  read -r -p "  Token de Cloudflare Tunnel (pegalo ahora o pulsa Enter para configurarlo más tarde): " cf_token
  cf_token="$(printf '%s' "${cf_token}" | xargs)"
  if [[ -n "${cf_token}" ]]; then
    compose_profiles="cloudflare"
  fi

  printf '\n  --- Respaldo en la nube con rclone (opcional) ---\n'
  local rclone_remote=""
  read -r -p "  Destino rclone (ej. gdrive:FiambreriaBackups o Enter para configurar luego): " rclone_remote
  rclone_remote="$(printf '%s' "${rclone_remote}" | xargs)"

  local pg_password auth_secret
  pg_password="$(openssl rand -hex 24)"
  auth_secret="$(openssl rand -base64 36 | tr -d '\n')"

  cat <<EOF > "${ENV_FILE}"
# Generado automáticamente por install.sh el $(date '+%Y-%m-%d %H:%M:%S')
POSTGRES_DB=vertex_pos
POSTGRES_USER=posuser
POSTGRES_PASSWORD=${pg_password}

AUTH_SECRET=${auth_secret}
APP_URL=${app_url}
MAX_PRODUCT_IMAGE_UPLOAD_MB=5

INIT_ADMIN_NAME="${admin_name}"
INIT_ADMIN_EMAIL="${admin_email}"
INIT_ADMIN_PASSWORD='${admin_password}'

COMPOSE_PROFILES=${compose_profiles}
CLOUDFLARE_TUNNEL_TOKEN=${cf_token}

BACKUP_RETENTION_DAYS=30
RCLONE_REMOTE=${rclone_remote}
BACKUP_CLOUD_RETENTION_DAYS=60
EOF

  chmod 600 "${ENV_FILE}"
  log_ok "Archivo .env generado con claves seguras."
}

start_services() {
  log_step "5/6 Descargando imagen precompilada desde GitHub y levantando contenedores..."
  cd "${SCRIPT_DIR}"
  mkdir -p "${BACKUP_DIR}/db" "${BACKUP_DIR}/uploads"
  chmod +x "${SCRIPT_DIR}/update.sh" "${SCRIPT_DIR}/scripts/backup.sh" "${SCRIPT_DIR}/scripts/restore.sh"

  run_docker_compose pull
  run_docker_compose up -d --no-build --remove-orphans
  log_ok "Base de datos PostgreSQL, servidor Web y Worker iniciados correctamente."
}

configure_automation_cron() {
  log_step "6/6 Configurando backups diarios y actualizaciones desde GitHub (rama main)..."

  printf '\n  ¿Cómo preferís que esta notebook aplique tus nuevos commits de la rama main?\n'
  printf '    1) Automático nocturno a las 03:30 AM (Recomendado: no interrumpe ventas en mostrador)\n'
  printf '    2) Automático continuo cada 15 minutos (Actualiza apenas GitHub termina de compilar)\n'
  printf '    3) Solo manual ejecutando ./update.sh\n'
  local update_choice
  read -r -p "  Elige una opción [1]: " update_choice
  update_choice="${update_choice:-1}"

  local current_cron=""
  current_cron="$(crontab -l 2>/dev/null | grep -v 'FIAMBRERIA-POS' || true)"

  local new_cron="${current_cron}"
  new_cron+=$'\n'"0 3 * * * ${SCRIPT_DIR}/scripts/backup.sh >> ${BACKUP_DIR}/backup.log 2>&1 # FIAMBRERIA-POS-BACKUP"

  if [[ "${update_choice}" == "1" ]]; then
    new_cron+=$'\n'"30 3 * * * ${SCRIPT_DIR}/update.sh --auto >> ${BACKUP_DIR}/update.log 2>&1 # FIAMBRERIA-POS-UPDATE"
    log_ok "Backup diario (03:00 AM) + Auto-actualización nocturna (03:30 AM) programados."
  elif [[ "${update_choice}" == "2" ]]; then
    new_cron+=$'\n'"*/15 * * * * ${SCRIPT_DIR}/update.sh --auto >> ${BACKUP_DIR}/update.log 2>&1 # FIAMBRERIA-POS-UPDATE"
    log_ok "Backup diario (03:00 AM) + Auto-actualización cada 15 min programados."
  else
    log_ok "Backup diario (03:00 AM) programado. Actualizaciones en modo manual (./update.sh)."
  fi

  printf '%s\n' "${new_cron}" | sed '/^[[:space:]]*$/d' | crontab -
}

print_summary() {
  local lan_ip app_url admin_email
  lan_ip="$(detect_lan_ip)"
  app_url="$(grep -E '^APP_URL=' "${ENV_FILE}" | tail -n 1 | cut -d'=' -f2- || printf 'http://%s:3000' "${lan_ip}")"
  admin_email="$(grep -E '^INIT_ADMIN_EMAIL=' "${ENV_FILE}" | tail -n 1 | cut -d'=' -f2- | tr -d '"' || true)"

  printf '\n==============================================================\n'
  printf '   ¡Fiambrería Costanera POS está instalado y funcionando!\n'
  printf '==============================================================\n'
  printf '  • Acceso Red Local (Wi-Fi):  http://%s:3000\n' "${lan_ip}"
  printf '  • URL Configurada:           %s\n' "${app_url}"
  if [[ -n "${admin_email}" ]]; then
    printf '  • Usuario Administrador:     %s\n' "${admin_email}"
  fi
  printf '\n  Comandos útiles en esta carpeta (%s):\n' "${SCRIPT_DIR}"
  printf '  • Actualizar ahora desde GitHub:   ./update.sh\n'
  printf '  • Crear backup manual ahora:       ./scripts/backup.sh\n'
  printf '  • Restaurar un backup:             ./scripts/restore.sh\n'
  printf '  • Ver logs del sistema:            docker compose logs -f web\n'
  printf '==============================================================\n\n'
}

main() {
  print_banner
  ensure_swap_memory
  configure_laptop_lid
  install_dependencies
  configure_env
  start_services
  configure_automation_cron
  print_summary
}

main "$@"
