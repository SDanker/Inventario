#!/bin/sh
# Entrypoint del contenedor `app`.
# Espera a la BD vía depends_on (healthcheck), aplica migraciones y
# opcionalmente carga el seed antes de iniciar Next.js.
set -e

echo "→ SIIB: sincronizando esquema de Prisma…"
npx prisma db push --skip-generate

# El seed es idempotente (usa upsert), pero solo lo corremos si SEED_ON_BOOT=true.
if [ "${SEED_ON_BOOT:-false}" = "true" ]; then
  echo "→ SIIB: ejecutando seed (idempotente)…"
  if ! npm run db:seed; then
    echo "⚠  El seed falló. Continuando arranque — revisa logs."
  fi
fi

echo "→ SIIB: iniciando aplicación en puerto ${PORT:-3000}…"
exec "$@"
