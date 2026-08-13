#!/usr/bin/env python3
"""brb_vision_characters.py — visually verify comic-cover characters with Claude vision.

Replaces the title-text-guessed `Inferred Character` with what's ACTUALLY drawn on
the cover. Robust, resumable, cost-aware:
  * pandas-loads the xlsx; processes rows with a valid Cover URL
  * streams each image (retries + timeout; a dead URL never stops the run)
  * downscales to <=800px long edge + JPEG -> ~4x fewer image tokens, same recognizability
  * one cached system prompt (character-ID instruction) -> cheaper per call
  * concurrent workers with exponential backoff on 429/529 rate limits
  * writes `Visually Verified Characters`; Confidence -> 🟢 identified / 🔴 Unknown|failed
  * checkpoints to <out>.partial.csv every --save-every rows; on restart it SKIPS
    rows already in that checkpoint (true resume — a crash costs nothing already spent)

The API key is read from ANTHROPIC_API_KEY in the environment — this script never
takes it as an argument and never logs it. You run it; I never handle the key.

Run:
    export ANTHROPIC_API_KEY=sk-ant-...
    python3 brb_vision_characters.py --in updated_cover_links_with_characters.xlsx \
        --model claude-haiku-4-5-20251001 --limit 25        # batch test first
    # then the full run (drop --limit); re-run the same command to resume after any stop
"""
import argparse, base64, io, os, sys, time, threading
import concurrent.futures as cf

PROMPT = ("Identify the primary comic book characters featured on this cover. "
          "Respond with ONLY a comma-separated list of their standard names — "
          "no sentences, no explanation, no preamble. "
          "If no specific comic book character can be identified (e.g. a real "
          "person, sports, or non-fiction cover), respond with exactly: Unknown")


def clean_answer(resp):
    """The model sometimes ignores 'return only' and writes a paragraph that
    ENDS with the answer (or 'Unknown'). Take the last non-empty line, and treat
    anything containing 'unknown' or still looking like a sentence as Unknown."""
    lines = [l.strip() for l in (resp or "").splitlines() if l.strip()]
    if not lines:
        return "Unknown"
    val = lines[-1].strip().strip(".")
    low = val.lower()
    if "unknown" in low:
        return "Unknown"
    # a real answer is a short name list; a leftover sentence is prose -> Unknown
    if len(val.split()) > 14 or low.startswith(("this ", "the cover", "i ", "there")):
        return "Unknown"
    return val

_lock = threading.Lock()


def log(*a):
    print(*a, flush=True)


def fetch_image(url, timeout=20, retries=3):
    import urllib.request
    last = None
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 MCI-vision"})
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return r.read()
        except Exception as e:
            last = e; time.sleep(1.5 * (attempt + 1))
    raise last


def to_jpeg(data, max_edge=800):
    from PIL import Image
    im = Image.open(io.BytesIO(data)).convert("RGB")
    w, h = im.size
    s = min(1.0, max_edge / max(w, h))
    if s < 1.0:
        im = im.resize((int(w * s), int(h * s)))
    buf = io.BytesIO(); im.save(buf, format="JPEG", quality=82)
    return buf.getvalue()


