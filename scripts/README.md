# Scripts

Both scripts talk to the app's REST API as a super admin and need only Python 3 (no packages).
The password is read from `$YPO_PASSWORD` or prompted without echo.

- `export-events.py <url> <admin email> [out.json]` — dumps chapters, event types and every event (published, draft, cancelled) to `scripts/data/events-export.json`.
- `backfill-chairs.py <url> <admin email>` — one-off: moves an "Event chair(s)" line from descriptions into the structured chairs field.
- `build-fy27-calendars.py` — regenerates `scripts/data/fy27-sea-calendars.json` from the hand-normalised FY26/27 chapter calendars (19 chapters, 286 events; conventions in the script header). Import it with `import-events.py <url> <admin> scripts/data/fy27-sea-calendars.json`.
- `import-events.py <url> <admin email> [file.json] [--chapters VN,VNG]` — recreates them on another instance, creating missing chapters and event types first. Existing titles are skipped, so it is safe to re-run; add `--update` to overwrite existing events' details (including chairs, resources and agenda) while keeping their status and registrations.

Typical move from local dev to production:

```bash
python3 scripts/export-events.py http://localhost:3000 admin@example.com
python3 scripts/import-events.py https://ypo.example.org admin@example.org
```

The Vietnam & Vietnam Gold 2026–27 calendar (24 events) was originally imported from the chapter's spreadsheet on 2026-09-09: title, dates in `Asia/Ho_Chi_Minh`, theme, "Open for Region" → REGIONAL or chapter-specific for VN+VNG, event chairs in the description; tentative or undated rows kept as drafts.
