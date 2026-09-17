#!/usr/bin/env python3
"""Move an "**Event chair(s):** …" line from event descriptions into the structured `chairs` field.

Usage:  python3 scripts/backfill-chairs.py <url> <admin email>
Password from $YPO_PASSWORD or prompted. Safe to re-run: events without that line, or with chairs already set, are left alone.
"""
import os
import re
import sys

sys.path.insert(0, os.path.dirname(__file__))
from ypo_api import Api  # noqa: E402

if len(sys.argv) < 3:
    print(__doc__)
    sys.exit(1)
api = Api(sys.argv[1], sys.argv[2])
LINE = re.compile(r"^\*\*Event chair\(s\):\*\*\s*(.+?)\s*$", re.M)

_, ch = api.call("/chapters?all=true")
_, ty = api.call("/event-types?all=true")
changed = 0
for e in api.all_events():
    m = LINE.search(e["description"])
    if not m or e.get("chairs"):
        continue
    raw = m.group(1).strip()
    chairs = [c.strip() for c in re.split(r",|&| and ", raw) if c.strip() and not c.strip().lower().startswith("to be")]
    description = re.sub(r"\n{3,}", "\n\n", LINE.sub("", e["description"])).strip()
    body = {
        "title": e["title"], "description": description, "hostChapterId": e["hostChapter"]["id"], "eventTypeId": e["eventType"]["id"],
        "startAt": e["startAt"], "endAt": e["endAt"], "timezone": e["timezone"], "venue": e["venue"], "isOnline": e["isOnline"],
        "onlineUrl": e["onlineUrl"], "coverImageUrl": e["coverImageUrl"], "visibility": e["visibility"],
        "accessChapterIds": [c["id"] for c in e["accessChapters"]], "capacity": e["capacity"],
        "registrationOpensAt": e["registrationOpensAt"], "registrationClosesAt": e["registrationClosesAt"],
        "paymentType": e["paymentType"], "price": e["price"], "currency": e["currency"],
        "paymentInstructions": e["paymentInstructions"], "paymentUrl": e["paymentUrl"],
        "chairs": chairs, "resources": e.get("resources", []), "agenda": e.get("agenda", []),
    }
    s, b = api.call(f"/events/{e['id']}", "PATCH", body)
    if s != 200:
        print("FAIL", e["title"], s, b)
        continue
    changed += 1
    print(f"  {e['title']}: chairs = {chairs or '(to be updated)'}")
print(f"\nupdated {changed} events")
