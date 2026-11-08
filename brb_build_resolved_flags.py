#!/usr/bin/env python3
"""brb_build_resolved_flags.py — make Data Fix triage STICK for every problem type.

The Data Fix page is a to-do queue, but it had no memory: a resolution that
doesn't change the sheet (accept-blank, needs-research, try-Comic-Vine,
trust-my-year, confirm-variant, or a pasted link that 404s) left the book
flagged, so the same books re-asked on every regen. You re-triaged them forever.

This rebuilds a committed map { "Title|||Issue|||Box": [problemId, ...] } from
EVERY data-fixes export — Downloads, the repo root, and processed_exports/ (your
archived history) — recording which problem you resolved on which book. The app
reads it and drops those flags permanently. Idempotent: a decision made once is
honoured for good. Data-changing fixes (volume/year/link) still apply as before
and clear on their own; this only stops the re-ask.

    python3 brb_build_resolved_flags.py
Writes: artifacts/comics-inventory/public/resolved_flags.json
"""
import glob, json, os
from collections import defaultdict

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "artifacts/comics-inventory/public/resolved_flags.json")
DOWNLOADS = os.path.expanduser("~/Downloads")


def _id(rec):
    """The comic id the app keys on: Title|||Issue|||Box. Prefer the record's own
    `id`; fall back to rebuilding it from the parts."""
    rid = rec.get("id")
    if rid and str(rid).count("|||") == 2:
        return str(rid)
    t = str(rec.get("title", "")).strip()
    i = str(rec.get("issue", "")).strip().lstrip("#")
    b = str(rec.get("box", "")).strip()
    return f"{t}|||{i}|||{b}"


def main():
    paths = set()
    for d in (DOWNLOADS, ROOT, os.path.join(ROOT, "processed_exports")):
        paths |= set(glob.glob(os.path.join(d, "data-fixes*.json")))
        paths |= set(glob.glob(os.path.join(d, "*_data-fixes*.json")))  # archived prefix
    resolved = defaultdict(set)
    files = 0
    # Only ACKNOWLEDGE-type decisions are remembered — the ones that change nothing
    # on the sheet, so nothing else would ever clear them. Data-changing fixes
    # (fandom/image links, vol:/year:/vol1, trust-gcd, and "cv" retry) are NOT
    # suppressed: they clear naturally when they work, and — crucially — a bad link
    # that resolves no cover RE-SURFACES instead of silently vanishing.
    # trust-year is NOT here: it now rewrites the wrong-edition date (data change),
    # so it clears on success and re-surfaces if it didn't take.
    ACK = {"no-entry", "no-art", "research", "indie", "confirm-variant", "not-variant"}
    for p in sorted(paths):
        try:
            recs = json.load(open(p))
        except Exception:  # noqa: BLE001
            continue
        if not isinstance(recs, list):
            continue
        files += 1
        for rec in recs:
            if not isinstance(rec, dict):
                continue
            prob = rec.get("problem")
            if not prob or rec.get("kind") != "solution" or str(rec.get("value")) not in ACK:
                continue
            resolved[_id(rec)].add(str(prob))
    out = {k: sorted(v) for k, v in sorted(resolved.items())}
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    json.dump(out, open(OUT, "w"), indent=0)
    total = sum(len(v) for v in out.values())
    print(f"resolved_flags.json: {len(out)} book(s), {total} resolved flag(s) from {files} export file(s)")


if __name__ == "__main__":
    main()
