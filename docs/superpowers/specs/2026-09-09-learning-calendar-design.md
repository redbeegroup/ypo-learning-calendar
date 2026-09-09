# YPO SEA Learning Calendar — Build Plan (v1 Web)

## Context

YPO chapters across South East Asia each host learning events. Today there is no single place for members to see what is on across the region. This project builds a login-protected web application where chapter admins publish events and members browse, search, filter, view a calendar, and register. The web app comes first; a mobile app follows later, so the backend is built API-first from day one. The project folder is empty, so this is a greenfield build.

## Decisions confirmed with you

| Topic | Decision |
|---|---|
| Accounts | Admin-invited only. No public sign-up. |
| Registration | In-app. Members click Register; admins see attendee lists. |
| Payment | Free/Paid label with price, currency, and payment instructions or link. No card processing in v1. |
| Visibility | Everyone sees every published event. Visibility only controls who may register. |
| Capacity | Optional per-event capacity with waitlist and automatic promotion on cancellation. |
| Chapters | Seed a standard SEA list, editable by super admin. |
| Stack | Next.js + PostgreSQL in one deployable. |
| Runtime | Everything runs in Docker, locally and in production. Nothing installs on the Mac beyond Docker. |
| Theme | Blue. |

## Assumptions I am making (tell me if wrong)

- One chapter per member. A member's chapter is set by the admin who invites them.
- Chapter admins manage only their own chapter's events and members. Super admins manage everything.
- Event dates are stored in UTC with an IANA timezone per event, since SEA spans UTC+6:30 to UTC+8. The UI shows the event's local time with the zone label.
- Rich text for descriptions is Markdown, rendered safely. No file uploads in v1 except an optional cover image URL.
- Emails are sent for invite, password reset, registration confirmation, and waitlist promotion. Locally they go to a Mailpit inbox in Docker.
- Members can cancel their own registration until the event starts.

## Architecture

Single Next.js 15 app (App Router, TypeScript) that serves both the React UI and a versioned JSON REST API under `/api/v1`. The API is the only way the UI touches data, so the future mobile app reuses it unchanged.

```
Browser / future mobile
        │  HTTPS (cookie for web, Bearer JWT for mobile)
        ▼
Next.js app ─── /app/(auth), /app/(member), /app/admin   ← UI routes
           └── /app/api/v1/**                            ← REST API (Zod-validated)
                    │
                    ▼
              /src/server/**   services + permission rules (pure TS, unit-tested)
                    │
                    ▼
              Prisma ──► PostgreSQL 16 (Docker container, named volume)
Email: Resend in prod, Mailpit locally (same sender interface)
```

### Docker layout

All services run as containers. The Mac only needs Docker; Node is never run on the host.

| Service | Local (`docker-compose.yml`) | Production (`docker-compose.prod.yml`) |
|---|---|---|
| `app` | `Dockerfile` dev target: `node:22-bookworm-slim` (Alpine crashes `next dev` with SIGBUS on Docker Desktop), source bind-mounted, `next dev` with hot reload on port 3000 | `Dockerfile` prod target: multi-stage build, Next.js standalone output plus a self-contained Prisma CLI for migrations, non-root user |
| `db` | `postgres:16-alpine`, named volume `pgdata` | same, named volume, daily `pg_dump` sidecar to a backup folder |
| `mailpit` | catches all email, web UI on port 8025 | not present; app sends via Resend |
| `caddy` | not present | Caddy reverse proxy with automatic HTTPS for your domain |

- `Dockerfile` has two targets (`dev`, `prod`) so both environments build from one file.
- `npm install`, Prisma generate, migrations, seed, tests, and Playwright all run inside the `app` container via `docker compose exec app …`. A `Makefile` wraps the common commands (`make dev`, `make migrate`, `make seed`, `make test`, `make shell`).
- Prisma migrations run automatically on container start (`prisma migrate deploy` in the entrypoint) so a production deploy is `git pull && docker compose -f docker-compose.prod.yml up -d --build`.
- Configuration comes only from `.env` files (`.env.example` committed). Secrets: `DATABASE_URL`, `JWT_SECRET`, `RESEND_API_KEY`, `APP_URL`, `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`.
- Health check route `GET /api/health` used by Docker `healthcheck` and by Caddy.

### Tech stack

- Next.js 15, React 19, TypeScript
- Tailwind CSS + shadcn/ui components, blue primary palette (Tailwind `blue-600`/`blue-800`, dark navy sidebar)
- Prisma ORM, PostgreSQL 16
- Auth: own lightweight JWT auth (`jose` + `bcrypt`). Login issues a JWT stored in an httpOnly cookie for the web; the same endpoint returns the token in the body for mobile. Middleware accepts either cookie or `Authorization: Bearer`.
- Validation: Zod schemas shared between API and forms
- Calendar: FullCalendar React (dayGrid month, timeGrid week, list view)
- Search: PostgreSQL `pg_trgm` index with case-insensitive matching on title, description, venue
- Email: Resend SDK behind a small `sendEmail()` interface; Mailpit via Docker for local dev
- Testing: Vitest (unit + API integration against a test DB), Playwright (end-to-end)
- Infra: Docker Compose for app, Postgres, and Mailpit locally; app, Postgres, and Caddy in production
- Tooling needed on your Mac: Docker only (Docker 29 is installed). Node, npm, and Prisma run inside the container.

