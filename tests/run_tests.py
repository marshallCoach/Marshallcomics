#!/usr/bin/env python3
"""Regression tests for the brb_* pipeline — every bug we've hit gets a test here.

    python3 tests/run_tests.py          (standard library only; takes a few seconds)

Each test copies the scripts into a throw-away folder with its own fake HOME
(~/Downloads), builds a tiny workbook, runs the real script, and checks the result.
Nothing touches your real inventory, covers or Downloads.
"""
import glob, json, os, shutil, subprocess, sys, tempfile, time, unittest, warnings
warnings.simplefilter("ignore", ResourceWarning)

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, REPO)
INV = "✅ Clean Inventory"


class Sandbox:
    def __init__(self):
        self.dir = tempfile.mkdtemp(prefix="brbtest_")
        for f in glob.glob(os.path.join(REPO, "brb_*.py")):
            shutil.copy(f, self.dir)
        for d in ("attached_assets", "home/Downloads", "artifacts/comics-inventory/public"):
            os.makedirs(os.path.join(self.dir, d), exist_ok=True)

    def p(self, *a):
        return os.path.join(self.dir, *a)

    def xlsx(self, header, rows, name="comics_inventory_0111_1200.xlsx"):
        import openpyxl
        wb = openpyxl.Workbook(); ws = wb.active; ws.title = INV
        ws.append(header)
        for r in rows:
            ws.append(r)
        wb.save(self.p("attached_assets", name))

    def newest(self):
        import openpyxl
        from brb_apply_arcs import _fn_key
        f = max(glob.glob(self.p("attached_assets", "comics_inventory_*.xlsx")), key=_fn_key)
        ws = openpyxl.load_workbook(f).active
        H = [c.value for c in ws[1]]
        return [dict(zip(H, [c.value for c in r])) for r in ws.iter_rows(min_row=2)]

    def json(self, rel, obj):
        json.dump(obj, open(self.p(rel), "w"))
        time.sleep(0.05)

    def run(self, script, *args, env=None):
        e = dict(os.environ, HOME=self.p("home"))
        e.pop("BRB_FORCE", None)
        e.update(env or {})
        return subprocess.run([sys.executable, script, *args], cwd=self.dir, env=e,
                              capture_output=True, text=True, timeout=120)

    def close(self):
        shutil.rmtree(self.dir, ignore_errors=True)


