/** Blueprint §25F exact body/stock prices. Pure quotes; no automatic repair. */
const integer = (x: number, lo = 0) => {
  if (!Number.isSafeInteger(x) || x < lo) throw new Error('Recovery integer domain');
};
const ceil = (n: bigint, d: bigint) => (n + d - 1n) / d;
const safe = (n: bigint) => {
  if (n > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('Recovery price exceeds safe wallet');
  return Number(n);
};
export interface BodyInvestment {
  body: number;
  maximum: number;
  baseCost: number;
  enhancementPaid: number;
  promotionCoresPaid: number;
  warden: boolean;
  core: boolean;
  refundLocked: boolean;
  emergencyCreated: boolean;
}
function validate(a: BodyInvestment): void {
  integer(a.body);
  integer(a.maximum, 1);
  integer(a.baseCost);
  integer(a.enhancementPaid);
  integer(a.promotionCoresPaid);
  if (a.body > a.maximum || (a.core && a.warden)) throw new Error('Recovery body identity/domain');
}
/** Requested restoration uses fixed-point body units, not rounded display HP. */
export function quoteRepair(a: BodyInvestment, requested: number) {
  validate(a);
  integer(requested, 1);
  if (!a.core && a.body === 0) throw new Error('Restore the wreck before repairing');
  const restored = Math.min(requested, a.maximum - a.body);
  const points = BigInt(restored),
    units = 1024n;
  const direct = ceil(points, 10n * units);
  const scaled = ceil(BigInt(a.warden ? 500 : a.baseCost) * points, 4n * BigInt(a.maximum));
  const credits = safe(a.core ? direct : direct < scaled ? direct : scaled);
  return { restored, body: a.body + restored, credits };
}
export function quoteRestore(a: BodyInvestment) {
  validate(a);
  if (a.core || a.body !== 0) throw new Error('Only a non-Core wreck can Restore');
  const base = BigInt(a.warden ? 500 : a.baseCost);
  const cost = ceil(8n * base + BigInt(a.enhancementPaid), 20n);
  return { body: Number(ceil(BigInt(a.maximum), 2n)), credits: safe(cost > base ? base : cost) };
}
export function quoteSale(a: BodyInvestment, ownedWardenCount = 1) {
  validate(a);
  if (a.core) throw new Error('Core cannot be sold');
  integer(ownedWardenCount, 1);
  if (a.warden && ownedWardenCount < 2) throw new Error('The last owned Warden cannot be sold');
  const base = a.emergencyCreated ? 0n : BigInt(a.warden ? 500 : a.baseCost);
  const credits = a.refundLocked
    ? 0
    : safe(
        ((3n * base + 2n * BigInt(a.enhancementPaid)) * BigInt(a.body)) / (4n * BigInt(a.maximum)),
      );
  return { credits, promotionCores: a.promotionCoresPaid };
}

/** Temporary engineer stock must be removed before this permanent-stock quote. */
export function quoteRearm(
  baseCost: number,
  initial: number,
  permanent: number,
  requested: number,
) {
  integer(baseCost);
  integer(initial, 1);
  integer(permanent);
  integer(requested, 1);
  if (initial > 8 || permanent > initial) throw new Error('Permanent trap stock out of range');
  const restored = Math.min(requested, initial - permanent);
  return {
    restored,
    permanent: permanent + restored,
    credits: safe(ceil(BigInt(baseCost) * BigInt(restored), 4n * BigInt(initial))),
  };
}
