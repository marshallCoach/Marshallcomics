#!/usr/bin/env python3
"""brb_all.py — ONE command that runs the whole enrichment pipeline and deploys.

Order (each step reads the newest attached_assets workbook and writes a new dated
one, so they chain automatically):

  0. COLLAPSE to a single "Clean Inventory" tab.   <- the linchpin. Many Mac tools
     read the FIRST tab while the app reads the LAST; with one tab they all agree,
     so every step below writes where the app actually reads.
  1. WEEKLY INTAKE   — if ~/Downloads/intake_*.csv exists  (brb_add_intake)
  2. DATA-FIX EXPORT — if ~/Downloads/data-fixes*.json exists (brb_apply_fandom_pages)
  3. FANDOM FILL     — fill blank creators/date on fandom-covered books (brb_fill_from_fandom)
  4. GCD FILL        — fill the rest from the local GCD db (brb_credits_gcd)
  5. DEPLOY          — brb.py (validate -> regen -> commit -> push), ONCE.

Nothing to do for a step => it is skipped and logged. A step that errors is logged
and the pipeline keeps going, so partial progress still deploys. Runs on the Mac.

    python3 brb_all.py
"""
import glob, os, subprocess, sys, datetime
import openpyxl

ROOT = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.join(ROOT, "attached_assets")
DOWNLOADS = os.path.expanduser("~/Downloads")
PY = sys.executable
INV = "✅ Clean Inventory"


def _fn_key(f):
    import re
    m = re.search(r"_(\d{2})(\d{2})_(\d{2})(\d{2})", os.path.basename(f))
    if m:
        dd, mm, hh, mi = (int(x) for x in m.groups())
        return (1, mm, dd, hh, mi, os.path.getmtime(f))
    return (0, 0, 0, 0, 0, os.path.getmtime(f))


def newest_xlsx():
    m = [f for f in glob.glob(os.path.join(ASSETS, "comics_inventory_*.xlsx"))
         if " copy" not in f and not os.path.basename(f).startswith("~$")]
    return max(m, key=_fn_key) if m else None


def newest(pattern, root=DOWNLOADS):
    m = glob.glob(os.path.join(root, pattern))
    return max(m, key=os.path.getmtime) if m else None


def archive(path):
    """Move a consumed input out of ~/Downloads so it is never re-applied. This
    is why 'FANDOM links to open: 57' kept reappearing every run — the export
    was never retired. New exports you download later are picked up fresh."""
    dest_dir = os.path.join(ROOT, "processed_exports")
    os.makedirs(dest_dir, exist_ok=True)
    dest = os.path.join(dest_dir, f"{datetime.datetime.now():%Y%m%d_%H%M%S}_{os.path.basename(path)}")
    try:
        os.replace(path, dest)
        print(f"  consumed -> processed_exports/{os.path.basename(dest)} (won't re-apply)")
    except OSError as e:
        print(f"  (could not archive {os.path.basename(path)}: {e})")


def banner(n, title):
    print("\n" + "=" * 68)
    print(f"  STEP {n} · {title}")
    print("=" * 68, flush=True)


def run(cmd):
    print("$ " + " ".join(os.path.basename(c) if c.endswith(".py") else c for c in cmd), flush=True)
    return subprocess.call(cmd, cwd=ROOT)


def collapse_single_tab():
    """Delete every Clean Inventory tab except the newest (last). Writes a new
    dated workbook only if there was more than one; otherwise no-op."""
    src = newest_xlsx()
    if not src:
        raise SystemExit("no attached_assets/comics_inventory_*.xlsx found — nothing to run")
    wb = openpyxl.load_workbook(src)
    inv = [w for w in wb.worksheets if w.title.startswith(INV)]
    if len(inv) <= 1:
        print(f"Already single-tab ({inv[0].title if inv else 'none'}) — no collapse needed.")
        return
    keep = inv[-1]
    print(f"{len(inv)} Clean Inventory tabs; keeping newest: {keep.title}")
    for w in inv[:-1]:
        print(f"  removing stale tab: {w.title}")
        wb.remove(w)
    out = os.path.join(ASSETS, f"comics_inventory_{datetime.datetime.now():%d%m_%H%M}.xlsx")
    wb.save(out)
    print(f"WROTE single-tab workbook: {os.path.basename(out)}")


