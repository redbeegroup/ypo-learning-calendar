# Scripts

Both scripts talk to the app's REST API as a super admin and need only Python 3 (no packages).
The password is read from `$YPO_PASSWORD` or prompted without echo.

- `export-events.py <url> <admin email> [out.json]` — dumps chapters, event types and every event (published, draft, cancelled) to `scripts/data/events-export.json`.
- `import-events.py <url> <admin email> [file.json] [--chapters VN,VNG]` — recreates them on another instance, creating missing chapters and event types first. Existing titles are skipped, so it is safe to re-run.

Typical move from local dev to production:

```bash
python3 scripts/export-events.py http://localhost:3000 admin@example.com
python3 scripts/import-events.py https://ypo.example.org admin@example.org
```

The Vietnam & Vietnam Gold 2026–27 calendar (24 events) was originally imported from the chapter's spreadsheet on 2026-09-09: title, dates in `Asia/Ho_Chi_Minh`, theme, "Open for Region" → REGIONAL or chapter-specific for VN+VNG, event chairs in the description; tentative or undated rows kept as drafts.
