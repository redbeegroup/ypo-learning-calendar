# Phase 6: Admin Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admins invite, edit, disable, and re-invite members from the UI; super admins manage chapters and event types.

**Architecture:** Extend the users service with scoped listing and updates guarded by `canManageUser` on both the current and the target state. New `chapters.ts` and `event-types.ts` services are tiny CRUD wrappers guarded by `canManageChapters`. Each admin page is a server component that loads data through the service and renders a client table with dialogs that call `/api/v1`.

**Tech Stack:** Prisma, Zod, shadcn dialog/select/table/switch.

---

## File structure

```
src/lib/validation/users.ts                 updateUserSchema, userListQuerySchema
src/lib/validation/catalog.ts               chapterSchema, eventTypeSchema
src/server/services/users.ts                + listUsers, updateUser
src/server/services/catalog.ts              chapters + event types CRUD
src/app/api/v1/users/route.ts               + GET list
src/app/api/v1/users/[id]/route.ts          PATCH
src/app/api/v1/users/[id]/resend-invite/route.ts  POST
src/app/api/v1/chapters/route.ts            + POST (super admin)
src/app/api/v1/chapters/[id]/route.ts       PATCH
src/app/api/v1/event-types/route.ts         + POST
src/app/api/v1/event-types/[id]/route.ts    PATCH
src/components/admin/members-table.tsx      client: invite dialog, edit dialog, disable/enable, resend
src/components/admin/catalog-table.tsx      client: generic name/fields table with add + edit dialogs
src/app/admin/members/page.tsx
src/app/admin/chapters/page.tsx
src/app/admin/event-types/page.tsx
tests/api/admin.test.ts
```

## Rules

- Chapter admins see only their chapter's users and may invite/edit/disable `MEMBER` users only. They cannot change a user's chapter to another chapter or assign admin roles.
- Super admins may do anything except disable themselves or demote themselves.
- Disabling sets `status = DISABLED`; enabling sets `ACTIVE` (or back to `INVITED` if the user never set a password).
- Chapters: `code` unique, uppercase; deactivating hides the chapter from filters and new-event forms but keeps history.
- Event types: `name` unique; `color` is a hex string; `sortOrder` controls filter order.

## Tests (`tests/api/admin.test.ts`)

- list users: super admin sees all, chapter admin sees own chapter only, member gets 403.
- update user: chapter admin renames own member (200), cannot promote to CHAPTER_ADMIN (403), cannot move to another chapter (403); super admin can; super admin cannot disable self (400).
- resend invite: works for INVITED user, 400 for ACTIVE.
- chapters: super admin creates (201) and updates; chapter admin gets 403; duplicate code 409.
- event types: same shape; member `GET /event-types` still lists active only.

## Verification

Browser: as super admin invite a chapter admin for Malaysia from `/admin/members`, see the email in Mailpit; edit a member's name; disable and enable; add a chapter and an event type; sign in as the Malaysia chapter admin and confirm the members page shows only Malaysia users and the chapter select is locked. `make test && make lint && make typecheck`. Commit `feat: admin management for members, chapters, event types`.
