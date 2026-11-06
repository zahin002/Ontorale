import { describe, it, expect, vi } from 'vitest';
import { LiveKitProvider } from './LiveKitProvider';

vi.mock('livekit-server-sdk', () => {
  return {
    AccessToken: vi.fn().mockImplementation(() => ({
      addGrant: vi.fn(),
      toJwt: vi.fn().mockResolvedValue('jwt-mock-token'),
    })),
    RoomServiceClient: vi.fn().mockImplementation(() => ({
      updateParticipant: vi.fn().mockResolvedValue(undefined),
      removeParticipant: vi.fn().mockResolvedValue(undefined),
      listParticipants: vi.fn().mockResolvedValue([{ identity: 'p1' }, { identity: 'p2' }]),
      deleteRoom: vi.fn().mockResolvedValue(undefined),
    })),
  };
});

describe('LiveKitProvider', () => {
  it('issues tokens, updates permissions, lists, removes, and destroys rooms', async () => {
    const provider = new LiveKitProvider('wss://livekit.example.com', 'key', 'secret');

    // issueToken
    const token = await provider.issueToken('room1', 'p1', 'Player 1');
    expect(token).toEqual({
      url: 'wss://livekit.example.com',
      token: 'jwt-mock-token',
    });

    // setCanPublish
    await expect(provider.setCanPublish('room1', 'p1', true)).resolves.toBeUndefined();

    // removeParticipant
    await expect(provider.removeParticipant('room1', 'p1')).resolves.toBeUndefined();

    // listParticipants
    const participants = await provider.listParticipants('room1');
    expect(participants).toEqual(['p1', 'p2']);

    // destroyRoom
    await expect(provider.destroyRoom('room1')).resolves.toBeUndefined();
  });
});
