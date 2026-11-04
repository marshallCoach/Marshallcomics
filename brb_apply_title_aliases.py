#!/usr/bin/env python3
"""brb_apply_title_aliases.py — canonicalize split title spellings, for good.

The Data Fix "Title cleanup" section exports title_aliases_*.json (a map
normalized-key -> {canonical, source}). A Fandom link the user pasted is the
source of truth for the canonical spelling. This:

  1. merges any ~/Downloads/title_aliases_*.json into the committed
     title_aliases.json (accumulating, source-tracked), and archives them;
  2. rewrites the newest xlsx so EVERY row whose normalized title matches an
     alias becomes the canonical spelling — run every brb_all, so a re-split
     introduced by a later intake self-heals instead of re-flagging forever.

Normalization matches brb_validate.py Check 12 and the app exactly.

    python3 brb_apply_title_aliases.py            # dry-run (report only)
    python3 brb_apply_title_aliases.py --apply     # write a new dated xlsx
"""
import argparse, datetime, glob, json, os, re
import openpyxl
from brb_apply_fandom_pages import newest_xlsx, ROOT

DOWNLOADS = os.path.expanduser("~/Downloads")
ALIASES = os.path.join(ROOT, "title_aliases.json")


def norm_key(t):
    return re.sub(r"[^a-z0-9]+", " ", str(t or "").lower()).strip()


def load_json(path, default):
    try:
        return json.load(open(path))
    except Exception:  # noqa: BLE001
        return default


def merge_downloads(aliases):
    """Fold every ~/Downloads/title_aliases_*.json into the committed map and
    move the consumed files to processed_exports/ so they never re-apply."""
    merged = 0
    for f in sorted(glob.glob(os.path.join(DOWNLOADS, "title_aliases_*.json"))):
        incoming = load_json(f, {})
        if isinstance(incoming, dict):
            for k, v in incoming.items():
                if isinstance(v, dict) and v.get("canonical"):
                    aliases[norm_key(k)] = {"canonical": v["canonical"], "source": v.get("source", "")}
                    merged += 1
        dest_dir = os.path.join(ROOT, "processed_exports")
        os.makedirs(dest_dir, exist_ok=True)
        try:
            os.replace(f, os.path.join(dest_dir, f"{datetime.datetime.now():%Y%m%d_%H%M%S}_{os.path.basename(f)}"))
        except OSError:
            pass
    return merged


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    args = ap.parse_args()

    aliases = load_json(ALIASES, {})
    if not isinstance(aliases, dict):
        aliases = {}
    merged = merge_downloads(aliases)
    if merged and args.apply:
        json.dump(dict(sorted(aliases.items())), open(ALIASES, "w"), indent=0)
    print(f"Aliases: {len(aliases)} canonical title(s) on file  (+{merged} merged from Downloads)")
    if not aliases:
        print("Nothing to apply."); return

    src = newest_xlsx()
    wb = openpyxl.load_workbook(src)
    ws = [w for w in wb.worksheets if w.title.startswith("✅ Clean Inventory")][-1]
    H = [str(c.value).strip() if c.value is not None else "" for c in ws[1]]
    cT = H.index("Title") + 1 if "Title" in H else None
    if not cT:
        print("No Title column — abort."); return

    changed = 0
    for r in range(2, ws.max_row + 1):
        t = str(ws.cell(r, cT).value or "").strip()
        if not t:
            continue
        a = aliases.get(norm_key(t))
        if a and t != a["canonical"]:
            print(f"  {t!r} -> {a['canonical']!r}")
            if args.apply:
                ws.cell(r, cT, a["canonical"])
            changed += 1

    print(f"\nRows to canonicalize: {changed}")
    if not args.apply:
        print("DRY RUN — nothing written. Re-run with --apply.")
        return
    if changed:
        out = os.path.join(ROOT, f"attached_assets/comics_inventory_{datetime.datetime.now():%d%m_%H%M}.xlsx")
        wb.save(out)
        print(f"WROTE: {os.path.basename(out)}")


if __name__ == "__main__":
    main()
