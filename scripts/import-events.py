#!/usr/bin/env python3
"""Import an events-export.json into another instance (for example production).

Usage:  python3 scripts/import-events.py https://ypo.example.org admin@example.org [file.json] [--chapters VN,VNG] [--update]
Password is read from $YPO_PASSWORD or prompted. Requires a super admin account.
- Creates missing chapters (by code) and event types (by name) first.
- Skips events whose chapter + title already exist on the target, so it is safe to re-run.
- --update instead overwrites existing events (matched by title) with the file's details, including
  chairs, resources and agenda. Status and registrations on the target are left untouched.
- Recreates each event with its original status: published, draft, or cancelled.
- --chapters limits the import to events hosted by those chapter codes.
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from ypo_api import Api  # noqa: E402

args = [a for a in sys.argv[1:] if not a.startswith("--")]
update = "--update" in sys.argv
only = None
for a in sys.argv[1:]:
    if a.startswith("--chapters="):
        only = {c.strip().upper() for c in a.split("=", 1)[1].split(",") if c.strip()}
if "--chapters" in sys.argv:
    i = sys.argv.index("--chapters")
    only = {c.strip().upper() for c in sys.argv[i + 1].split(",")}
    args = [a for a in args if a != sys.argv[i + 1]]
if len(args) < 2:
    print(__doc__)
    sys.exit(1)
path = args[2] if len(args) > 2 else os.path.join(os.path.dirname(__file__), "data", "events-export.json")
data = json.load(open(path))
api = Api(args[0], args[1])

_, ch = api.call("/chapters?all=true")
C = {c["code"]: c["id"] for c in ch["data"]}
for r in data.get("renames", []):
    new = r.get("newCode", r["code"])
    if r["code"] in C and (new == r["code"] or new not in C):
        s, b = api.call(f"/chapters/{C[r['code']]}", "PATCH", {"name": r["name"], "code": r.get("newCode", r["code"])})
        assert s == 200, b
        C[r.get("newCode", r["code"])] = C.pop(r["code"])
        print("renamed chapter", r["code"], "->", r["name"], f"({r.get('newCode', r['code'])})")
for c in data["chapters"]:
    if c["code"] not in C:
        s, b = api.call("/chapters", "POST", {"name": c["name"], "code": c["code"], "country": c["country"], "isActive": c["isActive"]})
        assert s == 201, b
        C[c["code"]] = b["data"]["id"]
        print("created chapter", c["name"])

_, ty = api.call("/event-types?all=true")
T = {t["name"]: t["id"] for t in ty["data"]}
for t in data["eventTypes"]:
    if t["name"] not in T:
        s, b = api.call("/event-types", "POST", {"name": t["name"], "color": t["color"], "sortOrder": t["sortOrder"], "isActive": t["isActive"]})
        assert s == 201, b
        T[t["name"]] = b["data"]["id"]
        print("created event type", t["name"])

existing = {(e["hostChapter"]["code"], e["title"]): e["id"] for e in api.all_events()}
created, updated, skipped = [], [], []
for e in data["events"]:
    if only and e["hostChapter"].upper() not in only:
        continue
    key = (e["hostChapter"], e["title"])
    if key in existing and not update:
        skipped.append(e["title"])
        continue
    body = {
        "title": e["title"], "description": e["description"], "hostChapterId": C[e["hostChapter"]], "eventTypeId": T[e["eventType"]],
        "startAt": e["startAt"], "endAt": e["endAt"], "timezone": e["timezone"], "venue": e["venue"], "isOnline": e["isOnline"],
        "onlineUrl": e["onlineUrl"], "coverImageUrl": e["coverImageUrl"], "visibility": e["visibility"],
        "accessChapterIds": [C[c] for c in e["accessChapters"]], "capacity": e["capacity"],
        "registrationOpensAt": e["registrationOpensAt"], "registrationClosesAt": e["registrationClosesAt"],
        "paymentType": e["paymentType"], "price": e["price"], "currency": e["currency"],
        "paymentInstructions": e["paymentInstructions"], "paymentUrl": e["paymentUrl"],
        "chairs": e.get("chairs", []), "resources": e.get("resources", []), "agenda": e.get("agenda", []),
    }
    if key in existing:
        s, b = api.call(f"/events/{existing[key]}", "PATCH", body)
        if s != 200:
            print("FAIL (update)", e["title"], s, b)
            continue
        updated.append(e)
        print(f"  updated  {e['hostChapter']:4} {e['startAt'][:10]}  {e['title']}")
        continue
    s, b = api.call("/events", "POST", body)
    if s != 201:
        print("FAIL", e["title"], s, b)
        continue
    eid = b["data"]["id"]
    if e["status"] in ("PUBLISHED", "CANCELLED"):
        api.call(f"/events/{eid}/publish", "POST")
    if e["status"] == "CANCELLED":
        api.call(f"/events/{eid}/cancel", "POST")
    created.append(e)
    print(f"  {e['hostChapter']:4} {e['status']:9} {e['startAt'][:10]}  {e['title']}")
print(f"\ncreated {len(created)}, updated {len(updated)}, skipped {len(skipped)} already present")
