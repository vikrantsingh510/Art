import express from 'express';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import pinoHttp from 'pino-http';
import { env } from './config/env.js';
import { corsMiddleware } from './config/cors.js';
import { logger } from './config/logger.js';
import apiRouter from './routes/index.js';
import { notFoundMiddleware } from './middlewares/not-found.middleware.js';
import { errorMiddleware } from './middlewares/error.middleware.js';

const app = express();

app.set('trust proxy', env.TRUST_PROXY);

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
app.use(corsMiddleware);
app.use(pinoHttp({
  logger,
  autoLogging: true,
  redact: {
    paths: ['req.headers.authorization', 'req.headers.cookie'],
    censor: '[Redacted]',
  },
  customLogLevel(req, res, error) {
    if (res.statusCode >= 500 || error) {
      return 'error';
    }

    if (res.statusCode >= 400) {
      return 'warn';
    }

    return 'info';
  },
}));
app.use(express.json({
  limit: '1mb',
  verify(req, _res, buffer) {
    req.rawBody = buffer;
  },
}));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

if (process.env.NODE_ENV !== 'test') {
  app.use(rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 100,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => String(req.originalUrl || req.path).startsWith('/api/v1/health'),
    message: {
      success: false,
      error: {
        message: 'Too many requests',
      },
    },
  }));
}

app.use('/api/v1', apiRouter);
app.use(notFoundMiddleware);
app.use(errorMiddleware);

export default app;
