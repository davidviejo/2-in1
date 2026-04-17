import { AuditInput, CompetitorClass, Listing } from "@/lib/types";

const CATEGORY_MATCH_THRESHOLD = 0.55;

const normalize = (text: string) => text.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");

const scoreCategoryAffinity = (target: string, candidate: Listing): number => {
  const seed = normalize(target);
  const cat = normalize(candidate.primaryCategory);
  const secondary = candidate.secondaryCategories.map(normalize).join(" ");

  if (cat.includes(seed) || seed.includes(cat)) return 1;
  if (secondary.includes(seed)) return 0.75;
  if (seed.split(" ").some((token) => token.length > 4 && (cat.includes(token) || secondary.includes(token)))) {
    return 0.6;
  }
  return 0.25;
};

const classify = (affinity: number, distanceKm: number): CompetitorClass => {
  if (affinity >= CATEGORY_MATCH_THRESHOLD && distanceKm <= 6) return "directo";
  if (affinity >= 0.45 && distanceKm <= 10) return "parcial";
  return "irrelevante";
};

const haversineKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return 6371 * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
};

export function classifyCompetitors(input: AuditInput, target: Listing, listings: Listing[]) {
  return listings
    .filter((entry) => entry.sourceId !== target.sourceId)
    .map((entry) => {
      const affinity = scoreCategoryAffinity(input.category || input.primaryKeyword, entry);
      const distanceKm = haversineKm(target.lat, target.lng, entry.lat, entry.lng);
      const classification = classify(affinity, distanceKm);
      return {
        listing: entry,
        classification,
        rationale: `Afinidad ${(affinity * 100).toFixed(0)}% y distancia ${distanceKm.toFixed(1)} km.`
      };
    })
    .sort((a, b) => {
      const weight = { directo: 0, parcial: 1, irrelevante: 2 };
      return weight[a.classification] - weight[b.classification] || b.listing.reviewCount - a.listing.reviewCount;
    });
}
