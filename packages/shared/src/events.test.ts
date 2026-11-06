import { describe, it, expect } from 'vitest';
import {
  createDeathEvent,
  createSavedEvent,
  createSilencedEvent,
  createNoDeathsEvent,
  createVoteOutEvent,
  createVoteTieEvent,
  createNoEliminationEvent,
  createDisconnectedEvent,
  createGameOverEvent,
} from './events';

describe('events factory', () => {
  it('creates death event', () => {
    const e = createDeathEvent('p1', ['mafia', 'police'], 'citizen');
    expect(e).toEqual({ kind: 'death', id: 'p1', causes: ['mafia', 'police'], role: 'citizen' });
  });

  it('creates saved event', () => {
    const e = createSavedEvent('p1', 'mafia');
    expect(e).toEqual({ kind: 'saved', id: 'p1', from: 'mafia' });
  });

  it('creates silenced event', () => {
    const e = createSilencedEvent('p1');
    expect(e).toEqual({ kind: 'silenced', id: 'p1' });
  });

  it('creates noDeaths event', () => {
    const e = createNoDeathsEvent();
    expect(e).toEqual({ kind: 'noDeaths' });
  });

  it('creates voteOut event', () => {
    const e = createVoteOutEvent('p1', 'killer', 'vote');
    expect(e).toEqual({ kind: 'voteOut', id: 'p1', role: 'killer', by: 'vote' });
  });

  it('creates voteTie event', () => {
    const e = createVoteTieEvent();
    expect(e).toEqual({ kind: 'voteTie' });
  });

  it('creates noElimination event', () => {
    const e = createNoEliminationEvent();
    expect(e).toEqual({ kind: 'noElimination' });
  });

  it('creates disconnected event', () => {
    const e = createDisconnectedEvent('p1', 'doctor');
    expect(e).toEqual({ kind: 'disconnected', id: 'p1', role: 'doctor' });
  });

  it('creates gameOver event', () => {
    const e = createGameOverEvent('citizens');
    expect(e).toEqual({ kind: 'gameOver', winner: 'citizens' });
  });
});
