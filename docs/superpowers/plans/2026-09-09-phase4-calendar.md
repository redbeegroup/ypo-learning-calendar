# Phase 4: Calendar View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A month / week / list calendar at `/events/calendar` that shares the list page's filters and links each event to its detail page.

**Architecture:** The page is a server component that renders the same `EventFilters` component plus a client `EventCalendar` component. `EventCalendar` reads the filter values from the URL and, whenever FullCalendar's visible date range changes, fetches `/api/v1/events?from=&to=&pageSize=100&includePast=true` plus the current filters. Events are coloured by theme and clicking one navigates to `/events/[id]`. Times are shown in the viewer's browser timezone (all SEA zones are within 1.5 h of each other; the detail page shows the event's own zone).

**Tech Stack:** @fullcalendar/react with daygrid, timegrid, list, and interaction plugins.

---

## File structure

```
src/components/events/event-calendar.tsx   client; FullCalendar wrapper
src/app/(member)/events/calendar/page.tsx  server; filters + calendar
src/app/globals.css                        FullCalendar theme overrides (blue)
```

### Task 1: Calendar component and page

- [ ] **Step 1: `src/components/events/event-calendar.tsx`**

```tsx
"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import listPlugin from "@fullcalendar/list";
import interactionPlugin from "@fullcalendar/interaction";
import type { DatesSetArg, EventClickArg, EventInput } from "@fullcalendar/core";
import { api } from "@/lib/api-client";
import type { EventDto } from "@/server/services/events";

type ListResult = { items: EventDto[]; total: number };

export function EventCalendar() {
  const router = useRouter();
  const params = useSearchParams();
  const [events, setEvents] = useState<EventInput[]>([]);
  const [error, setError] = useState<string | null>(null);

  const filterQuery = useMemo(() => {
    const q = new URLSearchParams();
    for (const key of ["q", "chapterIds", "typeIds", "payment", "registrableOnly"]) {
      const v = params.get(key);
      if (v) q.set(key, v);
    }
    return q;
  }, [params]);

  const load = useCallback(
    async (arg: DatesSetArg) => {
      const q = new URLSearchParams(filterQuery);
      q.set("from", arg.start.toISOString());
      q.set("to", arg.end.toISOString());
      q.set("includePast", "true");
      q.set("pageSize", "100");
      try {
        const result = await api<ListResult>(`/events?${q.toString()}`);
        setEvents(
          result.items.map((e) => ({
            id: e.id,
            title: e.title,
            start: e.startAt,
            end: e.endAt,
            backgroundColor: e.eventType.color,
            borderColor: e.eventType.color,
            extendedProps: { chapter: e.hostChapter.name, registrable: e.registration.ok },
          })),
        );
        setError(null);
      } catch {
        setError("Could not load events");
      }
    },
    [filterQuery],
  );

  const onClick = (arg: EventClickArg) => {
    arg.jsEvent.preventDefault();
    router.push(`/events/${arg.event.id}`);
  };

  return (
    <div className="rounded-lg border bg-card p-3">
      {error && <p className="mb-2 text-sm text-destructive">{error}</p>}
      <FullCalendar
        key={filterQuery.toString()}
        plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        headerToolbar={{ left: "prev,next today", center: "title", right: "dayGridMonth,timeGridWeek,listMonth" }}
        buttonText={{ today: "Today", month: "Month", week: "Week", list: "List" }}
        events={events}
        datesSet={load}
        eventClick={onClick}
        eventDisplay="block"
        dayMaxEvents={3}
        height="auto"
        firstDay={1}
        nowIndicator
        eventTimeFormat={{ hour: "numeric", minute: "2-digit", meridiem: "short" }}
        eventDidMount={(info) => {
          info.el.title = `${info.event.title} · ${info.event.extendedProps.chapter}`;
          if (!info.event.extendedProps.registrable) info.el.style.opacity = "0.7";
        }}
      />
    </div>
  );
}
```

- [ ] **Step 2: `src/app/(member)/events/calendar/page.tsx`**

```tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/session";
import { listChapters, listEventTypes } from "@/server/services/events";
import { EventFilters } from "@/components/events/event-filters";
import { EventCalendar } from "@/components/events/event-calendar";
import { Button } from "@/components/ui/button";

export default async function CalendarPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const [chapters, types] = await Promise.all([listChapters(), listEventTypes()]);
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Calendar</h1>
        <Button asChild variant="outline" size="sm">
          <Link href="/events">List view</Link>
        </Button>
      </div>
      <EventFilters chapters={chapters} types={types} hideRange />
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        {types.map((t) => (
          <span key={t.id} className="flex items-center gap-1">
            <span className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: t.color }} /> {t.name}
          </span>
        ))}
      </div>
      <EventCalendar />
    </div>
  );
}
```

`EventFilters` gains a `hideRange` prop that hides the date-range select (the calendar's own navigation replaces it).

- [ ] **Step 3: Blue theme for FullCalendar** — append to `globals.css`:

```css
.fc {
  --fc-button-bg-color: var(--primary);
  --fc-button-border-color: var(--primary);
  --fc-button-hover-bg-color: oklch(0.48 0.22 262);
  --fc-button-hover-border-color: oklch(0.48 0.22 262);
  --fc-button-active-bg-color: oklch(0.42 0.2 262);
  --fc-button-active-border-color: oklch(0.42 0.2 262);
  --fc-today-bg-color: oklch(0.95 0.03 255);
  --fc-border-color: var(--border);
  font-size: 0.875rem;
}
.fc .fc-toolbar-title { font-size: 1.125rem; font-weight: 600; }
.fc .fc-event { cursor: pointer; }
```

- [ ] **Step 4: Verify** — open `/events/calendar`, see coloured events in October and November, switch to Week and List, click an event → detail. Filters narrow the calendar. `make lint && make typecheck`. Commit `feat: calendar view`.
