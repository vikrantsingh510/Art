import { logger, toSafeErrorLog } from '../config/logger.js';
import { ApiError } from '../utils/ApiError.js';
import { sendError } from '../utils/ApiResponse.js';

export function errorMiddleware(err, req, res, next) {
  if (res.headersSent) {
    next(err);
    return;
  }

  const statusCode = Number(err.statusCode || err.status || 500);
  const isServerError = statusCode >= 500;
  const safeLog = toSafeErrorLog(err);

  logger.error({
    err: safeLog,
    statusCode,
    method: req.method,
    url: req.originalUrl,
  }, 'Request failed');

  if (err instanceof ApiError) {
    sendError(res, {
      statusCode,
      message: err.message,
      details: err.details,
    });
    return;
  }

  sendError(res, {
    statusCode: isServerError ? 500 : statusCode,
    message: isServerError ? 'Internal server error' : (safeLog.message || 'Request failed'),
  });
}

export default errorMiddleware;
