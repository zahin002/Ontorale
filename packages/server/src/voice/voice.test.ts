import { describe, it, expect } from 'vitest';
import { Game } from '../game/Game';
import { FakeClock } from '../game/clock';
import { FakeVoiceProvider } from './FakeVoiceProvider';
import type { Phase } from '@ontorale/shared';

describe('VOICE-01: Voice permissions synchronization', () => {
  it('implements permission matrix across all phases, death, silence and disconnect', async () => {
    const clock = new FakeClock();
    const voice = new FakeVoiceProvider();
    const game = new Game({
      roomCode: 'VOICE1',
      clock,
      voiceProvider: voice,
    });

    const pubRoom = 'ontorale-VOICE1-pub';
    const mafRoom = 'ontorale-VOICE1-maf';

    const pCitizen = game.addPlayer('Citizen', true);
    const pKiller = game.addPlayer('Killer', false);
    const pSilenced = game.addPlayer('Silenced', false);
    const pDead = game.addPlayer('Dead', false);

    if ('error' in pCitizen || 'error' in pKiller || 'error' in pSilenced || 'error' in pDead) {
      throw new Error();
    }

    const cid = pCitizen.player.id;
    const kid = pKiller.player.id;
    const sid = pSilenced.player.id;
    const did = pDead.player.id;

    pCitizen.player.role = 'citizen';
    pKiller.player.role = 'killer';
    pSilenced.player.role = 'citizen';
    pSilenced.player.silenced = true;
    pDead.player.role = 'citizen';
    pDead.player.status = 'dead';

    // Issue tokens so participants exist in fake provider
    await voice.issueToken(pubRoom, cid, 'Citizen');
    await voice.issueToken(pubRoom, kid, 'Killer');
    await voice.issueToken(pubRoom, sid, 'Silenced');
    await voice.issueToken(pubRoom, did, 'Dead');

    await voice.issueToken(mafRoom, kid, 'Killer');

    // 1. Lobby: every connected player can publish in public room
    game.phase = 'lobby';
    await game.syncVoicePermissions();
    expect(voice.getParticipant(pubRoom, cid)?.canPublish).toBe(true);
    expect(voice.getParticipant(pubRoom, kid)?.canPublish).toBe(true);
    expect(voice.getParticipant(pubRoom, sid)?.canPublish).toBe(true);
    expect(voice.getParticipant(mafRoom, kid)?.canPublish).toBe(false);

    // 2. Night: nobody in public room, alive mafia in mafia room
    game.phase = 'night';
    await game.syncVoicePermissions();
    expect(voice.getParticipant(pubRoom, cid)?.canPublish).toBe(false);
    expect(voice.getParticipant(pubRoom, kid)?.canPublish).toBe(false);
    expect(voice.getParticipant(mafRoom, kid)?.canPublish).toBe(true);

    // 3. NightResult: nobody in public, nobody in mafia
    game.phase = 'nightResult';
    await game.syncVoicePermissions();
    expect(voice.getParticipant(pubRoom, cid)?.canPublish).toBe(false);
    expect(voice.getParticipant(mafRoom, kid)?.canPublish).toBe(false);

    // 4. Discussion: alive and not silenced in public, nobody in mafia
    game.phase = 'discussion';
    await game.syncVoicePermissions();
    expect(voice.getParticipant(pubRoom, cid)?.canPublish).toBe(true);
    expect(voice.getParticipant(pubRoom, kid)?.canPublish).toBe(true);
    // Silenced player cannot publish in public room
    expect(voice.getParticipant(pubRoom, sid)?.canPublish).toBe(false);
    // Dead player cannot publish in public room
    expect(voice.getParticipant(pubRoom, did)?.canPublish).toBe(false);
    expect(voice.getParticipant(mafRoom, kid)?.canPublish).toBe(false);

    // 5. Voting, MayorTiebreak, VoteResult: nobody in public, nobody in mafia
    for (const ph of ['voting', 'mayorTiebreak', 'voteResult'] as Phase[]) {
      game.phase = ph;
      await game.syncVoicePermissions();
      expect(voice.getParticipant(pubRoom, cid)?.canPublish).toBe(false);
      expect(voice.getParticipant(pubRoom, kid)?.canPublish).toBe(false);
      expect(voice.getParticipant(mafRoom, kid)?.canPublish).toBe(false);
    }

    // 6. GameOver: everyone in public room, mafia room destroyed
    game.phase = 'gameOver';
    await game.syncVoicePermissions();
    expect(voice.getParticipant(pubRoom, cid)?.canPublish).toBe(true);
    expect(voice.getParticipant(pubRoom, kid)?.canPublish).toBe(true);
    expect(voice.getParticipant(pubRoom, did)?.canPublish).toBe(true);
    // Mafia room destroyed
    expect(await voice.listParticipants(mafRoom)).toEqual([]);
  });
});
