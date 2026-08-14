#!/usr/bin/env python3
"""brb_cover_yeargate.py — fill missing covers from Marvel/DC Fandom, YEAR-GATED.
For each missing-cover row it scans Vol 1..N for that title+issue and keeps the
volume whose Fandom release year matches the row's year (+/-2). This finds the
correct-era cover even when the inventory's Volume is wrong (Green Lantern 2024
etc.). Never writes a cover whose year doesn't match. Free (no CV quota)."""
import glob,os,json,re,time,urllib.parse,urllib.request,shutil,openpyxl
WIKIS=["https://marvel.fandom.com/api.php","https://dc.fandom.com/api.php"]
UA="MCI/1.0"; DELAY=0.4; MAXV=11
COVERS="covers.json"; PUBLIC="artifacts/comics-inventory/public/covers.json"
def ni(v):
    s=str(v).strip().lstrip("#")
    try:
        f=float(s);return str(int(f)) if f==int(f) else s
    except:return s
def nv(v):
    try:return str(int(float(str(v).strip())))
    except:return "1"
def yr(v):
    n=[int(t) for t in re.findall(r"\d{4}",str(v or "")) if 1900<int(t)<2100];return n[0] if n else None
_cache={}
def page(base,title,vol,issue):
    k=(base,title,vol,issue)
    if k in _cache:return _cache[k]
    out=None
    try:
        u=base+"?"+urllib.parse.urlencode({"action":"parse","page":f"{title} Vol {vol} {issue}","prop":"wikitext","format":"json","formatversion":2,"redirects":1})
        d=json.load(urllib.request.urlopen(urllib.request.Request(u,headers={"User-Agent":UA}),timeout=25))
        time.sleep(DELAY)
        wt=d.get("parse",{}).get("wikitext","")
        if wt:
            im=re.search(r"\|\s*Image1?\s*=\s*([^\n|]+\.(?:jpg|png|jpeg))",wt,re.I)
            dm=re.search(r"\|\s*(?:ReleaseDate|CoverDate|Pubyear|Year)\s*=\s*([^\n|]+)",wt)
            if im: out=(im.group(1).strip(),yr(dm.group(1)) if dm else None)
    except Exception: time.sleep(DELAY)
    _cache[k]=out; return out
def imgurl(base,fn):
    try:
        u=base+"?"+urllib.parse.urlencode({"action":"query","titles":"File:"+fn,"prop":"imageinfo","iiprop":"url","format":"json","formatversion":2})
        d=json.load(urllib.request.urlopen(urllib.request.Request(u,headers={"User-Agent":UA}),timeout=25));time.sleep(DELAY)
        for p in d.get("query",{}).get("pages",[]):
            if "imageinfo" in p: return p["imageinfo"][0]["url"].split("/revision/")[0]
    except Exception: pass
    return None
def resolve(title,issue,want_year,hint):
    vols=[hint]+[str(v) for v in range(1,MAXV) if str(v)!=hint]
    for vol in vols:
        for base in WIKIS:
            r=page(base,title,vol,issue)
            if not r: continue
            fn,py=r
            if py and abs(py-want_year)<=2:
                url=imgurl(base,fn)
                if url: return url,py,base.split("//")[1].split(".")[0],vol
    return None
def main():
    import argparse
    ap=argparse.ArgumentParser();ap.add_argument("--limit",type=int,default=0);a=ap.parse_args()
    covers=json.load(open(COVERS))
    x=max(glob.glob("attached_assets/comics_inventory_*.xlsx"),key=os.path.getmtime)
    ws=next(w for w in openpyxl.load_workbook(x,read_only=True,data_only=True).worksheets if w.title.startswith("✅ Clean Inventory"))
    rows=list(ws.iter_rows(values_only=True));H=list(rows[0]);C={n:H.index(n) for n in H if n}
    def g(r,n):
        i=C.get(n);return r[i] if i is not None else None
    def has(t,iss,vol):
        for k in (f"{t}|||{iss}|||{vol}",f"{t}|||{iss}"):
            e=covers.get(k)
            if e and e.get("url"): return True
        return False
    todo=[];seen=set()
    for r in rows[1:]:
        t=str(g(r,'Title') or '').strip();iss=ni(g(r,'Issue #'));vol=nv(g(r,'Volume'));y=yr(g(r,'Year'))
        if not t or not iss or not y or has(t,iss,vol): continue
        if (t,iss,vol) in seen: continue
        seen.add((t,iss,vol)); todo.append((t,iss,vol,y))
    if a.limit: todo=todo[:a.limit]
    print(f"missing covers to resolve (year-gated): {len(todo)}",flush=True)
    filled=0
    for i,(t,iss,vol,y) in enumerate(todo,1):
        res=resolve(t,iss,y,vol)
        if res:
            url,py,wiki,fv=res
            covers[f"{t}|||{iss}|||{vol}"]={"url":url,"large":url,"date":str(py),"source":f"fandom-{wiki}-yg"}
            filled+=1
            if filled%25==0: print(f"  [{i}/{len(todo)}] filled {filled} (last {t} #{iss} -> Vol {fv} {py})",flush=True)
        if i%50==0: json.dump(covers,open(COVERS,"w"))
    json.dump(covers,open(COVERS,"w")); shutil.copy(COVERS,PUBLIC)
    print(f"\nFilled {filled}/{len(todo)} year-matched covers. Run: node gen_data.mjs",flush=True)
if __name__=="__main__": main()
