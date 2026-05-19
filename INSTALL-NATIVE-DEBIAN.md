# Instalación nativa en Debian

Guía exclusiva para **Debian 12 (Bookworm)** y **Debian 11 (Bullseye)**.
Sin Docker, todo nativo: Node.js 20 + PostgreSQL 16 + SIIB.

Probado en Debian 12 limpio. Si usas Ubuntu, los pasos son casi idénticos
(mismo gestor `apt`), pero esta guía asume Debian.

---

## 1. Requisitos previos

| Componente | Versión mínima | Justificación |
|---|---|---|
| Debian | 11 o 12 | Las versiones soportadas actualmente |
| Acceso `sudo` | sí | Para instalar paquetes |
| Conexión a internet | sí | Repos de NodeSource y PostgreSQL |
| RAM libre | 1 GB | Build de Next.js puede usar ~700 MB |
| Disco libre | 2 GB | Node modules + BD + PDFs |
| Puerto libre | 3000 (app) y 5432 (BD) | Cambiable |

---

## 2. Actualizar el sistema

```bash
sudo apt update
sudo apt upgrade -y
sudo apt install -y curl ca-certificates gnupg lsb-release git build-essential openssl
```

`build-essential` es necesario porque `bcryptjs` y otros paquetes pueden compilar nativamente en algunas instalaciones.

---

## 3. Instalar Node.js 20 LTS desde NodeSource

El paquete `nodejs` que trae Debian es muy antiguo. Usa el repo oficial de NodeSource:

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

Verifica:

```bash
node --version    # debe mostrar v20.x.x
npm --version     # 10.x.x o superior
```

---

## 4. Instalar PostgreSQL 16 desde el repo oficial

Debian 12 trae PostgreSQL 15; recomendamos 16 desde el repo oficial PGDG para alinear con producción.

```bash
# Llave GPG y repo PGDG
sudo install -d /usr/share/postgresql-common/pgdg
sudo curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc \
  -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc

echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] \
https://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" \
  | sudo tee /etc/apt/sources.list.d/pgdg.list

# Instalar
sudo apt update
sudo apt install -y postgresql-16 postgresql-client-16
```

Servicio:

```bash
sudo systemctl enable --now postgresql
sudo systemctl status postgresql      # debe estar "active (running)"
```

Verifica:

```bash
psql --version    # psql (PostgreSQL) 16.x
```

> Si prefieres usar PostgreSQL 15 (el que ya trae Debian 12), salta el bloque del repo PGDG e instala `sudo apt install postgresql postgresql-contrib`. El sistema es compatible con PG 14+.

---

## 5. Crear base de datos y usuario

```bash
sudo -u postgres psql <<SQL
CREATE USER siib WITH PASSWORD 'siib_dev';
CREATE DATABASE siib OWNER siib;
GRANT ALL PRIVILEGES ON DATABASE siib TO siib;
\q
SQL
```

Verifica desde tu usuario normal:

```bash
PGPASSWORD=siib_dev psql -U siib -d siib -h localhost -c "SELECT version();"
```

> **Producción:** cambia `siib_dev` por una contraseña fuerte y revisa
> `/etc/postgresql/16/main/pg_hba.conf` para restringir conexiones a `localhost`
> o redes específicas. Tras editar:
> ```bash
> sudo systemctl reload postgresql
> ```

---

## 6. Clonar el proyecto y configurar

```bash
# Ubicación recomendada
sudo mkdir -p /opt/siib
sudo chown $USER:$USER /opt/siib
cd /opt/siib

# Si tienes el código en un repo:
git clone <url-del-repo> .

# O copia el directorio desde donde lo tengas
```

Copia y edita el `.env`:

```bash
cp .env.example .env
nano .env
```

Como mínimo cambia:

```env
DATABASE_URL="postgresql://siib:siib_dev@localhost:5432/siib?schema=public"
AUTH_SECRET="<pega-aquí-el-resultado-del-siguiente-comando>"
NEXTAUTH_URL="http://localhost:3000"
STORAGE_LOCAL_PATH="./storage/uploads"
NODE_ENV=production    # cámbialo a "development" si quieres hot-reload
```

Genera un `AUTH_SECRET` seguro:

```bash
openssl rand -base64 32
```

---

## 7. Instalar dependencias, migrar y sembrar

```bash
cd /opt/siib

# 1. Dependencias
npm install

# 2. Cliente de Prisma
npm run db:generate

# 3. Migrar (crea las tablas)
npm run db:migrate -- --name init

# 4. Datos iniciales (26 unidades + usuarios demo + catálogo)
npm run db:seed
```

Si todo va bien verás:
```
✓ 14 categorías
✓ 27 unidades
✓ 3 usuarios demo
✓ 12 materiales base
✓ Seed completado
```

---

## 8. Arrancar

### Modo desarrollo (hot-reload)

```bash
npm run dev
```

Abre **http://localhost:3000** y entra con:

