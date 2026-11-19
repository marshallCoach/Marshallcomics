// Plain-English guide for every Data Fix section: what it is, why it happens, how to fix
// it, and what happens after. Shown (open) at the top of each section — Robert asked for
// this on Nov 19 because the "why" and "where" are easy to forget between sessions.

export type GuideText = { what: string; why: string; fix: string[]; next: string };

const RUN = "Click ⬇ Export (top right), then run brb_all on the Mac";

export const GUIDES: Record<string, GuideText> = {
  "restored": {
    what: "744 books that had silently fallen out of your inventory were put back on Nov 19, each with its full old row (credits, value, condition, notes). 429 of them sit in the UNKNOWN box because their old box no longer exists (84, 92, 94…) or putting them back would have overfilled Box 15. 57 are extra copies of the same book, flagged ⚠ Verify Duplicate. 12 weren't restored because they have no issue number, and 19 were skipped because they were already in your data.",
    why: "Earlier rebuilds of the app data (mostly Jun 15, \"exclude CC boxes ≥ 82\") dropped rows by mistake. Your Data Integrity Log had no deliberate removals, so these were losses, not decisions.",
    fix: [
      "📍 Needs a box: open the \"Where Is It?\" page (Boxes menu) and walk your boxes. When you find a book, set its real box with Edit Comic (or in the xlsx).",
      "⚠ Copies to verify: confirm you really have two or more. If not, delete the extra copy with Edit Comic.",
      "✋ No issue #: find the book and add it through the weekly intake CSV, with its issue number.",
      "↷ Already in your data: nothing to do. Listed so you can see why they weren't added twice.",
    ],
    next: "brb_all step 7b applies Edit Comic changes. A book leaves the 📍 list as soon as its box is no longer UNKNOWN.",
  },
  "reclaim": {
    what: "Books that dropped out of your inventory in a past update, where a book with the same title and issue still exists, but in a different volume or year (Tier 2).",
    why: "The same June rebuilds dropped these rows. For each one, the dropped row is either a second copy you really own, or the same book whose volume or year was corrected later, so restoring it would double it.",
    fix: [
      "Compare the volume and year under the card with the copy you already have (shown underneath).",
      "✓ Separate copy: you own a second physical book, so it gets restored.",
      "✗ Same book: it's the one already listed, so it stays out.",
      RUN + ", or send Claude the export.",
    ],
    next: "Your ✓ answers feed the same safe restore step used for the 744 Tier 1 books (re-checked against every tab, boxed, logged).",
  },
  "series-match": {
    what: "Series whose name in your sheet doesn't line up with a Fandom series page, so arcs, credits and covers can't be looked up for them.",
    why: "Your title is spelled or split differently from Fandom's (a subtitle, \"The\", a relaunch counted as a new volume). One scan of 380 series found 234 confident matches.",
    fix: [
      "● green (both test issues found with the right year): click Map.",
      "● amber (one test issue found): open the page, check it, then Map.",
      "● red (nothing verified): paste the correct Fandom series page.",
      "Map keeps your title and only links the lookup. Use Map + rename only when your title is actually wrong (covers follow the rename).",
      "⚠ Held: Fandom's name doesn't fit your title, e.g. \"Low Slain\" → Crime Syndicate. Click Yes, paste the right page, or mark it Not on Fandom.",
      RUN + ".",
    ],
    next: "brb_all step 2 (series map) records the link, and later lookups (arcs, credits, covers) use it. Held series wait until you decide.",
  },
  "arc-conflict": {
    what: "Fandom and Comic Vine give this book's story arc different names.",
    why: "The two wikis label arcs differently, for example the trade-paperback name versus the solicitation name.",
    fix: [
      "Open either page to check.",
      "Keep Fandom (there's also a one-click button for all of them), Use Comic Vine, or paste the correct Fandom issue page.",
      RUN + ".",
    ],
    next: "brb_all step 2 (arc decisions) writes the arc. A decided conflict is never asked again.",
  },
  "unresolved": {
    what: "Books the Fandom fill tried to look up, but the page it built from your title, volume and issue doesn't exist.",
    why: "Usually your title is spelled differently from Fandom's, the volume number is off, or Fandom doesn't cover the book at all.",
    fix: [
      "Search Fandom (🔍) for the book.",
      "Paste the working issue page link and Save.",
      "No page on Fandom? Leave it, since nothing more can be found there.",
      RUN + ".",
    ],
    next: "brb_all step 2 reads the link and fills credits, date and cover. It also corrects the volume from the link.",
  },
  "fandom-linked": {
    what: "Flagged books that already carry a cover from Fandom, but still have a problem such as a date or volume conflict.",
    why: "The Fandom link probably pointed at the wrong volume or issue, or the row is a mislabel or duplicate entry.",
    fix: [
      "Compare the cover with your physical book.",
      "Right: tick Cover's correct (hides it in this browser).",
      "Wrong: paste the correct Fandom issue page and Save.",
      RUN + ".",
    ],
    next: "brb_all step 2 re-reads the correct page and overwrites the volume, date and cover.",
  },
  "cover-guesses": {
    what: "Books with no cover, where a sibling issue's confirmed link lets the app build the likely Fandom page (#3's link with the number changed to #4).",
    why: "You (or the pipeline) linked another issue of the same series, so this one's page is almost certainly the same pattern.",
    fix: [
      "✓ green (page name matches your title): Use this.",
      "⚠ amber (a different-named page, could be another book): open it first, and only use it if it's yours.",
      "Or paste the right link, or dismiss.",
      RUN + ".",
    ],
    next: "brb_all step 2 fetches the page and adds the cover. A dead page skips itself.",
  },
  "title-cleanup": {
    what: "One series spelled two ways (\"X Club\" / \"X-Club\"), so it shows up as two series.",
    why: "Intake, GCD and Fandom punctuate titles differently.",
    fix: [
      "Click the spelling to keep. Prefer the one marked 🔗, which already has a Fandom cover.",
      "\"Near-identical\" pairs can be genuinely different series (Batman vs Batwoman), so merge only when they're the same.",
      "Click ⬇ Export title aliases, then run brb_all.",
    ],
    next: "brb_all step 2b renames the other spellings, and their covers follow.",
  },
  "no-date": {
    what: "The book has no on-sale (publication) date.",
    why: "Neither GCD nor Comic Vine matched it, usually because of an unusual title, a variant, or a very new or indie book.",
    fix: ["Paste the Fandom issue page (the date comes from it), or", "Try Comic Vine next run, or", "No catalogue entry: accept the blank.", RUN + "."],
    next: "brb_all steps 2, 5 and 6 fill the date. Step 7 then checks the Year against it.",
  },
  "date-conflict": {
    what: "The on-sale date and the Year are years apart.",
    why: "Usually the row points at the wrong volume (a relaunch or reprint), or the Year was typed wrong.",
    fix: ["Trust the on-sale date (the Year follows it), or", "Trust my Year (fix the date), or", "Type the right volume or year, or paste the right Fandom page.", RUN + "."],
    next: "brb_all step 2 / step 7 applies it. Gaps over 5 years are held for you, never auto-changed.",
  },
  "no-volume": {
    what: "No volume number recorded.",
    why: "Older rows were entered without one, and every Fandom and GCD lookup needs it to find the right book.",
    fix: ["It's Volume 1 (when the series only ever had one run), or", "Type the volume, or paste the Fandom issue page (it sets the volume).", RUN + "."],
    next: "brb_all step 2 writes the volume, and lookups start working for the book.",
  },
  "no-year": {
    what: "The Year is blank or not a 4-digit year.",
    why: "Usually a range (\"2021–2022\") or a typo from older entry.",
    fix: ["Type the year, or paste the Fandom issue page.", RUN + "."],
    next: "brb_all step 2 writes it, and the validator's Year check stays green.",
  },
  "likely-variant": {
    what: "A CC1 cover-buy (bought for its cover), so its cover may be a variant.",
    why: "Cover-buys are often variants, and the regular-cover lookup can show the wrong art.",
    fix: ["Cover shown is right: ✓ Cover's right, keep as variant.", "It's a regular copy: Not a variant.", "Only paste a Fandom link when the cover shown is wrong.", RUN + "."],
    next: "Confirmed variants are remembered (confirmed_variants.json) and never re-asked.",
  },
  "not-in-gcd": {
    what: "Informational: GCD has no series for this book. It's not counted as work.",
    why: "Indie, very recent, or variant books that GCD hasn't catalogued. Most are already verified by a Fandom cover.",
    fix: ["Nothing required.", "Optionally mark Indie (not catalogued) or Needs research."],
    next: "Only informational. Credits for these come from Fandom or Image pages instead.",
  },
  "cover-no-data": {
    what: "The cover is right, but credits, date or volume are blank.",
    why: "The cover came from a source (Comic Vine, an extrapolated link) that didn't bring the rest of the data.",
    fix: ["Paste the Fandom or Image Comics issue page, or", "Nothing more to find: accept the blanks.", RUN + "."],
    next: "brb_all step 2 / 2a fills only the blank cells. Nothing you've entered is overwritten.",
  },
  "no-cover": {
    what: "No cover image yet. This is the biggest bucket, so it starts collapsed.",
    why: "No source matched the book automatically.",
    fix: ["Paste the Fandom issue page. For a specific variant, paste the image link with ?file=… from that page.", "No art exists: No art available, accept blank.", RUN + "."],
    next: "brb_all step 2 pulls the cover into covers.json.",
  },
};

export function Guide({ id }: { id: string }) {
  const g = GUIDES[id];
  if (!g) return null;
  return (
    <details className="df-guide" open>
      <summary>📘 What this is · why it happens · how to fix it</summary>
      <p><b>What:</b> {g.what}</p>
      <p><b>Why it happens:</b> {g.why}</p>
      <div><b>How to fix:</b>
        <ol>{g.fix.map((f, i) => <li key={i}>{f}</li>)}</ol>
      </div>
      <p><b>What happens next:</b> {g.next}</p>
    </details>
  );
}

export const FLOW = [
  "Pick a fix on a card, or paste a Fandom / Image Comics link. The card disappears (saved in this browser).",
  "Click ⬇ Export (top right). That downloads data-fixes-DATE.json to your Downloads.",
  "On the Mac: python3 brb_all.py. Step 2 reads every export in Downloads and applies it to the xlsx.",
  "brb_all ends by deploying, and the fixed books drop off this page for good.",
];
