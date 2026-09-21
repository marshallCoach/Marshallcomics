#!/usr/bin/env python3
"""brb_fix.py — ONE command to apply a Data Fix / Volume Confirm export.

Export flags from the page (they land in ~/Downloads), then just run:

    python3 brb_fix.py

It finds the newest export (even if named "data-fixes-2026-09-20 (1).json"),
copies it into the repo under a clean name, then runs the whole chain:

    mci (before)  →  apply_data_fixes  →  apply_fandom_pages  →  brb.py commit  →  mci (after)

and prints the before/after missing-cover delta. Pass a path to force a
specific file:  python3 brb_fix.py ~/Downloads/whatever.json
"""
import glob, os, re, shutil, subprocess, sys, datetime

ROOT = os.path.dirname(os.path.abspath(__file__))
DOWNLOADS = os.path.expanduser("~/Downloads")
TODAY = datetime.date.today().isoformat()
PY = sys.executable

# Files that are NOT a per-book data-fix export (different pipelines / merged sets).
EXCLUDE = ("combined", "merged", "flagged")


def newest_export(explicit):
    if explicit:
        if not os.path.exists(explicit):
            sys.exit(f"file not found: {explicit}")
        return explicit
    cands = []
    for d in (ROOT, DOWNLOADS):
        for f in glob.glob(os.path.join(d, "data-fixes-*.json")) + glob.glob(os.path.join(d, "volume-confirm-*.json")):
            b = os.path.basename(f).lower()
            if any(x in b for x in EXCLUDE):
                continue
            cands.append(f)
    if not cands:
        sys.exit("no data-fixes-*.json or volume-confirm-*.json found in ~/Downloads or the repo.\n"
                 "Export from the Data Fix / Volume Confirm page first.")
    return max(cands, key=os.path.getmtime)


def mci():
    """Return the current MISSING covers count (or None)."""
    r = subprocess.run([PY, "mci_missing_covers.py"], cwd=ROOT, capture_output=True, text=True)
    m = re.search(r"MISSING covers:\s*(\d+)", r.stdout)
    return int(m.group(1)) if m else None


def step(title, argv):
    print(f"\n{'='*60}\n  {title}\n{'='*60}", flush=True)
    r = subprocess.run(argv, cwd=ROOT)
    if r.returncode != 0:
        print(f"\n✗ step failed: {' '.join(argv)}", flush=True)
        if "brb.py" in argv[1]:
            print("  If this was a push rejection, run:\n"
                  "    git pull --rebase origin main\n"
                  "  then re-run: python3 brb.py --commit \"apply data fixes\" --yes", flush=True)
        sys.exit(r.returncode)


def main():
    src = newest_export(sys.argv[1] if len(sys.argv) > 1 else None)
    # copy into the repo under a clean, space-free name the apply scripts accept
    dst = os.path.join(ROOT, f"data-fixes-{TODAY}.json")
    if os.path.abspath(src) != os.path.abspath(dst):
        shutil.copy(src, dst)
    flags = os.path.basename(dst)
    print(f"USING: {src}\n  → {flags}", flush=True)

    before = mci()
    print(f"MISSING covers (before): {before}", flush=True)

    step("1 · APPLY DATA FIXES (per-issue volumes)", [PY, "brb_apply_data_fixes.py", "--flags", flags, "--apply"])
    step("2 · APPLY FANDOM PAGES (dates / covers / credits)", [PY, "brb_apply_fandom_pages.py", "--flags", flags, "--apply"])
    step("3 · REINGEST + COMMIT + PUSH", [PY, "brb.py", "--commit", f"apply data fixes {TODAY}", "--yes"])

    after = mci()
    delta = (before - after) if (before is not None and after is not None) else None
    print(f"\n{'='*60}\n  RESULT\n{'='*60}")
    print(f"  Flags applied : {flags}")
    print(f"  Missing covers: {before} → {after}" + (f"  ({'-' if delta and delta>0 else '+' if delta else ''}{abs(delta)})" if delta is not None else ""))
    print(f"  Committed + pushed to main.")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()
