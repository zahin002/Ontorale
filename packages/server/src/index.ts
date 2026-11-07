import path from 'node:path';
import dotenv from 'dotenv';
import { loadConfig } from './config';
import { createServer } from './app';

dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });

const config = loadConfig();
const { httpServer, logger } = createServer(config);

const PORT = config.PORT;

httpServer.listen(PORT, () => {
  logger.info(`Ontorale server listening on port ${PORT} [env=${config.NODE_ENV}]`);
});
