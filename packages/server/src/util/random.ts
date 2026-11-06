import crypto from 'node:crypto';
import { ROOM_CODE_CHARS, ROOM_CODE_LENGTH, type Rng } from '@ontorale/shared';

export class CryptoRng implements Rng {
  int(maxExclusive: number): number {
    return crypto.randomInt(0, maxExclusive);
  }
}

export class SeededRng implements Rng {
  private s: number;

  constructor(seed = 123456789) {
    this.s = seed;
  }

  int(maxExclusive: number): number {
    this.s = (this.s * 1103515245 + 12345) & 0x7fffffff;
    return this.s % maxExclusive;
  }
}

export function generateRoomCode(rng: Rng = new CryptoRng()): string {
  let code = '';
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    const idx = rng.int(ROOM_CODE_CHARS.length);
    code += ROOM_CODE_CHARS[idx];
  }
  return code;
}

export function generateSessionToken(): string {
  return crypto.randomBytes(16).toString('hex'); // 128-bit
}

export function timingSafeEqualString(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}
