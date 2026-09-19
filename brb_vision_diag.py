#!/usr/bin/env python3
"""One-shot vision diagnostic: fetch one cover, call the API, print the FULL error.
Run: python3 brb_vision_diag.py   (needs ANTHROPIC_API_KEY in env)"""
import base64, io, os, sys, urllib.request
URL = "https://comicvine.gamespot.com/a/uploads/scale_medium/6/67663/6713276-01.jpg"
MODEL = os.getenv("VISION_MODEL", "claude-haiku-4-5-20251001")

if not os.getenv("ANTHROPIC_API_KEY"):
    print("set ANTHROPIC_API_KEY first"); sys.exit(2)
import anthropic
from PIL import Image

data = urllib.request.urlopen(urllib.request.Request(URL, headers={"User-Agent": "Mozilla/5.0"}), timeout=20).read()
im = Image.open(io.BytesIO(data)).convert("RGB")
w, h = im.size
s = min(1.0, 800 / max(w, h))
im = im.resize((int(w * s), int(h * s)))
buf = io.BytesIO(); im.save(buf, format="JPEG", quality=82)
b64 = base64.standard_b64encode(buf.getvalue()).decode()
print(f"model={MODEL}  image {w}x{h} -> {im.size}  jpeg {len(buf.getvalue())} bytes  b64 {len(b64)} chars")

client = anthropic.Anthropic()
try:
    msg = client.messages.create(
        model=MODEL, max_tokens=120,
        messages=[{"role": "user", "content": [
            {"type": "image", "source": {"type": "base64", "media_type": "image/jpeg", "data": b64}},
            {"type": "text", "text": "Identify the primary comic book characters featured on this cover. Return only a comma-separated list of their standard names. If no specific character can be identified, return 'Unknown'."},
        ]}],
    )
    print("SUCCESS:", "".join(b.text for b in msg.content if b.type == "text").strip())
except Exception as e:
    print("FULL ERROR TYPE:", type(e).__name__)
    print("FULL ERROR MSG :", str(e))
