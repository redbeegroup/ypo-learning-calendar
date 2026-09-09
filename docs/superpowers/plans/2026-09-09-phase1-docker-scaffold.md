# Phase 1: Docker Scaffold Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Next.js 15 app, PostgreSQL, and Mailpit all running in Docker with hot reload, Prisma wired up, a health route, and a Vitest suite that runs inside the container.

**Architecture:** One `Dockerfile` with `dev` and `prod` targets. `docker-compose.yml` runs the dev target with the source bind-mounted and `node_modules` in a named volume. A `Makefile` wraps every command so nothing runs on the host. The entrypoint runs Prisma migrations before starting the app.

**Tech Stack:** Docker Compose, node:22-alpine, Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS v4, shadcn/ui, Prisma 6, PostgreSQL 16, Mailpit, Vitest.

Spec: `docs/superpowers/specs/2026-09-09-learning-calendar-design.md`

---

## File structure

```
Dockerfile                  dev and prod build targets
docker-compose.yml          app + db + mailpit for local dev
docker/entrypoint.sh        migrate deploy, then exec CMD
Makefile                    dev, down, shell, install, migrate, seed, test, lint
.env.example                every env var with local defaults
.dockerignore, .gitignore
package.json                pinned deps and scripts
tsconfig.json, next.config.ts, postcss.config.mjs, eslint.config.mjs, vitest.config.ts
prisma/schema.prisma        datasource + generator only (models come in Phase 2)
src/app/layout.tsx          root layout, blue theme globals
src/app/globals.css         Tailwind v4 import + shadcn tokens in blue
src/app/page.tsx            placeholder landing that links to /login
src/app/api/health/route.ts GET health check with DB ping
src/server/db.ts            Prisma client singleton
src/lib/utils.ts            cn() helper for shadcn
tests/unit/health.test.ts   unit test of health payload builder
```

---

### Task 1: Docker files, env, ignore files

**Files:**
- Create: `Dockerfile`, `docker-compose.yml`, `docker/entrypoint.sh`, `.env.example`, `.dockerignore`, `.gitignore`, `Makefile`

- [ ] **Step 1: Write `Dockerfile`**

```dockerfile
# syntax=docker/dockerfile:1
FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

# ---------- dev: source is bind-mounted, deps live in a named volume ----------
FROM base AS dev
ENV NODE_ENV=development
COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
EXPOSE 3000
ENTRYPOINT ["/entrypoint.sh"]
CMD ["npm", "run", "dev"]

# ---------- deps: install production + build deps ----------
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# ---------- build ----------
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate && npm run build

# ---------- prod: standalone output, non-root ----------
FROM base AS prod
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
RUN addgroup -S app && adduser -S app -G app
COPY --from=build --chown=app:app /app/.next/standalone ./
COPY --from=build --chown=app:app /app/.next/static ./.next/static
COPY --from=build --chown=app:app /app/public ./public
COPY --from=build --chown=app:app /app/prisma ./prisma
COPY --from=build --chown=app:app /app/node_modules/prisma ./node_modules/prisma
COPY --from=build --chown=app:app /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=build --chown=app:app /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build --chown=app:app /app/node_modules/.bin/prisma ./node_modules/.bin/prisma
COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
USER app
EXPOSE 3000
ENTRYPOINT ["/entrypoint.sh"]
CMD ["node", "server.js"]
```

- [ ] **Step 2: Write `docker/entrypoint.sh`**

```sh
#!/bin/sh
set -e

if [ "$NODE_ENV" = "development" ]; then
  if [ ! -d node_modules/.bin ] || [ ! -f node_modules/.install-stamp ] || [ package-lock.json -nt node_modules/.install-stamp ]; then
    echo ">> installing dependencies"
    npm install
    touch node_modules/.install-stamp
  fi
  npx prisma generate
fi

if [ -d prisma/migrations ] && [ -n "$(ls -A prisma/migrations 2>/dev/null)" ]; then
  echo ">> applying migrations"
  npx prisma migrate deploy
fi

exec "$@"
```

