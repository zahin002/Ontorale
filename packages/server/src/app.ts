import express, { type Express } from 'express';
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Server as SocketIOServer } from 'socket.io';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import helmet from 'helmet';
import pino from 'pino';
import type { EnvConfig } from './config';
import { RoomManager } from './rooms/RoomManager';
import { registerSocketHandlers } from './socket/handlers';
import type { Clock } from './game/clock';
import type { CryptoRng } from './util/random';
import type { VoiceProvider } from './voice/VoiceProvider';
import { LiveKitProvider } from './voice/LiveKitProvider';
import { FakeVoiceProvider } from './voice/FakeVoiceProvider';

export interface ServerInstance {
  app: Express;
  httpServer: http.Server;
  io: SocketIOServer;
  roomManager: RoomManager;
  logger: pino.Logger;
}

export function createServer(
  config: EnvConfig,
  overrides?: {
    clock?: Clock;
    rng?: CryptoRng;
    voiceProvider?: VoiceProvider;
  },
): ServerInstance {
  const logger = pino({
    level: config.LOG_LEVEL,
    transport:
      config.NODE_ENV !== 'production'
        ? {
            target: 'pino-pretty',
            options: { colorize: true },
          }
        : undefined,
  });

  const app = express();
  const httpServer = http.createServer(app);

  // Security headers with helmet
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          fontSrc: ["'self'"],
          connectSrc: [
            "'self'",
            'ws:',
            'wss:',
            'http:',
            'https:',
            ...(config.LIVEKIT_URL ? [config.LIVEKIT_URL] : []),
          ],
          imgSrc: ["'self'", 'data:', 'blob:', 'http:', 'https:'],
          upgradeInsecureRequests: null,
        },
      },
      strictTransportSecurity:
        config.NODE_ENV === 'production' ? { maxAge: 31536000, includeSubDomains: true } : false,
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  let voiceProvider: VoiceProvider;
  if (overrides?.voiceProvider) {
    voiceProvider = overrides.voiceProvider;
  } else if (config.LIVEKIT_URL && config.LIVEKIT_API_KEY && config.LIVEKIT_API_SECRET) {
    voiceProvider = new LiveKitProvider(
      config.LIVEKIT_URL,
      config.LIVEKIT_API_KEY,
      config.LIVEKIT_API_SECRET,
    );
  } else {
    voiceProvider = new FakeVoiceProvider();
  }

  const roomManager = new RoomManager(config, {
    clock: overrides?.clock,
    rng: overrides?.rng,
    voiceProvider,
  });

  // Health endpoint (Section 7)
  app.get('/healthz', (_req, res) => {
    res.json({
      ok: true,
      activeGames: roomManager.activeGamesCount(),
      rooms: roomManager.roomsCount(),
    });
  });

  // Socket.IO configuration (Section 10)
  const io = new SocketIOServer(httpServer, {
    pingInterval: 10_000,
    pingTimeout: 10_000,
    maxHttpBufferSize: 10_000,
    cors: {
      origin: (_origin, callback) => {
        // Allow all valid browser connections across localhost, LAN IPs, and production domains
        callback(null, true);
      },
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  registerSocketHandlers(io, roomManager, config);

  // Serve static files in production, test, or whenever client dist is built
  const clientDist = path.resolve(__dirname, '../../client/dist');
  if (
    config.NODE_ENV === 'production' ||
    config.NODE_ENV === 'test' ||
    fs.existsSync(path.join(clientDist, 'index.html'))
  ) {
    app.use(express.static(clientDist));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(clientDist, 'index.html'));
    });
  }

  // Idle cleanup interval (Section 7)
  const cleanupTimer = setInterval(() => {
    roomManager.idleCleanupSweep();
  }, 60_000);
  cleanupTimer.unref();

  return { app, httpServer, io, roomManager, logger };
}