def main():
    failures = []

    def step(n, title, fn):
        banner(n, title)
        try:
            fn()
        except SystemExit as e:        # a tool's own sys.exit(msg)
            if e.code not in (0, None):
                print(f"!! STEP {n} stopped: {e.code}")
                failures.append((n, title, str(e.code)))
        except Exception as e:
            print(f"!! STEP {n} error: {e}")
            failures.append((n, title, str(e)))

    # 0 — collapse (must succeed; if no workbook at all, abort)
    banner(0, "COLLAPSE to single Clean Inventory tab")
    collapse_single_tab()

    # 1 — weekly intake (optional input)
    def intake():
        csv_in = newest("intake_*.csv")
        if not csv_in:
            print("No ~/Downloads/intake_*.csv — skipping weekly intake.")
            return
        print(f"Intake file: {csv_in}")
        if run([PY, os.path.join(ROOT, "brb_add_intake.py"), "--csv", csv_in, "--apply"]):
            raise RuntimeError("brb_add_intake failed")
        archive(csv_in)
    step(1, "WEEKLY INTAKE", intake)

    # 2 — data-fix export from the site (optional input)
    def datafix():
        js = newest("data-fixes*.json")
        if not js:
            print("No ~/Downloads/data-fixes*.json — skipping Data Fix export.")
            return
        print(f"Export: {js}")
        if run([PY, os.path.join(ROOT, "brb_apply_fandom_pages.py"), "--flags", js, "--apply"]):
            raise RuntimeError("brb_apply_fandom_pages failed")
        archive(js)
    step(2, "DATA-FIX EXPORT (apply Fandom links)", datafix)

    # Enrichment runs most-authoritative first so later non-destructive fills
    # can't degrade a better source: user links (above) -> GCD catalog -> Fandom.

    # 3 — fill from the local GCD database (authoritative catalog, blanks + union)
    def gcd_fill():
        if not os.path.exists(os.path.join(ROOT, "gcd_local.sqlite")):
            print("No gcd_local.sqlite — skipping GCD fill.")
            return
        # --no-conflicts: in an unattended run, only FILL blanks and UNION names —
        # never silently overwrite an existing credit GCD merely disagrees with
        # (those are logged to credits_gcd_changes.csv for a manual review pass).
        if run([PY, os.path.join(ROOT, "brb_credits_gcd.py"), "--no-conflicts"]):
            raise RuntimeError("brb_credits_gcd failed")
    step(3, "GCD FILL (authoritative catalog — blanks + union)", gcd_fill)

    # 4 — Fandom fills what GCD couldn't reach (not-in-GCD books) + unions
    def fandom_fill():
        if run([PY, os.path.join(ROOT, "brb_fill_from_fandom.py"), "--no-deploy"]):
            raise RuntimeError("brb_fill_from_fandom failed")
    step(4, "FANDOM FILL (gap-filler for books GCD can't reach)", fandom_fill)

    # 5 — Publication Date from local GCD (offline, blanks only)
    def date_gcd():
        if not os.path.exists(os.path.join(ROOT, "gcd_local.sqlite")):
            print("No gcd_local.sqlite — skipping GCD date fill.")
            return
        if run([PY, os.path.join(ROOT, "brb_pubdate_fill.py")]):
            raise RuntimeError("brb_pubdate_fill failed")
    step(5, "DATE FILL — GCD (offline)", date_gcd)

    # 6 — Publication Date fallback from Comic Vine (needs COMIC_VINE_API_KEY)
    def date_cv():
        if not os.environ.get("COMIC_VINE_API_KEY"):
            print("No COMIC_VINE_API_KEY — skipping Comic Vine date fallback.")
            return
        if run([PY, os.path.join(ROOT, "brb_pubdate_cv.py")]):
            raise RuntimeError("brb_pubdate_cv failed")
    step(6, "DATE FILL — Comic Vine fallback", date_cv)

    # 7 — fix Year from the (now-filled) on-sale date, clearing date-conflicts.
    # Runs AFTER the date fills so it uses the freshest Publication Date. The tool
    # only pulls Year back to an OLDER on-sale date (the intake-stamp slip); a
    # newer on-sale date past 5y is held for review, never applied.
    def year_fix():
        if run([PY, os.path.join(ROOT, "brb_year_from_pubdate.py"), "--apply"]):
            raise RuntimeError("brb_year_from_pubdate failed")
    step(7, "YEAR FROM ON-SALE DATE (clear date-conflicts)", year_fix)

    # 7b — apply comic-edit exports from the site's Edit Comic page (optional)
    def edit_review():
        if not (glob.glob(os.path.join(DOWNLOADS, "comic_edit_*.json")) or
                glob.glob(os.path.join(ROOT, "comic_edit_*.json"))):
            print("No comic_edit_*.json — skipping Edit Comic review.")
            return
        if run([PY, os.path.join(ROOT, "brb_review_edits.py"), "--apply"]):
            raise RuntimeError("brb_review_edits failed")
    step("7b", "EDIT COMIC REVIEW (apply site edits/deletions)", edit_review)

    # 8 — regenerate + deploy, once
    banner(8, "DEPLOY (brb.py: validate -> regen -> commit -> push)")
    rc = run([PY, os.path.join(ROOT, "brb.py"), "--commit", "brb_all: full enrichment pipeline", "--yes"])

    print("\n" + "=" * 68)
    if failures:
        print(f"  DONE with {len(failures)} step error(s) — deploy still ran:")
        for n, title, why in failures:
            print(f"    STEP {n} {title}: {why}")
    else:
        print("  DONE — all steps clean.")
    print("=" * 68)
    sys.exit(rc)


if __name__ == "__main__":
    main()
