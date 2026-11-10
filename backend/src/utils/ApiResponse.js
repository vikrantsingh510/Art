export function sendSuccess(res, {
  statusCode = 200,
  status = 'ok',
  message,
  data,
} = {}) {
  const payload = {
    success: true,
    status,
  };

  if (message) {
    payload.message = message;
  }

  if (data !== undefined) {
    payload.data = data;
  }

  return res.status(statusCode).json(payload);
}

export function sendError(res, {
  statusCode = 500,
  message = 'Internal server error',
  details,
} = {}) {
  const payload = {
    success: false,
    error: {
      message,
    },
  };

  if (details !== undefined) {
    payload.error.details = details;
  }

  return res.status(statusCode).json(payload);
}

export default {
  sendSuccess,
  sendError,
};