class T(unittest.TestCase):
    def setUp(self):
        self.sb = Sandbox()

    def tearDown(self):
        self.sb.close()

    # ── flagged covers ────────────────────────────────────────────────────────
    def test_guard_blocks_mass_cover_clear(self):
        sb = self.sb
        sb.json("covers.json", {f"T{i}|||1": {"url": "u"} for i in range(150)})
        sb.json("home/Downloads/flagged-covers-x.json", [{"Title": f"T{i}", "Issue": "1", "kind": "incorrect"} for i in range(150)])
        r = sb.run("brb_fix_flagged_covers.py", "--flags", sb.p("home/Downloads/flagged-covers-x.json"), "--apply")
        self.assertEqual(r.returncode, 3, r.stdout)
        self.assertEqual(len(json.load(open(sb.p("covers.json")))), 150, "nothing may be cleared over the limit")
        r = sb.run("brb_fix_flagged_covers.py", "--flags", sb.p("home/Downloads/flagged-covers-x.json"), "--apply", env={"BRB_FORCE": "1"})
        self.assertEqual(r.returncode, 0, r.stdout)
        self.assertEqual(len(json.load(open(sb.p("covers.json")))), 0)

    def test_brb_all_mode_ignores_old_backlog(self):
        sb = self.sb
        sb.json("covers.json", {"A|||1": {"url": "u"}, "B|||1": {"url": "u"}})
        sb.json("home/Downloads/flagged-covers-old.json", [{"Title": "A", "Issue": "1"}])
        r = sb.run("brb_fix_flagged_covers.py", "--apply", "--quiet")
        self.assertIn("marker set", r.stdout)
        self.assertIn("A|||1", json.load(open(sb.p("covers.json"))), "first automatic run must not apply the backlog")
        time.sleep(1.1)
        sb.json("home/Downloads/flagged-covers-new.json", [{"Title": "B", "Issue": "1"}])
        sb.run("brb_fix_flagged_covers.py", "--apply", "--quiet")
        cov = json.load(open(sb.p("covers.json")))
        self.assertNotIn("B|||1", cov); self.assertIn("A|||1", cov)

    def test_flag_keeps_cover_you_supplied_since(self):
        sb = self.sb
        sb.json("covers.json", {"A|||1|||1": {"url": "u", "source": "manual-link"}, "C|||1": {"url": "u"}})
        sb.json("home/Downloads/flagged-covers-1.json", [{"Title": "A", "Issue": "1"}, {"Title": "C", "Issue": "1"}])
        sb.run("brb_fix_flagged_covers.py", "--flags", sb.p("home/Downloads/flagged-covers-1.json"), "--apply")
        cov = json.load(open(sb.p("covers.json")))
        self.assertIn("A|||1|||1", cov); self.assertNotIn("C|||1", cov)

    # ── data-fix link precedence ──────────────────────────────────────────────
    def test_link_precedence_is_stable(self):
        sb = self.sb
        sb.xlsx(["Title", "Issue #", "Box #", "Volume", "Year", "Publisher", "Publication Date"],
                [["Moon Knight", 2, "9", 2, 2021, "Marvel", None]])
        rec = lambda v: [{"title": "Moon Knight", "issue": "2", "box": "9", "problem": "x", "kind": "fandom", "value": v}]
        sb.json("home/Downloads/data-fixes-autolink-1.json", rec("https://marvel.fandom.com/wiki/Moon_Knight_Vol_9_2"))
        time.sleep(1.1)
        sb.json("home/Downloads/data-fixes-extrapolated-auto-1.json", rec("https://marvel.fandom.com/wiki/Moon_Knight_Vol_2_2"))
        sb.run("brb_apply_data_fixes.py", "--apply")
        self.assertEqual(str(sb.newest()[0]["Volume"]), "9", "year-verified autolink beats extrapolated")
        r = sb.run("brb_apply_data_fixes.py", "--apply")
        self.assertIn("CHANGED 0", r.stdout, "second run must change nothing")

    def test_your_link_beats_autolink(self):
        sb = self.sb
        sb.xlsx(["Title", "Issue #", "Box #", "Volume", "Year", "Publisher", "Publication Date"],
                [["Foo", 1, "5", 1, 2020, "Marvel", None]])
        rec = lambda v: [{"title": "Foo", "issue": "1", "box": "5", "problem": "x", "kind": "fandom", "value": v}]
        sb.json("home/Downloads/data-fixes-2026-11-01.json", rec("https://marvel.fandom.com/wiki/Foo_Vol_3_1"))
        time.sleep(1.1)
        sb.json("home/Downloads/data-fixes-autolink-1.json", rec("https://marvel.fandom.com/wiki/Foo_Vol_2_1"))
        sb.run("brb_apply_data_fixes.py", "--apply")
        self.assertEqual(str(sb.newest()[0]["Volume"]), "3")

    # ── arcs ──────────────────────────────────────────────────────────────────
    ARC_H = ["Title", "Issue #", "Volume", "Year", "Box #", "Story Arc", "Arc Part", "Arc Length",
             "Finale Issue #", "Crossover Event (Fandom)", "Arc Confidence", "Arc Source"]
    CSV_H = "title,sheet_volume,issue,year,Story Arc,Arc Part,Arc Length,Finale Issue #,Crossover Event (Fandom),Arc Confidence,Arc Source\n"

    def test_fill_only_never_overwrites_or_clears(self):
        sb = self.sb
        sb.xlsx(self.ARC_H, [["Foo", 1, 1, 2020, "5", "Fandom Arc", 1, 6, 6, "Evt", "Stated", "fandom-url"]])
        open(sb.p("x.csv"), "w").write(self.CSV_H + 'Foo,1,1,2020,"""Foo"" Other Arc",,,,,,\nFoo,1,1,2020,Fandom Arc,,,,,,\n')
        sb.run("brb_apply_arcs.py", "--csv", "x.csv", "--fill-only", "--apply")
        row = sb.newest()[0]
        self.assertEqual(row["Story Arc"], "Fandom Arc")
        self.assertEqual(str(row["Arc Length"]), "6", "a blank CSV cell must never clear a cell")
        self.assertEqual(row["Arc Source"], "fandom-url")

    def test_length_csv_does_not_wipe_conflict_list(self):
        sb = self.sb
        sb.xlsx(self.ARC_H, [["Foo", 1, 1, 2020, "5", "A", 1, None, None, None, "Stated", "u"]])
        sb.json("artifacts/comics-inventory/public/arc_conflicts.json", [{"id": "keep-me"}])
        open(sb.p("arc_lengths.csv"), "w").write(self.CSV_H + "Foo,1,1,2020,A,1,3,3,,,\n")
        sb.run("brb_apply_arcs.py", "--csv", "arc_lengths.csv", "--fill-only")
        self.assertEqual(json.load(open(sb.p("artifacts/comics-inventory/public/arc_conflicts.json"))), [{"id": "keep-me"}])

    def test_comic_vine_prefix_stripped(self):
        from brb_apply_arcs import clean_arc, same_arc
        self.assertEqual(clean_arc('"Amazing X-Men" The Once and Future Juggernaut'), "The Once and Future Juggernaut")
        self.assertTrue(same_arc('"Avengers" Original Sin', "Original Sin"))

    def test_rollback_really_clears_cells(self):
        sb = self.sb
        sb.xlsx(self.ARC_H, [["Bar", 55, 1, 2022, "6", "Kang Dynasty", None, None, None, None, "Stated", "cv"]])
        open(sb.p("cv_arcs.csv"), "w").write(self.CSV_H + "Bar,1,55,2022,Kang Dynasty,,,,,Stated,cv\n")
        open(sb.p("arc_extracted.csv"), "w").write(self.CSV_H)
        sb.run("brb_cv_rollback.py", "--apply")
        row = sb.newest()[0]
        self.assertIsNone(row["Story Arc"], "openpyxl ignores ws.cell(r,c,None) - must assign .value")

    # ── Fandom link formats ───────────────────────────────────────────────────
    def test_fandom_link_formats(self):
        import brb_apply_fandom_pages as A
        self.assertEqual(A.parse_url("https://marvel.fandom.com/wiki/IVX_Vol_1_6")[1:], ("IVX", "1", "6"))
        self.assertEqual(A.parse_url("https://memory-alpha.fandom.com/wiki/Star_Trek,_Issue_1_(2026)")[2], "ISSUE:c:2026")
        self.assertEqual(A.parse_url("https://powerrangers.fandom.com/wiki/Mighty_Morphin_Power_Rangers_(Boom!_Studios)_Issue_101")[1:],
                         ("Mighty Morphin Power Rangers (Boom! Studios)", "ISSUE::", "101"))
        self.assertEqual(A.parse_url("https://dc.fandom.com/wiki/Tales_of_the_Green_Lantern_Corps:_Guy_Gardner_Vol_1_1?file=X.jpg")[1:],
                         ("Tales of the Green Lantern Corps: Guy Gardner", "1", "1"))
        src = open(os.path.join(REPO, "brb_apply_fandom_pages.py")).read()
        self.assertIn('re.search(r"_Issue_|%20Issue%20"', src, "franchise links must reach the fetch filter")

    # ── renames keep covers ───────────────────────────────────────────────────
    def test_rename_carries_covers(self):
        sb = self.sb
        sb.xlsx(["Title", "Issue #"], [["Typo Title", 1]])
        sb.json("title_aliases.json", {"typo title": {"canonical": "Fixed Title", "source": "t"}})
        sb.json("covers.json", {"Typo Title|||#1": {"url": "u"}})
        sb.run("brb_apply_title_aliases.py", "--apply")
        cov = json.load(open(sb.p("covers.json")))
        self.assertIn("Fixed Title|||#1", cov); self.assertIn("Typo Title|||#1", cov)

    # ── performance: big workbook, write step must finish fast ────────────────
    def test_arc_decisions_fast_on_big_workbook(self):
        sb = self.sb
        H = self.ARC_H + [f"Extra {i}" for i in range(40)]
        rows = [[f"T{i % 300}", i, 1, 2020, str(i % 80 + 1), "Arc", 1, None, None, None, "Stated", "u"] + ["x"] * 40 for i in range(11000)]
        sb.xlsx(H, rows)
        sb.json("artifacts/comics-inventory/public/arc_conflicts.json",
                [{"id": "T5|||5|||6", "cv": {"name": "New Arc", "part": "1", "length": "3", "finale": "7", "url": "cv"}}])
        sb.json("home/Downloads/data-fixes-1.json", [{"title": "T5", "issue": "5", "box": "6", "problem": "arc-conflict", "kind": "solution", "value": "use-cv"}])
        t0 = time.time()
        r = sb.run("brb_apply_arc_decisions.py", "--apply")
        self.assertLess(time.time() - t0, 90, "must not hang on an 11k-row workbook")
        self.assertIn("verified", r.stdout, r.stdout + r.stderr)

    def test_no_max_column_inside_loops(self):
        bad = []
        for f in glob.glob(os.path.join(REPO, "brb_*.py")):
            for n, line in enumerate(open(f, encoding="utf-8"), 1):
                if "for c in range(1, ws.max_column" in line and " for r in " in line:
                    bad.append(f"{os.path.basename(f)}:{n}")
        self.assertFalse(bad, "ws.max_column recounts every cell per row - hoist it: " + ", ".join(bad))

    # ── CC boxes are never duplicates ─────────────────────────────────────────
    def test_cc_box_never_flagged_duplicate(self):
        sb = self.sb
        sb.xlsx(["#", "Title", "Issue #", "Volume", "Year", "Box #"],
                [[1, "Bloodhunt: Dracula", 2, 1, 2024, "5"], [2, "Dracula: Bloodhunt", 2, 1, 2024, "CC1"]])
        sb.run("brb_data_suspects.py")
        import csv
        rows = list(csv.DictReader(open(sb.p("data_suspects.csv"))))
        self.assertFalse([r for r in rows if r["box"].startswith("CC") and "Title / Volume" in r["field"]])


if __name__ == "__main__":
    unittest.main(verbosity=2)