- [ ] **Step 3: Write `docker-compose.yml`**

```yaml
services:
  app:
    build:
      context: .
      target: dev
    ports:
      - "3000:3000"
    env_file: .env
    environment:
      DATABASE_URL: postgresql://ypo:ypo@db:5432/ypo?schema=public
      SMTP_HOST: mailpit
      SMTP_PORT: "1025"
      WATCHPACK_POLLING: "true"
    volumes:
      - .:/app
      - node_modules:/app/node_modules
      - next_cache:/app/.next
    depends_on:
      db:
        condition: service_healthy
      mailpit:
        condition: service_started

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: ypo
      POSTGRES_PASSWORD: ypo
      POSTGRES_DB: ypo
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ypo -d ypo"]
      interval: 5s
      timeout: 3s
      retries: 10

  mailpit:
    image: axllent/mailpit:latest
    ports:
      - "8025:8025"
      - "1025:1025"

volumes:
  pgdata:
  node_modules:
  next_cache:
```

- [ ] **Step 4: Write `.env.example`** (copied to `.env` by `make dev`)

```env
# App
APP_URL=http://localhost:3000
JWT_SECRET=change-me-to-a-long-random-string
# Database (compose overrides this for the app container)
DATABASE_URL=postgresql://ypo:ypo@localhost:5432/ypo?schema=public
# Email: local dev uses Mailpit SMTP; production uses Resend
EMAIL_FROM="YPO SEA Learning <no-reply@example.com>"
SMTP_HOST=localhost
SMTP_PORT=1025
RESEND_API_KEY=
# Seed super admin
SEED_ADMIN_EMAIL=admin@example.com
SEED_ADMIN_PASSWORD=ChangeMe123!
SEED_ADMIN_NAME=Super Admin
```

- [ ] **Step 5: Write `.dockerignore` and `.gitignore`**

`.dockerignore`:
```
node_modules
.next
.git
docs
*.md
.env
.env.*
!.env.example
coverage
playwright-report
test-results
```

`.gitignore`:
```
node_modules
.next
out
coverage
playwright-report
test-results
.env
.env.*
!.env.example
*.tsbuildinfo
next-env.d.ts
.DS_Store
```

- [ ] **Step 6: Write `Makefile`**

```makefile
COMPOSE=docker compose
APP=$(COMPOSE) exec app

.PHONY: dev down logs shell install migrate migrate-dev seed studio test test-watch lint typecheck build-prod

.env:
	cp .env.example .env

dev: .env
	$(COMPOSE) up --build

down:
	$(COMPOSE) down

logs:
	$(COMPOSE) logs -f app

shell:
	$(APP) sh

install:
	$(APP) npm install

migrate:
	$(APP) npx prisma migrate deploy

migrate-dev:
	$(APP) npx prisma migrate dev --name $(name)

seed:
	$(APP) npx prisma db seed

studio:
	$(COMPOSE) exec -p 5555:5555 app npx prisma studio --port 5555 --hostname 0.0.0.0

test:
	$(APP) npx vitest run

test-watch:
	$(APP) npx vitest

lint:
	$(APP) npm run lint

typecheck:
	$(APP) npx tsc --noEmit

build-prod:
	docker build --target prod -t ypo-lc:local .
```

- [ ] **Step 7: Commit**

```bash
git add Dockerfile docker docker-compose.yml .env.example .dockerignore .gitignore Makefile docs
git commit -m "chore: docker scaffold, compose, makefile, spec"
```

---

### Task 2: Next.js app files

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `eslint.config.mjs`, `src/app/layout.tsx`, `src/app/globals.css`, `src/app/page.tsx`, `src/lib/utils.ts`, `public/.gitkeep`, `next-env.d.ts` is generated

- [ ] **Step 1: Write `package.json`**

