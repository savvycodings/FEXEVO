/** Mirrors BEXevo's `src/club/clubDefinitions.ts` CLUB_AMENITY_KEYS — server is the source of
 * truth for validation, this just supplies display labels (same split as achievementsCatalog.ts
 * vs. the server's ACHIEVEMENT_KEYS). Unknown keys fall back to the raw key so nothing silently
 * disappears if the two ever drift. */
const AMENITY_LABELS: Record<string, string> = {
  parking: "Parking",
  showers: "Showers",
  lockers: "Lockers",
  pro_shop: "Pro shop",
  lighting: "Court lighting",
  air_conditioning: "Air conditioning",
  restaurant_bar: "Restaurant / bar",
  kids_area: "Kids area",
  wifi: "Wi-Fi",
  equipment_rental: "Equipment rental",
  wheelchair_accessible: "Wheelchair accessible",
};

export function amenityLabel(key: string): string {
  return AMENITY_LABELS[key] ?? key;
}
