# syntax=docker/dockerfile:1
# Debian-based image: Next.js's native SWC binary crashes with SIGBUS on Alpine/musl under Docker Desktop.
FROM node:22-bookworm-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates curl \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# ---------- dev: source is bind-mounted, deps live in a named volume ----------
FROM base AS dev
ENV NODE_ENV=development
EXPOSE 3000
# Use the bind-mounted script so edits to docker/entrypoint.sh apply without a rebuild.
ENTRYPOINT ["sh", "/app/docker/entrypoint.sh"]
CMD ["npm", "run", "dev"]

# ---------- deps: install all deps for the build ----------
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# ---------- build: generate the Prisma client and the standalone Next.js output ----------
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate && npm run build

# ---------- prisma-cli: a self-contained Prisma CLI for `migrate deploy` in production ----------
FROM base AS prisma-cli
WORKDIR /cli
COPY package.json /tmp/package.json
RUN npm init -y >/dev/null \
  && npm install --no-audit --no-fund --omit=dev "prisma@$(node -p "require('/tmp/package.json').devDependencies.prisma")" \
  && rm -rf /root/.npm

# ---------- prod: standalone output, non-root ----------
FROM base AS prod
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
RUN groupadd --system app && useradd --system --gid app --create-home app
COPY --from=build --chown=app:app /app/.next/standalone ./
COPY --from=build --chown=app:app /app/.next/static ./.next/static
COPY --from=build --chown=app:app /app/public ./public
COPY --from=build --chown=app:app /app/prisma ./prisma
COPY --from=prisma-cli --chown=app:app /cli/node_modules ./cli/node_modules
COPY --chown=app:app docker/entrypoint.sh /entrypoint.sh
USER app
EXPOSE 3000
ENTRYPOINT ["sh", "/entrypoint.sh"]
CMD ["node", "server.js"]
