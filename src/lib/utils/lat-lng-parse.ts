/**
 * Parse a single text field containing two numbers (comma, space, or semicolon separated).
 * Detects whether values are (lat, lng) or (lng, lat) using valid ranges:
 * latitude ∈ [-90, 90], longitude ∈ [-180, 180].
 */

export function parseLatLngString(raw: string): { lat: number; lng: number } | null {
  const s = raw.trim();
  if (!s) return null;

  const matches = s.match(/-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g);
  if (!matches || matches.length < 2) return null;
  if (matches.length > 2) return null;

  const a = Number(matches[0]);
  const b = Number(matches[1]);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;

  const validLat = (n: number) => Math.abs(n) <= 90;
  const validLng = (n: number) => Math.abs(n) <= 180;

  // First value cannot be latitude (e.g. 122, 10.7 → Philippines-style lng, lat)
  if (!validLat(a) && validLat(b) && validLng(a)) {
    return { lat: b, lng: a };
  }

  // Standard lat, lng
  if (validLat(a) && validLng(b)) {
    return { lat: a, lng: b };
  }

  // Swapped: lng, lat when second can't be lng
  if (validLat(b) && validLng(a)) {
    return { lat: b, lng: a };
  }

  return null;
}

export function formatLatLngInputValue(lat: number, lng: number): string {
  return `${lat}, ${lng}`;
}
