import { sendError } from '../utils/ApiResponse.js';

export function notFoundMiddleware(req, res) {
  sendError(res, {
    statusCode: 404,
    message: 'Route not found',
  });
}

export default notFoundMiddleware;