```json
{
  "name": "ypo-learning-calendar",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev -H 0.0.0.0 -p 3000",
    "build": "next build",
    "start": "next start",
    "lint": "eslint .",
    "test": "vitest run",
    "prisma:generate": "prisma generate"
  },
  "prisma": {
    "seed": "tsx prisma/seed.ts"
  },
  "dependencies": {
    "@prisma/client": "^6.14.0",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "lucide-react": "^0.541.0",
    "next": "^15.5.0",
    "react": "^19.1.1",
    "react-dom": "^19.1.1",
    "tailwind-merge": "^3.3.1",
    "zod": "^3.25.76"
  },
  "devDependencies": {
    "@eslint/eslintrc": "^3.3.1",
    "@tailwindcss/postcss": "^4.1.12",
    "@types/node": "^22.17.2",
    "@types/react": "^19.1.10",
    "@types/react-dom": "^19.1.7",
    "eslint": "^9.34.0",
    "eslint-config-next": "^15.5.0",
    "prisma": "^6.14.0",
    "tailwindcss": "^4.1.12",
    "tsx": "^4.20.4",
    "tw-animate-css": "^1.3.7",
    "typescript": "^5.9.2",
    "vitest": "^3.2.4"
  }
}
```

- [ ] **Step 2: Write `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: Write `next.config.ts`, `postcss.config.mjs`, `eslint.config.mjs`**

`next.config.ts`:
```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
};

export default nextConfig;
```

`postcss.config.mjs`:
```js
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};
export default config;
```

`eslint.config.mjs`:
```js
import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const compat = new FlatCompat({ baseDirectory: __dirname });

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  { ignores: [".next/**", "node_modules/**", "coverage/**"] },
];

export default eslintConfig;
```

- [ ] **Step 4: Write `src/app/globals.css`** (Tailwind v4 + shadcn tokens, blue primary)

```css
@import "tailwindcss";
@import "tw-animate-css";

@custom-variant dark (&:is(.dark *));

:root {
  --radius: 0.625rem;
  --background: oklch(0.985 0.002 247.839);
  --foreground: oklch(0.208 0.042 265.755);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.208 0.042 265.755);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.208 0.042 265.755);
  --primary: oklch(0.546 0.245 262.881);
  --primary-foreground: oklch(0.985 0 0);
  --secondary: oklch(0.932 0.032 255.585);
  --secondary-foreground: oklch(0.379 0.146 265.522);
  --muted: oklch(0.968 0.007 247.896);
  --muted-foreground: oklch(0.554 0.046 257.417);
  --accent: oklch(0.932 0.032 255.585);
  --accent-foreground: oklch(0.379 0.146 265.522);
  --destructive: oklch(0.577 0.245 27.325);
  --border: oklch(0.929 0.013 255.508);
  --input: oklch(0.929 0.013 255.508);
  --ring: oklch(0.546 0.245 262.881);
  --sidebar: oklch(0.282 0.091 267.935);
  --sidebar-foreground: oklch(0.985 0 0);
  --sidebar-primary: oklch(0.546 0.245 262.881);
  --sidebar-primary-foreground: oklch(0.985 0 0);
  --sidebar-accent: oklch(0.379 0.146 265.522);
  --sidebar-accent-foreground: oklch(0.985 0 0);
  --sidebar-border: oklch(0.379 0.146 265.522);
  --sidebar-ring: oklch(0.546 0.245 262.881);
}

@theme inline {
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-sidebar: var(--sidebar);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-ring: var(--sidebar-ring);
}

@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  body {
    @apply bg-background text-foreground;
  }
}
```

- [ ] **Step 5: Write `src/lib/utils.ts`, `src/app/layout.tsx`, `src/app/page.tsx`**

`src/lib/utils.ts`:
```ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

`src/app/layout.tsx`:
```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "YPO SEA Learning Calendar",
  description: "Learning events across YPO South East Asia chapters",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
```

`src/app/page.tsx`:
```tsx
import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
      <h1 className="text-3xl font-semibold text-primary">YPO SEA Learning Calendar</h1>
      <p className="text-muted-foreground">Learning events across South East Asia chapters.</p>
      <Link href="/login" className="rounded-md bg-primary px-4 py-2 text-primary-foreground">
        Sign in
      </Link>
    </main>
  );
}
```

- [ ] **Step 6: Create `public/.gitkeep`** (empty file) and `components.json` for shadcn

