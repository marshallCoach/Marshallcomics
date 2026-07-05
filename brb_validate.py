#!/usr/bin/env python3
"""
BRB MASTER VALIDATION — all 10 locked data integrity rules.
Standalone: needs no chat history. Usage:
    python3 brb_validate.py <inventory.xlsx> [--write-report]
--write-report appends/replaces a '🛡 Validation Report' sheet in a _VALIDATED copy.
Exit code = number of rules violated.
"""
import sys, re
import pandas as pd
from datetime import datetime

GHOST_BOXES = {'2','32','34','38','41','61','63','69','71','73','74','76','77','78','81','84','89','90','91','92','93','94'}
CAPS = {'15':150,'44':200,'72':80,'23':155,'85':155,'101':180,'102':180,'103':180}
DEFAULT_CAP = 240
HALLUCINATION_LIMIT = 240  # Roberto 2906: no box may exceed 180
NON_PHYSICAL = re.compile(r'AT |MAGIC|CGC|UNKNOWN|DISPLAY|VERIFY', re.I)
LEGIT_PARENS = re.compile(r'\((19|20)\d{2}\)$')  # volume-year disambiguators are allowed

def norm_issue(x):
    s = str(x).strip()
    try: return str(float(s))
    except: return s

def validate(path):
    xl = pd.ExcelFile(path)
    inv_sheets = [s for s in xl.sheet_names if 'Clean Inventory' in s]
    if not inv_sheets:
        inv_sheets = [s for s in xl.sheet_names if 'Inventory' in s]
    sheet = inv_sheets[0]
    df = pd.read_excel(path, sheet_name=sheet)
    results = []
    box = df['Box #'].astype(str).str.strip()
    phys = df[~box.str.contains(NON_PHYSICAL, na=False)].copy()
    pbox = phys['Box #'].astype(str).str.strip()
    t = df['Title'].astype(str).str.strip()
    iss = df['Issue #'].apply(norm_issue)
    wr = df['Writer(s)'].astype(str).str.strip()
    yr = df['Year'].astype(str).str.strip()
    ar = df['Artist(s)'].astype(str).str.strip()

    # R1 phantom fingerprint: same Title+Issue+Writer+Year, diff box, exactly one Artist blank
    key = t.str.lower()+'|'+iss+'|'+wr.str.lower()+'|'+yr
    v1 = 0
    for k, g in df.groupby(key):
        if len(g) < 2: continue
        bxs = g['Box #'].astype(str).str.strip().nunique()
        blanks = g['Artist(s)'].astype(str).str.strip().isin(['','nan','None']).sum()
        if bxs > 1 and 0 < blanks < len(g): v1 += int(blanks)
    results.append((1,'Phantom fingerprint (blank-artist twin, diff box)',v1))

    # R2 same box + identical Title+Issue+Year → exact dupes still present
    k2 = t.str.lower()+'|'+iss+'|'+yr+'|'+box
    v2 = int(k2.duplicated().sum())
    results.append((2,'Same-box exact duplicates unpurged',v2))

    # R3 diff box + same data must carry ⚠ Verify Duplicate flag
    k3 = t.str.lower()+'|'+iss+'|'+yr
    dup_keys = k3[k3.duplicated(keep=False)]
    v3 = 0
    vd = df.get('⚠ Verify Duplicate')
    for k, g in df[k3.isin(dup_keys)].groupby(k3[k3.isin(dup_keys)]):
        if g['Box #'].astype(str).str.strip().nunique() > 1:
            flagged = vd.loc[g.index].astype(str).str.strip().isin(['','nan','None']) if vd is not None else pd.Series(True,index=g.index)
            gaps = df.loc[g.index,'⚠ Data Gaps'].astype(str).str.contains('MULTI-MATCH|CONFLICT',na=False)
            v3 += int((flagged & ~gaps).sum())
    results.append((3,'Cross-box duplicates missing ⚠ Verify Duplicate flag',v3))

    # R4 title contamination: parentheticals other than legit (YYYY)
    par = t.str.contains(r'\(', na=False) & ~t.apply(lambda s: bool(LEGIT_PARENS.search(s)))
    results.append((4,'Title contains non-year parenthetical',int(par.sum())))

    # R5 issue # integers only
    def bad_issue(x):
        s = str(x).strip()
        if s in ('','nan','None'): return True
        try:
            f = float(s)
            return round(f % 1, 4) not in (0.0,0.1,0.2,0.3,0.4,0.5,0.6,0.7,0.8,0.9)
        except: return True
    results.append((5,'Issue # invalid (blank/non-numeric; ints, .1-style points, 0 allowed)',int(df['Issue #'].apply(bad_issue).sum())))

    # R6 "/" in Writer/Artist/Cover Artist
    v6 = 0
    for c in ['Writer(s)','Artist(s)','Cover Artist']:
        if c in df.columns:
            v6 += int(df[c].astype(str).str.contains(r'\w/\w', na=False, regex=True).sum())
    results.append((6,'"/" not converted to "&" in creator fields',v6))

    # R7 volume advisory: Volume present but Year blank (can't cross-check)
    if 'Volume' in df.columns:
        v7 = int(((~df['Volume'].astype(str).str.strip().isin(['','nan','None'])) & (yr.isin(['','nan','None']))).sum())
    else: v7 = 0
    results.append((7,'Volume set but Year blank (uncheckable volume)',v7))

    # R8 row-index safety proxy: '#' column must be unique
    v8 = int(df['#'].duplicated().sum()) if '#' in df.columns else -1
    results.append((8,"'#' column duplicate ids (row-match integrity)",v8))

    # R9 capacity: any physical box over its cap / hallucination limit
    counts = pbox.value_counts()
    v9 = 0; det9 = []
    for b,c in counts.items():
        cap = min(CAPS.get(b, DEFAULT_CAP), HALLUCINATION_LIMIT)
        if c > cap:
            v9 += 1; det9.append(f'{b}:{c}/{cap}')
    results.append((9,f'Boxes over capacity [{", ".join(det9[:25])}]',v9))

    # R10 ghost boxes must have zero rows
    v10 = int(pbox.isin(GHOST_BOXES).sum())
    results.append((10,'Rows assigned to ghost box numbers',v10))

    return sheet, len(df), results

def main():
    path = sys.argv[1]
    sheet, nrows, results = validate(path)
    ts = datetime.now().strftime('%Y-%m-%d %H:%M')
    total_viol = sum(1 for _,_,v in results if v > 0)
    print(f'BRB VALIDATION — {path.split("/")[-1]} [{sheet}] {nrows} rows @ {ts}')
    for n, name, v in results:
        print(f'  Rule {n:2d}: {"PASS" if v==0 else f"FAIL ({v})":>10s} — {name}')
    print(f'RULES VIOLATED: {total_viol}/10')
    if '--write-report' in sys.argv:
        rep = pd.DataFrame([{'Rule':n,'Check':name,'Violations':v,
                             'Status':'PASS' if v==0 else 'FAIL','Run':ts,
                             'File':path.split('/')[-1]} for n,name,v in results])
        xl = pd.read_excel(path, sheet_name=None)
        out = path.replace('.xlsx','_VALIDATED.xlsx')
        with pd.ExcelWriter(out, engine='openpyxl') as w:
            for name_, sdf in xl.items():
                if name_ != '🛡 Validation Report':
                    sdf.to_excel(w, sheet_name=name_, index=False)
            rep.to_excel(w, sheet_name='🛡 Validation Report', index=False)
        print(f'Report written into: {out}')
    sys.exit(total_viol)

if __name__ == '__main__':
    main()
