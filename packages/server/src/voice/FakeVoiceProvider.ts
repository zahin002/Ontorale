import type { VoiceProvider } from './VoiceProvider';

interface FakeParticipant {
  identity: string;
  name: string;
  canPublish: boolean;
}

export class FakeVoiceProvider implements VoiceProvider {
  private rooms = new Map<string, Map<string, FakeParticipant>>();

  async issueToken(
    room: string,
    identity: string,
    name: string,
  ): Promise<{ url: string; token: string }> {
    if (!this.rooms.has(room)) {
      this.rooms.set(room, new Map());
    }
    const r = this.rooms.get(room)!;
    if (!r.has(identity)) {
      r.set(identity, { identity, name, canPublish: false });
    }
    return {
      url: 'fake://livekit',
      token: `fake-token-${room}-${identity}`,
    };
  }

  async setCanPublish(room: string, identity: string, canPublish: boolean): Promise<void> {
    const p = this.rooms.get(room)?.get(identity);
    if (p) {
      p.canPublish = canPublish;
    }
  }

  async removeParticipant(room: string, identity: string): Promise<void> {
    this.rooms.get(room)?.delete(identity);
  }

  async listParticipants(room: string): Promise<string[]> {
    const r = this.rooms.get(room);
    if (!r) return [];
    return Array.from(r.keys());
  }

  async destroyRoom(room: string): Promise<void> {
    this.rooms.delete(room);
  }

  // Helper for tests to inspect participant permission
  getParticipant(room: string, identity: string): FakeParticipant | undefined {
    return this.rooms.get(room)?.get(identity);
  }
}
