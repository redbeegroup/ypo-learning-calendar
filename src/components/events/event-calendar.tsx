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

const FILTER_KEYS = ["q", "chapterIds", "typeIds", "payment", "registrableOnly"];

export function EventCalendar() {
  const router = useRouter();
  const params = useSearchParams();
  const [events, setEvents] = useState<EventInput[]>([]);
  const [error, setError] = useState<string | null>(null);

  const filterQuery = useMemo(() => {
    const q = new URLSearchParams();
    for (const key of FILTER_KEYS) {
      const v = params.get(key);
      if (v) q.set(key, v);
    }
    return q.toString();
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
        key={filterQuery}
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
