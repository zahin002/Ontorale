import type { PlayerId } from './types';

export function tally(aliveIds: PlayerId[], votes: Record<PlayerId, PlayerId | null>) {
  const alive = new Set(aliveIds);
  const counts: Record<PlayerId, number> = {};
  for (const [voter, target] of Object.entries(votes)) {
    if (!alive.has(voter) || target === null || !alive.has(target) || target === voter) continue;
    counts[target] = (counts[target] ?? 0) + 1;
  }
  const max = Math.max(0, ...Object.values(counts));
  const top = max > 0 ? Object.keys(counts).filter((id) => counts[id] === max) : [];
  return { counts, max, top }; // top.length: 0 none, 1 eliminate, >=2 tie
}