`components.json`:
```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "src/app/globals.css",
    "baseColor": "slate",
    "cssVariables": true,
    "prefix": ""
  },
  "iconLibrary": "lucide",
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  }
}
```

- [ ] **Step 7: Commit**

```bash
git add package.json tsconfig.json next.config.ts postcss.config.mjs eslint.config.mjs components.json src public
git commit -m "feat: next.js app skeleton with blue theme"
```

---

### Task 3: Prisma client, health route, Vitest

**Files:**
- Create: `prisma/schema.prisma`, `src/server/db.ts`, `src/server/health.ts`, `src/app/api/health/route.ts`, `vitest.config.ts`, `tests/unit/health.test.ts`

- [ ] **Step 1: Write `prisma/schema.prisma`** (models arrive in Phase 2)

```prisma
generator client {
  provider      = "prisma-client-js"
  binaryTargets = ["native", "linux-musl-openssl-3.0.x"]
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

- [ ] **Step 2: Write `src/server/db.ts`**

```ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

- [ ] **Step 3: Write `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
});
```

- [ ] **Step 4: Write the failing test `tests/unit/health.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { buildHealth } from "@/server/health";

describe("buildHealth", () => {
  it("reports ok when the database ping succeeds", async () => {
    const result = await buildHealth(async () => true);
    expect(result).toEqual({ status: "ok", db: "up" });
  });

  it("reports degraded when the database ping fails", async () => {
    const result = await buildHealth(async () => {
      throw new Error("boom");
    });
    expect(result).toEqual({ status: "degraded", db: "down" });
  });
});
```

- [ ] **Step 5: Run test to verify it fails**

Run: `docker compose run --rm --no-deps app npx vitest run` (or `make test` once the stack is up)
Expected: FAIL with "Cannot find module '@/server/health'"

- [ ] **Step 6: Write `src/server/health.ts` and `src/app/api/health/route.ts`**

`src/server/health.ts`:
```ts
export type Health = { status: "ok" | "degraded"; db: "up" | "down" };

export async function buildHealth(ping: () => Promise<unknown>): Promise<Health> {
  try {
    await ping();
    return { status: "ok", db: "up" };
  } catch {
    return { status: "degraded", db: "down" };
  }
}
```

`src/app/api/health/route.ts`:
```ts
import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { buildHealth } from "@/server/health";

export const dynamic = "force-dynamic";

export async function GET() {
  const health = await buildHealth(() => prisma.$queryRaw`SELECT 1`);
  return NextResponse.json(health, { status: health.status === "ok" ? 200 : 503 });
}
```

- [ ] **Step 7: Run test to verify it passes**

Run: `make test`
Expected: `2 passed`

- [ ] **Step 8: Commit**

```bash
git add prisma vitest.config.ts src/server src/app/api tests
git commit -m "feat: prisma client, health route, vitest"
```

---

### Task 4: Bring the stack up and verify

- [ ] **Step 1: Start the stack**

Run: `make dev` (first run installs dependencies inside the container; allow a few minutes)
Expected: app logs show `✓ Ready` on `http://0.0.0.0:3000`

- [ ] **Step 2: Verify the health route**

Run: `curl -s localhost:3000/api/health`
Expected: `{"status":"ok","db":"up"}`

- [ ] **Step 3: Verify the landing page**

Open `http://localhost:3000` in the browser. Expected: blue "YPO SEA Learning Calendar" heading and a Sign in button.

- [ ] **Step 4: Verify hot reload**

Edit the heading text in `src/app/page.tsx`, save, refresh. Expected: new text appears without restarting. Revert the edit.

- [ ] **Step 5: Verify lint and typecheck in the container**

Run: `make lint && make typecheck`
Expected: no errors.

- [ ] **Step 6: Verify the production image builds**

Run: `make build-prod`
Expected: image `ypo-lc:local` built. (Running it end-to-end is Phase 8.)

- [ ] **Step 7: Commit any generated lockfile**

```bash
git add package-lock.json
git commit -m "chore: lockfile"
```
