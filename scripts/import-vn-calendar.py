#!/usr/bin/env python3
"""Import the YPO Vietnam & Vietnam Gold 2026-27 learning calendar into the app.

Usage:
  python3 scripts/import-vn-calendar.py https://ypo.example.org admin@example.org
It prompts for the password (not echoed). Safe to re-run: events whose title already exists are skipped.
Creates the "Vietnam Gold" chapter and the sheet's event types if they are missing.
"""
import datetime as dt
import getpass
import json
import os
import re
import sys
import urllib.error
import urllib.request

if len(sys.argv) < 3:
    print(__doc__)
    sys.exit(1)
BASE = sys.argv[1].rstrip("/") + "/api/v1"
EMAIL = sys.argv[2]
PASSWORD = os.environ.get("YPO_PASSWORD") or getpass.getpass("Password: ")
DATA = os.path.join(os.path.dirname(__file__), "data", "vietnam-calendar-2026-27.json")


def call(path, method="GET", body=None, token=None):
    req = urllib.request.Request(
        BASE + path,
        method=method,
        data=json.dumps(body).encode() if body is not None else None,
        headers={"content-type": "application/json", **({"authorization": "Bearer " + token} if token else {})},
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read())


s, l = call("/auth/login", "POST", {"email": EMAIL, "password": PASSWORD})
if s != 200:
    print("login failed:", l)
    sys.exit(1)
tok = l["data"]["token"]

_, ch = call("/chapters", token=tok)
C = {c["code"]: c["id"] for c in ch["data"]}
if "VNG" not in C:
    s, b = call("/chapters", "POST", {"name": "Vietnam Gold", "code": "VNG", "country": "Vietnam"}, tok)
    assert s == 201, b
    C["VNG"] = b["data"]["id"]
    print("created chapter Vietnam Gold")
VN, VNG = C["VN"], C["VNG"]

_, ty = call("/event-types", token=tok)
T = {t["name"]: t["id"] for t in ty["data"]}
for name, color, order in [("Learning", "#0ea5e9", 20), ("Social", "#f59e0b", 21), ("Untold Story", "#8b5cf6", 22), ("Bridge Room", "#14b8a6", 23), ("Retreat", "#f43f5e", 24)]:
    if name not in T:
        s, b = call("/event-types", "POST", {"name": name, "color": color, "sortOrder": order}, tok)
        assert s == 201, b
        T[name] = b["data"]["id"]
        print("created type", name)
TYPE_MAP = {"Learning": "Learning", "Social": "Social", "Family": "Family", "Untold": "Untold Story", "Bridge Room": "Bridge Room", "Forum": "Forum", "Retreat": "Retreat"}

existing = set()
for qs in ("&status=DRAFT", ""):
    _, ex = call(f"/events?includePast=true&pageSize=100{qs}", token=tok)
    existing |= {e["title"] for e in ex["data"]["items"]}

MONTHS = {m: i for i, m in enumerate(["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"], 1)}
TZ = "+07:00"


def iso(y, m, d, hh, mm):
    return f"{y:04d}-{m:02d}-{d:02d}T{hh:02d}:{mm:02d}:00{TZ}"


def parse_time(s):
    m = re.search(r"(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*-\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)", s, re.I)
    if not m:
        return None
    sh, sm, smer, eh, em, emer = m.groups()
    sh, eh, sm, em = int(sh), int(eh), int(sm or 0), int(em or 0)
    emer = emer.lower()
    smer = (smer or emer).lower()

    def to24(h, mer):
        if mer == "pm" and h != 12:
            return h + 12
        if mer == "am" and h == 12:
            return 0
        return h

    S24, E24 = to24(sh, smer), to24(eh, emer)
    if smer == emer and S24 > E24 and not m.group(3):
        S24 = to24(sh, "am")
    return ((S24, sm), (E24, em))


rows = json.load(open(DATA))
created, skipped = [], []
for r in rows:
    title = r["name"].split("\n")[0].strip()
    tagline = " ".join(r["name"].split("\n")[1:]).strip()
    if title in existing:
        skipped.append(title)
        continue
    y, mo = int(r["year"]), MONTHS[r["month"][:3]]
    notes, publish = [], True
    date = r["date"].replace("\n", " ").strip()
    if "tentative" in date.lower() or "tentative" in r["day"].lower():
        notes.append("Date is tentative.")
        publish = False
    date = re.sub(r"\(tentative\)", "", date, flags=re.I).strip()
    if date.startswith("2015-11-01"):  # Excel mangled "11-15"; Wed–Sun matches 11–15 Nov 2026
        d1, d2 = 11, 15
    elif date.lower().startswith("to be"):
        d1 = d2 = 1
        notes.append("Date to be confirmed (placeholder: 1st of the month).")
        publish = False
    elif "-" in date:
        a, b = date.split("-")
        d1, d2 = int(a), int(b)
    else:
        d1 = d2 = int(date)
    t = parse_time(r["day"])
    if t:
        (sh, sm), (eh, em) = t
    else:
        sh, sm, eh, em = 9, 0, 17, 0
        if "full day" not in r["day"].lower() and d1 == d2 and not date.lower().startswith("to be"):
            notes.append("Time to be confirmed.")
    start, end = iso(y, mo, d1, sh, sm), iso(y, mo, d2, eh, em)
    if d1 == d2 and (eh, em) <= (sh, sm):
        end = iso(y, mo, d2, sh + 1, sm)
    desc = []
    if tagline:
        desc.append(f"*{tagline}*")
    chairs = r["chairs"] if r["chairs"] and r["chairs"].lower() != "to be updated" else "to be updated"
    desc.append(f"**Event chair(s):** {chairs}")
    if notes:
        desc.append("_" + " ".join(notes) + "_")
    desc.append("Part of the YPO Vietnam & Vietnam Gold Learning Calendar 2026–27 — *The Next Run: No Finish Line. Just Better Peers.*")
    regional = r["region"].strip().lower() == "yes"
    body = {
        "title": title, "description": "\n\n".join(desc), "hostChapterId": VN, "eventTypeId": T[TYPE_MAP[r["type"]]],
        "startAt": start, "endAt": end, "timezone": "Asia/Ho_Chi_Minh", "venue": "", "isOnline": False,
        "visibility": "REGIONAL" if regional else "CHAPTER_SPECIFIC", "accessChapterIds": [] if regional else [VN, VNG],
        "capacity": None, "paymentType": "FREE",
    }
    s, b = call("/events", "POST", body, tok)
    if s != 201:
        print("FAIL", title, s, b)
        continue
    eid, st = b["data"]["id"], "draft"
    if publish:
        s2, _ = call(f"/events/{eid}/publish", "POST", None, tok)
        st = "published" if s2 == 200 else f"publish-failed-{s2}"
    created.append((r["no"], title, start[:16], st))
print(f"\ncreated {len(created)}, skipped {len(skipped)} already present")
for c in created:
    print(" ", " | ".join(c))
