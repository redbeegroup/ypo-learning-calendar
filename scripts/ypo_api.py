"""Tiny helper shared by the export/import scripts: login and JSON calls against /api/v1."""
import getpass
import json
import os
import sys
import urllib.error
import urllib.request


class Api:
    def __init__(self, base_url, email):
        self.base = base_url.rstrip("/") + "/api/v1"
        password = os.environ.get("YPO_PASSWORD") or getpass.getpass(f"Password for {email}: ")
        status, body = self.call("/auth/login", "POST", {"email": email, "password": password})
        if status != 200:
            print("login failed:", body, file=sys.stderr)
            sys.exit(1)
        self.token = body["data"]["token"]

    def call(self, path, method="GET", body=None, token=None):
        headers = {"content-type": "application/json"}
        tok = token or getattr(self, "token", None)
        if tok:
            headers["authorization"] = "Bearer " + tok
        req = urllib.request.Request(
            self.base + path, method=method, data=json.dumps(body).encode() if body is not None else None, headers=headers
        )
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                return r.status, json.loads(r.read())
        except urllib.error.HTTPError as e:
            raw = e.read()
            try:
                return e.code, json.loads(raw)
            except ValueError:
                text = raw.decode("utf-8", "replace").strip()[:200]
                return e.code, {"error": {"code": f"HTTP_{e.code}", "message": text or e.reason}}

    def all_events(self):
        items = []
        for status in ("PUBLISHED", "DRAFT", "CANCELLED"):
            page = 1
            while True:
                s, b = self.call(f"/events?includePast=true&pageSize=100&page={page}&status={status}")
                if s != 200:
                    print("list failed:", b, file=sys.stderr)
                    sys.exit(1)
                items += b["data"]["items"]
                if page * 100 >= b["data"]["total"]:
                    break
                page += 1
        return items
