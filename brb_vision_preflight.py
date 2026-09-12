#!/usr/bin/env python3
"""brb_vision_preflight.py — KEYLESS de-risking pass before spending any Vision $$.
Validates every Cover URL (concurrent liveness check), measures each image's real
pixel size to model Claude image-token cost, and writes:
  - vision_workqueue.csv  : live URLs to process (title, issue, url, px, est_tokens)
  - vision_deadlinks.csv  : dead/broken/timed-out URLs (skip these, saves $$)
Cost is modeled for both a cheap and a strong model so you can pick.

Usage:  python3 brb_vision_preflight.py [path.xlsx]   (defaults to newest cover_links_*.xlsx)
"""
import sys, glob, os, csv, io, concurrent.futures as cf, urllib.request

MAX_EDGE = 800          # we downscale to this long edge before sending -> cost model uses it
TIMEOUT = 15
WORKERS = 24


def find_input():
    if len(sys.argv) > 1:
        return sys.argv[1]
    for pat in ("updated_cover_links_with_characters.xlsx", "cover_links_*.xlsx"):
        m = glob.glob(pat) + glob.glob(os.path.join("/Users/robertmarshall/Downloads", pat))
        if m:
            return max(m, key=os.path.getmtime)
    return None


def load_rows(path):
    import openpyxl
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    ws = wb.active
    rows = list(ws.iter_rows(values_only=True))
    H = list(rows[0]); idx = {str(n).strip().lower(): i for i, n in enumerate(H) if n}
    ui = idx.get("cover url") or next((i for n, i in idx.items() if "url" in n and "large" not in n), None)
    ti = idx.get("title", 0); ii = idx.get("issue", 1)
    out = []
    for r in rows[1:]:
        u = r[ui] if ui is not None else None
        if u and str(u).startswith("http"):
            out.append((str(r[ti]), str(r[ii]), str(u)))
    return out


def est_tokens(w, h):
    # Claude image tokens ~ (w*h)/750 after fitting inside MAX_EDGE on the long side.
    if not w or not h:
        return 550
    scale = min(1.0, MAX_EDGE / max(w, h))
    return int((w * scale) * (h * scale) / 750)


def check(row):
    title, issue, url = row
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 MCI-preflight"})
        with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
            data = r.read(200000)  # enough for header dims
        w = h = 0
        try:
            from PIL import Image
            im = Image.open(io.BytesIO(data)); w, h = im.size
        except Exception:
            pass
        return (title, issue, url, w, h, est_tokens(w, h), "live")
    except Exception as e:
        return (title, issue, url, 0, 0, 0, f"DEAD:{type(e).__name__}")


def main():
    path = find_input()
    if not path:
        print("NO INPUT FILE FOUND — drop updated_cover_links_with_characters.xlsx in the repo.", flush=True)
        sys.exit(2)
    rows = load_rows(path)
    print(f"input: {os.path.basename(path)}  URLs to check: {len(rows)}", flush=True)

    live, dead, tok_sum = [], [], 0
    done = 0
    with cf.ThreadPoolExecutor(max_workers=WORKERS) as ex:
        for res in ex.map(check, rows):
            done += 1
            if res[6] == "live":
                live.append(res); tok_sum += res[5]
            else:
                dead.append(res)
            if done % 250 == 0:
                print(f"  checked {done}/{len(rows)}  live={len(live)} dead={len(dead)}", flush=True)

    with open("vision_workqueue.csv", "w", newline="") as f:
        w = csv.writer(f); w.writerow(["title", "issue", "url", "px_w", "px_h", "est_img_tokens"])
        for t, i, u, pw, ph, tk, _ in live:
            w.writerow([t, i, u, pw, ph, tk])
    with open("vision_deadlinks.csv", "w", newline="") as f:
        w = csv.writer(f); w.writerow(["title", "issue", "url", "status"])
        for t, i, u, pw, ph, tk, st in dead:
            w.writerow([t, i, u, st])

    n = len(live)
    avg = tok_sum / n if n else 0
    # token totals: image + ~90 cached system/prompt + ~25 output per request
    in_tok = tok_sum + 90 * n
    out_tok = 25 * n
    print(f"\nLIVE: {n}   DEAD: {len(dead)}   avg image tokens: {avg:.0f}", flush=True)
    print(f"est input tokens: {in_tok:,}  output tokens: {out_tok:,}", flush=True)
    print("COST MODEL (per-1M in/out; batch API halves it):", flush=True)
    for name, pin, pout in [("Haiku-class 1.00/5.00", 1.00, 5.00), ("Sonnet-class 3.00/15.00", 3.00, 15.00)]:
        c = in_tok / 1e6 * pin + out_tok / 1e6 * pout
        print(f"  {name:26} sync ~${c:,.2f}   batch ~${c/2:,.2f}", flush=True)
    print("\nwrote vision_workqueue.csv (feed this to brb_vision_characters.py) + vision_deadlinks.csv", flush=True)


if __name__ == "__main__":
    main()
