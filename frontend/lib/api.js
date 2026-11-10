import { createArtApi } from './api-client';
import { getApiBaseUrl } from './env';

export { ApiClientError } from './api-client';

export const api = createArtApi({
  baseUrl: getApiBaseUrl(),
});
