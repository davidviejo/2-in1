import { Listing, ScoringBlock } from "@/lib/types";

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

export function calculateScoring(target: Listing, benchmark: Listing[]): ScoringBlock[] {
  const avgRating = benchmark.reduce((acc, cur) => acc + cur.rating, 0) / (benchmark.length || 1);
  const avgReviews = benchmark.reduce((acc, cur) => acc + cur.reviewCount, 0) / (benchmark.length || 1);
  const avgAttributes = benchmark.reduce((acc, cur) => acc + cur.attributes.length, 0) / (benchmark.length || 1);

  const blocks: ScoringBlock[] = [
    {
      key: "completitud",
      label: "Completitud de ficha",
      score: clamp(40 + target.attributes.length * 12 + (target.website ? 10 : 0)),
      benchmark: clamp(40 + avgAttributes * 12 + 10),
      gap: 0
    },
    {
      key: "reputacion",
      label: "Reputación visible",
      score: clamp(target.rating * 18 + Math.log10(target.reviewCount + 1) * 20),
      benchmark: clamp(avgRating * 18 + Math.log10(avgReviews + 1) * 20),
      gap: 0
    },
    {
      key: "operativa",
      label: "Cobertura operativa",
      score: clamp((target.workHours.includes("24h") ? 100 : 68) + target.attributes.length * 4),
      benchmark: 80,
      gap: 0
    },
    {
      key: "consistencia",
      label: "Consistencia competitiva",
      score: clamp(55 + (target.phone ? 15 : 0) + (target.address ? 15 : 0) + (target.website ? 15 : 0)),
      benchmark: 90,
      gap: 0
    }
  ];

  return blocks.map((item) => ({ ...item, gap: item.score - item.benchmark }));
}
