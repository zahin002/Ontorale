import { AccessToken, RoomServiceClient } from 'livekit-server-sdk';
import type { VoiceProvider } from './VoiceProvider';

export class LiveKitProvider implements VoiceProvider {
  private url: string;
  private apiKey: string;
  private apiSecret: string;
  private roomService: RoomServiceClient;

  constructor(url: string, apiKey: string, apiSecret: string) {
    this.url = url;
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
    // RoomServiceClient takes HTTP/HTTPS URL
    const httpUrl = url.replace(/^wss:\/\//, 'https://').replace(/^ws:\/\//, 'http://');
    this.roomService = new RoomServiceClient(httpUrl, apiKey, apiSecret);
  }

  async issueToken(
    room: string,
    identity: string,
    name: string,
  ): Promise<{ url: string; token: string }> {
    const at = new AccessToken(this.apiKey, this.apiSecret, {
      identity,
      name,
      ttl: '2h',
    });

    at.addGrant({
      room,
      roomJoin: true,
      canPublish: false,
      canSubscribe: true,
      canPublishData: false,
    });

    return {
      url: this.url,
      token: await at.toJwt(),
    };
  }

  async setCanPublish(room: string, identity: string, canPublish: boolean): Promise<void> {
    await this.roomService.updateParticipant(room, identity, undefined, {
      canPublish,
      canSubscribe: true,
      canPublishData: false,
    });
  }

  async removeParticipant(room: string, identity: string): Promise<void> {
    try {
      await this.roomService.removeParticipant(room, identity);
    } catch {
      // Ignore if participant already left
    }
  }

  async listParticipants(room: string): Promise<string[]> {
    try {
      const participants = await this.roomService.listParticipants(room);
      return participants.map((p) => p.identity);
    } catch {
      return [];
    }
  }

  async destroyRoom(room: string): Promise<void> {
    try {
      await this.roomService.deleteRoom(room);
    } catch {
      // Ignore if room does not exist
    }
  }
}
