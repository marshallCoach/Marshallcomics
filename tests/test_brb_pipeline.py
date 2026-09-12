"""
Tests for the brb.py pipeline conductor's safety gate.

The gate decides whether a validator run is allowed to proceed to a reingest.
Getting it wrong in either direction is costly: too strict blocks legit work,
too loose lets a structurally-broken file overwrite data3.ts. These lock the
classification down.

Run:  python -m pytest tests/ -v
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import brb


def _validator_output(check_results):
    """Build a synthetic brb_validate.py-style output.
    check_results: list of (check_label, passed_bool)."""
    blocks = []
    for label, passed in check_results:
        mark = "✓" if passed else "✗"
        blocks.append(f"CHECK X — {label}\n  {mark}  {label} result line")
    return "\n".join(blocks) + "\nRESULT: N of M CHECKS FAILED"


def test_structural_failure_is_hard_stop():
    out = _validator_output([("Required columns present", False)])
    hard, soft = brb.parse_validator(out)
    assert any("Required columns" in h for h in hard)
    assert not soft


def test_blank_title_and_box_are_hard_stops():
    out = _validator_output([("Blank Title fields", False), ("Blank Box # fields", False)])
    hard, soft = brb.parse_validator(out)
    assert len(hard) == 2
    assert not soft


def test_dupes_and_clones_are_soft_not_blocking():
    out = _validator_output([
        ("Same-box duplicates (Title + Issue # + Year + Box #)", False),
        ("Exact clones (normalized)", False),
        ("Box capacity (default 240)", False),
    ])
    hard, soft = brb.parse_validator(out)
    assert not hard, f"accepted checks wrongly hard-stopped: {hard}"
    assert len(soft) == 3


def test_mixed_hard_and_soft():
    out = _validator_output([
        ("Required columns present", False),   # hard
        ("Same-box duplicates", False),         # soft
        ("Issue # blank rate", False),          # hard
    ])
    hard, soft = brb.parse_validator(out)
    assert any("Required columns" in h for h in hard)
    assert any("Issue # blank rate" in h for h in hard)
    assert any("Same-box duplicates" in s for s in soft)


def test_all_passing_yields_nothing():
    out = _validator_output([
        ("Required columns present", True),
        ("Same-box duplicates", True),
    ])
    hard, soft = brb.parse_validator(out)
    assert not hard and not soft


def test_real_validator_output_classifies_cleanly(tmp_path):
    """A realistic run where only accepted checks fail must NOT hard-stop."""
    out = """
CHECK 1 — Required columns present
  ✓  All 6 required columns present
CHECK 3 — Blank Title fields
  ✓  No blank Title fields
CHECK 5 — Box capacity (default 240; exceptions: ...)
  ✗  7 boxes over capacity:
CHECK 6 — Same-box duplicates (Title + Issue # + Year + Box #)
  ✗  95 same-box duplicate groups / 103 excess rows
CHECK 9 — Box # values are positive integers (or known status strings)
  ✓  All Box # values are valid
CHECK 10 — Issue # blank rate
  ✓  0 rows have blank Issue #
CHECK 11 — Exact clones (Title+Issue#+Year+Condition+Signed?+Box#, normalized)
  ✗  78 exact-clone groups / 80 excess rows
RESULT: 3 of 12 CHECKS FAILED
"""
    hard, soft = brb.parse_validator(out)
    assert not hard, f"real accepted-only failures must not hard-stop, got {hard}"
    assert len(soft) == 3  # capacity, same-box dupes, exact clones
