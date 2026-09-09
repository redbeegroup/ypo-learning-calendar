# Importing a chapter learning calendar spreadsheet

The Vietnam & Vietnam Gold 2026–27 calendar was imported on 2026-09-09 with a one-off script
that read the workbook (columns: No, Year, Month, Date, Day+time, Type, Open for Region,
Event Name, Event Chairs) and created events through the REST API as the super admin.

Mapping used:

| Sheet | App |
|---|---|
| Event Name (first line) | title; extra lines → description |
| Year + Month + Date + Day time | startAt / endAt in `Asia/Ho_Chi_Minh`; "Full Day" or no time → 09:00–17:00 |
| Type | event type (Learning, Social, Family, Untold Story, Bridge Room, Forum, Retreat) |
| Open for Region = Yes | visibility REGIONAL |
| Open for Region = No | visibility CHAPTER_SPECIFIC for Vietnam + Vietnam Gold |
| Event Chairs | "Event chair(s): …" line in the description |
| (none) | payment FREE, capacity unlimited, venue blank |

Rows marked "(tentative)" or "To be updated" were created as drafts with a placeholder date
(first of the month) and a note in the description. Everything else was published.

For the next chapter's spreadsheet, the quickest path is the same: export the rows, decide the
column mapping, create any missing chapters or event types in Admin, and POST to
`/api/v1/events` followed by `/api/v1/events/:id/publish`.
