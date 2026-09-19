"""
Tests for brb_validate.py duplicate/clone detection and normalization.

These keys MUST stay in lockstep with the Mac-side JS validator (see CLAUDE.md
"Duplicate key"). A silent divergence here is how the same book gets counted
as a dupe in one tool and not the other — a bug this project has actually hit.

Run:  python -m pytest tests/ -v
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pandas as pd
import brb_validate as v


def _df(rows):
    cols = ["Title", "Issue #", "Year", "Box #", "Condition", "Signed?"]
    return pd.DataFrame(rows, columns=cols)


def test_norm_str_trims_and_lowercases():
    s = pd.Series(["  The Flash ", "NAN", "Bob's Comics"])
    out = v._norm_str(s).tolist()
    assert out == ["the flash", "", "bob's comics"]


def test_same_box_duplicate_is_flagged():
    # Two identical Title+Issue+Year+Box rows -> same-box duplicate -> check fails
    df = _df([
        ["Batman", 1, 2016, 5, "NM", "no"],
        ["Batman", 1, 2016, 5, "VF", "no"],  # condition differs but Rule 2 ignores it
    ])
    assert v.check_duplicate_rows(df) is False


def test_same_title_different_box_is_not_same_box_dupe():
    df = _df([
        ["Batman", 1, 2016, 5, "NM", "no"],
        ["Batman", 1, 2016, 6, "NM", "no"],  # different box -> not a same-box dupe
    ])
    assert v.check_duplicate_rows(df) is True


def test_exact_clone_requires_condition_and_signed_match():
    # Same everything incl. condition + signed -> exact clone -> check fails
    clones = _df([
        ["Batman", 1, 2016, 5, "NM", "no"],
        ["Batman", 1, 2016, 5, "NM", "no"],
    ])
    assert v.check_exact_clones(clones) is False

    # Different condition -> genuine distinct copy, NOT a clone -> check passes
    distinct = _df([
        ["Batman", 1, 2016, 5, "NM", "no"],
        ["Batman", 1, 2016, 5, "VF", "no"],
    ])
    assert v.check_exact_clones(distinct) is True


def test_clone_detection_normalizes_whitespace_and_case():
    # "Batman" vs " batman " with differing case/space must still clone-match
    df = _df([
        ["Batman", 1, 2016, 5, "NM", "no"],
        [" batman ", 1, 2016, 5, "nm", "NO"],
    ])
    assert v.check_exact_clones(df) is False


def test_status_box_rows_excluded_from_dupe_check():
    # Rows in an allowlisted status box are not physical dupes
    df = _df([
        ["Batman", 1, 2016, "AT CGC", "NM", "no"],
        ["Batman", 1, 2016, "AT CGC", "NM", "no"],
    ])
    assert v.check_duplicate_rows(df) is True
