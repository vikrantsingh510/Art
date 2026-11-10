const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function exactOrderUuid(query) {
  if (query?.orderId && UUID_RE.test(query.orderId)) {
    return query.orderId;
  }
  if (query?.q && UUID_RE.test(String(query.q).trim())) {
    return String(query.q).trim();
  }
  return null;
}

export function searchTerm(query) {
  const uuid = exactOrderUuid(query);
  if (uuid) {
    return null;
  }
  const raw = typeof query?.q === 'string' ? query.q.trim() : '';
  return raw || null;
}

export function compactAdminOrderRow(row) {
  return {
    id: row.id,
    orderNumber: row.orderNumber,
    placedAt: row.placedAt,
    status: row.status,
    itemCount: Number(row.itemCount || 0),
    totalPaise: row.totalPaise,
    currency: row.currency,
    customerId: row.customerId,
    customerFullName: row.customerFullName || null,
    customerPhone: row.customerPhone || null,
    paymentStatus: row.paymentStatus || null,
    reservationExpiresAt: row.reservationExpiresAt || null,
  };
}

export default {
  exactOrderUuid,
  searchTerm,
  compactAdminOrderRow,
};
