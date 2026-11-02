# Guía Paso a Paso: Instalación en Ubuntu Server, Cloudflare Tunnel, Backups y Balanzas Systel Croma

Esta guía explica cómo poner en marcha **Fiambrería Costanera POS** desde cero en una notebook dedicada como servidor (por ejemplo: **Intel Celeron N4000, 4 GB de RAM, SSD de 250 GB** con **Ubuntu Server 24.04 LTS**), conectando tablets y celulares por red local o Internet y múltiples balanzas **Systel Croma** en el mostrador.

---

## 1. Preparación previa (una sola vez)

### 1.1. Hacer pública la imagen en GitHub Packages
Para que la notebook (o cualquier dispositivo nuevo) descargue el sistema ya compilado sin pedir contraseñas de GitHub:
1. Entrá a tu repositorio en GitHub (`https://github.com/Santi-GS/fiambreria-main`).
2. A la derecha, en la sección **Packages**, hacé clic en **`fiambreria-main`**.
3. Si figura como *Private*, entrá abajo del todo a **Package settings** → **Change visibility** → seleccioná **Public**.

### 1.2. Instalar Ubuntu Server en la notebook
1. Descargá **Ubuntu Server 24.04 LTS** y grabalo en un pendrive con Rufus o BalenaEtcher.
2. Durante la instalación:
   - Conectá la notebook preferentemente por **cable de red (Ethernet)** al router (o configurá el Wi-Fi del local).
   - Marcá la casilla **`[X] Install OpenSSH server`** para poder administrarla desde tu PC principal sin tocar la notebook.
3. **Recomendado:** Entrá al panel de tu router Wi-Fi y asignale una **IP local fija (Reserva DHCP)** a la notebook (por ejemplo `192.168.1.50`), para que su dirección interna nunca cambie si se corta la luz.

---

## 2. Instalación Rápida con el Instalador Automático (`install.sh`)

Iniciá sesión en la terminal de Ubuntu Server (o por SSH desde tu PC con `ssh usuario@192.168.1.50`) y ejecutá estos comandos:

```bash
sudo apt update && sudo apt install -y git
git clone https://github.com/Santi-GS/fiambreria-main.git
cd fiambreria-main
bash install.sh
```

### ¿Qué hace `./install.sh` automáticamente por vos?
1. **Crea 4 GB de memoria Swap** en el SSD para que los 4 GB de RAM del Celeron nunca se saturen.
2. **Configura la tapa de la notebook** para que puedas cerrarla y guardarla sin que Ubuntu entre en suspensión.
3. **Instala Docker, Docker Compose y `rclone`**.
4. **Te pide los datos del Primer Administrador** (Nombre, Email y Contraseña) y genera claves criptográficas únicas para PostgreSQL y las sesiones.
5. **Descarga la imagen ya compilada desde GitHub (`--no-build`)** y levanta PostgreSQL, las tablas de la base de datos, el usuario Administrador inicial, la web y el worker.
6. **Programa el backup diario (03:00 AM)** y el modo de **actualización automática desde `main`** que elijas.

### Primer ingreso al sistema
1. Desde cualquier celular, tablet o PC en el mismo Wi-Fi, abrí el navegador en `http://<IP-DE-LA-NOTEBOOK>:3000` (o en tu dominio HTTPS si ya pegaste el token de Cloudflare).
2. Iniciá sesión con el **Email y Contraseña de Administrador** que elegiste en el instalador.
3. El sistema te llevará automáticamente al asistente **`/onboard`** con el catálogo limpio (moneda `ARS` / `$` editable) para crear los datos de la fiambrería desde cero.
4. Una vez adentro, andá a **Personal (`/staff`)** para crear las cuentas de tus cajeros y encargados (el registro público `/signup` está completamente bloqueado).

---

## 3. Acceso desde Internet con Cloudflare Tunnel (HTTPS gratis)

