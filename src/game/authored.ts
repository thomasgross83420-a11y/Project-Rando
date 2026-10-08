import index from '../../public/content/full/index.json';
import { planSchema } from './validation';
import { FULL_VERSION, type Difficulty, type Plan } from './model';
import { planDigest, validatePlan } from './director';
const cache = new Map<string, Plan>();
export async function authored(
  kind: 'campaign' | 'mastery',
  number: number,
  difficulty: Difficulty,
): Promise<Plan> {
  const file = `${kind}-${number}-${difficulty}.json`,
    expected = (index.files as Record<string, string>)[file];
  if (index.version !== FULL_VERSION || !expected)
    throw new Error('This authored encounter is unavailable in the installed content version');
  const existing = cache.get(file);
  if (existing) return structuredClone(existing);
  const response = await fetch(import.meta.env.BASE_URL + 'content/full/' + file);
  if (!response.ok)
    throw new Error(
      'The authored encounter could not load. Retry when your connection is available.',
    );
  const plan = planSchema.parse(await response.json());
  if (plan.hash !== expected || (await planDigest(plan)) !== expected)
    throw new Error('Authored encounter checksum mismatch');
  validatePlan(plan);
  cache.set(file, plan);
  if (cache.size > 4) cache.delete(cache.keys().next().value!);
  return structuredClone(plan);
}
