#!/usr/bin/env python3
"""mci_missing_covers.py — READ-ONLY. Count/list inventory rows that still show
NO cover, using the app's exact-key lookup (Title|||Issue|||Volume, then
Title|||Issue, then Title|||#Issue). Writes missing_covers.csv (title, issue,
volume, year, publisher, box) grouped so you can see Marvel/DC vs other — which
tells you which fetch tool to point at them. Run before and after each pass to
watch the number fall."""
import glob, os, json, re, csv, openpyxl
from collections import Counter

X = max((f for f in glob.glob("attached_assets/comics_inventory_*.xlsx")
         if " copy" not in f and not os.path.basename(f).startswith("~$")), key=os.path.getmtime)
cov = json.load(open("covers.json")) if os.path.exists("covers.json") else \
      json.load(open("artifacts/comics-inventory/public/covers.json"))

def filled(k):
    v = cov.get(k)
    return bool(v.get("url")) if isinstance(v, dict) else bool(v)
def ni(v):
    s = str(v or "").strip().lstrip("#")
    try:
        f = float(s); return str(int(f)) if f == int(f) else s
    except ValueError:
        return s

# Mirror the app's rename/volume-tolerant fallback (CoverImage.tsx normIndex):
# a book resolves if its NORMALIZED title+issue maps to a single unambiguous
# cover — even when it's stored under a different volume number. Without this,
# mci over-reports missing (counts covers the app actually displays).
def _nt(t): return re.sub(r"[^a-z0-9]+", " ", t.lower().replace("&", " and ")).strip()
def _norm_issue(i): return re.sub(r"^0+(\d)", r"\1", str(i).lstrip("#")).strip()
_nm = {}
for _k, _e in cov.items():
    _u = _e.get("url") if isinstance(_e, dict) else _e
    if not _u:
        continue
    _p = _k.split("|||")
    if len(_p) >= 2:
        _nm.setdefault((_nt(_p[0]), _norm_issue(_p[1])), set()).add(_u)
NORM_INDEX = {k for k, v in _nm.items() if len(v) == 1}   # unambiguous only
def app_resolves(t, iss):
    return (_nt(t), _norm_issue(iss)) in NORM_INDEX

wb = openpyxl.load_workbook(X, read_only=True, data_only=True)
ws = next(w for w in wb.worksheets if w.title.startswith("✅ Clean Inventory"))
rows = list(ws.iter_rows(values_only=True)); H = [str(h).strip() if h else "" for h in rows[0]]
C = {h: i for i, h in enumerate(H)}
def g(r, n):
    i = C.get(n); v = r[i] if i is not None and i < len(r) else None
    return str(v).strip() if v not in (None, "") else ""

missing = []; seen = set()
for r in rows[1:]:
    t = g(r, "Title"); iss = ni(g(r, "Issue #")); vol = g(r, "Volume") or "1"
    if not t: continue
    ident = (t, iss, vol)
    if ident in seen: continue
    seen.add(ident)
    if (filled(f"{t}|||{iss}|||{vol}") or filled(f"{t}|||{iss}") or filled(f"{t}|||#{iss}")
            or app_resolves(t, iss)):   # cover exists under a different volume — app shows it
        continue
    pub = g(r, "Publisher")
    grp = "Marvel/DC" if pub in ("Marvel", "DC") else "other"
    missing.append((t, iss, vol, g(r, "Year"), pub, g(r, "Box #"), grp))

by = Counter(m[6] for m in missing)
print(f"canonical: {os.path.basename(X)}")
print(f"MISSING covers: {len(missing)}   (Marvel/DC: {by['Marvel/DC']}  ·  other: {by['other']})")
with open("missing_covers.csv", "w", newline="") as f:
    w = csv.writer(f); w.writerow(["Title", "Issue", "Volume", "Year", "Publisher", "Box", "Group"])
    for m in sorted(missing, key=lambda x: (x[6], x[4], x[0])): w.writerow(m)
print("wrote missing_covers.csv")
