import { describe, it, expect } from 'vitest';
import {
  NicknameSchema,
  RoomCodeSchema,
  RoomCreateSchema,
  RoomJoinSchema,
  RoomResumeSchema,
  RoomSettingsSchema,
  ActionSubmitSchema,
  VoteCastSchema,
  MayorDecideSchema,
  ChatSendSchema,
  VoiceTokenSchema,
  VoiceReadySchema,
} from './schemas';

describe('schemas validation', () => {
  it('validates nicknames with trimming and rejects invalid', () => {
    expect(NicknameSchema.parse('  Alice  ')).toBe('Alice');
    expect(NicknameSchema.parse('রহিম')).toBe('রহিম');
    expect(() => NicknameSchema.parse('')).toThrow();
    expect(() => NicknameSchema.parse('a'.repeat(21))).toThrow();
    // Control characters
    expect(() => NicknameSchema.parse('Bad\u0000Name')).toThrow();
  });

  it('validates room codes', () => {
    expect(RoomCodeSchema.parse('abcdef')).toBe('ABCDEF');
    expect(RoomCodeSchema.parse('234567')).toBe('234567');
    expect(() => RoomCodeSchema.parse('ABCDE')).toThrow();
    expect(() => RoomCodeSchema.parse('ABCDEFG')).toThrow();
    // 'O' and 'I' are not in valid chars ABCDEFGHJKLMNPQRSTUVWXYZ23456789
    expect(() => RoomCodeSchema.parse('ABCDOI')).toThrow();
  });

  it('validates room settings', () => {
    const valid = {
      discussionSec: 180,
      voteSec: 60,
      optional: { detective: true, silencer: false, confuser: false, mayor: true },
    };
    expect(RoomSettingsSchema.parse(valid)).toEqual(valid);
    expect(() =>
      RoomSettingsSchema.parse({
        ...valid,
        discussionSec: 100,
      }),
    ).toThrow();
  });

  it('validates RoomCreate and RoomJoin schemas', () => {
    expect(RoomCreateSchema.parse({ nickname: 'Host' })).toEqual({ nickname: 'Host' });
    expect(RoomJoinSchema.parse({ roomCode: 'ABCDEF', nickname: 'Guest' })).toEqual({
      roomCode: 'ABCDEF',
      nickname: 'Guest',
    });
    expect(RoomResumeSchema.parse({ roomCode: 'ABCDEF', sessionToken: 'tok123' })).toEqual({
      roomCode: 'ABCDEF',
      sessionToken: 'tok123',
    });
  });

  it('validates action, vote, mayor schemas', () => {
    expect(ActionSubmitSchema.parse({ kind: 'kill', targetId: 'p2' })).toEqual({
      kind: 'kill',
      targetId: 'p2',
    });
    expect(ActionSubmitSchema.parse({ kind: 'kill', targetId: null })).toEqual({
      kind: 'kill',
      targetId: null,
    });
    expect(VoteCastSchema.parse({ targetId: 'p1' })).toEqual({ targetId: 'p1' });
    expect(VoteCastSchema.parse({ targetId: null })).toEqual({ targetId: null });
    expect(MayorDecideSchema.parse({ targetId: 'p1' })).toEqual({ targetId: 'p1' });
  });

  it('validates chat and strips control chars', () => {
    expect(ChatSendSchema.parse({ channel: 'public', text: 'Hello \u0007 world' })).toEqual({
      channel: 'public',
      text: 'Hello  world',
    });
    expect(() => ChatSendSchema.parse({ channel: 'invalid', text: 'hi' })).toThrow();
    expect(() => ChatSendSchema.parse({ channel: 'public', text: '' })).toThrow();
    expect(() => ChatSendSchema.parse({ channel: 'public', text: 'a'.repeat(301) })).toThrow();
  });

  it('validates voice schemas', () => {
    expect(VoiceTokenSchema.parse({ channel: 'public' })).toEqual({ channel: 'public' });
    expect(VoiceReadySchema.parse({ channel: 'mafia' })).toEqual({ channel: 'mafia' });
  });
});

