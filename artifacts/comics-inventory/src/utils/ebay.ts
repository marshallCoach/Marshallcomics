// Conservative eBay headline price: the LOWER of eBay Median and Avg, ignoring
// nulls. Median wins whenever Avg is skewed by an outlier sale (the pricing tool
// flags those "trust median"); if only one exists, that one is used.
export function ebayHeadline(
  c: { eBay_Median?: number | null; eBay_Avg?: number | null }
): number | null {
  const vals = [c.eBay_Median, c.eBay_Avg].filter(
    (v): v is number => v != null && Number.isFinite(v)
  );
  return vals.length ? Math.min(...vals) : null;
}
