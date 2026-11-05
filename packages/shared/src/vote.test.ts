import { describe, it, expect } from 'vitest';
import { tally } from './vote';

describe('tally - VOTE-01 suite', () => {
  const aliveIds = ['p1', 'p2', 'p3', 'p4', 'p5'];

  it('all abstain: nobody receives votes', () => {
    const votes = {
      p1: null,
      p2: null,
      p3: null,
      p4: null,
      p5: null,
    };
    const result = tally(aliveIds, votes);
    expect(result.counts).toEqual({});
    expect(result.max).toBe(0);
    expect(result.top).toEqual([]);
  });

  it('single leader: player with highest votes wins', () => {
    const votes = {
      p1: 'p2',
      p3: 'p2',
      p4: 'p5',
      p5: 'p2',
    };
    const result = tally(aliveIds, votes);
    expect(result.counts).toEqual({ p2: 3, p5: 1 });
    expect(result.max).toBe(3);
    expect(result.top).toEqual(['p2']);
  });

  it('2-way tie: two players have the exact maximum votes', () => {
    const tiedVotes = {
      p1: 'p2',
      p3: 'p2',
      p4: 'p5',
      p2: 'p5',
    };
    const result = tally(aliveIds, tiedVotes);
    expect(result.counts).toEqual({ p2: 2, p5: 2 });
    expect(result.max).toBe(2);
    expect(result.top.sort()).toEqual(['p2', 'p5'].sort());
  });

  it('3-way tie: three players have the exact maximum votes', () => {
    const votes = {
      p1: 'p2',
      p3: 'p4',
      p5: 'p1',
    };
    const result = tally(aliveIds, votes);
    expect(result.counts).toEqual({ p1: 1, p2: 1, p4: 1 });
    expect(result.max).toBe(1);
    expect(result.top.sort()).toEqual(['p1', 'p2', 'p4'].sort());
  });

  it('ignores votes for dead target', () => {
    const votes = {
      p1: 'pDead', // pDead is not in aliveIds
      p2: 'p3',
    };
    const result = tally(aliveIds, votes);
    expect(result.counts).toEqual({ p3: 1 });
    expect(result.top).toEqual(['p3']);
  });

  it('ignores votes from dead voters', () => {
    const votes = {
      pDead: 'p3', // pDead is not in aliveIds
      p1: 'p2',
    };
    const result = tally(aliveIds, votes);
    expect(result.counts).toEqual({ p2: 1 });
    expect(result.top).toEqual(['p2']);
  });

  it('ignores self-votes', () => {
    const votes = {
      p1: 'p1', // self vote
      p2: 'p3',
    };
    const result = tally(aliveIds, votes);
    expect(result.counts).toEqual({ p3: 1 });
    expect(result.top).toEqual(['p3']);
  });
});
