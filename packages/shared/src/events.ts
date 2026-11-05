import type { GameEvent, PlayerId, Role, Cause } from './types';

export function createDeathEvent(
  id: PlayerId,
  causes: Cause[],
  role: Role,
): Extract<GameEvent, { kind: 'death' }> {
  return { kind: 'death', id, causes, role };
}

export function createSavedEvent(id: PlayerId, from: Cause): Extract<GameEvent, { kind: 'saved' }> {
  return { kind: 'saved', id, from };
}

export function createSilencedEvent(id: PlayerId): Extract<GameEvent, { kind: 'silenced' }> {
  return { kind: 'silenced', id };
}

export function createNoDeathsEvent(): Extract<GameEvent, { kind: 'noDeaths' }> {
  return { kind: 'noDeaths' };
}

export function createVoteOutEvent(
  id: PlayerId,
  role: Role,
  by: 'vote' | 'mayor',
): Extract<GameEvent, { kind: 'voteOut' }> {
  return { kind: 'voteOut', id, role, by };
}

export function createVoteTieEvent(): Extract<GameEvent, { kind: 'voteTie' }> {
  return { kind: 'voteTie' };
}

export function createNoEliminationEvent(): Extract<GameEvent, { kind: 'noElimination' }> {
  return { kind: 'noElimination' };
}

export function createDisconnectedEvent(
  id: PlayerId,
  role: Role,
): Extract<GameEvent, { kind: 'disconnected' }> {
  return { kind: 'disconnected', id, role };
}

export function createGameOverEvent(
  winner: 'citizens' | 'mafia',
): Extract<GameEvent, { kind: 'gameOver' }> {
  return { kind: 'gameOver', winner };
}
