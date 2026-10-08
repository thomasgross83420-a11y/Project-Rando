import { deployedCampaign } from './campaign';
import { validateCampaign } from '../../src/persistence/campaign';
/** Four independent sources around one injured mechanical recipient. */
export function supportCampaign(order: 'receiver-first' | 'receiver-last') {
  const c = deployedCampaign(),
    node = c.assets.find((a) => a.type === 'friendly.repair_node');
  if (!node) throw new Error('Missing Node');
  for (const a of c.assets) if (a.type !== c.warden) a.placement = null;
  const nodes = [node];
  for (let i = 14; i <= 16; i++) {
    const a = {
      ...node,
      id: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
      placement: null,
    };
    c.assets.push(a);
    nodes.push(a);
  }
  const index = order === 'receiver-first' ? 0 : 3,
    receiver = nodes[index];
  if (!receiver) throw new Error('Missing receiver');
  const spots = [
    [18, 20],
    [20, 18],
    [22, 20],
  ] as const;
  let next = 0;
  for (const [i, a] of nodes.entries()) {
    const spot = i === index ? ([20, 20] as const) : spots[next++];
    if (!spot) throw new Error('Missing placement');
    a.placement = { x: spot[0], y: spot[1], rotation: 0 };
  }
  receiver.hp = 400 * 1024;
  validateCampaign(c);
  return { campaign: c, receiverID: receiver.id };
}
