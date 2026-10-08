/** Blueprint §§9/26E sequential upgrade quotes. No wallet writes/free grants. */
const integer = (n: number, lo: number, hi = Number.MAX_SAFE_INTEGER) => {
  if (!Number.isSafeInteger(n) || n < lo || n > hi) throw new Error('Upgrade integer domain');
};
const promotionCosts = [
  { rank: 10, credits: 1000, cores: 1 },
  { rank: 25, credits: 3000, cores: 3 },
  { rank: 45, credits: 8000, cores: 8 },
  { rank: 70, credits: 20000, cores: 20 },
  { rank: 100, credits: 50000, cores: 50 },
] as const;
export function quoteEnhancement(baseCost: number, level: number, current: number) {
  integer(baseCost, 1);
  integer(level, 1, 100);
  integer(current, 0, 10);
  if (current > Math.floor(level / 10))
    throw new Error('Existing enhancement exceeds level ceiling');
  const next = current + 1;
  if (next > Math.floor(level / 10)) throw new Error('Next enhancement is level locked');
  const numerator = BigInt(baseCost) * BigInt(5 + 3 * next),
    price = (numerator + 19n) / 20n;
  if (price > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('Upgrade price exceeds safe wallet');
  return { enhancement: next, credits: Number(price) };
}
export function quotePromotion(rank: number, level: number, currentStars: number) {
  integer(rank, 1, 100);
  integer(level, 1, 100);
  integer(currentStars, 1, 6);
  if (currentStars > 1) {
    const existing = promotionCosts[currentStars - 2];
    if (!existing) throw new Error('Unknown promotion tier');
    if (rank < existing.rank || level < existing.rank)
      throw new Error('Existing promotion gate mismatch');
  }
  const next = promotionCosts[currentStars - 1];
  if (!next) throw new Error('Already at maximum stars');
  if (rank < next.rank || level < next.rank)
    throw new Error('Promotion needs both rank and asset level');
  return { stars: currentStars + 1, credits: next.credits, cores: next.cores };
}
