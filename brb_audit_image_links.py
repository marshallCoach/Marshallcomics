#!/usr/bin/env python3
"""brb_audit_image_links.py — did my direct-image covers actually work?

Two retroactive checks, both read-only:

  A. REACHABILITY — HEAD/GET every source=="manual-link" cover in covers.json and
     report whether the URL still loads as an image. Hotlink-blocked (403) or dead
     (404) links look "saved" but render broken in the app.

  B. SKIPPED PASTES — scan every data-fixes export (Downloads, repo root,
     processed_exports/) for kind=="image" records, then check covers.json: an
     image you pasted onto a book that ALREADY had a cover was silently dropped
     (brb_apply_fandom_pages only sets an image when the key is empty), so your
     chosen image never took.

    python3 brb_audit_image_links.py
Writes a CSV of the findings next to the script. Egress needed (run on the Mac).
"""
import csv, glob, json, os, ssl, urllib.request
from collections import defaultdict

ROOT = os.path.dirname(os.path.abspath(__file__))
COVERS = os.path.join(ROOT, "covers.json")
if not os.path.exists(COVERS):
    COVERS = os.path.join(ROOT, "artifacts/comics-inventory/public/covers.json")
DOWNLOADS = os.path.expanduser("~/Downloads")
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36"
CTX = ssl.create_default_context()
CTX.check_hostname = False
CTX.verify_mode = ssl.CERT_NONE


def ni(v):
    return str(v if v is not None else "").strip().lstrip("#").replace(".0", "")


def reach(url):
    """(ok, detail). ok=True only on 2xx with an image content-type."""
    for method in ("HEAD", "GET"):
        try:
            req = urllib.request.Request(url, method=method, headers={"User-Agent": UA, "Accept": "image/*,*/*"})
            with urllib.request.urlopen(req, timeout=20, context=CTX) as r:
                ct = r.headers.get("Content-Type", "")
                code = r.getcode()
                if code == 200 and ct.startswith("image"):
                    return True, f"200 {ct}"
                if code == 200:
                    return False, f"200 but {ct or 'no content-type'} (not an image)"
                return False, f"HTTP {code}"
        except urllib.error.HTTPError as e:
            if method == "GET":
                return False, f"HTTP {e.code}"
        except Exception as e:  # noqa: BLE001
            if method == "GET":
                return False, f"{type(e).__name__}: {str(e)[:50]}"
    return False, "unreachable"


def main():
    cov = json.load(open(COVERS))

    # ---- A. reachability of live manual-link covers ----
    manual = [(k, v.get("url", "")) for k, v in cov.items()
              if isinstance(v, dict) and v.get("source") == "manual-link" and v.get("url")]
    print(f"\n=== A. REACHABILITY — {len(manual)} manual-link cover(s) ===")
    rows_a = []
    for k, url in sorted(manual):
        ok, detail = reach(url)
        mark = "OK  " if ok else "DEAD"
        print(f"  [{mark}] {k}  ({detail})")
        rows_a.append([k, url, "ok" if ok else "dead", detail])

    # ---- B. image pastes that were skipped (cover already existed) ----
    paths = set()
    for d in (DOWNLOADS, ROOT, os.path.join(ROOT, "processed_exports")):
        paths |= set(glob.glob(os.path.join(d, "data-fixes*.json")))
        paths |= set(glob.glob(os.path.join(d, "*_data-fixes*.json")))
    # title|||issue -> list of (url, source) present in covers.json
    by_ti = defaultdict(list)
    for k, v in cov.items():
        if not isinstance(v, dict) or not v.get("url"):
            continue
        p = k.split("|||")
        if len(p) >= 2:
            by_ti[f"{p[0]}|||{ni(p[1])}"].append((v.get("url"), v.get("source")))

    seen, rows_b = set(), []
    for p in sorted(paths):
        try:
            recs = json.load(open(p))
        except Exception:  # noqa: BLE001
            continue
        for rec in (recs if isinstance(recs, list) else []):
            if not isinstance(rec, dict) or rec.get("kind") != "image":
                continue
            url = (rec.get("value") or "").strip()
            title = str(rec.get("title", "")).strip()
            issue = ni(rec.get("issue"))
            kk = (title.lower(), issue, url)
            if kk in seen:
                continue
            seen.add(kk)
            present = by_ti.get(f"{title}|||{issue}", [])
            urls = [u for u, _ in present]
            if url in urls:
                status = "applied"
            elif present:
                status = "SKIPPED — a different cover already won: " + str(present[0][1])
            else:
                status = "not applied — no cover for this book"
            rows_b.append([title, issue, url, status])

    print(f"\n=== B. IMAGE PASTES vs covers.json — {len(rows_b)} paste(s) across history ===")
    for t, i, url, status in rows_b:
        tag = "OK " if status == "applied" else "!! "
        print(f"  [{tag}] {t} #{i}: {status}")

    out = os.path.join(ROOT, "image_links_audit.csv")
    with open(out, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["Section", "Key/Title", "Issue/URL", "Status", "Detail"])
        for k, url, st, detail in rows_a:
            w.writerow(["reachability", k, url, st, detail])
        for t, i, url, status in rows_b:
            w.writerow(["skipped-check", t, i, url, status])
    dead = sum(1 for r in rows_a if r[2] == "dead")
    skipped = sum(1 for r in rows_b if r[3].startswith("SKIPPED"))
    print(f"\nSUMMARY: {dead}/{len(rows_a)} manual-link covers DEAD · "
          f"{skipped}/{len(rows_b)} image pastes SKIPPED (cover pre-existed)")
    print(f"Wrote: {os.path.basename(out)}")


if __name__ == "__main__":
    main()
