import { Router } from 'express';
import { env } from '../config/env.js';
import { client } from '../config/database.js';
import { logger, toSafeErrorLog } from '../config/logger.js';

const healthRouter = Router();

healthRouter.get('/', (_req, res) => {
  res.json({
    success: true,
    status: 'ok',
    environment: env.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

healthRouter.get('/db', async (_req, res) => {
  try {
    await client`select 1`;

    res.json({
      success: true,
      status: 'ok',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error({ err: toSafeErrorLog(error) }, 'Database health check failed');

    res.status(503).json({
      success: false,
      status: 'unavailable',
      timestamp: new Date().toISOString(),
    });
  }
});

export default healthRouter;
