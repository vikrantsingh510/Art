export function formatDimensions(artwork) {
  if (!artwork) {
    return null;
  }

  const parts = [artwork.width, artwork.height, artwork.depth]
    .map((value) => (value === null || value === undefined || value === '' ? null : String(value)))
    .filter(Boolean);

  if (parts.length === 0) {
    return null;
  }

  const unit = artwork.dimensionUnit || '';
  return `${parts.join(' × ')}${unit ? ` ${unit}` : ''}`;
}

export function formatDate(value) {
  if (!value) {
    return '—';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export function availabilityLabel(artwork) {
  if (!artwork) {
    return 'Unavailable';
  }
  if (artwork.isPurchasable) {
    return 'Available';
  }
  if (artwork.status === 'archived') {
    return 'Archived';
  }
  if (artwork.status === 'sold') {
    return 'Acquired';
  }
  if (Number(artwork.availableQuantity) <= 0) {
    return 'Reserved';
  }
  return 'Unavailable';
}

export function orderStatusLabel(status) {
  const labels = {
    pending_payment: 'Payment pending',
    confirmed: 'Confirmed',
    processing: 'Processing',
    shipped: 'Shipped',
    delivered: 'Delivered',
    cancelled: 'Cancelled',
    refund_pending: 'Refund pending',
    refunded: 'Refunded',
  };
  return labels[status] || status || 'Unknown';
}
