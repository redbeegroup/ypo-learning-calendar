import { eventListQuerySchema } from "@/lib/validation/events";

export type SearchParams = Record<string, string | string[] | undefined>;

export const RANGE_OPTIONS = [
  { value: "upcoming", label: "Upcoming" },
  { value: "week", label: "This week" },
  { value: "month", label: "This month" },
  { value: "3months", label: "Next 3 months" },
  { value: "past", label: "Past events" },
  { value: "custom", label: "Year/month range" },
];

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

/** "YYYY-MM" inputs → inclusive ISO bounds (start of first month, end of last month). */
export function monthRangeToDates(fromMonth?: string, toMonth?: string): { from?: string; to?: string; includePast: boolean } {
  const out: { from?: string; to?: string; includePast: boolean } = { includePast: true };
  if (fromMonth && MONTH.test(fromMonth)) {
    const [y, m] = fromMonth.split("-").map(Number);
    out.from = new Date(Date.UTC(y, m - 1, 1)).toISOString();
  }
  if (toMonth && MONTH.test(toMonth)) {
    const [y, m] = toMonth.split("-").map(Number);
    out.to = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999)).toISOString();
  }
  return out;
}

export function rangeToDates(range: string): { from?: string; to?: string; includePast?: boolean } {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  switch (range) {
    case "week":
      end.setDate(end.getDate() + (7 - end.getDay()));
      return { from: start.toISOString(), to: end.toISOString() };
    case "month":
      end.setMonth(end.getMonth() + 1, 1);
      return { from: start.toISOString(), to: end.toISOString() };
    case "3months":
      end.setMonth(end.getMonth() + 3);
      return { from: start.toISOString(), to: end.toISOString() };
    case "past":
      return { from: new Date(0).toISOString(), to: start.toISOString(), includePast: true };
    default:
      return {};
  }
}

export function flattenSearchParams(sp: SearchParams): Record<string, string> {
  const obj: Record<string, string> = {};
  for (const [k, v] of Object.entries(sp)) {
    const val = Array.isArray(v) ? v[0] : v;
    if (val !== undefined && val !== "") obj[k] = val;
  }
  return obj;
}

/** Translate page search params (including the `range` shortcut) into a validated list query. */
export function buildEventQuery(sp: SearchParams, extra: Record<string, string> = {}) {
  const raw = flattenSearchParams(sp);
  const custom = raw.range === "custom" || raw.fromMonth || raw.toMonth;
  const range = custom ? monthRangeToDates(raw.fromMonth, raw.toMonth) : rangeToDates(raw.range ?? "upcoming");
  const merged: Record<string, string> = {
    ...raw,
    ...(range.from ? { from: range.from } : {}),
    ...(range.to ? { to: range.to } : {}),
    ...(range.includePast ? { includePast: "true" } : {}),
    ...extra,
  };
  delete merged.range;
  delete merged.fromMonth;
  delete merged.toMonth;
  return eventListQuerySchema.parse(merged);
}
