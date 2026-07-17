#!/usr/bin/env python3
"""
brb_move_dupes_to_tab.py — NON-DESTRUCTIVE duplicate handling.

Instead of deleting a same-box field-identical double-entry, record it on the
'Duplicates' tab and log the action on the 'Data Integrity Log' tab, leaving the
one surviving copy in Clean Inventory. Preserves provenance — nothing is lost.

Reads a CSV of the removed/duplicate rows (Title,Issue,Year,Box,Raw Value,Note)
and appends them. Writes a NEW file; never edits the source in place.

Usage:
    python3 brb_move_dupes_to_tab.py <xlsx> --dupes dupes.csv --action "..." --out <file>
"""
import argparse, csv, datetime, os
import openpyxl


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("xlsx")
    ap.add_argument("--dupes", required=True)
    ap.add_argument("--action", required=True, help="short action label for the integrity log")
    ap.add_argument("--out", required=True)
    args = ap.parse_args()

    with open(args.dupes) as f:
        dupes = list(csv.DictReader(f))
    wb = openpyxl.load_workbook(args.xlsx)

    dws = wb["Duplicates"]
    # find current last data row
    start = dws.max_row
    for d in dupes:
        dws.append([d["Box"], d["Title"], f"#{d['Issue']} [DUPLICATE]", d["Year"],
                    d.get("Raw Value", ""), "$1 (freebie/giveaway)", d.get("Note", "double-entry — consolidated")])
    print(f"Duplicates tab: appended {len(dupes)} rows (was {start} rows)")

    log = wb["📝 Data Integrity Log"]
    stamp = datetime.datetime.now().strftime("%d%m_%H%M")
    log.append([stamp, args.action,
                f"{len(dupes)} field-identical same-box double-entries moved from Clean Inventory to "
                f"Duplicates tab (one surviving copy retained per book). No data deleted."])
    print(f"Integrity Log: appended 1 entry at {stamp}")

    wb.save(args.out)
    print(f"Written: {args.out}")


if __name__ == "__main__":
    main()
