// Wrapper around the auto-generated data3.ts.
// Checks localStorage for a brb_data_v1 override so the static offline site
// can accept new inventory data without a rebuild.

import { DATA3 as _DATA3 } from "./data3";
export type { Comic, BoxSummary } from "./data3";

export const DATA_LS_KEY = "brb_data_v1";

function loadOverride(): typeof _DATA3 | null {
  try {
    const raw = localStorage.getItem(DATA_LS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as typeof _DATA3;
    if (!Array.isArray(parsed?.comics) || !Array.isArray(parsed?.boxes)) return null;
    return parsed;
  } catch { return null; }
}

export const DATA = loadOverride() ?? _DATA3;