| Email | Contraseña |
|---|---|
| `admin@bomberos.local` | `Admin1234!` |
| `encargado1@bomberos.local` | `Encargado1!` |
| `operativo1@bomberos.local` | `Operativo1!` |

### Modo producción

```bash
npm run build
npm start
```

---

## 9. Servicio systemd (producción)

Para que SIIB arranque automáticamente con el servidor:

```bash
sudo nano /etc/systemd/system/siib.service
```

Contenido:

```ini
[Unit]
Description=SIIB - Sistema Integral de Inventario de Bomberos
After=network.target postgresql.service
Wants=postgresql.service

[Service]
Type=simple
User=siib
Group=siib
WorkingDirectory=/opt/siib
EnvironmentFile=/opt/siib/.env
ExecStart=/usr/bin/npm start
Restart=on-failure
RestartSec=5

# Hardening
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/opt/siib/storage /opt/siib/.next

[Install]
WantedBy=multi-user.target
```

Crear el usuario de servicio y dar permisos:

```bash
sudo useradd --system --no-create-home --shell /usr/sbin/nologin siib
sudo chown -R siib:siib /opt/siib
sudo chmod 750 /opt/siib
sudo chmod 640 /opt/siib/.env
```

Habilitar y arrancar:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now siib
sudo systemctl status siib       # debe estar active (running)
```

Logs:

```bash
sudo journalctl -u siib -f       # en vivo
sudo journalctl -u siib -n 200   # últimas 200 líneas
```

Reiniciar tras un cambio:

```bash
sudo systemctl restart siib
```

---

## 10. Reverse proxy con Nginx (recomendado en producción)

```bash
sudo apt install -y nginx
```

```bash
sudo nano /etc/nginx/sites-available/siib
```

```nginx
server {
    listen 80;
    server_name siib.bomberos.local;

    client_max_body_size 25M;   # PDFs hasta 20 MB

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

Activar:

```bash
sudo ln -s /etc/nginx/sites-available/siib /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

Para HTTPS con Let's Encrypt (si el equipo es accesible desde internet):

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d siib.bomberos.local
```

Tras emitir el certificado, ajusta `NEXTAUTH_URL=https://siib.bomberos.local` en `.env` y reinicia `siib`.

---

## 11. Firewall (opcional)

Si usas `ufw`:

```bash
sudo apt install -y ufw
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'      # 80 y 443
sudo ufw enable
```

**No** abras 5432 ni 3000 al exterior si tienes Nginx delante.

---

## 12. Programar el job de alertas

Crea una entrada de cron del sistema:

```bash
sudo nano /etc/cron.d/siib-alerts
```

```cron
# Escaneo diario de alertas a las 06:00
0 6 * * * siib cd /opt/siib && /usr/bin/npm run alerts:scan >> /var/log/siib-alerts.log 2>&1
```

Permisos:

```bash
sudo touch /var/log/siib-alerts.log
sudo chown siib:siib /var/log/siib-alerts.log
sudo chmod 644 /etc/cron.d/siib-alerts
```

---

## 13. Backups automáticos

Crea un script:

```bash
sudo nano /opt/siib/scripts/backup.sh
```

```bash
#!/bin/bash
set -e
BACKUP_DIR="/var/backups/siib"
DATE=$(date +%F)
mkdir -p "$BACKUP_DIR"

# 1. Dump de la BD
sudo -u postgres pg_dump -Fc siib > "$BACKUP_DIR/db_$DATE.dump"

# 2. PDFs
tar czf "$BACKUP_DIR/uploads_$DATE.tgz" -C /opt/siib/storage uploads

# 3. Limpieza: conservar últimos 30 días
find "$BACKUP_DIR" -type f -mtime +30 -delete
```

```bash
sudo chmod +x /opt/siib/scripts/backup.sh
sudo mkdir -p /var/backups/siib
```

Programar con cron:

```bash
sudo nano /etc/cron.d/siib-backup
```

```cron
# Backup diario a las 02:00
0 2 * * * root /opt/siib/scripts/backup.sh >> /var/log/siib-backup.log 2>&1
```

Restaurar:

```bash
# BD
sudo systemctl stop siib
sudo -u postgres dropdb siib
sudo -u postgres createdb -O siib siib
sudo -u postgres pg_restore -d siib /var/backups/siib/db_2026-05-18.dump
sudo systemctl start siib

# PDFs
sudo tar xzf /var/backups/siib/uploads_2026-05-18.tgz -C /opt/siib/storage
sudo chown -R siib:siib /opt/siib/storage
```

---

## 14. Comandos de referencia

```bash
# Operaciones del proyecto (como usuario `siib` o desde el dir)
npm run dev              # desarrollo con hot-reload
npm run build            # build producción
npm start                # arranque producción
npm run typecheck        # validar TypeScript
npm run db:studio        # GUI Prisma (http://localhost:5555)
npm run db:migrate       # crear/aplicar migración nueva
npm run db:deploy        # aplicar migraciones existentes
npm run db:seed          # cargar datos iniciales (idempotente)
npm run alerts:scan      # ejecutar job de alertas

# Servicio
sudo systemctl start siib
sudo systemctl stop siib
sudo systemctl restart siib
sudo systemctl status siib
sudo journalctl -u siib -f

# Base de datos
sudo -u postgres psql siib                       # shell SQL
sudo -u postgres pg_dump siib > backup.sql       # dump simple
sudo systemctl restart postgresql
```

---

## 15. Solución de errores comunes

**`E: Unable to locate package nodejs`**
No corriste el script de NodeSource (paso 3). Lo más probable es que falló por `curl` no instalado: `sudo apt install -y curl ca-certificates`.

**`Error: P1001: Can't reach database server at localhost:5432`**
PostgreSQL no está corriendo o está en otro puerto.
```bash
sudo systemctl status postgresql
sudo ss -tlnp | grep 5432
```

**`password authentication failed for user "siib"`**
La contraseña en `.env` no coincide con la real. Verifica:
```bash
PGPASSWORD=siib_dev psql -U siib -d siib -h localhost -c "SELECT 1;"
```
Si falla, recrea el usuario:
```bash
sudo -u postgres psql -c "ALTER USER siib WITH PASSWORD 'siib_dev';"
```

**`peer authentication failed for user "siib"`**
Estás intentando conectarte sin host (`-h localhost`). PostgreSQL en Debian usa autenticación `peer` para conexiones locales por socket. Soluciones:
- Conectarte siempre con `-h localhost` (TCP).
- O editar `/etc/postgresql/16/main/pg_hba.conf` y cambiar `peer` por `md5` en la línea `local all all`. Recarga con `sudo systemctl reload postgresql`.

**`relation "users" does not exist`**
Te saltaste las migraciones. Ejecuta:
```bash
npm run db:migrate -- --name init
```

**`AUTH_SECRET is undefined`**
El `.env` no se está cargando. Verifica:
```bash
ls -la /opt/siib/.env
cat /opt/siib/.env | grep AUTH_SECRET
```
Si es servicio systemd, asegúrate de que `EnvironmentFile=` apunte al `.env` correcto y que el usuario `siib` tenga permiso de lectura (`chmod 640 .env && chown siib:siib .env`).

**Puerto 3000 en uso**
```bash
sudo ss -tlnp | grep 3000     # ver qué lo usa
# Cambiar puerto:
PORT=3001 npm run dev
# O en systemd: agregar Environment=PORT=3001
```

**`EACCES: permission denied, open '.../storage/uploads/...'`**
Permisos del directorio. Como usuario del servicio:
```bash
sudo chown -R siib:siib /opt/siib/storage
sudo chmod -R 750 /opt/siib/storage
```

**`prisma migrate` se cuelga**
Probable problema de red al descargar el motor binario. Pre-descarga:
```bash
PRISMA_HIDE_UPDATE_MESSAGE=true npx prisma generate
```

**El servicio no arranca y `journalctl` muestra `ENOENT npm`**
La unit usa `/usr/bin/npm`, pero Node de NodeSource lo instala ahí. Verifica:
```bash
which npm                            # debe ser /usr/bin/npm
sudo systemctl cat siib | grep ExecStart
```
Si `npm` está en otro path (`/usr/local/bin/npm`), actualiza la unit.

**`Out of memory` durante `npm run build`**
Build de Next.js puede pedir mucha RAM. Workarounds:
```bash
# 1. Aumentar swap
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# 2. Limitar memoria de Node
NODE_OPTIONS="--max-old-space-size=1024" npm run build
```

**El navegador muestra "Untrusted certificate" tras `certbot`**
Espera 1–2 minutos a que se propague o limpia la caché del navegador. Verifica el cert:
```bash
sudo certbot certificates
```

---

## 16. Actualizar SIIB a una nueva versión

```bash
cd /opt/siib
sudo systemctl stop siib
sudo -u siib git pull              # o copia los archivos nuevos
sudo -u siib npm install
sudo -u siib npm run db:deploy     # aplica migraciones pendientes
sudo -u siib npm run build
sudo systemctl start siib
sudo journalctl -u siib -n 50
```

---

## 17. Desinstalar

```bash
sudo systemctl disable --now siib
sudo rm /etc/systemd/system/siib.service
sudo systemctl daemon-reload

sudo rm /etc/nginx/sites-enabled/siib /etc/nginx/sites-available/siib
sudo systemctl reload nginx

sudo rm /etc/cron.d/siib-alerts /etc/cron.d/siib-backup

sudo -u postgres dropdb siib
sudo -u postgres dropuser siib

sudo userdel siib
sudo rm -rf /opt/siib /var/backups/siib /var/log/siib-*.log
```

---

Para Docker o desarrollo en Windows/macOS, ver:
- [INSTALL-DOCKER.md](INSTALL-DOCKER.md)
- [INSTALL-NATIVE.md](INSTALL-NATIVE.md) (multi-OS)
