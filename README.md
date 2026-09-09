# YPO SEA Learning Calendar

A login-protected web application where YPO chapters across South East Asia publish learning events and members browse, search, filter, view a calendar, and register. Everything runs in Docker, locally and in production.

- **Members** see every published event, search and filter by chapter, theme, date, and payment, switch to a calendar view, register (or join the waitlist), and manage their registrations.
- **Chapter admins** create, edit, publish, and cancel their chapter's events, see attendee lists, mark payments, export CSV, and invite or disable their chapter's members.
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

One Linux server with Docker, a DNS record for your domain pointing at it, and ports 80/443 open.

1. Clone the repo on the server and create the env file:
   ```bash
   cp .env.production.example .env
   ```
   Fill in `DOMAIN`, `APP_URL`, `JWT_SECRET` (`openssl rand -hex 32`), `POSTGRES_PASSWORD`, the SMTP settings (Resend works over SMTP), and the seed admin.
2. Build and start everything (app, Postgres, Caddy with automatic HTTPS, nightly backups):
   ```bash
   make deploy
   ```
   Migrations run automatically when the app container starts.
3. Create the chapters, event types, and first super admin:
   ```bash
   make prod-seed
   ```
4. Open `https://<your domain>` and sign in as the seed admin. Invite chapter admins from **Admin → Members**.

Later releases are the same command: `make deploy` pulls the latest commit, rebuilds the image, and restarts the app with zero manual steps. Roll back with `git checkout <previous tag>` followed by `make deploy`.

Useful: `make prod-logs`, `make prod-ps`, `make prod-backup` (manual dump), `make prod-restore file=backups/<file>.sql.gz`.

### Backups

The `backup` container writes a gzipped `pg_dump` into `./backups` once a day and keeps `BACKUP_KEEP_DAYS` (default 14) days. Copy that folder off the server (for example with a cron `rsync` or an object-storage sync).

## Environment variables

| Variable | Purpose |
|---|---|
| `APP_URL` | Public URL, used in emails |
| `DOMAIN` | Domain for Caddy's certificate (production only) |
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
