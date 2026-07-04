// Wrapper around the auto-generated data3.ts.
// Checks localStorage for a brb_data_v1 override so the static offline site
// can accept new inventory data without a rebuild.
// NOTE: catalogs always come from static data — the localStorage override only
// covers comics + boxes (the main inventory).

import { DATA3 as _DATA3 } from "./data3";
export type { Comic, BoxSummary, CatalogComic } from "./data3";

export const DATA_LS_KEY = "brb_data_v1";

function loadOverride(): Pick<typeof _DATA3, "comics" | "boxes"> | null {
  try {
    const raw = localStorage.getItem(DATA_LS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as typeof _DATA3;
    if (!Array.isArray(parsed?.comics) || !Array.isArray(parsed?.boxes)) return null;
    return { comics: parsed.comics, boxes: parsed.boxes };
  } catch { return null; }
}

const override = loadOverride();

export const DATA = {
  comics:   override?.comics   ?? _DATA3.comics,
  boxes:    override?.boxes    ?? _DATA3.boxes,
  catalogs: _DATA3.catalogs,   // always from static build
};
