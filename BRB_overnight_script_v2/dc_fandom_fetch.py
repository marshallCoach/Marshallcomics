#!/usr/bin/env python3
"""
DC Fandom Wiki fetcher — extracts Writer, Artist, Cover Artist, Year
from dc.fandom.com using predictable URL construction.

URL pattern: https://dc.fandom.com/wiki/{Title_Vol_N}_{Issue}
Example: The Flash Vol 2 163 -> The_Flash_Vol_2_163

Works for ALL DC titles in inventory, not just ones that need web search.
"""

import re
import time
import requests
from bs4 import BeautifulSoup

BASE = "https://dc.fandom.com/wiki/"
HEADERS = {"User-Agent": "BRB-Comics-Inventory/1.0 (educational, non-commercial)"}

def slugify(title, volume, issue):
    """Build the DC Fandom wiki slug from Title + Volume + Issue."""
    # Normalise title: spaces to underscores, strip special chars except / and :
    t = str(title).strip()
    t = re.sub(r'\s+', '_', t)
    # Remove characters the wiki doesn't use in slugs
    t = re.sub(r'[^A-Za-z0-9_\-:/]', '', t)
    v = str(int(float(volume))) if volume else '1'
    i = str(int(float(issue))) if '.' not in str(issue) else str(issue)
    return f"{t}_Vol_{v}_{i}"

def fetch_dc_fandom(title, volume, issue, retry=2):
    """
    Fetch a DC Fandom page and extract creator credits.
    Returns dict with keys: writer, penciler, cover_artist, year, found (bool)
    """
    slug = slugify(title, volume, issue)
    url = BASE + slug
    
    for attempt in range(retry):
        try:
            r = requests.get(url, headers=HEADERS, timeout=10)
            if r.status_code == 404:
                return {"found": False, "url": url}
            if r.status_code != 200:
                time.sleep(2)
                continue
            
            soup = BeautifulSoup(r.text, 'html.parser')
            
            result = {"found": True, "url": url,
                      "writer": None, "penciler": None, 
                      "cover_artist": None, "year": None}
            
            # Extract from categories — most reliable source on these pages
            # Format: "Pat McGreal/Writer", "Ron Lim/Penciler", "Steve Lightle/Cover Artist"
            cats = soup.find_all('a', href=re.compile(r'/wiki/Category:'))
            for cat in cats:
                text = cat.get_text(strip=True)
                if '/Writer' in text:
                    name = text.replace('/Writer', '').strip()
                    if result['writer']:
                        result['writer'] += f', {name}'
                    else:
                        result['writer'] = name
                elif '/Penciler' in text:
                    name = text.replace('/Penciler', '').strip()
                    if result['penciler']:
                        result['penciler'] += f', {name}'
                    else:
                        result['penciler'] = name
                elif '/Cover_Artist' in text or '/Cover Artist' in text:
                    name = text.replace('/Cover_Artist', '').replace('/Cover Artist', '').strip()
                    if result['cover_artist']:
                        result['cover_artist'] += f', {name}'
                    else:
                        result['cover_artist'] = name
            
            # Year from page header
            year_match = re.search(r',\s*(\d{4})', r.text[:5000])
            if year_match:
                result['year'] = year_match.group(1)
            
            return result
            
        except Exception as e:
            if attempt < retry - 1:
                time.sleep(3)
            else:
                return {"found": False, "url": url, "error": str(e)}
    
    return {"found": False, "url": url}


def test():
    """Quick sanity check on known pages."""
    print("Testing DC Fandom fetcher...")
    
    result = fetch_dc_fandom("The Flash", 2, 163)
    print(f"\nThe Flash Vol 2 #163:")
    print(f"  Found: {result['found']}")
    print(f"  URL: {result.get('url')}")
    print(f"  Writer: {result.get('writer')}")
    print(f"  Penciler: {result.get('penciler')}")
    print(f"  Cover Artist: {result.get('cover_artist')}")
    print(f"  Year: {result.get('year')}")

if __name__ == "__main__":
    test()
