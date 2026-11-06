export interface VoiceProvider {
  issueToken(room: string, identity: string, name: string): Promise<{ url: string; token: string }>;
  setCanPublish(room: string, identity: string, canPublish: boolean): Promise<void>;
  removeParticipant(room: string, identity: string): Promise<void>;
  listParticipants(room: string): Promise<string[]>;
  destroyRoom(room: string): Promise<void>;
}
