#!/usr/bin/env python3
"""List an instance's chapters with codes and event counts, flagging duplicate names.

Usage:  python3 scripts/check-chapters.py <url> <admin email>
"""
import os
import sys
from collections import Counter

sys.path.insert(0, os.path.dirname(__file__))
from ypo_api import Api  # noqa: E402

if len(sys.argv) < 3:
    print(__doc__)
    sys.exit(1)
api = Api(sys.argv[1], sys.argv[2])
_, ch = api.call("/chapters?all=true")
events = api.all_events()
counts = Counter(e["hostChapter"]["id"] for e in events)
names = Counter(c["name"] for c in ch["data"])
print(f"{len(ch['data'])} chapters, {len(events)} events\n")
for c in sorted(ch["data"], key=lambda c: c["name"]):
    flag = "  <-- DUPLICATE NAME" if names[c["name"]] > 1 else ""
    print(f"  {c['code']:6} {c['name']:22} active={str(c['isActive']):5} events={counts.get(c['id'], 0):3}  id={c['id']}{flag}")
