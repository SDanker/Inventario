# Instalación con Docker

Levanta **PostgreSQL + la aplicación** en contenedores. Misma base de código que el modo nativo.

## 1. Requisitos previos

| SO | Qué instalar |
|---|---|
| Windows 10/11 | [Docker Desktop](https://www.docker.com/products/docker-desktop/) (incluye WSL2). Reiniciar al terminar. |
| macOS (Intel/Apple Silicon) | [Docker Desktop](https://www.docker.com/products/docker-desktop/) |
| Linux (Ubuntu/Debian) | `sudo apt install docker.io docker-compose-plugin` y `sudo usermod -aG docker $USER` (relogin) |
| Linux (Fedora/RHEL) | `sudo dnf install docker docker-compose-plugin` y arrancar `sudo systemctl enable --now docker` |

Verificar:

```bash
docker --version          # 24+ recomendado
docker compose version    # v2.x
```

## 2. Configurar variables de entorno

```powershell
# Windows (PowerShell)
Copy-Item .env.example .env
```

```bash
# Linux / macOS
cp .env.example .env
```

Editar `.env` y como mínimo cambiar:

- `AUTH_SECRET` — genera uno seguro:
  ```bash
  # Linux / macOS
  openssl rand -base64 32
  ```
  ```powershell
  # Windows PowerShell
  [Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
  ```
- `POSTGRES_PASSWORD` — contraseña fuerte para producción.
- `ALERTS_SCAN_TOKEN` — token aleatorio para el job de alertas.

## 3. Construir y arrancar

```bash
docker compose up -d --build
```

Esto:

1. Compila la imagen `siib-app` (multi-stage).
2. Arranca PostgreSQL y espera a que esté listo (healthcheck).
3. El contenedor `app` ejecuta automáticamente `prisma migrate deploy` y el `seed`.
4. La app queda disponible en **http://localhost:3000**.

Primer arranque: ~2–5 minutos según red e internet.

## 4. Verificar

```bash
docker compose ps           # estado de los servicios
docker compose logs -f app  # logs de la app (Ctrl-C para salir)
```

Debes ver en los logs:

```
→ SIIB: aplicando migraciones de Prisma…
→ SIIB: ejecutando seed (idempotente)…
→ SIIB: iniciando aplicación en puerto 3000…
▲ Next.js 15 - ready
```

Abrir el navegador en http://localhost:3000 y entrar con un usuario demo (ver sección **Usuario administrador inicial**).

## 5. Comandos útiles

### Detener / iniciar

```bash
docker compose stop          # detiene sin borrar contenedores
docker compose start         # vuelve a levantar lo detenido
docker compose down          # detiene Y borra contenedores (volúmenes se mantienen)
docker compose down -v       # ⚠ borra TAMBIÉN volúmenes (RESET TOTAL: pierdes BD y PDFs)
```

### Rebuild tras cambios en el código

```bash
docker compose up -d --build app
```

### Ejecutar migraciones manualmente

El contenedor ya las corre al arrancar. Si necesitas forzar:

```bash
docker compose exec app npx prisma migrate deploy
```

### Crear una nueva migración (desarrollo)

```bash
docker compose exec app npx prisma migrate dev --name describe_change
```

### Re-ejecutar el seed (idempotente)

```bash
docker compose exec app npm run db:seed
```

### Ejecutar el job de alertas

```bash
docker compose exec app npm run alerts:scan
```

### Abrir una shell dentro del contenedor

```bash
docker compose exec app sh
```

### Acceder a la BD con psql

```bash
docker compose exec postgres psql -U siib -d siib
```

### Backup de la BD

```bash
# Linux / macOS
docker compose exec -T postgres pg_dump -U siib siib > backup_$(date +%F).sql

# Windows PowerShell
docker compose exec -T postgres pg_dump -U siib siib | Out-File -Encoding utf8 "backup_$(Get-Date -Format yyyy-MM-dd).sql"
```

### Restore

```bash
cat backup.sql | docker compose exec -T postgres psql -U siib -d siib
```

### Backup de PDFs

```bash
docker run --rm -v siib_uploads:/data -v ${PWD}:/backup alpine \
  tar czf /backup/uploads_$(date +%F).tgz -C /data .
```

## 6. Volúmenes y persistencia

Dos volúmenes Docker garantizan que **nada se pierde** entre `docker compose down` y `up`:

| Volumen | Contenido | Recrear borra |
|---|---|---|
| `siib_pgdata` | Toda la base de datos | Usuarios, inventario, auditoría |
| `siib_uploads` | PDFs subidos | Documentos cargados |

Solo `docker compose down -v` los elimina.

## 7. Programar el job de alertas

Linux/macOS — cron:

```bash
# crontab -e — todos los días a las 06:00
0 6 * * * docker compose -f /ruta/al/proyecto/docker-compose.yml exec -T app npm run alerts:scan
```

Windows — Task Scheduler:

```powershell
schtasks /Create /SC DAILY /ST 06:00 /TN "SIIB-AlertsScan" /TR "docker compose -f D:\claude\Inventario\docker-compose.yml exec -T app npm run alerts:scan"
```

## 8. Producción on-premise

1. Cambiar **todas** las contraseñas y secrets de `.env`.
2. Servir detrás de Nginx con HTTPS:
   ```nginx
   server {
     listen 443 ssl http2;
     server_name siib.bomberos.local;
     ssl_certificate     /etc/ssl/siib.crt;
     ssl_certificate_key /etc/ssl/siib.key;
     client_max_body_size 25M;     # PDFs hasta 20 MB
     location / {
       proxy_pass http://127.0.0.1:3000;
       proxy_set_header Host $host;
       proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
       proxy_set_header X-Forwarded-Proto $scheme;
     }
   }
   ```
3. `NEXTAUTH_URL=https://siib.bomberos.local` en `.env`.
4. Cambiar `SEED_ON_BOOT=false` después del primer arranque.
5. Backups automáticos diarios (ver sección 5).
6. Actualizar el stack:
   ```bash
   git pull
   docker compose up -d --build
   ```

## 9. Solución de errores comunes

**`Error: Falta AUTH_SECRET en .env`**
No definiste `AUTH_SECRET` o tu `.env` no se está cargando. Verifica que está en la raíz del proyecto (al lado de `docker-compose.yml`).

**`port is already allocated` (puerto 3000 ocupado)**
Cambia `APP_PORT=3001` (o lo que prefieras) en `.env` y reinicia.

**El contenedor `app` se reinicia en bucle**
```bash
docker compose logs --tail=100 app
```
Causa típica: migración falló (BD vieja). Solución: `docker compose down -v && docker compose up -d --build` (⚠ borra datos).

**No puedo conectarme a la BD desde DBeaver/psql en el host**
Por seguridad, el `docker-compose.yml` no publica el puerto 5432. Descomenta la sección `ports:` del servicio `postgres` y reinicia. Alternativa: `docker compose exec postgres psql -U siib`.

**Cambié código y no se ve reflejado**
La imagen no se reconstruye sola. Ejecuta `docker compose up -d --build`.

**Permisos de archivos en Linux (volumen `siib_uploads`)**
El contenedor corre como UID 1001. Si el directorio host quedó con otro dueño, usa `sudo chown -R 1001:1001 <ruta>` o deja Docker gestionar el volumen named (recomendado, es lo que hace el compose por defecto).

**Apple Silicon (M1/M2/M3): `no matching manifest`**
Las imágenes oficiales que usamos (`node:20-alpine`, `postgres:16-alpine`) son multi-arch. Si recibes este error con alguna otra, agrega al servicio: `platform: linux/amd64`.

**Windows: el build falla con `EACCES` o `permission denied`**
Asegúrate de que Docker Desktop esté usando WSL2 (no Hyper-V legacy). Settings → General → "Use the WSL 2 based engine".

---

Para desarrollo sin Docker, ver [INSTALL-NATIVE.md](INSTALL-NATIVE.md).
