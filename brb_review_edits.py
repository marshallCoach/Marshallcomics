#!/usr/bin/env python3
"""brb_review_edits.py — review & apply comic edits exported from the site's
"Edit Comic" page (Cleanup section). Each export is a comic_edit_*.json file:

    {
      "type": "comic-edit",
      "match":   {"Title": ..., "Issue": ..., "Volume": ..., "Box": ..., "Signed_By": ...},
      "delete":  false,
      "changes": {"Value_NM": "$120", "Cover_Artist": "Jim Lee", ...}
    }

Field edits are ordinary data work (creator credits included) — applied freely.
"Credits" confirmation in CLAUDE.md is about AI/compute spend, NOT this.

It matches each edit to ONE inventory row by Title+Issue+Volume+Box (+Signed By
as a tiebreak for intended duplicates), prints a diff, and:

    python3 brb_review_edits.py            # dry run — show every edit + diff
    python3 brb_review_edits.py --apply    # write changes / delete rows -> new dated xlsx

Non-destructive: --apply writes a NEW dated workbook, never the source. Deletions
need the row to match exactly or they're skipped and reported. Consumed edit
files are moved to processed_exports/ so they never re-apply. Bundled into
brb_all.py as its edit-review step.
"""
import argparse, glob, os, re, json, datetime, openpyxl

ROOT = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.join(ROOT, "attached_assets")
DOWNLOADS = os.path.expanduser("~/Downloads")
INV = "✅ Clean Inventory"

# data3 field key -> xlsx column header
COLMAP = {
    "Title": "Title", "Issue": "Issue #", "Volume": "Volume", "Year": "Year",
    "Publisher": "Publisher", "Imprint": "Imprint", "Box": "Box #",
    "Condition": "Condition", "Signed": "Signed?", "Signed_By": "Signed By",
    "Value_NM": "Est. Raw Value (NM) $", "Cover_Price": "Cover Price",
    "Pub_Date": "Publication Date", "Date_Added": "Date Added", "Era": "Era",
    "Category": "Whatnot Category", "Key": "Key Issue?",
    "Key_Reason": "Key Issue — Why", "First_App": "1st Appearances",
    "Writer": "Writer(s)", "Artist": "Artist(s)", "Cover_Artist": "Cover Artist",
    "Seller_Notes": "Seller Notes / Variants / Caveats",
}


def nt(t):
    s = re.sub(r"^the\s+", "", str(t or "").lower())
    return re.sub(r"[^a-z0-9]+", "", s)


def ni(i):
    # NOTE: use "is None", not "or", so a #0 issue (integer 0, which is falsy)
    # normalizes to "0" and matches instead of silently becoming "".
    return re.sub(r"\.0$", "", str(i if i is not None else "").replace("#", "").strip())


def nv(v):
    return re.sub(r"\.0$", "", str(v if v is not None else "").strip())


def _fn_key(f):
    m = re.search(r"_(\d{2})(\d{2})_(\d{2})(\d{2})", os.path.basename(f))
    if m:
        dd, mm, hh, mi = (int(x) for x in m.groups())
        return (1, mm, dd, hh, mi, os.path.getmtime(f))
    return (0, 0, 0, 0, 0, os.path.getmtime(f))


def newest_xlsx():
    m = [f for f in glob.glob(os.path.join(ASSETS, "comics_inventory_*.xlsx"))
         if " copy" not in f and not os.path.basename(f).startswith("~$")]
    return max(m, key=_fn_key) if m else None


def find_edits():
    """Edit exports from ~/Downloads and the repo root, oldest first so a later
    edit to the same book wins. Single-edit files (comic_edit_*.json, from the
    Edit Comic page) and batch files (comic_edits_batch_*.json, from the
    Condition Entry page) are both picked up."""
    pats = ("comic_edit_*.json", "comic_edits_batch_*.json")
    files = []
    for p in pats:
        files += glob.glob(os.path.join(DOWNLOADS, p)) + glob.glob(os.path.join(ROOT, p))
    return sorted(set(files), key=os.path.getmtime)


def archive(path):
    dest_dir = os.path.join(ROOT, "processed_exports")
    os.makedirs(dest_dir, exist_ok=True)
    dest = os.path.join(dest_dir, f"{datetime.datetime.now():%Y%m%d_%H%M%S}_{os.path.basename(path)}")
    try:
        os.replace(path, dest)
        print(f"  consumed -> processed_exports/{os.path.basename(dest)}")
    except OSError as e:
        print(f"  (could not archive {os.path.basename(path)}: {e})")


def build_index(ws, H):
    """One pass over the sheet → {(title,issue,vol,box): [rows]} plus per-row
    signer, so each edit is an O(1) lookup instead of a full-sheet scan. A batch
    of thousands of edits would be O(edits × rows) otherwise."""
    def ci(n):
        return H.index(n) + 1 if n in H else None
    cT, cI, cV, cB, cS = (ci(COLMAP[k]) for k in ("Title", "Issue", "Volume", "Box", "Signed_By"))
    idx, signer = {}, {}
    for r in range(2, ws.max_row + 1):
        vol = (nv(ws.cell(r, cV).value) or "1") if cV else "1"
        key = (nt(ws.cell(r, cT).value) if cT else "",
               ni(ws.cell(r, cI).value) if cI else "",
               vol,
               nv(ws.cell(r, cB).value) if cB else "")
        idx.setdefault(key, []).append(r)
        if cS:
            signer[r] = nv(ws.cell(r, cS).value)
    return idx, signer


