# Pricing Audit Log — wrong-volume / inflated eBay prices

**Where pricing findings live (review these in the future):**
| Artifact | What it is | Regenerated |
|---|---|---|
| `price_gate_review.xlsx` | Machine output: every suppressed price (≥$25 delta) + a "Keys to verify (bimodal)" tab | Each `brb_price_gate.py` run |
| `PRICING_AUDIT_LOG.md` (this file) | Human review log — dated snapshots + decisions | Appended per session |

**Root cause:** `brb_ebay_pricing.py` text-searches eBay by Title+Issue+Year. For reused issue numbers a loose match pulls in an OLDER, more valuable version of the same title → inflated median (same volume-collision bug we fixed in covers). Handled *after* the fetch, not by trusting the raw median.

**Defenses already in the pipeline (verified in code):**
- Year is in the search query (`brb_ebay_pricing.py:97`).
- `brb_ebay_rescore.py` — splits comps into clusters on the NM prior (drops the wrong-book cluster).
- `brb_price_gate.py` — suppresses modern non-key medians ≥3× NM (→ fall back to NM); routes bimodal high-priced KEYS to a "verify" tab instead of trusting them.
- The 154 volume corrections applied 2026-08-13 (`VOLUME_FIX_LOG.md`) improve match accuracy on the next fetch.

**Review workflow (you run the credentialed fetch):**
```bash
source ~/.zshrc                       # EBAY_APP_ID / EBAY_CERT_ID
python3 brb_ebay_pricing.py           # fetch (credentialed — you run this)
python3 brb_price_gate.py --apply     # suppress + write price_gate_review.xlsx
node gen_data.mjs                     # fold into the app
```
Then open `price_gate_review.xlsx`, confirm/override, and note decisions below.

---

## 2026-08-13 — snapshot (read-only audit on canonical `comics_inventory_1308_1843.xlsx`)
- **63** modern non-key medians ≥3× NM → suppressed to NM fallback
- **22** worth review (≥$25 delta) — in `price_gate_review.xlsx`
- **10** KEYS with bimodal/high price → "verify" tab (not auto-changed)

Top suppressions (eBay median → NM fallback):
| Title | Issue | Year | Was | → NM | comps |
|---|---|---|---|---|---|
| Legend Has It | 1 | 2025 | $448 | $20 | 10 |
| Doctor Strange Annual | 1 | 2016 | $158 | $6 | 10 |
| Doctor Strange | 1 | 2017 | $142 | $5 | 9 |
| Avengers Academy | 21 | 2010 | $97 | $8 | 10 |
| Ultimate Spider-Man: Incursion | 5 | 2024 | $90 | $12 | 9 |
| Young Avengers | 1 | 2011 | $75 | $15 | 9 |
| New Avengers | 64 | 2005 | $72 | $8 | 9 |
| Savage Avengers | 30 | 2019 | $70 | $6 | 2 |

Keys to verify (bimodal — human confirm real vs. wrong-volume): Doctor Strange #1 (2018/2019/2023), Wolverine #72 (2008), Batman/Superman: World's Finest #50 (2025), Monstress #1 (2015), Ultimates #1 (2011).

**Decisions:** _(record confirm/override here after review)_