## Data model (Prisma)

- **Chapter**: id, name, code, country, isActive, timestamps
- **User**: id, email (unique), passwordHash (nullable until invite accepted), name, role (`SUPER_ADMIN` | `CHAPTER_ADMIN` | `MEMBER`), chapterId, status (`INVITED` | `ACTIVE` | `DISABLED`), inviteToken, inviteExpiresAt, resetToken, resetExpiresAt, timestamps
- **EventType** (theme): id, name, color, sortOrder, isActive
- **Event**: id, title, description (Markdown), hostChapterId, eventTypeId, startAt, endAt, timezone, venue, isOnline, onlineUrl, coverImageUrl, visibility (`LOCAL` | `REGIONAL` | `CHAPTER_SPECIFIC`), capacity (nullable), registrationOpensAt, registrationClosesAt, paymentType (`FREE` | `PAID`), price, currency, paymentInstructions, paymentUrl, status (`DRAFT` | `PUBLISHED` | `CANCELLED`), createdById, timestamps
- **EventChapterAccess**: eventId, chapterId (composite key; used only for `CHAPTER_SPECIFIC`)
- **Registration**: id, eventId, userId, status (`REGISTERED` | `WAITLISTED` | `CANCELLED`), paymentStatus (`NOT_REQUIRED` | `PENDING` | `PAID`), registeredAt, cancelledAt, unique (eventId, userId)

Indexes: Event(startAt), Event(hostChapterId), Event(status), Registration(eventId, status), trigram index on Event title/description/venue.

Seed data: one super admin (from env), SEA chapters (Singapore, Singapore Gold, Malaysia, Malaysia Gold, Thailand, Indonesia, Philippines, Philippines Gold, Vietnam, Myanmar, Cambodia), and event types (Business, Leadership, Family, Health & Wellness, Personal Growth, Networking, Social Impact, Forum).

## Roles and permissions

| Action | Member | Chapter Admin | Super Admin |
|---|---|---|---|
| Browse, search, filter, calendar, view detail | all published events | all published events | all events incl. drafts |
| Register / cancel own registration | if in scope | if in scope | if in scope |
| Create, edit, publish, cancel events | – | own chapter | any chapter |
| View registrations, mark paid, export CSV | – | own chapter's events | all |
| Invite, edit, disable members | – | own chapter, MEMBER role only | any chapter, any role |
| Manage chapters and event types | – | – | yes |

Permission rules live in one pure module (`src/server/permissions.ts`) and are unit-tested. API routes call these rules; the UI uses them only to hide buttons.

### Registration scope rule

A user may register when the event is `PUBLISHED`, the registration window is open, and one of:
- visibility is `REGIONAL`
- visibility is `LOCAL` and user.chapterId equals event.hostChapterId
- visibility is `CHAPTER_SPECIFIC` and user.chapterId is in EventChapterAccess

Out-of-scope users see the event with a "Open to [chapter names] members" notice and a disabled Register button.

### Waitlist rule

Inside a database transaction: count `REGISTERED` rows; if capacity is null or count < capacity, insert `REGISTERED`, else insert `WAITLISTED`. On cancellation of a `REGISTERED` row, promote the oldest `WAITLISTED` row to `REGISTERED` and email that member. Paid events set paymentStatus `PENDING`; admins mark `PAID`.

## Screens

**Auth**: `/login`, `/invite/[token]` (set password), `/forgot-password`, `/reset-password/[token]`

**Member**
- `/events` — list view. Top search box (title, description, venue). Filters: chapter (multi-select, default all), event type, date range with quick picks (this week, this month, next 3 months), Free/Paid, "Only events I can register for" toggle. Sorted by date. Card shows title, chapter badge, type colour tag, date/time with zone, Free/Paid, spots left.
- `/events/calendar` — month/week/list toggle using the same filters. Click an event opens the detail.
- `/events/[id]` — full detail, Markdown description, map/online link, price and payment instructions, Register / Cancel / Join waitlist button, position on waitlist.
- `/my-registrations` — upcoming and past, with status and payment status.
- `/profile` — name, chapter, change password.

**Admin** (`/admin`, sidebar layout)
- `/admin/events` — table of events for the admin's scope with status filter, duplicate action.
- `/admin/events/new`, `/admin/events/[id]/edit` — form with all fields, chapter multi-select shown only when visibility is Chapter Specific, Save as draft / Publish.
- `/admin/events/[id]/registrations` — registered and waitlisted lists, mark paid, export CSV.
- `/admin/members` — invite (email, name, chapter, role), resend invite, disable, edit chapter.
- `/admin/chapters`, `/admin/event-types` — super admin only.

