import http from 'node:http';
import app from '../../src/app.js';

let server;
let baseUrl;

export async function startTestServer() {
  if (baseUrl) {
    return baseUrl;
  }

  server = http.createServer(app);
  await new Promise((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });

  const { port } = server.address();
  baseUrl = `http://127.0.0.1:${port}`;
  return baseUrl;
}

export async function stopTestServer() {
  if (!server) {
    return;
  }

  await new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });

  server = undefined;
  baseUrl = undefined;
}

export async function api(pathname, options = {}) {
  const origin = await startTestServer();
  const headers = { ...options.headers };
  let body = options.body;

  if (body && typeof body === 'object' && !Buffer.isBuffer(body)) {
    headers['Content-Type'] = headers['Content-Type'] || 'application/json';
    body = JSON.stringify(body);
  }

  const response = await fetch(`${origin}${pathname}`, {
    method: options.method || 'GET',
    headers,
    body,
  });

  const text = await response.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }

  return {
    status: response.status,
    json,
    text,
  };
}

export default {
  startTestServer,
  stopTestServer,
  api,
};
