#!/usr/bin/env python3
"""Regression tests for the brb_* pipeline — every bug we've hit gets a test here.

    python3 tests/run_tests.py          (standard library only; takes a few seconds)

Each test copies the scripts into a throw-away folder with its own fake HOME
(~/Downloads), builds a tiny workbook, runs the real script, and checks the result.
Nothing touches your real inventory, covers or Downloads.
"""
import csv, glob, json, os, shutil, subprocess, sys, tempfile, time, unittest, warnings
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
        import site
        # Fake HOME keeps tests out of your real ~/Downloads, but on a Mac pip installs
        # openpyxl under ~/Library/Python/... (the "user base", derived from HOME) - so
        # point the child Python at the REAL user base or it can't import openpyxl.
        e = dict(os.environ, HOME=self.p("home"), PYTHONUSERBASE=site.getuserbase())
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

    def test_sibling_built_link_never_changes_volume(self):
        # Nov 20: Data Fix copies one pasted link to the other issues of the run ("auto": true).
        # Those are guesses: cover/data only, never the Volume (like extrapolated-auto files).
        sb = self.sb
        sb.xlsx(["Title", "Issue #", "Box #", "Volume", "Year", "Publisher", "Publication Date"],
                [["Foo", 1, "5", 1, 2020, "Marvel", None], ["Foo", 2, "5", 1, 2020, "Marvel", None]])
        sb.json("home/Downloads/data-fixes-2026-11-20.json", [
            {"title": "Foo", "issue": "1", "box": "5", "problem": "x", "kind": "fandom", "value": "https://marvel.fandom.com/wiki/Foo_Vol_3_1"},
            {"title": "Foo", "issue": "2", "box": "5", "problem": "x", "kind": "fandom", "auto": True, "value": "https://marvel.fandom.com/wiki/Foo_Vol_3_2"}])
        r = sb.run("brb_apply_data_fixes.py", "--apply")
        v = {x["Issue #"]: str(x["Volume"]) for x in sb.newest()}
        self.assertEqual(v[1], "3", r.stdout); self.assertEqual(v[2], "1", "auto link must not change Volume")

    def test_year_pinned_fix_hits_its_own_copy(self):
        # Nov 24: FF #3 from 2013 (Vol 4) and 2018 (Vol 6) both live in box 4. Matching on
        # title+issue+box sent both legacy fixes to the first copy (2013 ended as Vol 6).
        sb = self.sb
        sb.xlsx(["Title", "Issue #", "Box #", "Volume", "Year", "Publisher", "Publication Date"],
                [["Fantastic Four", 3, "4", 8, 2013, "Marvel", None], ["Fantastic Four", 3, "4", 10, 2018, "Marvel", None]])
        u = "https://marvel.fandom.com/wiki/Fantastic_Four_Vol_%s_3"
        sb.json("data-fixes-legacy-fantastic-four-1.json", [
            {"title": "Fantastic Four", "issue": "3", "box": "4", "problem": "legacy-volume", "kind": "fandom", "year": "2013", "vol": "8", "value": u % 4},
            {"title": "Fantastic Four", "issue": "3", "box": "4", "problem": "legacy-volume", "kind": "fandom", "year": "2018", "vol": "10", "value": u % 6}])
        r = sb.run("brb_apply_data_fixes.py", "--apply")
        v = {x["Year"]: str(x["Volume"]) for x in sb.newest()}
        self.assertEqual(v, {2013: "4", 2018: "6"}, r.stdout)
        r = sb.run("brb_apply_data_fixes.py", "--apply")
        self.assertIn("CHANGED 0", r.stdout, "second run must change nothing")

    def test_unpinned_fix_never_guesses_between_eras(self):
        # Nov 24: a link with no year on a box holding the issue from two eras used to land on
        # the first copy. Now it changes nothing; a single-era book still gets fixed.
        sb = self.sb
        sb.xlsx(["Title", "Issue #", "Box #", "Volume", "Year", "Publisher", "Publication Date"],
                [["Thor", 13, "5", 6, 2018, "Marvel", None], ["Thor", 13, "5", 9, 2021, "Marvel", None],
                 ["Thor", 99, "5", 1, 2021, "Marvel", None]])
        u = "https://marvel.fandom.com/wiki/Thor_Vol_6_%s"
        sb.json("data-fixes-relink-1.json", [
            {"title": "Thor", "issue": "13", "box": "5", "problem": "relink", "kind": "fandom", "value": u % 13},
            {"title": "Thor", "issue": "99", "box": "5", "problem": "relink", "kind": "fandom", "value": u % 99}])
        r = sb.run("brb_apply_data_fixes.py", "--apply")
        v = {(x["Issue #"], x["Year"]): str(x["Volume"]) for x in sb.newest()}
        self.assertEqual(v, {(13, 2018): "6", (13, 2021): "9", (99, 2021): "6"}, r.stdout)
        self.assertIn("skipped_unpinned_several_eras", r.stdout)

    def test_relink_matches_the_copy_year(self):
        # Nov 24: archived links were keyed title+issue+box, newest wins, so one era's link was
        # re-sent for every copy in the box. Now each copy gets its own year's link, pinned.
        sb = self.sb
        sb.xlsx(["Title", "Issue #", "Year", "Volume", "Box #", "Publication Date", "Writer(s)", "Artist(s)", "Cover Artist"],
                [["Fantastic Four", 3, 2013, 4, "4", "2013-01-00", "W", "A", "C"],
                 ["Fantastic Four", 3, 2018, 6, "4", "2018-11-00", "W", "A", "C"]])
        sb.json("covers.json", {})
        os.makedirs(sb.p("processed_exports"), exist_ok=True)
        u = "https://marvel.fandom.com/wiki/Fantastic_Four_Vol_%s_3"
        rec = lambda y, v: {"title": "Fantastic Four", "issue": "3", "box": "4", "problem": "legacy-volume", "kind": "fandom", "year": y, "value": u % v}
        sb.json("processed_exports/20261124_data-fixes-legacy-ff.json", [rec("2013", 4), rec("2018", 6)])
        sb.run("brb_relink.py", "--write")
        out = json.load(open(glob.glob(sb.p("data-fixes-relink-*.json"))[0]))
        self.assertEqual(sorted((x["year"], x["value"]) for x in out), [("2013", u % 4), ("2018", u % 6)])

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

    def test_cover_found_on_any_wiki_layout(self):
        import brb_apply_fandom_pages as A
        cases = {
            "| Image1_Artist1 = Someone\n| Image1 = Batman Vol 1 1.jpg\n": "Batman Vol 1 1.jpg",   # Marvel/DC
            "{{Comic\n| image = MMPR 101 Cover A.png\n| writer = Ryan Parrott\n": "MMPR 101 Cover A.png",  # franchise
            "| cover = [[File:TNG Mirror Broken 1.webp|250px]]\n": "TNG Mirror Broken 1.webp",
            "Intro [[File:Issue101.JPG|thumb]] text": "Issue101.JPG",
            "<gallery>\nMMPR101 A.jpg|Cover A\n</gallery>": "MMPR101 A.jpg",
        }
        for wt, want in cases.items():
            self.assertEqual(A.cover_file(wt), want, wt)
        self.assertIsNone(A.cover_file("| Image1_Artist1 = Jim Lee\n"))

    def test_lead_image_fallback_when_no_image_field(self):
        import io, urllib.request, brb_apply_fandom_pages as A
        real, A.time.sleep = urllib.request.urlopen, (lambda s: None)
        def fake(req, timeout=None):
            q = req.full_url
            if "pageimages" in q:
                return io.BytesIO(json.dumps({"query": {"pages": [{"original": {"source": "https://static.wikia.nocookie.net/pr/images/x/MMPR101.jpg/revision/latest"}}]}}).encode())
            return io.BytesIO(json.dumps({"parse": {"wikitext": "| release date = October 26, 2022\n| writer = [[Ryan Parrott]]"}}).encode())
        urllib.request.urlopen = fake
        try:
            fn, date, py, cr = A.fetch_page("https://powerrangers.fandom.com/api.php", "Mighty Morphin Power Rangers (Boom! Studios)", "ISSUE::", "101")
            self.assertEqual(A.img_url("x", fn), "https://static.wikia.nocookie.net/pr/images/x/MMPR101.jpg")
            self.assertEqual(date, "2022-10-00")
        finally:
            urllib.request.urlopen = real

    # ── autolink targets missing covers and wrong-era covers ──────────────────
    def test_autolink_targets_missing_and_wrong_era_covers(self):
        sb = self.sb
        H = ["Title", "Issue #", "Year", "Volume", "Publisher", "Box #", "Publication Date", "Writer(s)", "Artist(s)", "Cover Artist"]
        full = ["2020-01-00", "w", "a", "c"]
        sb.xlsx(H, [["Hulk", 1, 2008, 2, "Marvel", "5"] + full,        # complete but NO cover
                    ["Shazam!", 15, 2020, 5, "DC", "6"] + full,        # two eras share one title+issue cover
                    ["Shazam!", 15, 2024, 5, "DC", "7"] + full,
                    ["Done", 1, 2020, 1, "DC", "8"] + full])           # complete, own cover -> untouched
        sb.json("covers.json", {"Shazam!|||#15": {"url": "u"}, "Done|||1|||1": {"url": "u"}})
        sb.json("arc_cache.json", {"v": 3, "resolved": {}, "probe": {}, "issues": {
            "Hulk Vol 2 1": {"page": "Hulk Vol 2 1", "f": {}, "year": 2008},
            "Shazam! Vol 1 15": {"page": "Shazam! Vol 1 15", "f": {}, "year": 2020},
            "Shazam! Vol 2 15": {"page": "Shazam! Vol 2 15", "f": {}, "year": 2024}}})
        r = sb.run("brb_autolink.py", "--write")
        out = json.load(open(glob.glob(sb.p("data-fixes-autolink-*.json"))[0]))
        got = sorted((x["title"], x["issue"], x["value"].rsplit("/", 1)[1]) for x in out)
        self.assertEqual(got, [("Hulk", "1", "Hulk_Vol_2_1"), ("Shazam!", "15", "Shazam!_Vol_1_15"), ("Shazam!", "15", "Shazam!_Vol_2_15")], r.stdout)

    def test_one_link_on_many_eras_never_rewrites_years(self):
        sb = self.sb
        sb.xlsx(["Title", "Issue #", "Year", "Volume", "Box #", "Publication Date", "Writer(s)", "Artist(s)", "Cover Artist"],
                [["Moon Knight", 2, 2006, 5, "10", None, None, None, None],
                 ["Moon Knight", 2, 2022, 9, "20", None, None, None, None],
                 ["Solo", 1, 2012, 1, "30", None, None, None, None]])
        sb.json("covers.json", {})
        url = "https://marvel.fandom.com/wiki/Moon_Knight_Vol_10_2"
        rec = lambda t, i, b, u: {"title": t, "issue": i, "box": b, "problem": "x", "kind": "fandom", "value": u}
        sb.json("home/Downloads/data-fixes-2026-11-01.json",
                [rec("Moon Knight", "2", "10", url), rec("Moon Knight", "2", "20", url),
                 rec("Solo", "1", "30", "https://marvel.fandom.com/wiki/Solo_Vol_1_1")])
        os.makedirs(sb.p("site"), exist_ok=True)
        open(sb.p("site", "sitecustomize.py"), "w").write(
            "import io, json, time, urllib.request\n"
            "time.sleep = lambda s: None\n"
            "def f(req, timeout=None):\n"
            "    u = req.full_url\n"
            "    y = '2026' if 'Moon' in u else '2016'\n"
            "    if 'pageimages' in u or 'imageinfo' in u: return io.BytesIO(b'{}')\n"
            "    return io.BytesIO(json.dumps({'parse': {'wikitext': '| Year = ' + y + '\\n| Month = 3\\n| Writer1_1 = A'}}).encode())\n"
            "urllib.request.urlopen = f\n")
        r = sb.run("brb_apply_fandom_pages.py", "--apply", env={"PYTHONPATH": sb.p("site")})
        years = {(x["Title"], x["Box #"]): str(x["Year"]) for x in sb.newest()}
        self.assertEqual(years[("Moon Knight", "10")], "2006", r.stdout)
        self.assertEqual(years[("Moon Knight", "20")], "2022", r.stdout)
        self.assertEqual(years[("Solo", "30")], "2016", "a link on ONE copy is still the truth")

    def test_only_your_link_replaces_credits(self):
        # Nov 20: 88 credit replacements hit the guard - links copied across a run (auto) were
        # overwriting writers they didn't overlap with. Guesses fill/add only; your link replaces.
        sb = self.sb
        sb.xlsx(["Title", "Issue #", "Year", "Volume", "Box #", "Publication Date", "Writer(s)", "Artist(s)", "Cover Artist"],
                [["Solo", 1, 2016, 1, "30", None, "Old Writer", "B", "C"],
                 ["Solo", 2, 2016, 1, "30", None, "Old Writer", "B", "C"]])
        sb.json("covers.json", {})
        rec = lambda i, auto: {"title": "Solo", "issue": i, "box": "30", "problem": "x", "kind": "fandom",
                               "value": f"https://marvel.fandom.com/wiki/Solo_Vol_1_{i}", **({"auto": True} if auto else {})}
        sb.json("home/Downloads/data-fixes-2026-11-20.json", [rec("1", False), rec("2", True)])
        os.makedirs(sb.p("site"), exist_ok=True)
        open(sb.p("site", "sitecustomize.py"), "w").write(
            "import io, json, time, urllib.request\n"
            "time.sleep = lambda s: None\n"
            "def f(req, timeout=None):\n"
            "    u = req.full_url\n"
            "    if 'pageimages' in u or 'imageinfo' in u: return io.BytesIO(b'{}')\n"
            "    return io.BytesIO(json.dumps({'parse': {'wikitext': '| Year = 2016\\n| Month = 3\\n| Writer1_1 = New Writer'}}).encode())\n"
            "urllib.request.urlopen = f\n")
        r = sb.run("brb_apply_fandom_pages.py", "--apply", env={"PYTHONPATH": sb.p("site")})
        w = {x["Issue #"]: x["Writer(s)"] for x in sb.newest()}
        self.assertEqual(w[1], "New Writer", r.stdout + r.stderr)
        self.assertEqual(w[2], "Old Writer", "a copied (auto) link must not replace credits")

    def test_linked_year_fix_does_not_flip_back(self):
        # Spider-Woman #1 (Nov 17 run): your link set Year 2024->2026, then
        # year_from_pubdate put it back to 2024 from the stale on-sale date.
        sb = self.sb
        sb.xlsx(["Title", "Issue #", "Year", "Volume", "Box #", "Publication Date", "Writer(s)", "Artist(s)", "Cover Artist"],
                [["Solo", 1, 2012, 1, "30", "2012-03-00", "A", "B", "C"]])
        sb.json("covers.json", {})
        sb.json("home/Downloads/data-fixes-2026-11-01.json",
                [{"title": "Solo", "issue": "1", "box": "30", "problem": "x", "kind": "fandom",
                  "value": "https://marvel.fandom.com/wiki/Solo_Vol_1_1"}])
        os.makedirs(sb.p("site"), exist_ok=True)
        open(sb.p("site", "sitecustomize.py"), "w").write(
            "import io, json, time, urllib.request\n"
            "time.sleep = lambda s: None\n"
            "def f(req, timeout=None):\n"
            "    u = req.full_url\n"
            "    if 'pageimages' in u or 'imageinfo' in u: return io.BytesIO(b'{}')\n"
            "    return io.BytesIO(json.dumps({'parse': {'wikitext': '| Year = 2016\\n| Month = 3\\n| Writer1_1 = A'}}).encode())\n"
            "urllib.request.urlopen = f\n")
        r = sb.run("brb_apply_fandom_pages.py", "--apply", env={"PYTHONPATH": sb.p("site")})
        row = sb.newest()[0]
        self.assertEqual(str(row["Year"]), "2016", r.stdout)
        self.assertTrue(str(row["Publication Date"]).startswith("2016"), row)
        r2 = sb.run("brb_year_from_pubdate.py", "--apply")
        self.assertEqual(str(sb.newest()[0]["Year"]), "2016", r2.stdout + r2.stderr)

    def test_fix_list_year_beats_stale_pubdate(self):
        # Nov 26: year_fix_1126 set Bloodhunt Diaries 2021->2024 and What If? Magic -> Magik
        # 2022->2018; year_from_pubdate then put both back from their stale on-sale dates.
        sb = self.sb
        sb.xlsx(["Title", "Issue #", "Year", "Volume", "Box #", "Publication Date"],
                [["Bloodhunt Diaries", 1, 2024, 1, "75", "2021-06-00"],
                 ["What If? Magik", 1, 2018, 1, "1", "2022-03-00"],
                 ["Batman", 4, 2025, 1, "9", "2016-05-00"]])
        sb.json("year_fix_1126.json", [
            {"title": "Bloodhunt Diaries", "issue": "1", "box": "75", "year": "2021", "volume": "1",
             "set": {"Year": "2024"}, "old": {"Year": "2021"}},
            {"title": "What If? Magic", "issue": "1", "box": "1", "year": "2022", "volume": "1",
             "set": {"Title": "What If? Magik", "Year": "2018"}, "old": {"Title": "What If? Magic", "Year": "2022"}}])
        r = sb.run("brb_year_from_pubdate.py", "--apply")
        rows = {x["Title"]: x for x in sb.newest()}
        self.assertEqual(str(rows["Bloodhunt Diaries"]["Year"]), "2024", r.stdout + r.stderr)
        self.assertEqual(str(rows["What If? Magik"]["Year"]), "2018")
        self.assertIn(rows["Bloodhunt Diaries"]["Publication Date"], (None, ""))   # stale date cleared
        self.assertEqual(str(rows["Batman"]["Year"]), "2016")                       # normal rule still runs
        r2 = sb.run("brb_year_from_pubdate.py", "--apply")                          # idempotent
        self.assertIn("Nothing to fix", r2.stdout, r2.stdout)

    def test_gcd_union_is_idempotent_and_drops_companies(self):
        # Nov 17: every run re-appended "Top Cow Productions, Inc." (comma split never
        # matched GCD's spelling) -> 66 copies in one cell, #1 "artist" on the homepage.
        sys.path.insert(0, self.sb.dir)
        import importlib, brb_credits_gcd as G
        importlib.reload(G)
        gcd = ["Tyler Kirkham", "Top Cow Productions, Inc."]
        bad = "Tyler Kirkham & Top Cow Productions & Inc. & Top Cow Productions & Inc. & Top Cow Productions, Inc."
        self.assertEqual(G.decide(bad, gcd), ("CLEAN", "Tyler Kirkham"))
        self.assertEqual(G.decide("Tyler Kirkham", gcd), (None, None), "second run must change nothing")
        a, v = G.decide("Tyler Kirkham", ["Tyler Kirkham", "Sal Buscema"])
        self.assertEqual((a, v), ("UNION", "Tyler Kirkham & Sal Buscema"))
        self.assertEqual(G.decide(v, ["Tyler Kirkham", "Sal Buscema"]), (None, None))
        # Suffixes: "Romulo Fajardo, Jr." is one person (UNION 4 recurred every run).
        gcd2 = ["Leinil Francis Yu", "Romulo Fajardo, Jr."]
        a2, v2 = G.decide("Leinil Francis Yu & Romulo Fajardo & Jr.", gcd2)
        self.assertEqual((a2, v2), ("CLEAN", "Leinil Francis Yu & Romulo Fajardo Jr."))
        self.assertEqual(G.decide(v2, gcd2), (None, None), "second run must change nothing")
        self.assertEqual(G.decide("John Romita Jr. & Klaus Janson", ["John Romita, Jr.", "Klaus Janson"]), (None, None))
        # Deadpool #65-69 (Nov 19): GCD names carry "(Udon)" tags; UNION rewrote the same value every run
        cell = "Alvin Lee & Udon's Rob Ross & A-Zero & TR2 & A-Zero (Udon) & TR2 (Udon)"
        gcd3 = ["Alvin Lee", "A-Zero (Udon)", "TR2 (Udon)"]
        a4, v4 = G.decide(cell, gcd3)
        self.assertEqual(a4, "CLEAN", "duplicate people (A-Zero twice) cleaned once")
        self.assertEqual(G.decide(v4, gcd3), (None, None), "tagged GCD names must match the stripped cell")
        a3, v3 = G.decide("John Romita Jr. & Klaus Janson & John Romita & Jr.", ["Klaus Janson"])
        self.assertEqual((a3, v3), ("CLEAN", "John Romita Jr. & Klaus Janson"))

    def test_series_map_holds_names_that_dont_fit(self):
        # Nov 17 "Map all green": year-only checks sent Low Slain -> Crime Syndicate.
        sb = self.sb
        sb.json("series_map.json", {
            "Low Slain|||1": {"fandom": "Crime Syndicate Vol 1", "wiki": "DC"},
            "Futures End: Aquaman|||1": {"fandom": "Aquaman: Futures End Vol 1", "wiki": "DC"},
            "WildC.A.T.s|||1": {"fandom": "Wildcats Vol 1", "wiki": "DC"},
            "Tarot Mine|||1": {"fandom": "Tarot Vol 1", "wiki": "Marvel", "confirmed": True}})
        rec = lambda t, v: {"title": t, "vol": "1", "problem": "series-match", "kind": "solution", "value": v, "wiki": "DC"}
        sb.json("home/Downloads/data-fixes-2026-11-18.json",
                [rec("What If? Magic", "map:Strange Academy: Finals Vol 1"),
                 rec("Ultimate X4", "map!:X-Men/Fantastic Four Vol 1")])
        r = sb.run("brb_apply_series_map.py", "--apply")
        m = json.load(open(sb.p("series_map.json")))
        self.assertNotIn("Low Slain|||1", m, r.stdout)
        self.assertNotIn("What If? Magic|||1", m, "bulk map with a non-fitting name is held")
        self.assertIn("Futures End: Aquaman|||1", m, "same words, different order still fits")
        self.assertIn("WildC.A.T.s|||1", m)
        self.assertIn("Tarot Mine|||1", m, "a mapping you confirmed is never second-guessed")
        self.assertIn("Ultimate X4|||1", m, "map! (picked one-by-one) is trusted")
        held = {h["key"] for h in json.load(open(sb.p("artifacts/comics-inventory/public/series_held.json")))}
        self.assertEqual(held, {"Low Slain|||1", "What If? Magic|||1"})
        r2 = sb.run("brb_apply_series_map.py", "--apply")
        self.assertEqual(json.load(open(sb.p("series_map.json"))), m, "second run changes nothing")
        # the decisions file gets archived after a run - the held list must survive that
        os.remove(sb.p("home/Downloads/data-fixes-2026-11-18.json"))
        sb.run("brb_apply_series_map.py", "--apply")
        held2 = {h["key"] for h in json.load(open(sb.p("artifacts/comics-inventory/public/series_held.json")))}
        self.assertEqual(held2, {"Low Slain|||1", "What If? Magic|||1"}, "held list emptied on the next run")
        self.assertNotIn("Low Slain|||1", json.load(open(sb.p("series_map.json"))))
        # deciding one (paste a link) takes it off the held list
        sb.json("home/Downloads/data-fixes-2026-11-19.json",
                [rec("Low Slain", "link:https://dc.fandom.com/wiki/Low_Slain_Vol_1_1")])
        sb.run("brb_apply_series_map.py", "--apply")
        held3 = {h["key"] for h in json.load(open(sb.p("artifacts/comics-inventory/public/series_held.json")))}
        self.assertEqual(held3, {"What If? Magic|||1"})
        self.assertEqual(json.load(open(sb.p("series_map.json")))["Low Slain|||1"]["fandom"], "Low Slain Vol 1")

    def test_brb_all_pulls_code_before_steps(self):
        # Nov 19: fixes landed at step 8, so step 3 ran stale code for one more run.
        import importlib, io, contextlib
        d = self.sb.dir
        git = lambda cwd, *a: subprocess.run(["git", "-c", "user.email=t@t", "-c", "user.name=t", *a],
                                             cwd=cwd, capture_output=True, text=True)
        os.makedirs(os.path.join(d, "origin.git")); git(os.path.join(d, "origin.git"), "init", "-q", "--bare", "-b", "main")
        a, b = os.path.join(d, "A"), os.path.join(d, "B")
        git(d, "clone", "-q", os.path.join(d, "origin.git"), a)
        git(a, "checkout", "-q", "-b", "main")
        open(os.path.join(a, "fix.py"), "w").write("v = 1\n")
        git(a, "add", "."); git(a, "commit", "-q", "-m", "one"); git(a, "push", "-q", "origin", "main")
        git(d, "clone", "-q", os.path.join(d, "origin.git"), b)
        open(os.path.join(b, "fix.py"), "w").write("v = 2\n")
        git(b, "commit", "-qam", "fix"); git(b, "push", "-q", "origin", "main")
        sys.path.insert(0, d)
        import brb_all; importlib.reload(brb_all)
        brb_all.ROOT = a
        os.environ.pop("BRB_NO_SYNC", None)
        with contextlib.redirect_stdout(io.StringIO()):
            brb_all.code_sync()
        self.assertEqual(open(os.path.join(a, "fix.py")).read(), "v = 2\n", "clean tree must fast-forward")
        # an edited tracked file -> no sync, nothing lost
        open(os.path.join(b, "fix.py"), "w").write("v = 3\n"); git(b, "commit", "-qam", "fix2"); git(b, "push", "-q", "origin", "main")
        open(os.path.join(a, "fix.py"), "w").write("v = local\n")
        with contextlib.redirect_stdout(io.StringIO()) as out:
            brb_all.code_sync()
        self.assertEqual(open(os.path.join(a, "fix.py")).read(), "v = local\n", out.getvalue())

    def test_doctor_who_wiki_tables_to_arcs(self):
        # Nov 19: TARDIS series pages - story tables with spanning writer cells, "6 - 8, 10"
        # issue lists, and Backup tables that must be ignored.
        sys.path.insert(0, self.sb.dir)
        import importlib, brb_dw_wiki as D
        importlib.reload(D)
        H = """<h2>Stories</h2><h3>Main</h3><h4>Year One</h4>
<table><tr><th>#</th><th>Title</th><th>Writer</th><th>Featuring</th><th>Printed in</th><th>Released</th></tr>
<tr><td>1</td><td>Revolutions of Terror</td><td rowspan="2">Nick Abadzis</td><td>Gabby, Cindy</td><td>10D 1-3</td><td>23 July - 24 September 2014</td></tr>
<tr><td>2</td><td>The Arts in Space</td><td>Gabby</td><td>10D 4-5</td><td>8 October - 5 November 2014</td></tr>
<tr><td>3</td><td>The Weeping Angels of Mons</td><td rowspan="2">Robbie Morrison</td><td>Gabby</td><td>10D 6-9</td><td>x</td></tr>
<tr><td>4</td><td>Echo</td><td>Gabby, Cindy</td><td>10D 10</td><td>25 March 2015</td></tr></table>
<h4>Year Three</h4>
<table><tr><th>#</th><th>Title</th><th>Writer</th><th>Featuring</th><th>Printed in</th><th>Released</th></tr>
<tr><td>4</td><td>Vortex Butterflies</td><td rowspan="2">Nick Abadzis</td><td>Gabby</td><td>10DY3 6 - 8, 10</td><td>x</td></tr>
<tr><td>5</td><td>The Lost Dimension: The Tenth Doctor</td><td>Gabby, Cindy, Cybermen</td><td>10DY3 9</td><td>x</td></tr></table>
<h3>Backup</h3><h4>Year One</h4>
<table><tr><th>#</th><th>Title</th><th>Writer</th><th>Printed in</th></tr>
<tr><td>1</td><td>A Backup Strip</td><td>Someone</td><td>10D 1-3</td></tr></table>"""
        tabs = D.story_tables(H)
        self.assertEqual([len(r) for _, r in tabs], [4, 2], "main tables only, backups ignored")
        self.assertEqual(tabs[0][1][1]["writer"], "Nick Abadzis", "spanning writer cell copied down")
        self.assertEqual(tabs[0][1][3]["writer"], "Robbie Morrison")
        self.assertEqual(tabs[0][1][3]["printed"], "10D 10", "columns stay aligned under a span")
        self.assertEqual(D.printed_issues("10DY3 6 - 8, 10"), [("10", "3", [6, 7, 8, 10])])
        self.assertEqual(D.printed_issues("11DY3 9, 11"), [("11", "3", [9, 11])])
        plan = D.build([("u", tabs)])
        y1 = D.norm("Doctor Who: The Tenth Doctor - Year One")
        self.assertEqual(plan[(y1, "2")]["Story Arc"], "Revolutions of Terror")
        self.assertEqual((plan[(y1, "2")]["Arc Part"], plan[(y1, "2")]["Arc Length"], plan[(y1, "2")]["Finale Issue #"]), ("2", "3", "3"))
        self.assertEqual(plan[(y1, "10")]["Arc Part"], "", "a one-issue story has no part numbers")
        y3 = D.norm("Doctor Who: The Tenth Doctor — Year Three")
        self.assertEqual((plan[(y3, "10")]["Story Arc"], plan[(y3, "10")]["Arc Part"], plan[(y3, "10")]["Arc Length"]), ("Vortex Butterflies", "4", "4"))
        self.assertEqual(plan[(y3, "9")]["Story Arc"], "The Lost Dimension: The Tenth Doctor")
        self.assertNotIn("A Backup Strip", {v["Story Arc"] for v in plan.values()})

    def test_image_comics_page_fills_blanks_once(self):
        # Nov 19: Image Comics release links (imagecomics.com/comics/releases/...) pasted on Data Fix.
        sb = self.sb
        sb.xlsx(["Title", "Issue #", "Year", "Volume", "Box #", "Publication Date", "Writer(s)", "Artist(s)", "Cover Artist"],
                [["G.I. Joe", 13, 2025, 1, "103", None, None, "Already Here", None]])
        sb.json("covers.json", {})
        sb.json("home/Downloads/data-fixes-2026-11-19.json",
                [{"title": "G.I. Joe", "issue": "13", "box": "103", "problem": "no-date", "kind": "fandom",
                  "value": "https://imagecomics.com/comics/releases/g-i-joe-13"}])
        page = ('<h1>G.I. Joe #13</h1><div class="entry-meta"><p>Published: November 5, 2025</br>'
                '<a href="https://imagecomics.com/files/releases/X-hires.jpg" id="entry-cover-image">'
                '<img class="with-border" src="https://cdn.imagecomics.com/x/g-i-joe-13.jpg" alt="G.I. Joe #13" ></a>'
                'Cover price: <b>$3.99</b></p><div class="role"><h2>Writer</h2><aside><a href="/c/jw">Joshua Williamson</a></aside></div>'
                '<div class="role"><h2>Artists</h2><aside><a href="/c/tr">Tom Reilly</a></aside><aside><a href="/c/jb">Jordie Bellaire</a></aside></div>'
                '<div class="role"><h2>Cover A</h2><aside><a href="/c/tr">Tom Reilly</a></aside></div>'
                '<div class="role"><h2>Cover H</h2><aside><a href="/c/ec">Eric Canete</a></aside></div>')
        os.makedirs(sb.p("site"), exist_ok=True)
        open(sb.p("site", "sitecustomize.py"), "w").write(
            "import io, time, urllib.request\ntime.sleep = lambda s: None\n"
            f"urllib.request.urlopen = lambda req, timeout=None: io.BytesIO({page!r}.encode())\n")
        r = sb.run("brb_apply_image_pages.py", "--apply", env={"PYTHONPATH": sb.p("site")})
        row = sb.newest()[0]
        self.assertEqual(row["Writer(s)"], "Joshua Williamson", r.stdout + r.stderr)
        self.assertEqual(row["Artist(s)"], "Already Here", "a filled cell is never overwritten")
        self.assertEqual(row["Cover Artist"], "Tom Reilly", "Cover A, not the variant Cover H")
        self.assertEqual(str(row["Publication Date"]), "2025-11-05")
        cov = json.load(open(sb.p("covers.json")))
        self.assertEqual(cov["G.I. Joe|||13|||1"]["large"], "https://imagecomics.com/files/releases/X-hires.jpg")
        r2 = sb.run("brb_apply_image_pages.py", "--apply", env={"PYTHONPATH": sb.p("site")})
        self.assertIn("cells to fill (blank only): 0   covers to add: 0", r2.stdout, "second run must change nothing")

    def test_power_rangers_infobox_credits(self):
        # Nov 19: powerrangers.fandom.com ComicInfo uses pencils= / releasedate= (real MMPR #101 text)
        sys.path.insert(0, self.sb.dir)
        import importlib, brb_apply_fandom_pages as A
        importlib.reload(A)
        wt = ("{{ComicInfo\n|image= MMPR 101 Cover A Main.webp\n|editor=[[Allyson Gronowitz]]\n"
              "|coverartist=[[Mateus Manhanini]]\n|writer=[[Melissa Flores]] \n|pencils=[[Simona Di Gianfelice]]\n"
              "|inks=[[Simona Di Gianfelice]]\n|colors=[[Raul Angulo]]\n|releasedate=October 26, 2022\n}}")
        self.assertEqual(A.infobox_names(wt, A.CRED_PATS["artist"]), ["Simona Di Gianfelice"])
        self.assertEqual(A.infobox_names(wt, A.CRED_PATS["writer"]), ["Melissa Flores"])
        self.assertEqual(A.infobox_names(wt, A.CRED_PATS["cover"]), ["Mateus Manhanini"])
        # Nov 24: only the first cover credit - the 2nd+ slots are the cover's inker / colorist
        mv = "|Image1_Artist1 = Stephen Segovia\n|Image1_Artist2 = Rachelle Rosenberg\n|Image2_Artist1 = Variant Guy\n"
        self.assertEqual(A.infobox_names(mv, A.CRED_PATS["cover"]), ["Stephen Segovia"])
        dc = "|CoverArtist1 = Mark Bagley\n|CoverArtist2 = Mark Farmer\n|CoverArtist3 = Paul Mounts\n"
        self.assertEqual(A.infobox_names(dc, A.CRED_PATS["cover"]), ["Mark Bagley"])
        self.assertEqual(A.infobox_names("|CoverArtist1_1 = A\n|CoverArtist1_2 = B\n", A.CRED_PATS["cover"]), ["A"])
        # a name suffix is part of the name, not a second person (Nov 24: "Romulo Fajardo & Jr.")
        self.assertEqual(A.clean_credit("Romulo Fajardo, Jr."), ["Romulo Fajardo Jr."])
        self.assertEqual(A.clean_credit("[[John K. Snyder III]], Jane Doe"), ["John K. Snyder III", "Jane Doe"])
        self.assertEqual(A.infobox_names("|Penciler1_1 = John Romita Jr.\n", A.CRED_PATS["artist"]), ["John Romita Jr."], "Marvel style still works")

    def test_relink_resends_archived_links_once(self):
        sb = self.sb
        sb.xlsx(["Title", "Issue #", "Year", "Volume", "Box #", "Publication Date", "Writer(s)", "Artist(s)", "Cover Artist"],
                [["MMPR", 101, 2022, 1, "103", "2022-10-00", "Melissa Flores", None, "Mateus Manhanini"],
                 ["Done", 1, 2020, 1, "5", "2020-01-00", "W", "A", "C"]])
        sb.json("covers.json", {"Done|||1|||1": {"url": "x"}, "MMPR|||101|||1": None})
        os.makedirs(sb.p("processed_exports"), exist_ok=True)
        rec = lambda t, i, b, u: {"title": t, "issue": i, "box": b, "problem": "no-cover", "kind": "fandom", "value": u}
        sb.json("processed_exports/20261117_data-fixes-2026-11-17.json",
                [rec("MMPR", "101", "103", "https://powerrangers.fandom.com/wiki/MMPR_Issue_101?file=MMPR_101_Cover_G.jpeg"),
                 rec("Done", "1", "5", "https://marvel.fandom.com/wiki/Done_Vol_1_1")])
        r = sb.run("brb_relink.py")
        self.assertIn("to re-send: 1", r.stdout, r.stdout + r.stderr)
        self.assertFalse(glob.glob(sb.p("data-fixes-relink-*.json")), "report-only writes nothing")
        sb.run("brb_relink.py", "--write")
        out = json.load(open(glob.glob(sb.p("data-fixes-relink-*.json"))[0]))
        self.assertEqual([x["title"] for x in out], ["MMPR"], "only the book with gaps")
        self.assertIn("file=MMPR_101_Cover_G.jpeg", out[0]["value"], "your cover pick is kept")
        r3 = sb.run("brb_relink.py", "--write")
        self.assertIn("nothing to re-send", r3.stdout, "re-sent once per parser version, never loops")

    def test_relink_reuses_another_copys_link(self):
        # Nov 24: a copy in another box with gaps reuses the link already vouched for on its
        # twin - but only when the sheet has that title + issue from one year (or the link is
        # pinned to this copy's year). Sibling-built guesses are never reused.
        sb = self.sb
        H = ["Title", "Issue #", "Year", "Volume", "Box #", "Publication Date", "Writer(s)", "Artist(s)", "Cover Artist"]
        sb.xlsx(H, [["Solo", 1, 2020, 1, "5", "2020-01-00", "W", "A", "C"],
                    ["Solo", 1, 2020, 1, "9", None, None, None, None],
                    ["Two", 3, 2013, 4, "4", "2013-01-00", "W", "A", "C"],
                    ["Two", 3, 2018, 6, "8", None, None, None, None]])
        sb.json("covers.json", {"Solo|||1|||1": {"url": "x"}, "Two|||3|||4": {"url": "x"}})
        os.makedirs(sb.p("processed_exports"), exist_ok=True)
        rec = lambda t, i, b, u: {"title": t, "issue": i, "box": b, "problem": "x", "kind": "fandom", "value": u}
        sb.json("processed_exports/20261124_data-fixes-2026-11-24.json",
                [rec("Solo", "1", "5", "https://marvel.fandom.com/wiki/Solo_Vol_1_1"),
                 rec("Two", "3", "4", "https://marvel.fandom.com/wiki/Two_Vol_4_3")])
        sb.run("brb_relink.py", "--write")
        out = json.load(open(glob.glob(sb.p("data-fixes-relink-*.json"))[0]))
        self.assertEqual([(x["title"], x["box"], x["year"]) for x in out], [("Solo", "9", "2020")],
                         "single-era twin reuses the link; a two-era book does not")

    def test_relink_never_resends_a_flagged_cover(self):
        # Nov 20: relink switched on. A cover you flagged incorrect must not come back from the
        # same archived link; a book whose only gap is that cover is not re-sent at all.
        sb = self.sb
        sb.xlsx(["Title", "Issue #", "Year", "Volume", "Box #", "Publication Date", "Writer(s)", "Artist(s)", "Cover Artist"],
                [["Bad", 1, 2020, 1, "5", "2020-01-00", "W", "A", "C"], ["Gap", 2, 2020, 1, "5", "2020-01-00", "W", None, "C"]])
        sb.json("covers.json", {"Gap|||2|||1": {"url": "x"}})
        os.makedirs(sb.p("processed_exports"), exist_ok=True)
        rec = lambda t, i: {"title": t, "issue": i, "box": "5", "problem": "no-cover", "kind": "fandom", "value": f"https://marvel.fandom.com/wiki/{t}_Vol_1_{i}"}
        sb.json("processed_exports/1_data-fixes-x.json", [rec("Bad", "1"), rec("Gap", "2")])
        sb.json("home/Downloads/flagged-covers-2026-11-01.json", [{"Title": "Bad", "Issue": "1", "kind": "incorrect"}])
        r = sb.run("brb_relink.py")
        self.assertIn("to re-send: 1", r.stdout, r.stdout + r.stderr)
        self.assertIn("cover flagged wrong", r.stdout)
        self.assertIn("Gap #2", r.stdout); self.assertNotIn("Bad #1", r.stdout)

    def test_image_page_falls_back_to_curl_on_old_mac_ssl(self):
        # Nov 19: Mac CLT Python -> "[SSL: TLSV1_ALERT_PROTOCOL_VERSION]"; system curl works.
        sys.path.insert(0, self.sb.dir)
        import importlib, ssl, urllib.request, subprocess as sp, brb_apply_image_pages as I
        importlib.reload(I)
        I.CACHE = self.sb.p("imgcache")
        real_open, real_run = urllib.request.urlopen, sp.run
        try:
            def boom(*a, **k): raise urllib.error.URLError(ssl.SSLError("[SSL: TLSV1_ALERT_PROTOCOL_VERSION] tlsv1 alert protocol version"))
            urllib.request.urlopen = boom
            seen = []
            class R: returncode = 0; stdout = b"<h1>G.I. Joe #27</h1>"; stderr = b""
            def fake_run(cmd, **k): seen.append(cmd); return R()
            I.subprocess.run = fake_run
            page = I.fetch("https://imagecomics.com/comics/releases/g-i-joe-27")
            self.assertIn("G.I. Joe #27", page)
            self.assertEqual(seen[0][0], "curl")
        finally:
            urllib.request.urlopen, I.subprocess.run = real_open, real_run

    def test_writer_fixes_only_touch_reviewed_cells(self):
        sb = self.sb
        sb.xlsx(["Title", "Issue #", "Year", "Volume", "Box #", "Writer(s)", "Artist(s)"],
                [["Ultimate X-Men", 53, 2005, 1, "23", "Brian Michael Bendis", "A"],
                 ["Ultimate X-Men", 54, 2005, 1, "23", "Someone You Edited", "B"]])
        sb.json("fx.json", [
            {"title": "Ultimate X-Men", "volume": "1", "issue": "53", "year": "2005", "box": "23", "old": "Brian Michael Bendis", "new": "Brian K. Vaughan"},
            {"title": "Ultimate X-Men", "volume": "1", "issue": "54", "year": "2005", "box": "23", "old": "Brian Michael Bendis", "new": "Brian K. Vaughan"}])
        r = sb.run("brb_fix_writers.py", "fx.json", "--apply")
        w = {x["Issue #"]: x["Writer(s)"] for x in sb.newest()}
        self.assertEqual(w[53], "Brian K. Vaughan", r.stdout + r.stderr)
        self.assertEqual(w[54], "Someone You Edited", "a cell changed since review is left alone")
        r2 = sb.run("brb_fix_writers.py", "fx.json", "--apply")
        self.assertIn("cells to change: 0", r2.stdout, "second run changes nothing")

    def test_gcd_never_undoes_a_reviewed_writer_fix(self):
        # Nov 19: the 76 Bendis fixes were applied, then GCD's UNION step re-added Bendis (and the
        # other AvX architects) to 14 of them in the same brb_all run - a flip-flop. A reviewed
        # fix outranks GCD: the cell is locked, and the fixer re-corrects a reshuffled cell.
        sb = self.sb
        H = ["Title", "Issue #", "Year", "Volume", "Box #", "Publisher", "Writer(s)", "Artist(s)", "Cover Artist"]
        sb.xlsx(H, [["Avengers vs. X-Men", 2, 2012, 1, "19", "Marvel", "Jason Aaron", "A", "C"],
                    ["Avengers vs. X-Men", 3, 2012, 1, "19", "Marvel", "Ed Brubaker", "A", "C"]])
        sb.json("writer_fixes_t.json", [{"title": "Avengers vs. X-Men", "volume": "1", "issue": "2", "year": "2012",
                                         "box": "19", "old": "Jason Aaron & Brian Michael Bendis", "new": "Jason Aaron"}])
        open(sb.p("wrap.py"), "w").write(
            "import sys, brb_credits_gcd as G\n"
            "G.find_series = lambda *a: {'id': 1, 'name': 'AvX'}\n"
            "G.credit_sets = lambda *a: {'writer': ['Jason Aaron', 'Brian Michael Bendis', 'Ed Brubaker'], 'artist': [], 'cover_artist': []}\n"
            "sys.argv = ['x', '--no-conflicts']\nG.main()\n")
        r = sb.run("wrap.py")
        w = {x["Issue #"]: x["Writer(s)"] for x in sb.newest()}
        self.assertEqual(w[2], "Jason Aaron", "locked reviewed cell must not get UNION names\n" + r.stdout + r.stderr)
        self.assertIn("Bendis", w[3], "unlocked rows still get GCD's UNION")
        self.assertIn("Locked (reviewed fix):   1", r.stdout)
        # a cell GCD already reshuffled (only names from the reviewed 'old') is re-corrected
        for f in glob.glob(sb.p("attached_assets", "*.xlsx")):
            os.remove(f)
        sb.xlsx(H, [["Avengers vs. X-Men", 2, 2012, 1, "19", "Marvel", "Brian Michael Bendis & Jason Aaron", "A", "C"]])
        r2 = sb.run("brb_fix_writers.py", "writer_fixes_t.json", "--apply")
        self.assertEqual(sb.newest()[0]["Writer(s)"], "Jason Aaron", r2.stdout + r2.stderr)
        self.assertIn("cells to change: 0", sb.run("brb_fix_writers.py", "writer_fixes_t.json").stdout)

    def test_reclaim_restore_safe_and_idempotent(self):
        # Nov 19: 775 dropped books restored from their last-known rows. Never double a book that
        # is back (any volume / any tab), retired or over-full boxes -> UNKNOWN, year ranges -> year,
        # extra copies flagged, guard needs FORCE, a second run adds 0.
        sb = self.sb
        import openpyxl
        H = ["#", "Title", "Issue #", "Year", "Volume", "Box #", "Publisher", "Writer(s)", "⚠ Verify Duplicate"]
        wb = openpyxl.Workbook(); ws = wb.active; ws.title = INV; ws.append(H)
        ws.append([7, "Batman", "1", 2016, 3, 12, "DC", "Tom King", None])
        ws.append([8, "Hulk", "1", 2008, 2, 40, "Marvel", "Jeph Loeb", None])
        for k in range(79):
            ws.append([9 + k, f"Filler {k}", "1", 2020, 1, 40, "DC", "W", None])   # box 40 cap 80: one slot left
        d = wb.create_sheet("Duplicates"); d.append(["Box", "Title", "Issue", "Year"]); d.append([3, "Flash", "#5 [DUPLICATE]", 2011])
        lg = wb.create_sheet("📝 Data Integrity Log"); lg.append(["0101_1200", "Dedup", "rows moved to Duplicates tab"])
        wb.save(sb.p("attached_assets", "comics_inventory_0111_1200.xlsx"))
        R = lambda t, i, y, b, v="1": {"was_entry": "1", "dropped": "2026-06-15", "commit": "6d2d85f",
                                       "row": {"Title": t, "Issue #": i, "Year": y, "Box #": b, "Volume": v, "Publisher": "DC", "Writer(s)": "X"}}
        sb.json("reclaim_restore_rows.json", [
            R("Batman: Off World", "1", "2023–2024", "12"),     # new book, existing box -> restored, year 2023
            R("Batman", "1", "2011", "60", "2"),                # Batman #1 is back (other volume) -> skip
            R("Flash", "5", "2011", "3"),                       # on the Duplicates tab -> skip
            R("Ghost Book", "", "2024", "39"),                  # no issue -> skip
            R("Retired Box Book", "#2", "2019", "84"),          # box 84 gone -> UNKNOWN; "#2" -> "2" (Nov 23 ##4 bug)
            R("Twin", "3", "2019", "40"), R("Twin", "3", "2019", "40"),   # 2 copies; box 40 has 1 slot -> UNKNOWN, flagged
        ])
        r = sb.run("brb_reclaim_restore.py")
        self.assertIn("to restore: 4", r.stdout, r.stdout + r.stderr)
        self.assertIn("REPORT ONLY", r.stdout)
        self.assertIn("Dedup", r.stdout, "integrity-log removals are shown first")
        r = sb.run("brb_reclaim_restore.py", "--apply")
        rows = {(x["Title"], str(x["Issue #"]), str(x["Box #"])): x for x in sb.newest()}
        self.assertEqual(len(sb.newest()), 81 + 4, r.stdout + r.stderr)
        ow = rows[("Batman: Off World", "1", "12")]
        self.assertEqual(ow["Year"], 2023); self.assertEqual(ow["#"], 88)
        self.assertIn(("Retired Box Book", "2", "UNKNOWN — needs physical reassignment"), rows)
        twins = [x for x in sb.newest() if x["Title"] == "Twin"]
        self.assertEqual({x["Box #"] for x in twins}, {"UNKNOWN — needs physical reassignment"})
        self.assertTrue(all(x["⚠ Verify Duplicate"] for x in twins))
        self.assertNotIn(("Batman", "1", "60"), rows); self.assertNotIn(("Flash", "5", "3"), rows)
        lg = openpyxl.load_workbook(max(glob.glob(sb.p("attached_assets", "*.xlsx")), key=os.path.getmtime))["📝 Data Integrity Log"]
        self.assertIn("Reclaim", str(lg.cell(lg.max_row, 2).value))
        r2 = sb.run("brb_reclaim_restore.py").stdout
        self.assertIn("to restore: 0", r2, "second run adds nothing")
        self.assertIn("LOG: 1 removal", r2, "the restore's own log entry is not listed as a removal")

    def test_reclaim_restore_guard_needs_force(self):
        sb = self.sb
        sb.xlsx(["#", "Title", "Issue #", "Year", "Volume", "Box #", "Publisher", "Writer(s)"], [[1, "A", "1", 2020, 1, 5, "DC", "W"]])
        sb.json("reclaim_restore_rows.json", [{"row": {"Title": f"Lost {k}", "Issue #": "1", "Year": "2020", "Box #": "5", "Volume": "1"}} for k in range(60)])
        r = sb.run("brb_reclaim_restore.py", "--apply")
        self.assertNotEqual(r.returncode, 0); self.assertIn("SAFETY LIMIT", r.stdout)
        self.assertEqual(len(sb.newest()), 1, "nothing saved over the limit")
        r = sb.run("brb_reclaim_restore.py", "--apply", env={"BRB_FORCE": "1"})
        self.assertEqual(len(sb.newest()), 61, r.stdout + r.stderr)

    def test_legacy_numbers_leave_regular_later_volume_issues_alone(self):
        # Nov 24: Black Panther Vol 3 #23 (2000) is a regular issue; Vol 1 ended at #15, so the
        # legacy list (#23 = Vol 3 #8) wrongly flagged it as a renumber.
        import brb_legacy_links as LL
        L = {**{str(k): f"Black Panther Vol 1 {k}" for k in range(1, 16)}, "23": "Black Panther Vol 3 8"}
        years = {"Black Panther Vol 3 23": 2000, "Black Panther Vol 3 8": 1999}
        P = LL.plan([("row", "23", "3", 2000, "7")], "Black Panther", L, years.get)
        self.assertEqual(P, [], "own page exists with the right year -> untouched")
        P = LL.plan([("row", "23", "1", 2000, "7")], "Black Panther", L, years.get)
        self.assertEqual([(k, t) for _, k, t, _ in P], [("volume", "Black Panther Vol 3 23")], "wrong volume -> volume fix, not renumber")
        P = LL.plan([("row", "23", "1", 1990, "7")], "Black Panther", L, years.get)
        self.assertEqual([k for _, k, _, _ in P], ["renumber"], "no page in that era -> legacy candidate")

    def test_legacy_numbers_put_each_issue_on_its_page(self):
        # Nov 20: Avengers #672 was filed as Vol 8 (Vol 8 starts at #691); Fandom's
        # Legacy_Numbers page names the real page. Dual-numbered #480 = Vol 3 #65 -> renumber
        # (listed, never auto-written); ordinary issues pick the volume whose year fits.
        import brb_legacy_links as LL
        cap = lambda n, link: (f'class="wikia-gallery-item"><div class="lightbox-caption" style="x"><span><span>Avengers</span> #{n}</span>'
                               + (f'<br />(<a href="/wiki/{link}">x</a>)' if link else "") + "</div>")
        L = LL.parse_legacy("".join([cap(400, None), cap(402, None), cap(480, "Avengers_Vol_3_65"), cap(672, "Avengers_Vol_7_672")]), "Avengers")
        self.assertEqual(L["672"], "Avengers Vol 7 672"); self.assertEqual(L["400"], "Avengers Vol 1 400")
        Y = {"Avengers Vol 4 1": 2010, "Avengers Vol 5 1": 2013, "Avengers Vol 8 1": 2018, "Avengers Vol 7 1": 2017}.get
        rows = [("a", "672", "8", 2017, "27"), ("b", "480", "", 2001, "U"), ("c", "1", "5", 2010, "6"),
                ("d", "1", "8", 2018, "27"), ("e", "400", "1", 1996, "3")]
        P = {r: (k, t) for r, k, t, _ in LL.plan(rows, "Avengers", L, Y)}
        self.assertEqual(P["a"], ("volume", "Avengers Vol 7 672"))
        self.assertEqual(P["b"], ("renumber", "Avengers Vol 3 65"))
        self.assertEqual(P["c"], ("volume", "Avengers Vol 4 1"))
        self.assertNotIn("d", P, "recorded volume closest in year stays")
        self.assertNotIn("e", P, "first-volume issue already right")

    def test_row_fixes_renumber_and_move_dupes(self):
        # Nov 20: Avengers #480-499 (restored) duplicated existing Vol 3 #65-84; #498 v3 -> #83.
        sb = self.sb
        U = "UNKNOWN — needs physical reassignment"
        sb.xlsx(["Title", "Issue #", "Year", "Volume", "Box #", "Writer(s)"],
                [["Avengers", "65", 2003, 3, U, "Geoff Johns"], ["Avengers", "498", 2004, 3, U, "Chuck Austen"],
                 ["Avengers", "480", 2001, None, U, "Geoff Johns"], ["Hulk", "1", 2008, 2, "40", "Jeph Loeb"]])
        sb.json("fx.json", [
            {"title": "Avengers", "issue": "498", "box": U, "year": "2004", "volume": "3", "set": {"Issue #": "83"}, "old": {"Issue #": "498"}},
            {"title": "Avengers", "issue": "480", "box": U, "year": "2001", "volume": "", "move_to_duplicates": "copy of Vol 3 #65"}])
        r = sb.run("brb_fix_rows.py", "fx.json")
        self.assertIn("cell changes: 1   rows to Duplicates tab: 1   skipped: 0", r.stdout, r.stdout + r.stderr)
        r = sb.run("brb_fix_rows.py", "fx.json", "--apply")
        rows = sb.newest()
        self.assertEqual([str(x["Issue #"]) for x in rows], ["65", "83", "1"], r.stdout + r.stderr)
        self.assertEqual(rows[2]["Writer(s)"], "Jeph Loeb", "other rows untouched")
        import openpyxl
        wb = openpyxl.load_workbook(max(glob.glob(sb.p("attached_assets", "*.xlsx")), key=os.path.getmtime))
        self.assertIn("480", str(wb["Duplicates"].cell(wb["Duplicates"].max_row, 3).value), "moved, not deleted")
        self.assertIn("cell changes: 0   rows to Duplicates tab: 0", sb.run("brb_fix_rows.py", "fx.json").stdout, "second run: nothing")

    def test_intake_records_signature_and_slab(self):
        # Nov 23: a CGC Signature Series slab needs Signed? / Signed By / Condition from intake.
        sb = self.sb
        sb.xlsx(["Title", "Issue #", "Year", "Volume", "Publisher", "Box #", "Era", "Date Added",
                 "Condition", "Signed?", "Signed By", "Cover Artist"], [["Hulk", "1", 2008, 2, "Marvel", "17", "Modern", "", "", "", "", ""]])
        open(sb.p("in.csv"), "w").write("title,issue,year,volume,publisher,box,era,condition,signed,signed_by,cover_artist\n"
                                        "Guardians of the Galaxy,1,2023,7,Marvel,CC10,Modern,CGC SS 9.8,YES,Alex Ross,Alex Ross\n")
        r = sb.run("brb_add_intake.py", "--csv", "in.csv", "--apply")
        row = sb.newest()[-1]
        self.assertEqual((row["Box #"], row["Condition"], row["Signed?"], row["Signed By"]),
                         ("CC10", "CGC SS 9.8", "YES", "Alex Ross"), r.stdout + r.stderr)

    def test_comic_vine_limit_stops_fast_and_keeps_dates(self):
        # Nov 19: HTTP 420 (hourly limit) was retried with backoff for ~50 min; Ctrl-C then
        # lost every date already found. Now: stop at the first 420, save what was found.
        import http.server, threading
        hits = []

        class H(http.server.BaseHTTPRequestHandler):
            def log_message(self, *a):
                pass

            def do_GET(self):
                hits.append(self.path)
                if len(hits) > 2:                      # limit used up after one book
                    self.send_response(420); self.end_headers(); return
                body = {"status_code": 1, "results": [{"id": 7, "name": "Hulk", "start_year": 2008}]} \
                    if "/search/" in self.path else {"status_code": 1, "results": [{"store_date": "2008-03-05"}]}
                self.send_response(200); self.end_headers(); self.wfile.write(json.dumps(body).encode())
        srv = http.server.HTTPServer(("127.0.0.1", 0), H)
        threading.Thread(target=srv.serve_forever, daemon=True).start()
        sb = self.sb
        sb.xlsx(["Title", "Issue #", "Year", "Publisher", "Publication Date"],
                [["Hulk", "1", 2008, "Marvel", None], ["Thor", "1", 2007, "Marvel", None], ["Thor", "2", 2007, "Marvel", None]])
        t0 = time.time()
        r = sb.run("brb_pubdate_cv.py", env={"BRB_CV_URL": f"http://127.0.0.1:{srv.server_port}/api",
                                             "COMIC_VINE_API_KEY": "test", "NO_PROXY": "127.0.0.1", "no_proxy": "127.0.0.1"})
        srv.shutdown()
        self.assertLess(time.time() - t0, 20, "no long backoff on 420")
        self.assertIn("hourly limit", r.stdout, r.stdout + r.stderr)
        rows = sb.newest()
        self.assertEqual(str(rows[0]["Publication Date"]), "2008-03-05", "date found before the limit is saved")
        self.assertIsNone(rows[1]["Publication Date"])

    def test_row_fixes_move_identical_rows_only_when_count_matches(self):
        # Nov 23: X-Men: The End #2 was restored twice with identical keys - "rows": 2 moves both.
        sb = self.sb
        U = "UNKNOWN — needs physical reassignment"
        sb.xlsx(["Title", "Issue #", "Year", "Volume", "Box #"],
                [["X-Men: The End", "#2", 2004, 3, U], ["X-Men: The End", "#2", 2004, 3, U], ["Hulk", "1", 2008, 2, "40"]])
        fx = {"title": "X-Men: The End", "issue": "2", "box": U, "year": "2004", "volume": "3", "move_to_duplicates": "dupe"}
        sb.json("a.json", [fx])
        self.assertIn("ambiguous", sb.run("brb_fix_rows.py", "a.json").stdout, "without a count: left alone")
        sb.json("b.json", [dict(fx, rows=3)])
        self.assertIn("rows to Duplicates tab: 0", sb.run("brb_fix_rows.py", "b.json").stdout, "count must match exactly")
        sb.json("c.json", [dict(fx, rows=2)])
        r = sb.run("brb_fix_rows.py", "c.json", "--apply")
        self.assertEqual([x["Title"] for x in sb.newest()], ["Hulk"], r.stdout + r.stderr)

    def test_row_fixes_where_picks_one_of_twin_rows(self):
        sb = self.sb
        sb.xlsx(["Title", "Issue #", "Year", "Volume", "Box #", "Arc / Story", "Publication Date"],
                [["Gargoyles", "1", 2023, 1, "75", "ongoing", None], ["Gargoyles", "1", 2023, 1, "75", "variant", None]])
        sb.json("w.json", [{"title": "Gargoyles", "issue": "1", "box": "75", "year": "2023", "volume": "1", "where": {"Arc / Story": "variant"},
                            "set": {"Publication Date": "2022-12-07"}, "old": {"Publication Date": ""}}])
        r = sb.run("brb_fix_rows.py", "w.json", "--apply")
        self.assertEqual([x["Publication Date"] for x in sb.newest()], [None, "2022-12-07"], r.stdout + r.stderr)

    def test_row_fixes_fast_on_full_size_sheet(self):
        # Nov 23: brb_fix_rows hung on the real 11,900-row sheet (ws[r] re-measured the sheet per row).
        sb = self.sb
        H = ["Title", "Issue #", "Year", "Volume", "Box #"] + [f"C{k}" for k in range(35)]
        rows = [[f"T{n}", str(n), 2000, 1, "5"] + ["x"] * 35 for n in range(6000)]
        rows.append(["Guardians of the Galaxy", "1", 2023, 10, "17"] + ["y"] * 35)
        sb.xlsx(H, rows)
        sb.json("fx.json", [{"title": "Guardians of the Galaxy", "issue": "1", "box": "17", "year": "2023", "volume": "10",
                             "set": {"Volume": "7"}, "old": {"Volume": "10"}}])
        t0 = time.time()
        r = sb.run("brb_fix_rows.py", "fx.json", "--apply")
        self.assertIn("WROTE", r.stdout, r.stdout + r.stderr)
        self.assertLess(time.time() - t0, 30, "must not crawl on a full-size sheet (old code: ~55s here, hours on the real sheet)")
        self.assertEqual(str(sb.newest()[-1]["Volume"]), "7")

    def test_fandom_fill_wide_covers_comic_vine_cover_books(self):
        # Nov 19: Absolute Superman #1 - cover from Comic Vine, so the fill never opened its DC page.
        sb = self.sb
        sb.xlsx(["Title", "Issue #", "Year", "Volume", "Box #", "Publisher", "Publication Date", "Writer(s)", "Artist(s)", "Cover Artist"],
                [["Absolute Superman", 1, 2025, 1, "104", "DC", "2025-01-00", "Jason Aaron", None, "Clayton Crain"],
                 ["Old Book", 1, 1990, 1, "5", "DC", "1990-01-00", "W", None, "C"]])
        sb.json("covers.json", {"Absolute Superman|||1|||1": {"url": "https://comicvine.gamespot.com/x.jpg"}})
        os.makedirs(sb.p("site"), exist_ok=True)
        open(sb.p("site", "sitecustomize.py"), "w").write(
            "import io, json, time, urllib.request\ntime.sleep = lambda s: None\n"
            "def f(req, timeout=None):\n"
            "    u = req.full_url if hasattr(req, 'full_url') else req\n"
            "    if 'pageimages' in u or 'imageinfo' in u: return io.BytesIO(b'{}')\n"
            "    y = '2025' if 'Absolute' in u else '2014'\n"
            "    wt = '| Month = 1\\n| Year = ' + y + '\\n| Writer1_1 = Jason Aaron\\n| Penciler1_1 = Rafa Sandoval\\n| Inker1_1 = Rafa Sandoval\\n| CoverArtist1 = Rafa Sandoval\\n'\n"
            "    return io.BytesIO(json.dumps({'parse': {'wikitext': wt}}).encode())\n"
            "urllib.request.urlopen = f\n")
        env = {"PYTHONPATH": sb.p("site")}
        r = sb.run("brb_fill_from_fandom.py", "--no-deploy", "--wide", env=env)
        self.assertIn("Absolute Superman #1: artist -> Rafa Sandoval", r.stdout, r.stdout + r.stderr)
        self.assertIsNone(sb.newest()[0]["Artist(s)"], "report-only writes nothing")
        r = sb.run("brb_fill_from_fandom.py", "--no-deploy", "--wide", "--wide-apply", env=env)
        rows = {x["Title"]: x for x in sb.newest()}
        self.assertEqual(rows["Absolute Superman"]["Artist(s)"], "Rafa Sandoval", r.stdout + r.stderr)
        self.assertEqual(rows["Absolute Superman"]["Cover Artist"], "Clayton Crain", "filled cells are never changed (variant cover kept)")
        self.assertIsNone(rows["Old Book"]["Artist(s)"], "a page from another era (2014 vs 1990) is skipped")
        r2 = sb.run("brb_fill_from_fandom.py", "--no-deploy", "--wide", "--wide-apply", env=env)
        self.assertNotIn("WIDE (", r2.stdout, "second run fills nothing")

    def test_fandom_fill_never_takes_another_eras_page_or_replaces_names(self):
        # Nov 23: GotG #1 (2023 slab, Vol 7 in the sheet) got the 2020 Vol 7 page's Al Ewing credits + date.
        sb = self.sb
        sb.xlsx(["Title", "Issue #", "Year", "Volume", "Box #", "Publisher", "Publication Date", "Writer(s)", "Artist(s)", "Cover Artist"],
                [["Guardians of the Galaxy", 1, 2023, 7, "CC10", "Marvel", None, "Collin Kelly & Jackson Lanzing", "Kev Walker", "Alex Ross"],
                 ["Hulk", 1, 2020, 1, "5", "Marvel", None, "Someone Else", None, "C"]])
        F = {"url": "https://static.wikia.nocookie.net/marveldatabase/images/x.jpg", "source": "fandom-page"}
        sb.json("covers.json", {"Guardians of the Galaxy|||1|||7": F, "Hulk|||1|||1": F})
        os.makedirs(sb.p("site"), exist_ok=True)
        open(sb.p("site", "sitecustomize.py"), "w").write(
            "import io, json, time, urllib.request\ntime.sleep = lambda s: None\n"
            "def f(req, timeout=None):\n"
            "    u = req.full_url if hasattr(req, 'full_url') else req\n"
            "    if 'pageimages' in u or 'imageinfo' in u: return io.BytesIO(b'{}')\n"
            "    wt = '| Month = 1\\n| Year = 2020\\n| Writer1_1 = Al Ewing\\n| Penciler1_1 = Juan Cabal\\n| CoverArtist1 = Juan Cabal\\n'\n"
            "    return io.BytesIO(json.dumps({'parse': {'wikitext': wt}}).encode())\n"
            "urllib.request.urlopen = f\n")
        r = sb.run("brb_fill_from_fandom.py", "--no-deploy", env={"PYTHONPATH": sb.p("site")})
        rows = {x["Title"]: x for x in sb.newest()}
        g = rows["Guardians of the Galaxy"]
        self.assertEqual((g["Writer(s)"], g["Cover Artist"], g["Publication Date"]),
                         ("Collin Kelly & Jackson Lanzing", "Alex Ross", None), r.stdout + r.stderr)
        h = rows["Hulk"]
        self.assertEqual(h["Writer(s)"], "Someone Else", "zero-overlap names are never replaced by the gap-filler")
        self.assertEqual(h["Artist(s)"], "Juan Cabal", "same-era page still fills blanks")

    def test_many_links_one_title_requests_each_page_once(self):
        sb = self.sb
        rows = [["Moon Knight", i, 2000 + i, 5, str(i), None, None, None, None] for i in range(1, 21)]
        sb.xlsx(["Title", "Issue #", "Year", "Volume", "Box #", "Publication Date", "Writer(s)", "Artist(s)", "Cover Artist"], rows)
        sb.json("covers.json", {})
        url = "https://marvel.fandom.com/wiki/Moon_Knight_Vol_10_2"
        sb.json("home/Downloads/data-fixes-2026-11-01.json",
                [{"title": "Moon Knight", "issue": str(i), "box": str(i), "problem": "x", "kind": "fandom", "value": url} for i in (1, 2, 3, 4, 5, 6)])
        os.makedirs(sb.p("site"), exist_ok=True)
        open(sb.p("site", "sitecustomize.py"), "w").write(
            "import io, json, time, urllib.request\n"
            "time.sleep = lambda s: None\n"
            "def f(req, timeout=None):\n"
            "    open('requests.log', 'a').write(req.full_url + '\\n')\n"
            "    return io.BytesIO(b'{}')\n"            # every page missing -> worst case probing
            "urllib.request.urlopen = f\n")
        sb.run("brb_apply_fandom_pages.py", env={"PYTHONPATH": sb.p("site")})
        reqs = open(sb.p("requests.log")).read().splitlines() if os.path.exists(sb.p("requests.log")) else []
        self.assertEqual(len(reqs), len(set(reqs)), "a page must never be requested twice in one run")
        self.assertLessEqual(len(reqs), 20 * 3 + 6 * 8, f"{len(reqs)} requests for 20 books")

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

    # ── Bad covers: placeholders + one image on different issues (Nov 26) ────
    def test_bad_cover_detection(self):
        from brb_cover_quality import bad_cover_keys
        one = {"url": "https://cv/x/61298-captain-america-amp.jpg"}
        cov = {
            "Captain America/Iron Man|||2|||1": {"url": "https://cv/x/6373148-blank.png"},   # placeholder
            "Captain America|||137|||1": one, "Captain America|||138|||1": one,              # shared in one title
            "Thor|||17|||2": {"url": "https://f/Mighty_Thor_Vol_2_17.jpg"},                  # same book, 2 titles
            "The Mighty Thor|||17|||2": {"url": "https://f/Mighty_Thor_Vol_2_17.jpg"},
            "Totally Awesome Hulk|||23|||1": {"url": "https://cv/h23.jpg"},                  # spelling twins
            "The Totally Awesome Hulk|||#23": {"url": "https://cv/h23.jpg"},
            "Moon Knight|||1|||5": {"url": "https://f/Moon_Knight_Vol_5_1.jpg"},             # normal
        }
        bad = bad_cover_keys(cov)
        self.assertEqual(bad.get("Captain America/Iron Man|||2|||1"), "placeholder")
        self.assertEqual(bad.get("Captain America|||137|||1"), "shared")
        self.assertEqual(bad.get("Captain America|||138|||1"), "shared")
        for ok in ("Thor|||17|||2", "The Mighty Thor|||17|||2", "Totally Awesome Hulk|||23|||1",
                   "The Totally Awesome Hulk|||#23", "Moon Knight|||1|||5"):
            self.assertNotIn(ok, bad, ok)

    # ── Collected editions are never a series mapping (Nov 26, Immortal Iron Fist) ──
    def test_collection_never_used_as_series(self):
        sb = self.sb
        sb.json("series_map.json", {
            "The Immortal Iron Fist|||1": {"fandom": "Immortal Iron Fist & The Immortal Weapons Omnibus Vol 1", "wiki": "Marvel"},
            "The Mighty Thor|||2": {"fandom": "Mighty Thor Omnibus Vol 1", "wiki": "Marvel"},
            "Hawkeye|||5": {"fandom": "Hawkeye Vol 5", "wiki": "Marvel"},
            "Marvel Comics #1000|||1": {"fandom": "Marvel Comics 1000 HC Vol 1", "wiki": "Marvel", "confirmed": True}})
        r = sb.run("brb_apply_series_map.py", "--apply")
        m = json.load(open(sb.p("series_map.json")))
        self.assertNotIn("The Immortal Iron Fist|||1", m, r.stdout + r.stderr)
        self.assertNotIn("The Mighty Thor|||2", m)
        self.assertIn("Hawkeye|||5", m)                       # a real series stays
        self.assertIn("Marvel Comics #1000|||1", m)           # one YOU confirmed stays
        held = json.load(open(sb.p("artifacts/comics-inventory/public/series_held.json")))
        self.assertIn("The Immortal Iron Fist|||1", [h["key"] for h in held])

    # ── Double intake: "row": N moves just ONE of two identical rows (Nov 26) ──
    def test_fix_rows_row_pin_moves_one_twin(self):
        sb = self.sb
        sb.xlsx(["Title", "Issue #", "Year", "Volume", "Box #", "Est. Raw Value (NM) $"],
                [["Superman", 44, 2026, 6, "101", ""], ["Superman", 44, 2026, 6, "101", ""]])
        sb.json("undo.json", [{"title": "Superman", "issue": "44", "box": "101", "year": "2026", "volume": "6",
                               "row": 2, "move_to_duplicates": "double intake"}])
        r = sb.run("brb_fix_rows.py", "undo.json", "--apply")
        self.assertEqual(len(sb.newest()), 1, r.stdout + r.stderr)

    # ── "rows": N on a set fix corrects every copy, and only when all still hold `old` (Nov 28) ──
    def test_fix_rows_set_on_all_copies(self):
        sb = self.sb
        sb.xlsx(["Title", "Issue #", "Year", "Volume", "Box #", "Whatnot Category"],
                [["Gargoyles", 1, 2022, 1, "75", "15"], ["Gargoyles", 1, 2022, 1, "75", "15"], ["Thor", 1, 2020, 6, "9", "Marvel/Modern"]])
        sb.json("c.json", [{"title": "Gargoyles", "issue": "1", "box": "75", "year": "2022", "volume": "1", "rows": 2,
                            "set": {"Whatnot Category": "Indie/Other"}, "old": {"Whatnot Category": "15"}}])
        r = sb.run("brb_fix_rows.py", "c.json", "--apply")
        self.assertEqual([x["Whatnot Category"] for x in sb.newest()], ["Indie/Other", "Indie/Other", "Marvel/Modern"], r.stdout + r.stderr)
        self.assertIn("cell changes: 0", sb.run("brb_fix_rows.py", "c.json").stdout, "second run: nothing")

    # ── Mistaken delete: put one row back by its '#' entry, only once (Nov 27) ──
    def test_restore_rows_puts_back_one_entry_once(self):
        sb = self.sb
        hdr = ["#", "Title", "Issue #", "Year", "Volume", "Box #", "Signed By"]
        sb.xlsx(hdr, [[1, "X-Men", 1, 1991, 2, "5", ""], [6897, "Wolverine", 8, 1989, 1, "106", "Chris Claremont"]],
                name="comics_inventory_2611_2342.xlsx")
        time.sleep(0.05)
        sb.xlsx(hdr, [[1, "X-Men", 1, 1991, 2, "5", ""]], name="comics_inventory_2611_2346.xlsx")
        r = sb.run("brb_restore_rows.py", "--from", "comics_inventory_2611_2342.xlsx", "--entry", "6897")
        self.assertIn("rows to restore: 1", r.stdout, r.stdout + r.stderr)
        self.assertEqual(len(sb.newest()), 1, "dry run writes nothing")
        r = sb.run("brb_restore_rows.py", "--from", "comics_inventory_2611_2342.xlsx", "--entry", "6897", "--apply")
        rows = sb.newest()
        self.assertEqual([x["Title"] for x in rows], ["X-Men", "Wolverine"], r.stdout + r.stderr)
        self.assertEqual(rows[1]["Signed By"], "Chris Claremont")
        r = sb.run("brb_restore_rows.py", "--from", "comics_inventory_2611_2342.xlsx", "--entry", "6897")
        self.assertIn("rows to restore: 0", r.stdout, "second run adds nothing")

    # ── Arc re-review: blanks -> FILL, agreement -> SAME, clash -> DIFFERENT (Nov 26) ──
    def test_arc_review_report(self):
        sb = self.sb
        sb.xlsx(["Title", "Issue #", "Year", "Volume", "Publisher", "Box #", "Story Arc"],
                [["Jean Grey", 1, 2026, 3, "Marvel", "102", ""], ["Thor", 803, 2026, 7, "Marvel", "102", "Muspelheim"],
                 ["Batman", 50, 2018, 3, "DC", "9", "The Wedding"], ["Void Rivals", 36, 2026, 1, "Image", "103", ""]])
        r = sb.run("brb_arc_review.py", "--targets")
        self.assertEqual(open(sb.p("arc_targets_full.csv")).read().count("\n"), 4, r.stdout + r.stderr)  # header + 3 Marvel/DC
        open(sb.p("arc_extracted_full.csv"), "w").write(
            "title,sheet_volume,issue,year,Story Arc,Arc Part,Arc Length,Finale Issue #,Crossover Event (Fandom),Arc Confidence,Arc Source\n"
            "Jean Grey,3,1,2026,Phoenix Reborn,1,5,,,Stated,x\nThor,7,803,2026,Muspelheim,4,,,,Stated,x\n"
            "Batman,3,50,2018,Something Else,,,,,Stated,x\n")
        r = sb.run("brb_arc_review.py", "--report")
        rep = {x["title"]: x["status"] for x in csv.DictReader(open(sb.p("arc_review_report.csv")))}
        self.assertEqual(rep, {"Jean Grey": "FILL", "Batman": "DIFFERENT"}, r.stdout + r.stderr)
        self.assertIn("SAME", r.stdout)

    # ── Intake: a shifted row stops everything; the arc column lands in Story Arc (Nov 26) ──
    def test_intake_shape_check_and_arc(self):
        sb = self.sb
        hdr = ["Title", "Issue #", "Year", "Volume", "Publisher", "Box #", "Era", "Date Added", "Story Arc", "Condition", "Signed?"]
        sb.xlsx(hdr, [["Old", 1, 2000, 1, "DC", "5", "Modern", "", "", "NM", "NO"]])
        open(sb.p("bad.csv"), "w").write("title,issue,year,volume,publisher,box,era,arc,cover_price,condition,seller_notes,signed,signed_by,\n"
                                         "X,5,2021,1,Marvel,106,Modern,,,4.99,NM,Cover A (Signed),YES,Someone\n")
        r = sb.run("brb_add_intake.py", "--csv", "bad.csv", "--apply")
        self.assertIn("INTAKE STOPPED", r.stdout, r.stdout + r.stderr)
        self.assertEqual(len(sb.newest()), 1)                          # nothing written
        open(sb.p("good.csv"), "w").write("title,issue,year,volume,publisher,box,era,arc,condition,signed,signed_by\n"
                                          "G.I. Joe,28,2026,1,Image,103,Modern,Night Force,NM,NO,\n")
        r = sb.run("brb_add_intake.py", "--csv", "good.csv", "--apply")
        new = [x for x in sb.newest() if x["Title"] == "G.I. Joe"]
        self.assertEqual(new[0]["Story Arc"], "Night Force", r.stdout + r.stderr)
        r = sb.run("brb_add_intake.py", "--csv", "good.csv", "--apply")     # same file again = double intake
        self.assertIn("ALREADY IN BOX 103", r.stdout, r.stdout + r.stderr)
        self.assertEqual(len([x for x in sb.newest() if x["Title"] == "G.I. Joe"]), 1)

    # ── One run at a time: a second run waits, then starts by itself (Nov 26) ──
    def test_second_run_waits_for_the_first(self):
        import fcntl
        sb = self.sb
        f = open(sb.p(".brb_run.lock"), "a+")
        fcntl.flock(f, fcntl.LOCK_EX)                      # a "run" is going
        e = dict(os.environ, HOME=sb.p("home"), BRB_LOCK_EVERY="1")
        e.pop("BRB_LOCK_PID", None)
        code = f"import sys; sys.path.insert(0, {sb.dir!r}); import brb_runlock as L; L.wait_for_turn('second'); print('RAN', L.LOCK)"
        pr = subprocess.Popen([sys.executable, "-c", code], cwd=sb.dir, env=e, stdout=subprocess.PIPE, text=True)
        first = pr.stdout.readline()                       # blocks until it reports waiting
        self.assertIn("another run is going", first)
        self.assertIsNone(pr.poll(), "second run must wait while the first holds the lock")
        fcntl.flock(f, fcntl.LOCK_UN); f.close()           # first run ends
        out = pr.communicate(timeout=20)[0]
        self.assertIn("RAN", out); self.assertIn("starting now", out)

    # ── New intakes get arcs: books added after the bulk arc fetch (Nov 26) ──
    def test_arc_new_targets_only_new_blank_books(self):
        sb = self.sb
        sb.xlsx(["Title", "Issue #", "Year", "Volume", "Publisher", "Box #", "Story Arc"],
                [["Jean Grey", 1, 2026, 1, "Marvel", "102", ""], ["Thor", 803, 2026, 7, "Marvel", "102", "Muspelheim"],
                 ["Void Rivals", 36, 2026, 1, "Image", "103", ""], ["The Flash", 112, 1996, 2, "DC", "5", ""]])
        open(sb.p("arc_targets.csv"), "w").write("rid,wiki,series_key,title,sheet_volume,issue,year\n"
                                                 "8558,DC,DC|The Flash|2,The Flash,2,112.0,1996\n")
        for s in ("brb_arc_fetch.py", "brb_arc_extract.py"):
            open(sb.p(s), "w").write("pass\n")            # no network in tests
        open(sb.p("arc_extracted.csv"), "w").write(
            "title,sheet_volume,issue,year,Story Arc,Arc Part,Arc Length,Finale Issue #,Crossover Event (Fandom),Arc Confidence,Arc Source\n"
            "Jean Grey,1,1,2026,Phoenix Reborn,1,5,,,Stated,x\nThe Flash,2,112,1996,Old Arc,,,,,Stated,x\n")
        r = sb.run("brb_arc_new.py", "--apply")
        rows = {(x["Title"], str(x["Issue #"])): x for x in sb.newest()}
        self.assertEqual(rows[("Jean Grey", "1")]["Story Arc"], "Phoenix Reborn", r.stdout + r.stderr)
        self.assertFalse(rows[("The Flash", "112")]["Story Arc"])      # bulk target: left to the bulk run
        self.assertEqual(rows[("Thor", "803")]["Story Arc"], "Muspelheim")
        self.assertEqual(open(sb.p("arc_targets.csv")).read().count("\n"), 2)   # git-tracked file untouched

    # ── Memory Alpha links: Creators section + issue-style URL (Nov 26) ───────
    def test_memory_alpha_link_and_creators(self):
        import brb_apply_fandom_pages as F
        base, title, vol, iss = F.parse_url("https://memory-alpha.fandom.com/wiki/Star_Trek,_Issue_1_(2026)")
        self.assertEqual((title, vol, iss), ("Star Trek", "ISSUE:c:2026", "1"))
        wt = ("{{sidebar comic\n|published  = {{d|23|September|2026}}\n|year = [[2407]]\n}}\n"
              "==Background information==\n=== Creators ===\n<div>\n* Writers\n** [[Christopher Cantwell]]\n"
              "*Artist\n**[[Dennis Menheere]]\n**[[Jodie Troutman]] (Letterer)\n*Editors\n**[[Someone]]\n==External link==\n")
        c = F.section_creators(wt)
        self.assertEqual(c["writer"], ["Christopher Cantwell"])
        self.assertEqual(c["artist"], ["Dennis Menheere"])          # letterer is not the artist
        self.assertEqual(c["cover"], [])


    # ── clearing a cell: ws.cell(r, c, None) is a no-op in openpyxl ───────────
    def test_apply_renames_actually_clears_flag(self):
        # Bug: brb_apply_renames used ws.cell(row, NCOL, None) to clear the
        # 'check title' note - openpyxl ignores value=None, so the flag survived.
        sb = self.sb
        H = ["Title", "Issue #", "Year", "Box #", "Issue Note"]
        rows = [[f"Filler {i}", "1", "2020", "1", None] for i in range(2, 819)]
        rows.append(["Avengers and Moon Girl", "1", "2024", "102", "check title"])   # row 819
        sb.xlsx(H, rows)
        r = sb.run("brb_apply_renames.py")
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertIn("CONTAMINATION (non Title/Note diffs): 0", r.stdout)
        out = sb.newest()
        row819 = out[819 - 2]
        self.assertEqual(row819["Title"], "Avengers & Moon Girl")
        self.assertIn(row819["Issue Note"], (None, ""), "flag cell must actually be emptied")
        self.assertTrue(all(o["Issue Note"] is None for o in out[:5]))

if __name__ == "__main__":
    unittest.main(verbosity=2)
