import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

export const SEA_TIMEZONES: { value: string; label: string }[] = [
  { value: "Asia/Singapore", label: "Singapore (SGT, UTC+8)" },
  { value: "Asia/Kuala_Lumpur", label: "Malaysia (MYT, UTC+8)" },
  { value: "Asia/Manila", label: "Philippines (PHT, UTC+8)" },
  { value: "Asia/Bangkok", label: "Thailand (ICT, UTC+7)" },
  { value: "Asia/Jakarta", label: "Indonesia – Jakarta (WIB, UTC+7)" },
  { value: "Asia/Ho_Chi_Minh", label: "Vietnam (ICT, UTC+7)" },
  { value: "Asia/Phnom_Penh", label: "Cambodia (ICT, UTC+7)" },
  { value: "Asia/Yangon", label: "Myanmar (MMT, UTC+6:30)" },
];

/** ICU lacks short names for most SEA zones (prints "GMT+8"), so map the common ones explicitly. */
const ZONE_ABBREVIATIONS: Record<string, string> = {
  "Asia/Singapore": "SGT",
  "Asia/Kuala_Lumpur": "MYT",
  "Asia/Manila": "PHT",
  "Asia/Bangkok": "ICT",
  "Asia/Jakarta": "WIB",
  "Asia/Ho_Chi_Minh": "ICT",
  "Asia/Phnom_Penh": "ICT",
  "Asia/Yangon": "MMT",
};

export function zoneAbbreviation(date: Date, tz: string): string {
  return ZONE_ABBREVIATIONS[tz] ?? formatInTimeZone(date, tz, "zzz");
}

export function isValidTimeZone(tz: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** "2026-10-01T09:00" typed in `tz` → UTC Date. */
export function zonedInputToUtc(input: string, tz: string): Date {
  return fromZonedTime(input, tz);
}

/** UTC Date → "YYYY-MM-DDTHH:mm" wall clock in `tz`, for <input type="datetime-local">. */
export function utcToZonedInput(date: Date, tz: string): string {
  return formatInTimeZone(date, tz, "yyyy-MM-dd'T'HH:mm");
}

export function formatEventRange(start: Date, end: Date, tz: string): string {
  const day = "EEE d MMM yyyy";
  const time = "h:mm a";
  const sameDay = formatInTimeZone(start, tz, "yyyy-MM-dd") === formatInTimeZone(end, tz, "yyyy-MM-dd");
  const zone = zoneAbbreviation(start, tz);
  if (sameDay) {
    return `${formatInTimeZone(start, tz, `${day}, ${time}`)} – ${formatInTimeZone(end, tz, time)} (${zone})`;
  }
  return `${formatInTimeZone(start, tz, `${day}, ${time}`)} – ${formatInTimeZone(end, tz, `${day}, ${time}`)} (${zone})`;
}

export function formatDateShort(date: Date, tz: string): string {
  return formatInTimeZone(date, tz, "EEE d MMM");
}

export function formatTime(date: Date, tz: string): string {
  return formatInTimeZone(date, tz, "h:mm a");
}
