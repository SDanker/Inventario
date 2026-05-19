# syntax=docker/dockerfile:1.7
# SIIB — Imagen de producción (multi-stage)
# Misma base de código que el modo nativo; cambia solo cómo se levanta.

# ──────────────────────────────────────────────────────────────────
# Stage 1: deps — instala dependencias con cache reproducible
# ──────────────────────────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl
COPY package.json package-lock.json* ./
# Si no existe package-lock.json (primer arranque), npm install lo crea.
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

# ──────────────────────────────────────────────────────────────────
# Stage 2: builder — genera Prisma Client y build de Next.js
# ──────────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app
RUN apk add --no-cache openssl
ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy"
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

# ──────────────────────────────────────────────────────────────────
# Stage 3: runner — imagen final, mínima
# ──────────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN apk add --no-cache openssl ca-certificates tini && \
    addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copia artefactos del builder con permisos correctos
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/scripts ./scripts
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nextjs:nodejs /app/next.config.mjs ./next.config.mjs
COPY --from=builder --chown=nextjs:nodejs /app/tsconfig.json ./tsconfig.json

# Carpeta para PDFs (montar volumen aquí en docker-compose)
RUN mkdir -p /app/storage/uploads && chown -R nextjs:nodejs /app/storage

# Entrypoint: aplica migraciones (+ seed opcional) y arranca Next.js
COPY --chown=nextjs:nodejs docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

USER nextjs
EXPOSE 3000

ENTRYPOINT ["/sbin/tini", "--", "/usr/local/bin/entrypoint.sh"]
CMD ["npm", "start"]
