export function normalizeTravellingType(value) {
  const text = String(value || '').trim().toLowerCase();
  if (text === 'flight') return 'Flight';
  return 'Train';
}

export function parseDateRanges(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function dateAtStart(dateStr) {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return d;
}

export function getDateWiseBasePrice(priceRow, fromDate, toDate) {
  const ranges = parseDateRanges(priceRow?.date_ranges);
  if (!ranges.length) return Number(priceRow?.base_price || 0);
  const from = dateAtStart(fromDate);
  const to = dateAtStart(toDate || fromDate);
  if (!from || !to) return 0;

  // Prefer a range that fully contains selected window.
  const containing = ranges.find((r) => {
    const rf = dateAtStart(r.from_date);
    const rt = dateAtStart(r.to_date);
    return rf && rt && from >= rf && to <= rt;
  });
  if (containing) return Number(containing.base_price || 0);

  // Fallback to first overlapping range.
  const overlap = ranges.find((r) => {
    const rf = dateAtStart(r.from_date);
    const rt = dateAtStart(r.to_date);
    return rf && rt && from <= rt && to >= rf;
  });
  if (overlap) return Number(overlap.base_price || 0);

  return 0;
}

export function getTravellingRowAmount(priceRow, fromDate, toDate) {
  const base = getDateWiseBasePrice(priceRow, fromDate, toDate);
  const markup = Number(priceRow?.markup_price || 0);
  return base + markup;
}