def identify(client, model, img_bytes):
    """One vision call with backoff on rate/overload. Returns character string."""
    b64 = base64.standard_b64encode(img_bytes).decode()
    for attempt in range(6):
        try:
            msg = client.messages.create(
                model=model, max_tokens=120,
                system="You identify comic book characters from cover art. Be precise; use standard character names.",
                messages=[{"role": "user", "content": [
                    {"type": "image", "source": {"type": "base64", "media_type": "image/jpeg", "data": b64}},
                    {"type": "text", "text": PROMPT},
                ]}],
            )
            return "".join(b.text for b in msg.content if b.type == "text").strip()
        except Exception as e:
            code = getattr(e, "status_code", None)
            if code in (429, 529, 500, 503) or "overloaded" in str(e).lower():
                time.sleep(min(60, 2 ** attempt)); continue
            raise
    raise RuntimeError("rate-limit backoff exhausted")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--in", dest="inp", default=None,
                    help="input .xlsx or .csv with a cover-URL column; "
                         "defaults to vision_workqueue.csv, then newest cover_links_*.xlsx")
    ap.add_argument("--out", default=None, help="output xlsx (default: <in>_visual.xlsx)")
    ap.add_argument("--model", default="claude-haiku-4-5-20251001")
    ap.add_argument("--workers", type=int, default=6)
    ap.add_argument("--save-every", type=int, default=50)
    ap.add_argument("--limit", type=int, default=0, help="process only N rows (batch test)")
    ap.add_argument("--url-col", default=None)
    args = ap.parse_args()

    if not os.getenv("ANTHROPIC_API_KEY"):
        log("ERROR: set ANTHROPIC_API_KEY in the environment first."); sys.exit(2)
    try:
        import pandas as pd
        import anthropic
    except ImportError as e:
        log(f"ERROR: missing lib ({e}). Run: pip3 install anthropic pandas openpyxl Pillow"); sys.exit(2)

    # Resolve input: explicit --in, else the preflight workqueue, else newest cover_links.
    import glob as _glob
    inp = args.inp
    if not inp:
        if os.path.exists("vision_workqueue.csv"):
            inp = "vision_workqueue.csv"
        else:
            cands = _glob.glob("cover_links_*.xlsx")
            inp = max(cands, key=os.path.getmtime) if cands else None
    if not inp or not os.path.exists(inp):
        log("ERROR: no input found. Pass --in <file.xlsx|csv> or run brb_vision_preflight.py first."); sys.exit(2)

    out = args.out or (os.path.splitext(os.path.basename(inp))[0] + "_visual.xlsx")
    ckpt = out + ".partial.csv"
    df = pd.read_csv(inp) if inp.lower().endswith(".csv") else pd.read_excel(inp)
    args.inp = inp
    url_col = args.url_col or next((c for c in df.columns if "url" in c.lower() and "large" not in c.lower()), None)
    if not url_col:
        log(f"ERROR: no Cover URL column found in {list(df.columns)}"); sys.exit(2)
    if "Visually Verified Characters" not in df.columns:
        df["Visually Verified Characters"] = ""
    if "Confidence" not in df.columns:
        df["Confidence"] = ""

    # resume: load any checkpoint, seed df, and skip those rows
    done = {}
    if os.path.exists(ckpt):
        prev = pd.read_csv(ckpt)
        for _, r in prev.iterrows():
            chars = str(r["chars"])
            if chars.startswith("ERROR"):
                continue   # failed rows are NOT done — retry them on re-run
            done[int(r["row"])] = (chars, str(r["conf"]))
        for i, (chars, conf) in done.items():
            if i in df.index:
                df.at[i, "Visually Verified Characters"] = chars
                df.at[i, "Confidence"] = conf
        log(f"resume: {len(done)} rows already done (from {ckpt})")

    todo = [i for i in df.index
            if isinstance(df.at[i, url_col], str) and df.at[i, url_col].startswith("http") and i not in done]
    if args.limit:
        todo = todo[:args.limit]
    log(f"input: {args.inp}  url col: {url_col}  to process: {len(todo)}  model: {args.model}")

    client = anthropic.Anthropic()
    ckpt_f = open(ckpt, "a", newline="")
    import csv as _csv
    ck = _csv.writer(ckpt_f)
    if os.path.getsize(ckpt) == 0:
        ck.writerow(["row", "chars", "conf"])

    counts = {"ok": 0, "unknown": 0, "fail": 0}
    processed = 0

    def work(i):
        url = df.at[i, url_col]
        try:
            img = to_jpeg(fetch_image(url))
            chars = clean_answer(identify(client, args.model, img))
            if not chars or chars.strip().lower() == "unknown":
                return i, "Unknown", "🔴", "unknown"
            return i, chars, "🟢", "ok"
        except Exception as e:
            return i, f"ERROR: {type(e).__name__}: {str(e)[:160]}", "🔴", "fail"

    with cf.ThreadPoolExecutor(max_workers=args.workers) as ex:
        for i, chars, conf, kind in ex.map(work, todo):
            df.at[i, "Visually Verified Characters"] = chars
            df.at[i, "Confidence"] = conf
            counts[kind] += 1
            processed += 1
            with _lock:
                ck.writerow([i, chars, conf]); ckpt_f.flush()
            if processed % args.save_every == 0:
                df.to_excel(out, index=False)
                log(f"  [{processed}/{len(todo)}] saved -> {out}  ok={counts['ok']} unknown={counts['unknown']} fail={counts['fail']}")

    df.to_excel(out, index=False)
    ckpt_f.close()
    log(f"\nDONE. {processed} processed  ok={counts['ok']} unknown={counts['unknown']} fail={counts['fail']}")
    log(f"Output: {out}  (checkpoint kept at {ckpt} for resume; delete it to start fresh)")


if __name__ == "__main__":
    main()
