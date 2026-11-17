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


if __name__ == "__main__":
    unittest.main(verbosity=2)
