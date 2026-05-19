# Instalación nativa (sin Docker)

Ejecutar el proyecto directamente con Node.js + PostgreSQL local. Misma base de código que el modo Docker.

## 1. Requisitos previos

| Componente | Versión | Cómo verificar |
|---|---|---|
| Node.js | 20 LTS o superior | `node --version` |
| npm | 10+ (viene con Node) | `npm --version` |
| PostgreSQL | 14 o superior (16 recomendado) | `psql --version` |
| Git | cualquiera reciente | `git --version` |

> **Atajo:** si no quieres instalar PostgreSQL nativo, puedes correr **solo la BD en Docker** y la app nativa. Ver [sección 7](#7-atajo-postgresql-en-docker-y-app-nativa).

---

## 2. Instalar Node.js

### Windows

Opción A — instalador oficial:
1. Descarga el LTS desde https://nodejs.org/
2. Ejecuta el `.msi`. Acepta agregar al `PATH`.
3. Reinicia PowerShell.

Opción B — winget:
```powershell
winget install OpenJS.NodeJS.LTS
```

### macOS

Con Homebrew (recomendado):
```bash
brew install node@20
brew link --overwrite node@20
```

### Linux (Ubuntu/Debian)

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

### Linux (Fedora/RHEL)

```bash
sudo dnf module install nodejs:20/common
```

---

## 3. Instalar PostgreSQL

### Windows

1. Descarga el instalador desde https://www.postgresql.org/download/windows/
2. Anota usuario `postgres` y la contraseña que defines.
3. El instalador añade `psql` al PATH. Verifica en PowerShell:
   ```powershell
   psql --version
   ```

### macOS

```bash
brew install postgresql@16
brew services start postgresql@16
```

### Linux (Ubuntu/Debian)

```bash
sudo apt install -y postgresql-16
sudo systemctl enable --now postgresql
```

### Linux (Fedora/RHEL)

```bash
sudo dnf install postgresql-server postgresql-contrib
sudo postgresql-setup --initdb
sudo systemctl enable --now postgresql
```

---

## 4. Crear base de datos y usuario

Ejecuta como superusuario de Postgres (`postgres`):

### Windows (PowerShell)

```powershell
# Conéctate como superusuario
psql -U postgres
```

### Linux / macOS

```bash
sudo -u postgres psql
```

Dentro de `psql`, ejecuta:

```sql
CREATE USER siib WITH PASSWORD 'siib_dev';
CREATE DATABASE siib OWNER siib;
GRANT ALL PRIVILEGES ON DATABASE siib TO siib;
\q
```

Verifica:

```bash
psql -U siib -d siib -h localhost -c "SELECT 1;"
# Si pide password: siib_dev
```

> **Producción:** usa una contraseña fuerte y, en `pg_hba.conf`, restringe conexiones por IP.

---

## 5. Configurar el proyecto

```powershell
# Windows
cd D:\claude\Inventario
Copy-Item .env.example .env
```

```bash
# Linux / macOS
cd /ruta/a/Inventario
cp .env.example .env
```

Editar `.env` con tu editor favorito y verificar:

```env
DATABASE_URL="postgresql://siib:siib_dev@localhost:5432/siib?schema=public"
AUTH_SECRET="<genera-uno-nuevo>"
NEXTAUTH_URL="http://localhost:3000"
STORAGE_LOCAL_PATH="./storage/uploads"
```

Generar `AUTH_SECRET`:

```bash
# Linux / macOS
openssl rand -base64 32
```

```powershell
# Windows PowerShell
[Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
```

---

## 6. Instalar dependencias, migrar, sembrar y arrancar

```bash
# 1. Instalar paquetes
npm install

# 2. Generar el cliente de Prisma
npm run db:generate

# 3. Aplicar migraciones (crea todas las tablas)
npm run db:migrate -- --name init

# 4. Cargar datos iniciales (26 unidades + usuarios demo + catálogo)
npm run db:seed

# 5. Arrancar el servidor de desarrollo
npm run dev
```

Abre **http://localhost:3000**.

### Build de producción (mismo equipo)

```bash
npm run build
npm start         # arranca en modo producción en puerto 3000
```

---

## 7. Atajo: PostgreSQL en Docker y app nativa

Si no quieres instalar PostgreSQL en tu máquina, levanta solo la BD con Docker y corre la app con Node:

```bash
# 1. Levantar PostgreSQL en Docker (publica el puerto 5432 al host)
docker compose -f docker-compose.db.yml up -d

# 2. Continuar con los pasos 5 y 6 de arriba, sin tocar nada más
npm install
npm run db:migrate -- --name init
npm run db:seed
npm run dev
```

Para detener:
```bash
docker compose -f docker-compose.db.yml down
```

---

## 8. Programar el job de alertas

### Windows — Task Scheduler

```powershell
schtasks /Create /SC DAILY /ST 06:00 /TN "SIIB-AlertsScan" /TR "cmd /c cd /d D:\claude\Inventario && npm run alerts:scan"
```

### Linux / macOS — cron

```bash
crontab -e
# añadir:
0 6 * * * cd /ruta/a/Inventario && /usr/bin/npm run alerts:scan
```

---

## 9. Comandos de referencia

```bash
npm run dev              # desarrollo con hot-reload
npm run build            # build producción
npm start                # arrancar build de producción
npm run typecheck        # validar TypeScript
npm run db:studio        # GUI para explorar la BD (Prisma Studio)
npm run db:migrate       # crear/aplicar migración nueva
npm run db:deploy        # aplicar migraciones existentes (producción)
npm run db:seed          # cargar datos iniciales
npm run alerts:scan      # ejecutar job de alertas manualmente
```

---

## 10. Solución de errores comunes

**`Error: P1001: Can't reach database server at localhost:5432`**
PostgreSQL no está corriendo. Verifica:
- Windows: panel "Servicios" → `postgresql-x64-16` debe estar en "Iniciado".
- macOS: `brew services list`.
- Linux: `sudo systemctl status postgresql`.

**`Error: password authentication failed for user "siib"`**
La contraseña en `DATABASE_URL` no coincide con la real. Vuelve al paso 4 y recrea el usuario con la misma contraseña que `.env`.

**`Error: relation "users" does not exist`**
Te saltaste las migraciones. Ejecuta `npm run db:migrate -- --name init`.

**`Error: prisma generate` falla en Windows con SSL**
Cierra antivirus que pueda estar bloqueando descargas, o pre-bajar el motor:
```powershell
npm install -D prisma@latest
```

**Puerto 3000 en uso**
```bash
# Cambia el puerto al arrancar
PORT=3001 npm run dev          # Linux / macOS
$env:PORT=3001; npm run dev    # Windows PowerShell
```

**`EACCES: permission denied, open '.../storage/uploads/...'`**
La carpeta no tiene permisos. Crea/repara:
```bash
mkdir -p storage/uploads
chmod -R 755 storage          # Linux / macOS
```

**El seed dice "User unique constraint failed"**
Ya cargaste el seed antes. Es idempotente (usa upsert), pero ese error puede aparecer si ediciones manuales rompieron la BD. Reset:
```bash
npx prisma migrate reset      # ⚠ borra y recrea todo, vuelve a ejecutar el seed
```

**`AUTH_SECRET is undefined`**
Tu `.env` no se está cargando. Verifica:
1. Que el archivo se llame exactamente `.env` (no `.env.txt`).
2. Que esté en la raíz del proyecto.
3. Que reiniciaste `npm run dev` después de editarlo.

**TypeScript no encuentra `@prisma/client`**
Genera el cliente:
```bash
npm run db:generate
```

**Tailwind no aplica estilos**
Reinicia el dev server. Si persiste, borra `.next/` y vuelve a iniciar:
```bash
# Linux / macOS
rm -rf .next && npm run dev
```
```powershell
# Windows
Remove-Item -Recurse -Force .next; npm run dev
```

---

Para correrlo todo en contenedores, ver [INSTALL-DOCKER.md](INSTALL-DOCKER.md).