Con **Cloudflare Tunnel** no tenés que abrir puertos en el router de tu casa/local y obtenés **HTTPS válido automático** (indispensable también para que Chrome en las tablets habilite la lectura directa por USB de las balanzas).

1. Creá una cuenta gratuita en [Cloudflare](https://dash.cloudflare.com/) y agregá tu dominio.
2. En el menú lateral entrá a **Zero Trust** → **Networks** → **Tunnels** → **Create a tunnel**.
3. Elegí **Cloudflared**, ponele un nombre (ej. `fiambreria-pos`) y copiá el **Token** del túnel (una cadena larga que empieza con `eyJ...`).
4. En la pestaña **Public Hostname** del túnel, configurá:
   - **Subdomain:** `pos` (o el que prefieras, ej. `pos.tudominio.com`)
   - **Domain:** tu dominio
   - **Service Type:** `HTTP`
   - **URL:** **`web:3000`** *(¡Importante! Escribí `web:3000` y NO `localhost:3000`, porque el túnel corre dentro de la red interna de Docker junto al contenedor `web`)*.
5. Si no pegaste el token durante `./install.sh`, editalo en la notebook:
   ```bash
   cd ~/fiambreria-main
   nano .env
   ```
   Completá estas tres líneas:
   ```env
   APP_URL=https://pos.tudominio.com
   COMPOSE_PROFILES=cloudflare
   CLOUDFLARE_TUNNEL_TOKEN=eyJhIjoi...tu-token-aqui...
   ```
   Guardá (`Ctrl+O`, `Enter`, `Ctrl+X`) y aplicá el cambio:
   ```bash
   docker compose up -d --no-build
   ```

> **Consejo extra de seguridad:** En el mismo panel de Cloudflare Zero Trust (*Access → Applications*), podés crear gratis una política para `pos.tudominio.com` que pida un PIN enviado a tus correos autorizados antes siquiera de mostrar la pantalla de inicio de sesión del POS.

---

## 4. Copias de Seguridad Diarias y Subida a la Nube (`rclone`)

El sistema guarda todas las noches a las **03:00 AM** una copia comprimida de la base de datos (`backups/db/fiambreria-db-YYYY-MM-DD_HHMMSS.sql.gz`) y de las fotos de productos (`backups/uploads/`) en el SSD local, conservando los últimos 30 días.

### Vincular Google Drive / OneDrive / Dropbox en Ubuntu Server
Como Ubuntu Server no tiene navegador gráfico, `rclone` permite autorizar tu cuenta desde tu PC principal con Windows:

1. En la terminal de **Ubuntu Server**, ejecutá:
   ```bash
   rclone config
   ```
   - Elegí `n` (*New remote*) → nombre: **`gdrive`**
   - Elegí el número correspondiente a **Google Drive** (o `onedrive` / `dropbox`).
   - Dejá `client_id` y `client_secret` vacíos (`Enter`), elegí acceso `1` (*Full access*), `service_account_file` vacío (`Enter`), `Edit advanced config?` → `n`.
   - Cuando pregunte **`Use web browser to automatically authenticate rclone with remote?`**, respondé **`n`** (No).
   - `rclone` te mostrará un comando del estilo `rclone authorize "drive" "..."`.
2. Descargá [rclone para Windows](https://rclone.org/downloads/) en tu PC principal, ejecutá ese comando `rclone authorize ...` en PowerShell, iniciá sesión con tu cuenta de Google en el navegador y copiá el código que te devuelve la consola de vuelta en Ubuntu Server.
3. Activá la subida automática en tu `.env` de Ubuntu Server:
   ```env
   RCLONE_REMOTE=gdrive:FiambreriaCostaneraBackups
   ```
4. Probá que suba correctamente ejecutando un backup manual:
   ```bash
   ./scripts/backup.sh
   ```

### Cómo restaurar un backup (o mudar el sistema a otra computadora)
```bash
# Ver lista de backups disponibles
./scripts/restore.sh

# Restaurar uno específico
./scripts/restore.sh backups/db/fiambreria-db-2026-11-02_030000.sql.gz
```

---

## 5. Cómo Actualizar el Sistema Cuando Hacés Commits en `main`

Cada vez que hacés `git commit` y `git push` a la rama `main` desde tu PC de desarrollo:
1. **GitHub Actions** verifica los tests y publica automáticamente la nueva imagen en `ghcr.io` (tarda ~2 minutos).
2. En la notebook Ubuntu Server:
   - **Si elegiste modo automático** (nocturno a las 03:30 AM o cada 15 minutos): el script `./update.sh --auto` verifica si publicaste cambios nuevos. Si no hubo commits nuevos no toca nada; si hay versión nueva, **hace un backup preventivo**, descarga los cambios, aplica migraciones nuevas de Prisma sin perder datos y reinicia el contenedor en pocos segundos.
   - **Si querés actualizar en el acto manualmente:** entrás por SSH a la notebook y corrés:
     ```bash
     cd ~/fiambreria-main
     ./update.sh
     ```

---

## 6. Conexión de Múltiples Balanzas Systel Croma en las Tablets

Cada puesto del mostrador puede tener su propia balanza **Systel Croma** independiente conectada directamente a su tablet.

### Requisitos físicos por puesto
1. **Tablet Android (con Google Chrome y soporte USB-OTG)** o **Tablet / PC Windows (Chrome o Edge)**. *(Nota: iPad/iOS no permite acceso web a cables USB-RS232).*
2. **Cable adaptador RS-232 a USB** de buena calidad (chips soportados nativamente por el sistema: **FTDI**, **CH340/CH341**, **CP2102/CP210x** y **Prolific PL2303**) + **adaptador USB-OTG** (USB-A hembra a USB-C macho para la tablet).
3. **Configuración de la balanza Systel Croma:** Velocidad estándar de fábrica (**9600 baudios, 8 bits, sin paridad, 1 bit de parada**). Soporta tanto modo *Pedido de Peso (`ENQ` / `P`)* como *Envío Continuo*.

### Uso en el Punto de Venta (`/checkout`)
1. Enchufá la balanza Systel Croma a la tablet mediante el cable RS-232 a USB + OTG.
2. Entrá al sistema por tu dominio HTTPS de Cloudflare (`https://pos.tudominio.com`) y tocá cualquier producto pesable (`Kg`) para abrir la ventana emergente de pesaje.
3. La **primera vez** en esa tablet, tocá el botón **`Conectar Systel USB`** y aceptá el permiso USB que muestra Chrome.
4. A partir de ese momento:
   - Cada vez que abras la ventana de un producto pesable en esa tablet, **se reconectará sola** y verás el peso e importe actualizarse en vivo (**`Systel en vivo • Estable`**).
   - Podés tocar **`Fijar peso`** para congelar el valor, o escribir directamente con el teclado / botones rápidos (`100 g`, `250 g`, `500 g`, `1 Kg`) si en algún momento necesitás ingresar un peso manual.

### Truco importante: Uso de la balanza USB si se corta Internet en el local
Si algún día el proveedor de Internet del local se cae, las tablets pueden seguir cobrando normalmente entrando por Wi-Fi interno a la IP local de la notebook (`http://192.168.1.50:3000`).
Para que Google Chrome en cada tablet también permita leer el cable USB sobre `http://` local sin HTTPS:
1. Abrí Chrome en la tablet y escribí en la barra de direcciones:
   `chrome://flags/#unsafely-treat-insecure-origin-as-secure`
2. En el cuadro de texto escribí la dirección local del servidor, por ejemplo:
   `http://192.168.1.50:3000`
3. Cambiá el selector a **Enabled** y tocá **Relaunch**. ¡Así la balanza USB funcionará tanto por Cloudflare HTTPS como por red local sin Internet!
