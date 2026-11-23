/** Open a verified place when available, otherwise search for the named entity. */
export function getGoogleMapsPinUrl(
  lat: number,
  lon: number,
  name?: string,
): string {
  if (name) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${name}, Malolos, Bulacan`)}`;
  }
  return `https://www.google.com/maps?q=${lat},${lon}`;
}

/** Open Street View at the coordinates via the Maps URLs API (no key needed). */
export function getGoogleStreetViewUrl(lat: number, lon: number): string {
  return `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lon}`;
}
