export const APP_NAME = 'Ontorale';
export const APP_DISPLAY_NAME_BN = 'অন্তরালে';

export const MIN_PLAYERS = 6;
export const MAX_PLAYERS = 15;

export const NIGHT_DURATION_SEC = 120;
export const NIGHT_RESULT_DURATION_SEC = 10;
export const VOTE_RESULT_DURATION_SEC = 10;
export const MAYOR_TIEBREAK_DURATION_SEC = 20;

export const POLICE_STARTING_BULLETS = 2;

export const DEFAULT_DISCUSSION_SEC = 180;
export const DEFAULT_VOTE_SEC = 60;

export const ROOM_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const ROOM_CODE_LENGTH = 6;
export const MAX_ROOMS = 20;

export const MIN_NICKNAME_LENGTH = 1;
export const MAX_NICKNAME_LENGTH = 20;

export const MAX_CHAT_LENGTH = 300;

export const MAFIA_COUNT: Record<number, number> = {
  6: 1,
  7: 1,
  8: 2,
  9: 2,
  10: 3,
  11: 3,
  12: 4,
  13: 4,
  14: 4,
  15: 4,
};

export const DEFAULT_OPTIONAL_ROLES = {
  detective: true,
  mayor: true,
  silencer: false,
  confuser: false,
  habildar: false,
  stalker: false,
};

export const DEFAULT_WIN_MODE = 'parity';

export const DEFAULT_ROOM_SETTINGS = {
  discussionSec: 180 as const,
  voteSec: 60 as const,
  optional: DEFAULT_OPTIONAL_ROLES,
};
