import { z } from 'zod';
import type { WinMode } from '@ontorale/shared';

const EnvSchema = z
  .object({
    PORT: z.coerce.number().default(3000),
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    CLIENT_ORIGIN: z.string().default('http://localhost:5173'),
    MAFIA_WIN_MODE: z.enum(['plusOne', 'examples', 'parity']).default('parity'),
    DISCONNECT_GRACE_MS: z.coerce.number().default(0),
    TIMER_SCALE: z.coerce.number().default(1),
    MAX_ROOMS: z.coerce.number().default(20),
    LIVEKIT_URL: z.string().optional(),
    LIVEKIT_API_KEY: z.string().optional(),
    LIVEKIT_API_SECRET: z.string().optional(),
    LOG_LEVEL: z.string().default('info'),
  })
  .superRefine((data, ctx) => {
    if (data.NODE_ENV === 'production' && data.TIMER_SCALE !== 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'TIMER_SCALE must be 1 in production mode',
        path: ['TIMER_SCALE'],
      });
    }
  });

export type EnvConfig = z.infer<typeof EnvSchema> & {
  MAFIA_WIN_MODE: WinMode;
};

export function loadConfig(rawEnv: Record<string, string | undefined> = process.env): EnvConfig {
  const parsed = EnvSchema.safeParse(rawEnv);
  if (!parsed.success) {
    const errorMessages = parsed.error.issues
      .map((issue) => `[${issue.path.join('.')}]: ${issue.message}`)
      .join('\n');
    throw new Error(`Environment validation failed:\n${errorMessages}`);
  }
  return parsed.data as EnvConfig;
}