def match_rows(index, signer, m):
    """Rows matching an edit's identity via the prebuilt index. Title+Issue+
    Volume+Box first; if more than one (intended dupes) narrow by Signed By."""
    want = (nt(m.get("Title")), ni(m.get("Issue")), nv(m.get("Volume") or "1"), nv(m.get("Box")))
    hits = list(index.get(want, []))
    if len(hits) > 1 and m.get("Signed_By"):
        narrowed = [r for r in hits if signer.get(r) == nv(m.get("Signed_By"))]
        if narrowed:
            hits = narrowed
    return hits


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    args = ap.parse_args()

    edits = find_edits()
    if not edits:
        print("No comic_edit_*.json in ~/Downloads or repo root — nothing to review.")
        return

    src = newest_xlsx()
    if not src:
        raise SystemExit("no attached_assets/comics_inventory_*.xlsx found")
    wb = openpyxl.load_workbook(src)
    ws = [w for w in wb.worksheets if w.title.startswith(INV)][-1]
    H = [str(c.value).strip() if c.value is not None else "" for c in ws[1]]

    def ci(n):
        return H.index(n) + 1 if n in H else None

    index, signer = build_index(ws, H)
    n_edit = n_del = n_skip = 0
    del_rows = []  # collect row numbers to delete, apply after field edits

    for path in edits:
        try:
            payload = json.load(open(path))
        except Exception as e:
            print(f"\n✗ {os.path.basename(path)}: unreadable ({e})"); n_skip += 1; continue
        # One file may hold a single edit or a batch of them (Condition Entry).
        if payload.get("type") == "comic-edit-batch":
            items = payload.get("edits", [])
        elif payload.get("type") == "comic-edit":
            items = [payload]
        else:
            print(f"\n✗ {os.path.basename(path)}: not a comic-edit file"); n_skip += 1; continue

        # fill_only (file- or edit-level): only write into a BLANK cell, never
        # overwrite an existing value — so a bulk condition sweep can't clobber a
        # grade you entered by hand since this export was made.
        file_fill_only = bool(payload.get("fill_only"))

        print(f"\n• {os.path.basename(path)} — {len(items)} edit(s)")
        file_applied = 0
        for payload_i in items:
            m = payload_i.get("match", {})
            label = f'{m.get("Title")} #{m.get("Issue")} (Vol {m.get("Volume") or "1"}, Box {m.get("Box")})'
            rows = match_rows(index, signer, m)
            if len(rows) == 0:
                print(f"    ✗ {label}: no matching row — SKIPPED"); n_skip += 1; continue

            if payload_i.get("delete"):
                # Deleting the wrong copy is unrecoverable, so a delete must match ONE row.
                if len(rows) > 1:
                    print(f"    ✗ {label}: {len(rows)} rows match — DELETE SKIPPED (add Signed By)"); n_skip += 1; continue
                r = rows[0]
                print(f"    🗑  DELETE {label} (row {r})")
                del_rows.append(r); n_del += 1; file_applied += 1
                continue

            # A field fill applies to EVERY matching row: duplicate copies of the
            # same book (same title/issue/vol/box) all take the same value, so
            # there is nothing to disambiguate — not a skip.
            changes = payload_i.get("changes", {})
            fill_only = file_fill_only or bool(payload_i.get("fill_only"))
            applied = 0
            for r in rows:
                for fk, newv in changes.items():
                    col = COLMAP.get(fk)
                    c = ci(col) if col else None
                    if not c:
                        print(f"    (skip unknown field {fk})"); continue
                    old = nv(ws.cell(r, c).value)
                    if nv(newv) == old:
                        continue
                    if fill_only and old:
                        print(f"    ↷ {label} · {fk}: keeps {old!r} (fill-only, not overwritten)")
                        continue
                    tag = f" (copy row {r})" if len(rows) > 1 else ""
                    print(f"    {label}{tag} · {fk}: {old!r} -> {newv!r}")
                    if args.apply:
                        ws.cell(r, c, newv)
                    applied += 1
            if applied == 0:
                print(f"    ({label}: no effective change)")
            else:
                n_edit += applied; file_applied += 1

        if args.apply and file_applied:
            archive(path)

    # delete rows last, bottom-up so indices stay valid
    if args.apply and del_rows:
        for r in sorted(set(del_rows), reverse=True):
            ws.delete_rows(r, 1)

    print(f"\n{'APPLIED' if args.apply else 'WOULD APPLY'}: "
          f"{n_edit} field change(s), {n_del} deletion(s), {n_skip} skipped.")
    if not args.apply:
        print("Dry run — re-run with --apply to write a new xlsx.")
        return
    if n_edit == 0 and n_del == 0:
        print("Nothing applied — no new workbook written.")
        return
    out = os.path.join(ASSETS, f"comics_inventory_{datetime.datetime.now():%d%m_%H%M}.xlsx")
    wb.save(out)
    print("SAVED:", os.path.basename(out))
    print("Next: python3 brb.py --commit apply-comic-edits --yes   (or let brb_all deploy)")


if __name__ == "__main__":
    main()