Layout: top navigation for members, left sidebar for admin, responsive down to phone width. Blue primary buttons and links, white cards, light grey page background.

## API (`/api/v1`)

All responses are JSON `{ data }` or `{ error: { code, message, fields? } }`. Zod validates every body and query.

- `POST auth/login`, `POST auth/logout`, `GET auth/me`, `POST auth/forgot-password`, `POST auth/reset-password`, `POST auth/accept-invite`
- `GET events` (query: q, chapterIds, typeIds, from, to, payment, registrableOnly, page, pageSize), `GET events/:id`
- `POST events/:id/register`, `DELETE events/:id/register`, `GET me/registrations`
- Admin: `POST events`, `PATCH events/:id`, `POST events/:id/publish`, `POST events/:id/cancel`, `GET events/:id/registrations`, `PATCH registrations/:id` (paymentStatus), `GET events/:id/registrations.csv`
- Admin: `GET/POST users`, `PATCH users/:id`, `POST users/:id/resend-invite`
- Super admin: `GET/POST/PATCH chapters`, `GET/POST/PATCH event-types`
- `GET chapters` and `GET event-types` are readable by any logged-in user for filters.

## Project structure

```
YPO-LC-V1/
  Dockerfile                    multi-stage: dev target and prod target
  docker-compose.yml            app (dev) + Postgres + Mailpit
  docker-compose.prod.yml       app (prod) + Postgres + Caddy + backup
  docker/entrypoint.sh          run migrations, then start
  Caddyfile                     reverse proxy + HTTPS
  Makefile                      make dev / migrate / seed / test / shell / deploy
  .env.example
  prisma/schema.prisma, seed.ts, migrations/
  src/app/(auth)/…              login, invite, reset pages
  src/app/(member)/…            events, calendar, detail, my-registrations, profile
  src/app/admin/…               admin pages
  src/app/api/v1/…              route handlers (thin: parse → service → respond)
  src/server/auth/              jwt.ts, password.ts, session.ts
  src/server/permissions.ts     role and scope rules
  src/server/services/          events.ts, registrations.ts, users.ts, chapters.ts
  src/server/email/             sender interface, templates
  src/lib/validation/           Zod schemas shared by API and forms
  src/components/               ui (shadcn), events, calendar, admin
  tests/unit, tests/api, e2e/
  docs/superpowers/specs/       this design copied in as the spec
```

## Build phases

1. **Scaffold in Docker**: Dockerfile (dev + prod targets), Compose files, entrypoint, Makefile, `.env.example`. Then inside the container: Next.js, Tailwind, shadcn with blue theme, Prisma, ESLint, Vitest, Playwright. Confirm `make dev` serves the app at `http://localhost:3000` with hot reload and `make test` runs in the container. Copy this plan to `docs/superpowers/specs/2026-09-09-learning-calendar-design.md`. Init git with `.dockerignore` and `.gitignore`.
2. **Auth and users**: schema and migration, seed script, login/logout/me, JWT middleware, invite and accept-invite, forgot/reset password, role guard, permission module with unit tests.
3. **Events core**: admin create/edit/publish/cancel with Zod forms, member list with search and filters, event detail, scope notice.
4. **Calendar view**: FullCalendar with shared filter state, month/week/list.
5. **Registration and waitlist**: register/cancel/promote in a transaction, my registrations, admin registrations page, mark paid, CSV export, confirmation and promotion emails.
6. **Admin management**: members invite/disable/edit, chapters, event types.
7. **Polish**: responsive pass, empty and error states, loading skeletons, pagination, email templates, accessibility check.
8. **Production deploy**: build and run the prod image locally with `docker-compose.prod.yml` to prove it works end-to-end, then document the server steps: install Docker on the VPS, clone the repo, fill `.env`, point DNS at the server, `make deploy`. Caddy obtains HTTPS automatically. Nightly Postgres backup to a mounted folder. Rollback is `git checkout <previous tag> && make deploy`.

Each phase ends with tests passing and a short demo in the browser before moving on.

## Verification

- Unit: permission matrix, registration scope rule, waitlist promotion, date/timezone formatting.
- API integration (Vitest against a throwaway Postgres): auth flows, event filters and search, register/cancel/promote concurrency (two members racing for the last seat).
- End-to-end (Playwright): super admin invites a chapter admin → chapter admin publishes a Local event with capacity 1 → member in chapter registers → second member is waitlisted → first cancels → second is promoted; member outside chapter sees the event but cannot register.
- All tests run inside the app container (`make test`, `make e2e`) so results match production.
- Manual: `make dev`, open `http://localhost:3000`, walk the member and admin flows; check Mailpit at `http://localhost:8025` for emails.
- Production rehearsal: `docker compose -f docker-compose.prod.yml up --build` locally, confirm migrations apply on start and the health check passes.

## Later (out of v1)

- Mobile app (React Native or Flutter) using the same API; add refresh tokens and an OpenAPI document at that point.
- In-app card payment via Stripe.
- YPO SSO if an identity provider becomes available.
- Recurring events, attachments, calendar (.ics) export, push notifications, reminders.
