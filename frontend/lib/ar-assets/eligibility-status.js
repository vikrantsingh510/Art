import { AR_READY_STATUSES } from './constants.js';

export function statusBlockReason(status) {
  if (AR_READY_STATUSES.includes(status)) {
    return null;
  }
  if (status === 'reserved') {
    return 'reserved';
  }
  if (status === 'archived') {
    return 'archived';
  }
  return 'not-published';
}
