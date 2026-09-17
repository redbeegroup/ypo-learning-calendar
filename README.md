# YPO SEA Learning Calendar

A login-protected web application where YPO chapters across South East Asia publish learning events and members browse, search, filter, view a calendar, and register. Everything runs in Docker, locally and in production.

- **Members** see every published event, search and filter by chapter, theme, date, and payment, switch to a calendar view, register (or join the waitlist), and manage their registrations.
- **Chapter managers** create, edit, publish, and cancel their chapter's events, see attendee lists, mark payments, export CSV, and invite or disable their chapter's members.
- **Super admins** do all of the above for every chapter and also manage chapters and event types.

Design spec: `docs/superpowers/specs/2026-09-09-learning-calendar-design.md`. Implementation plans per phase: `docs/superpowers/plans/`.

## Stack

Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS 4 + shadcn/ui · Prisma 6 · PostgreSQL 16 · FullCalendar · Vitest · Docker Compose · Caddy.

The same app serves the UI and a JSON REST API under `/api/v1` (cookie session for the browser, `Authorization: Bearer <token>` for a future mobile app).

## Local development (Docker only)

Requirements: Docker Desktop. Node is never installed on the host.

```bash
make dev
```

This copies `.env.example` to `.env` on first run, builds the dev image, installs dependencies inside the container, applies migrations, and starts:

| Service | URL |
|---|---|
| App | http://localhost:3000 |
| Mailpit (catches all email) | http://localhost:8025 |
| Postgres | localhost:5432 (`ypo` / `ypo`) |

Seed the chapters, event types, and the super admin from `.env` (`SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`):

```bash
make seed
```

Other targets: `make up` (detached), `make down`, `make logs`, `make shell`, `make migrate-dev name=<migration-name>`, `make studio` (Prisma Studio on port 5555).

## Tests and checks

All run inside the container against a throwaway `ypo_test` database:

```bash
make test
```

```bash
make lint
```

```bash
make typecheck
```

Unit tests cover permissions, validation, dates, JWT, and passwords. API tests exercise every route handler directly, including the race for the last seat and waitlist promotion.

## Production deploy

Two supported layouts. Both build the same production image (`Dockerfile`, target `prod`), run migrations automatically on start, and back up Postgres daily.

### Option A: Portainer stack behind NPMplus (recommended)

Files: `docker-compose.portainer.yml`, variables in `.env.portainer.example`. The app publishes one port on its Docker host; NPMplus (on the same or another host) forwards to that host's IP and port.

1. Push this repository to GitHub. The workflow in `.github/workflows/build-image.yml` builds the production image on every push to `main` and publishes it as `ghcr.io/<github-user>/ypo-lc:latest`. Portainer pulls that image, so nothing is built on the server (building inside Portainer often fails with BuildKit errors). If the repository is private, make the package public (GitHub → Packages → ypo-lc → Package settings → Change visibility) or add a GHCR registry in Portainer (**Registries → Add**, username = your GitHub user, password = a token with `read:packages`).
2. Decide the port the app will publish on the Docker host (`APP_PORT`, default 3000) and make sure the firewall allows only the NPMplus host to reach it. Traffic between NPMplus and the app is plain HTTP on your LAN; TLS terminates at NPMplus.
3. In Portainer: **Stacks → Add stack → Repository**. Repository URL = your repo, Compose path = `docker-compose.portainer.yml`. Under **Environment variables** choose *Advanced mode* and paste the contents of `.env.portainer.example` with real values (`APP_IMAGE`, `APP_URL`, `JWT_SECRET`, `POSTGRES_PASSWORD`, SMTP settings, seed admin, `APP_PORT`). Deploy.
4. In NPMplus: **Proxy Hosts → Add**. Domain = your domain, Scheme = `http`, Forward host = the Docker host's IP (for example `192.168.1.20`), Forward port = `APP_PORT` (`3030` in the example file; the container itself always listens on 3000). On the SSL tab request a Let's Encrypt certificate and enable *Force SSL* and *HTTP/2*.
5. Create the chapters, event types, and the first super admin once: in Portainer open the `ypo-app` container → **Console** → `/bin/sh`, then run `node prisma/seed.mjs`. (Or on the server: `docker exec ypo-app node prisma/seed.mjs`.)
6. Open `https://<your domain>`, sign in as the seed admin, and invite chapter managers from **Admin → Members**.

**Updates:** push to `main`, wait for the GitHub Action to finish (about 3 to 5 minutes), then in Portainer open the stack and click **Pull and redeploy** with *Re-pull image* enabled. Migrations apply on restart.

**Backups:** the `ypo-backup` container writes a gzipped `pg_dump` into the `backups` volume daily. Copy them off the server with `docker cp ypo-backup:/backups ./backups`. Restore with `gunzip -c file.sql.gz | docker exec -i ypo-db psql -U ypo -d ypo`.

**Rollback:** every build is also tagged with its commit SHA (`ghcr.io/<github-user>/ypo-lc:<sha>`). Set `APP_IMAGE` to a previous tag and update the stack.

### Option B: docker compose with Caddy

Files: `docker-compose.prod.yml`, `Caddyfile`, variables in `.env.production.example`. Caddy publishes 80/443 and obtains certificates itself.

```bash
cp .env.production.example .env   # fill it in
make deploy
make prod-seed
```

Useful: `make prod-logs`, `make prod-ps`, `make prod-backup`, `make prod-restore file=backups/<file>.sql.gz`.

## Environment variables

| Variable | Purpose |
|---|---|
| `APP_URL` | Public URL, used in emails |
| `DOMAIN` | Domain for Caddy's certificate (Option B only) |
| `APP_IMAGE` | Image to run, published by GitHub Actions to GHCR (Option A only) |
| `APP_PORT` / `APP_BIND` | Port and interface the app publishes for NPMplus (Option A only) |
| `JWT_SECRET` | Signs session tokens |
| `DATABASE_URL` | Postgres connection (set automatically by Compose) |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | Database credentials (production) |
| `EMAIL_FROM`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_SECURE` | Outgoing mail |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` / `SEED_ADMIN_NAME` | First super admin created by the seed |
| `BACKUP_KEEP_DAYS` | Backup retention (production) |

## Project layout

```
src/app/(auth)        login, invite, forgot/reset password
src/app/(member)      events list, calendar, detail, my registrations, profile
src/app/admin         events, registrations, members, chapters, event types
src/app/api/v1        REST API route handlers (thin)
src/server            services, permissions, auth, email
src/lib               validation schemas, date helpers, API client
prisma                schema, migrations, seed
tests                 unit and API tests
docker                entrypoint and backup scripts
```

## Roles and visibility

Every member sees every published event. An event's visibility only controls who may register: **Regional** (any SEA member), **Local** (host chapter members), or **Chapter specific** (a chosen set of chapters). Events may have a capacity; when full, members join a waitlist and are promoted automatically, with an email, when a seat frees up. Paid events show the price and payment instructions; admins mark registrations as paid.
