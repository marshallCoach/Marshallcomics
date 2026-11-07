#!/usr/bin/env python3
"""brb_build_confirmed_variants.py — make CC1 variant confirmations STICK.

Every CC1 cover-buy is flagged "likely variant" on the Data Fix page, forever —
the flag fires purely on Box == CC1. Confirming "Cover's right — keep as variant"
exported a `confirm-variant` resolution, but brb_apply_data_fixes treated that as
acknowledge-only and wrote nothing, so the book re-flagged on the next regen and
you re-confirmed the same books over and over.

This recovers EVERY confirm-variant / not-variant decision from all data-fixes
exports — Downloads, the repo root, AND processed_exports/ (where consumed
exports are archived) — and writes them to a committed list the app reads to
suppress the flag permanently. Idempotent: rebuilt from scratch each run, so a
decision made once is honoured for good.

    python3 brb_build_confirmed_variants.py
Writes: artifacts/comics-inventory/public/confirmed_variants.json
"""
import glob, json, os

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "artifacts/comics-inventory/public/confirmed_variants.json")
DOWNLOADS = os.path.expanduser("~/Downloads")
DECISIONS = {"confirm-variant", "not-variant"}


def _id(rec):
    """The comic id the app keys on: Title|||Issue|||Box. Prefer the record's own
    `id` (the page writes comicId there); fall back to rebuilding it."""
    if rec.get("id") and str(rec["id"]).count("|||") == 2:
        return str(rec["id"])
    t = str(rec.get("title", "")).strip()
    i = str(rec.get("issue", "")).strip().lstrip("#")
    b = str(rec.get("box", "")).strip()
    return f"{t}|||{i}|||{b}"


def main():
    paths = set()
    for d in (DOWNLOADS, ROOT, os.path.join(ROOT, "processed_exports")):
        paths |= set(glob.glob(os.path.join(d, "data-fixes*.json")))
        paths |= set(glob.glob(os.path.join(d, "*_data-fixes*.json")))  # archived prefix
    ids = set()
    files = 0
    for p in sorted(paths):
        try:
            recs = json.load(open(p))
        except Exception:  # noqa: BLE001
            continue
        if not isinstance(recs, list):
            continue
        files += 1
        for rec in recs:
            if isinstance(rec, dict) and rec.get("kind") == "solution" and str(rec.get("value")) in DECISIONS:
                ids.add(_id(rec))
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    json.dump(sorted(ids), open(OUT, "w"), indent=0)
    print(f"confirmed_variants.json: {len(ids)} confirmed CC1 book(s) from {files} export file(s)")


if __name__ == "__main__":
    main()
