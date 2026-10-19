# syntax=docker/dockerfile:1
# Same shape as loupMr-studio: Next.js standalone + Prisma, migrations on boot.

# ---- deps ----
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN npm ci

# ---- builder ----
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# Prisma downloads its engines from binaries.prisma.sh on first generate; the
# NAS's DNS sometimes flakes (EAI_AGAIN), so retry before giving up.
RUN for i in 1 2 3 4 5; do \
      npx prisma generate && break || { echo "prisma generate failed (attempt $i) — retrying in 8s"; sleep 8; }; \
    done \
    && npx next build

# ---- runner ----
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Full node_modules so `prisma migrate deploy` can run at start (the CLI is a
# devDependency with its own dependency tree).
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
# 1) COPY dereferences the .bin/prisma symlink, breaking its wasm lookups — recreate it.
# 2) Files uploaded to a NAS often carry restrictive modes; make them readable.
RUN ln -sf ../prisma/build/index.js node_modules/.bin/prisma \
    && chmod -R u+rX ./prisma ./public

COPY --chown=nextjs:nodejs docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

USER nextjs
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD wget -qO /dev/null http://127.0.0.1:3000/api/health || exit 1
ENTRYPOINT ["./docker-entrypoint.sh"]
