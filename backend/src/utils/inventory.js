export const DEFAULT_RESERVATION_TTL_SECONDS = 900;

export function availableQuantity(inventoryQuantity, activeReservedQuantity) {
  return Number(inventoryQuantity || 0) - Number(activeReservedQuantity || 0);
}

export function isPurchasable({
  status,
  inventoryQuantity,
  activeReservedQuantity,
  requestedQuantity = 1,
}) {
  const available = availableQuantity(inventoryQuantity, activeReservedQuantity);
  return status === 'published' && available >= requestedQuantity && requestedQuantity > 0;
}

export function reservationExpiresAt(now = new Date(), ttlSeconds = DEFAULT_RESERVATION_TTL_SECONDS) {
  return new Date(now.getTime() + ttlSeconds * 1000);
}

export default {
  availableQuantity,
  isPurchasable,
  reservationExpiresAt,
  DEFAULT_RESERVATION_TTL_SECONDS,
};
