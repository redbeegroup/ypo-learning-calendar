# Phase 7 + 8: Polish and Production Deploy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the member-facing loose ends (profile and password change, not-found and error pages, mobile navigation) and ship a repeatable production deployment with Docker Compose, Caddy HTTPS, nightly backups, and a README.

---

## Phase 7: Polish

- [ ] `POST /api/v1/auth/change-password` `{ currentPassword, newPassword }` in `src/app/api/v1/auth/change-password/route.ts`; service `changePassword(actor, current, next)` in `users.ts`; test in `tests/api/auth.test.ts`.
- [ ] `/profile` page: name, email, chapter, role; change-password form (`src/components/auth/change-password-form.tsx`).
- [ ] `src/app/not-found.tsx` and `src/app/error.tsx` in the blue theme.
- [ ] Mobile nav: member header collapses links into a menu under 640px (`src/components/layout/member-nav.tsx`).
- [ ] Prisma logging: only `error` in development is noisy for expected unique-violation checks; keep `warn`/`error` but catch expected P2002 before Prisma logs (already handled) — set `log: ["warn"]` in dev and rely on `ApiError` for expected failures.
- [ ] Browser check on the mobile preset.

## Phase 8: Production deploy

- [ ] `docker-compose.prod.yml`: `app` (prod target, `restart: unless-stopped`, healthcheck on `/api/health`), `db` (postgres:16-alpine, named volume), `caddy` (caddy:2, ports 80/443, `Caddyfile`, volumes for certs), `backup` (postgres:16-alpine running `pg_dump` daily into `./backups`, keeps 14 days).
- [ ] `Caddyfile`: `{$DOMAIN} { reverse_proxy app:3000 }`.
- [ ] `.env.production.example` with production values and comments.
- [ ] `Makefile`: `deploy` (pull, build, up -d, prune), `prod-logs`, `prod-seed`, `prod-backup`, `prod-restore file=…`.
- [ ] Trim the prod image: copy only what standalone needs; verify `docker compose -f docker-compose.prod.yml up --build` locally with `DOMAIN=localhost` and reach `https://localhost` (self-signed) and `/api/health`.
- [ ] `README.md`: what it is, local dev, tests, production deploy steps, backup/restore, rollback, env var reference.
- [ ] Commit `feat: production compose, caddy, backups, readme`.
