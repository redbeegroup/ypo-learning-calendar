#!/usr/bin/env python3
"""Merge a duplicate chapter into another: move members, delete events that already exist under the target
(same title), re-host the rest, then deactivate and rename the duplicate.

Usage:  python3 scripts/merge-chapter.py <url> <admin email> <from code> <into code> [--apply]
Without --apply it only prints what it would do. Requires a super admin and an app version with DELETE /events/:id.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from ypo_api import Api  # noqa: E402

args = [a for a in sys.argv[1:] if not a.startswith("--")]
apply = "--apply" in sys.argv
if len(args) < 4:
    print(__doc__)
    sys.exit(1)
url, email, src_code, dst_code = args[:4]
api = Api(url, email)

_, ch = api.call("/chapters?all=true")
by_code = {c["code"]: c for c in ch["data"]}
src, dst = by_code.get(src_code.upper()), by_code.get(dst_code.upper())
if not src or not dst:
    print("chapter not found; codes are:", ", ".join(sorted(by_code)))
    sys.exit(1)
print(f"merge {src['name']} ({src['code']}) -> {dst['name']} ({dst['code']})  {'APPLY' if apply else 'DRY RUN'}\n")

events = api.all_events()
src_events = [e for e in events if e["hostChapter"]["id"] == src["id"]]
dst_titles = {e["title"] for e in events if e["hostChapter"]["id"] == dst["id"]}
to_delete = [e for e in src_events if e["title"] in dst_titles]
to_move = [e for e in src_events if e["title"] not in dst_titles]
print(f"events under {src['code']}: {len(src_events)} -> delete {len(to_delete)} duplicates, re-host {len(to_move)}")

_, users = api.call(f"/users?chapterId={src['id']}&pageSize=200")
members = [u for u in users["data"]["items"] if u["chapterId"] == src["id"]]
print(f"members with primary chapter {src['code']}: {len(members)}")

if not apply:
    for e in to_delete:
        print("  would delete ", e["title"])
    for e in to_move:
        print("  would re-host", e["title"])
    for u in members:
        print("  would move   ", u["email"])
    print("\nre-run with --apply to make these changes")
    sys.exit(0)

for e in to_delete:
    s, b = api.call(f"/events/{e['id']}", "DELETE")
    print("deleted" if s == 200 else f"FAILED {s} {b}", e["title"])
for e in to_move:
    body = {k: e[k] for k in ["title", "description", "startAt", "endAt", "timezone", "venue", "isOnline", "onlineUrl", "coverImageUrl",
                              "visibility", "capacity", "registrationOpensAt", "registrationClosesAt", "paymentType", "price", "currency",
                              "paymentInstructions", "paymentUrl", "chairs", "resources", "agenda"]}
    body.update(hostChapterId=dst["id"], eventTypeId=e["eventType"]["id"],
                accessChapterIds=[dst["id"] if c["id"] == src["id"] else c["id"] for c in e["accessChapters"]])
    s, b = api.call(f"/events/{e['id']}", "PATCH", body)
    print("re-hosted" if s == 200 else f"FAILED {s} {b}", e["title"])
for u in members:
    s, b = api.call(f"/users/{u['id']}", "PATCH", {"chapterId": dst["id"]})
    print("moved" if s == 200 else f"FAILED {s} {b}", u["email"])
s, b = api.call(f"/chapters/{src['id']}", "PATCH", {"name": f"{src['name']} (merged into {dst['name']})", "isActive": False})
print("deactivated duplicate chapter" if s == 200 else f"FAILED {s} {b}")
