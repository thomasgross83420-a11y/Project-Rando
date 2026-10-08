/** First ordinary campaign encounter. The schedule remains authored; its
 * persistent body, stock and frozen growth are distinct from practice/studies. */
import { z } from 'zod';
import { combat, type ActorDefinition } from '../data/combat';
import { foundation } from '../data/foundation';
import { validateCampaign, type ProgressionCampaign } from '../persistence/campaign';
import {
  captureProfile,
  bandDefinition,
  PROFILE_POLICY,
  type CapturedProfile,
} from '../progression/profile';
import { ACCURACY_POLICY } from '../progression/accuracy';
import { CONTRIBUTION_POLICY } from '../progression/contribution';
import { tutorialSchema, tutorialPlan, startSchema } from './tutorial';
import { canonical } from './determinism';

export const campaignTutorialSchema = tutorialSchema.extend({
  schema: z.literal(2),
  mode: z.literal('campaign'),
  stage: z.literal('C01S01'),
  simulation: z.literal('rb-sim-v3'),
  difficulty: z.enum(['Cadet', 'Standard']),
  objectives: z.tuple([z.literal('objective.warden_survives'), z.literal('objective.core_75')]),
});
export type CampaignTutorialPlan = z.infer<typeof campaignTutorialSchema>;
export const profiledPracticePlanSchema = campaignTutorialSchema
  .omit({ stage: true })
  .extend({ mode: z.literal('tutorial-practice') });
export type ProfiledPracticePlan = z.infer<typeof profiledPracticePlanSchema>;
export function profiledPracticePlan(): ProfiledPracticePlan {
  const { stage: _stage, ...plan } = campaignTutorialPlan();
  return profiledPracticePlanSchema.parse({ ...plan, mode: 'tutorial-practice' });
}
export const campaignStartAssetSchema = startSchema.extend({ hp: z.number().int().min(0) });
const frozenAssetSchema = campaignStartAssetSchema.extend({
  level: z.number().int().min(1).max(100),
  enhancement: z.number().int().min(0).max(10),
  permanentStock: z.number().int().min(0).max(1),
});
export const frozenCampaignSchema = z
  .object({
    schema: z.literal(1),
    kind: z.literal('campaign-capture'),
    profilePolicy: z.literal(PROFILE_POLICY),
    accuracyPolicy: z.literal(ACCURACY_POLICY),
    contributionPolicy: z.literal(CONTRIBUTION_POLICY),
    coreHP: z
      .number()
      .int()
      .min(1)
      .max(10000 * 1024),
    army: z.array(frozenAssetSchema).min(1).max(80),
  })
  .strict();
export type FrozenCampaign = z.infer<typeof frozenCampaignSchema>;
export interface CapturedCampaign {
  readonly kind: 'campaign-capture';
  readonly frozen: FrozenCampaign;
  readonly profiles: Readonly<Record<number, CapturedProfile>>;
  readonly enemies: Readonly<Record<'enemy.runner' | 'enemy.raider', ActorDefinition>>;
}
export function campaignTutorialPlan(
  difficulty: 'Cadet' | 'Standard' = 'Standard',
): CampaignTutorialPlan {
  return campaignTutorialSchema.parse({
    ...tutorialPlan(),
    schema: 2,
    mode: 'campaign',
    stage: 'C01S01',
    simulation: 'rb-sim-v3',
    difficulty,
    objectives: ['objective.warden_survives', 'objective.core_75'],
  });
}
export function freezeCampaign(input: ProgressionCampaign): FrozenCampaign {
  const c = validateCampaign(input);
  if (c.schema !== 2) throw new Error('Explicit progression migration required');
  if (c.warden !== 'warden.bulwark' || c.doctrine !== 'Bastion')
    throw new Error('Current combat slice requires selected Bulwark / Bastion');
  if (!c.coreHP) throw new Error('Repair the Core before a campaign siege');
  const army = c.assets
    .filter((a) => a.placement)
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .map((a) => {
      const p = a.placement,
        d = foundation[a.type];
      if (!p || !(a.type in combat)) throw new Error('Deployed type combat is not implemented');
      return {
        uuid: a.id,
        heading: p.rotation * 16384,
        type: a.type,
        x: p.x,
        y: p.y,
        width: p.rotation % 2 ? d.height : d.width,
        height: p.rotation % 2 ? d.width : d.height,
        hp: a.hp,
        level: a.level,
        enhancement: a.enhancement,
        permanentStock: a.permanentCharges ?? 0,
      };
    });
  if (!army.some((a) => a.type === c.warden && a.hp > 0))
    throw new Error('Deploy a living selected Bulwark before a campaign siege');
  return frozenCampaignSchema.parse({
    schema: 1,
    kind: 'campaign-capture',
    profilePolicy: PROFILE_POLICY,
    accuracyPolicy: ACCURACY_POLICY,
    contributionPolicy: CONTRIBUTION_POLICY,
    coreHP: c.coreHP,
    army,
  });
}
export function validateFrozenCampaign(base: ProgressionCampaign, input: unknown): FrozenCampaign {
  const frozen = frozenCampaignSchema.parse(input);
  if (canonical(frozen) !== canonical(freezeCampaign(base)))
    throw new Error('Frozen campaign state mismatch');
  return frozen;
}
export function captureCampaign(input: unknown): CapturedCampaign {
  const frozen = frozenCampaignSchema.parse(input),
    profiles: Record<number, CapturedProfile> = {};
  if (
    new Set(frozen.army.map((a) => a.uuid)).size !== frozen.army.length ||
    canonical(frozen.army) !==
      canonical([...frozen.army].sort((a, b) => (a.uuid < b.uuid ? -1 : a.uuid > b.uuid ? 1 : 0)))
  )
    throw new Error('Frozen campaign identity/order mismatch');
  frozen.army.forEach((a, i) => {
    const p = captureProfile(a.type, a.level, a.enhancement);
    if (a.hp > p.definition.hp || (a.type !== 'friendly.proximity_mine' && a.permanentStock !== 0))
      throw new Error('Frozen campaign body/stock mismatch');
    profiles[i + 2] = p;
    Object.freeze(a);
  });
  Object.freeze(frozen.army);
  Object.freeze(frozen);
  return Object.freeze({
    kind: 'campaign-capture',
    frozen,
    profiles: Object.freeze(profiles),
    enemies: Object.freeze({
      'enemy.runner': bandDefinition('enemy.runner', 1),
      'enemy.raider': bandDefinition('enemy.raider', 1),
    }),
  });
}
