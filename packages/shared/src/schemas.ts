import { z } from 'zod';
import { MAX_CHAT_LENGTH, MAX_NICKNAME_LENGTH, MIN_NICKNAME_LENGTH } from './constants';

export const NicknameSchema = z
  .string()
  .transform((val) => val.normalize('NFC').trim())
  .refine((val) => !/[\u0000-\u001F\u007F-\u009F]/.test(val), {
    message: 'Control characters not allowed',
  })
  .pipe(z.string().min(MIN_NICKNAME_LENGTH).max(MAX_NICKNAME_LENGTH));

export const OptionalRolesSchema = z.object({
  detective: z.boolean(),
  silencer: z.boolean(),
  confuser: z.boolean(),
  mayor: z.boolean(),
  habildar: z.boolean(),
  stalker: z.boolean(),
});

export const RoomSettingsSchema = z.object({
  discussionSec: z.union([z.literal(180), z.literal(240)]),
  voteSec: z.union([z.literal(30), z.literal(60)]),
  optional: OptionalRolesSchema,
});

export const RoomCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);

export const RoomCreateSchema = z.object({
  nickname: NicknameSchema,
  settings: RoomSettingsSchema.optional(),
});

export const RoomJoinSchema = z.object({
  roomCode: RoomCodeSchema,
  nickname: NicknameSchema,
});

export const RoomResumeSchema = z.object({
  roomCode: RoomCodeSchema,
  sessionToken: z.string().min(1),
});

export const ActionSubmitSchema = z.object({
  kind: z.enum([
    'kill',
    'protect',
    'shoot',
    'investigate',
    'confuse',
    'silence',
    'disable',
    'stalk',
  ]),
  targetId: z.string().nullable(),
});

export const VoteCastSchema = z.object({
  targetId: z.string().nullable(),
});

export const MayorDecideSchema = z.object({
  targetId: z.string().nullable(),
});

export const ChatSendSchema = z.object({
  channel: z.enum(['public', 'mafia']),
  text: z
    .string()
    .transform((val) =>
      val
        .normalize('NFC')
        .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
        .trim(),
    )
    .pipe(z.string().min(1).max(MAX_CHAT_LENGTH)),
});

export const VoiceTokenSchema = z.object({
  channel: z.enum(['public', 'mafia']),
});

export const VoiceReadySchema = z.object({
  channel: z.enum(['public', 'mafia']),
});
