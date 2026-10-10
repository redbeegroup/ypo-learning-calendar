#!/usr/bin/env python3
"""Remove the demo data created while the app was being built.

Usage:  python3 scripts/remove-demo-data.py <url> <admin email> [--apply]
Dry run by default. Requires a super admin and an app version with DELETE /events/:id.

Removes:
- the six sample events invented on 2026-09-09 (Singapore, Philippines, Thailand, Malaysia, Indonesia), with their registrations
- the fictional speakers and agendas added to two real Vietnam events (their real chairs from the chapter sheet are kept)
- the "Test Member" demo account (member@example.com), by disabling it (accounts are never deleted)
"""
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from ypo_api import Api  # noqa: E402

DEMO_EVENTS = {
    ("SG", "Singapore Forum Night: Scaling Beyond SEA"),
    ("PH", "Online: AI for Family Businesses"),
    ("TH", "Bangkok + Vietnam Founders Exchange"),
    ("SG", "SEA Regional Leadership Summit"),
    ("MY", "Family Wellness Retreat in Langkawi"),
    ("ID", "Jakarta Chapter Draft Event"),
}
DEMO_PROGRAMME = {
    ("VN", "VNG Data Center Visit & The Future of AI"),
    ("VN", "The Bridge Room Ep.1: How To Reach Vietnam's Digital Consumers"),
}
DEMO_USERS = {"member@example.com"}

args = [a for a in sys.argv[1:] if not a.startswith("--")]
apply = "--apply" in sys.argv
if len(args) < 2:
    print(__doc__)
    sys.exit(1)
api = Api(args[0], args[1])
print("APPLY" if apply else "DRY RUN", "\n")

events = api.all_events()
key = lambda e: (e["hostChapter"]["code"], e["title"])  # noqa: E731
to_delete = [e for e in events if key(e) in DEMO_EVENTS]
to_clean = [e for e in events if key(e) in DEMO_PROGRAMME and (e.get("resources") or e.get("agenda"))]
_, users = api.call("/users?pageSize=200")
to_disable = [u for u in users["data"]["items"] if u["email"] in DEMO_USERS and u["status"] != "DISABLED"]

for e in to_delete:
    print("delete event      ", e["hostChapter"]["code"], e["title"])
for e in to_clean:
    print("clear programme   ", e["hostChapter"]["code"], e["title"], f"(resources {len(e['resources'])}, agenda {len(e['agenda'])})")
for u in to_disable:
    print("disable account   ", u["email"])
if not (to_delete or to_clean or to_disable):
    print("nothing to do; no demo data found")
    sys.exit(0)
if not apply:
    print("\nre-run with --apply to make these changes")
    sys.exit(0)

if to_delete:
    s, _ = api.call("/events/version-probe", "DELETE")
    if s == 405:
        print("\nThis server does not support deleting events yet (old image). Redeploy the latest image first; nothing was changed.")
        sys.exit(2)

for e in to_delete:
    s, b = api.call(f"/events/{e['id']}", "DELETE")
    print("deleted" if s == 200 else f"FAILED {s} {b}", e["title"])
for e in to_clean:
    body = {k: e[k] for k in ["title", "description", "startAt", "endAt", "timezone", "venue", "isOnline", "onlineUrl", "coverImageUrl",
                              "visibility", "capacity", "registrationOpensAt", "registrationClosesAt", "paymentType", "price", "currency",
                              "paymentInstructions", "paymentUrl", "chairs"]}
    body.update(hostChapterId=e["hostChapter"]["id"], eventTypeId=e["eventType"]["id"],
                accessChapterIds=[c["id"] for c in e["accessChapters"]], resources=[], agenda=[])
    s, b = api.call(f"/events/{e['id']}", "PATCH", body)
    print("cleared" if s == 200 else f"FAILED {s} {b}", e["title"])
for u in to_disable:
    s, b = api.call(f"/users/{u['id']}", "PATCH", {"status": "DISABLED"})
    print("disabled" if s == 200 else f"FAILED {s} {b}", u["email"])
