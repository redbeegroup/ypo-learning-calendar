#!/usr/bin/env python3
"""Export every event (published, draft, cancelled) plus chapters and event types to a JSON file.

Usage:  python3 scripts/export-events.py http://localhost:3000 admin@example.com [out.json]
Password is read from $YPO_PASSWORD or prompted. Requires a super admin account.
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from ypo_api import Api  # noqa: E402

if len(sys.argv) < 3:
    print(__doc__)
    sys.exit(1)
out = sys.argv[3] if len(sys.argv) > 3 else os.path.join(os.path.dirname(__file__), "data", "events-export.json")
api = Api(sys.argv[1], sys.argv[2])

_, ch = api.call("/chapters?all=true")
_, ty = api.call("/event-types?all=true")
events = api.all_events()
export = {
    "chapters": [{"code": c["code"], "name": c["name"], "country": c["country"], "isActive": c["isActive"]} for c in ch["data"]],
    "eventTypes": [{"name": t["name"], "color": t["color"], "sortOrder": t["sortOrder"], "isActive": t["isActive"]} for t in ty["data"]],
    "events": [
        {
            "title": e["title"], "description": e["description"], "hostChapter": e["hostChapter"]["code"],
            "eventType": e["eventType"]["name"], "startAt": e["startAt"], "endAt": e["endAt"], "timezone": e["timezone"],
            "venue": e["venue"], "isOnline": e["isOnline"], "onlineUrl": e["onlineUrl"], "coverImageUrl": e["coverImageUrl"],
            "visibility": e["visibility"], "accessChapters": [c["code"] for c in e["accessChapters"]],
            "capacity": e["capacity"], "registrationOpensAt": e["registrationOpensAt"], "registrationClosesAt": e["registrationClosesAt"],
            "paymentType": e["paymentType"], "price": e["price"], "currency": e["currency"],
            "paymentInstructions": e["paymentInstructions"], "paymentUrl": e["paymentUrl"], "status": e["status"],
        }
        for e in sorted(events, key=lambda e: (e["startAt"], e["title"]))
    ],
}
os.makedirs(os.path.dirname(out), exist_ok=True)
json.dump(export, open(out, "w"), ensure_ascii=False, indent=1)
print(f"exported {len(export['chapters'])} chapters, {len(export['eventTypes'])} event types, {len(export['events'])} events to {out}")
for e in export["events"]:
    print(f"  {e['hostChapter']:4} {e['status']:9} {e['startAt'][:10]}  {e['title']}")
