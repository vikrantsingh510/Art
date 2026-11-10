import { env } from './config/env.js';
import { logger, toSafeErrorLog } from './config/logger.js';
import { closeDatabase } from './config/database.js';
import app from './app.js';

const SHUTDOWN_TIMEOUT_MS = 10_000;

const server = app.listen(env.PORT, () => {
  logger.info({
    port: env.PORT,
    environment: env.NODE_ENV,
  }, 'Maison d\'Art API started');
});

server.on('error', (error) => {
  logger.error({ err: toSafeErrorLog(error) }, 'HTTP server failed to start');
  process.exit(1);
});

let shuttingDown = false;

async function shutdown(signal) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  logger.info({ signal }, 'Graceful shutdown started');

  const forceExit = setTimeout(() => {
    logger.error({ signal }, 'Graceful shutdown timed out');
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);

  forceExit.unref();

  server.close(async (closeError) => {
    if (closeError) {
      logger.error({ err: toSafeErrorLog(closeError) }, 'HTTP server close failed');
    }

    try {
      await closeDatabase();
      logger.info('Database connections closed');
      process.exit(closeError ? 1 : 0);
    } catch (error) {
      logger.error({ err: toSafeErrorLog(error) }, 'Database close failed');
      process.exit(1);
    }
  });
}

process.on('SIGINT', () => {
  shutdown('SIGINT');
});

process.on('SIGTERM', () => {
  shutdown('SIGTERM');
});

process.on('uncaughtException', (error) => {
  logger.fatal({ err: toSafeErrorLog(error) }, 'Uncaught exception');
  shutdown('uncaughtException');
});

process.on('unhandledRejection', (reason) => {
  const error = reason instanceof Error ? reason : new Error(String(reason));
  logger.fatal({ err: toSafeErrorLog(error) }, 'Unhandled promise rejection');
  shutdown('unhandledRejection');
});
