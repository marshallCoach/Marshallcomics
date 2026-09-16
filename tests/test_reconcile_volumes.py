"""
Tests for brb_reconcile_volumes.py — the deterministic volume auto-numbering.

This is the core that decides "Vol 1/2/3" from Comic Vine's volume_id +
cover_date, with no API calls and no AI. If the chronological ordering is wrong,
the whole confirm/mismatch worklist is wrong.
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import brb_reconcile_volumes as rv


def test_norm_issue_handles_floats_and_hash():
    assert rv.norm_issue("3.0") == "3"
    assert rv.norm_issue(3.0) == "3"
    assert rv.norm_issue("3.5") == "3.5"
    assert rv.norm_issue("#12") == "12"
    assert rv.norm_issue("Annual 1") == "Annual 1"


def test_single_volume_numbers_to_one():
    items = [{"vid": 100, "cdate": "2016-01-01"}, {"vid": 100, "cdate": "2016-05-01"}]
    assert rv.derive_volume_numbers(items) == {100: 1}


def test_two_volumes_ordered_by_earliest_cover_date():
    # vol 6211 started 1998, vol 6496 started 2016 -> 6211=Vol1, 6496=Vol2
    items = [
        {"vid": 6496, "cdate": "2016-06-01"},
        {"vid": 6211, "cdate": "1998-11-01"},
        {"vid": 6496, "cdate": "2017-02-01"},
        {"vid": 6211, "cdate": "1999-01-01"},
    ]
    assert rv.derive_volume_numbers(items) == {6211: 1, 6496: 2}


def test_three_volumes_chronological():
    items = [
        {"vid": "c", "cdate": "2021-01-01"},
        {"vid": "a", "cdate": "2001-01-01"},
        {"vid": "b", "cdate": "2012-01-01"},
    ]
    assert rv.derive_volume_numbers(items) == {"a": 1, "b": 2, "c": 3}


def test_rows_without_volume_id_are_ignored():
    items = [{"vid": None, "cdate": "2001"}, {"vid": 5, "cdate": "2001-01-01"}]
    assert rv.derive_volume_numbers(items) == {5: 1}


def test_missing_cover_date_sorts_last_not_crash():
    items = [{"vid": 1, "cdate": ""}, {"vid": 2, "cdate": "2010-01-01"}]
    # vol 2 has a real date (earlier than the "9999" placeholder) -> Vol 1
    assert rv.derive_volume_numbers(items) == {2: 1, 1: 2}


def test_cover_lookup_tries_multiple_key_forms():
    covers = {"Batman|||1|||1": {"volume_id": 42}, "Robin|||#5": {"volume_id": 7}}
    assert rv.cover_lookup(covers, "Batman", "1", "1")["volume_id"] == 42
    assert rv.cover_lookup(covers, "Robin", "5", "")["volume_id"] == 7
    assert rv.cover_lookup(covers, "Nope", "1", "1") is None
