export function paiseToRupees(paise) {
  return Number(paise || 0) / 100;
}

export function rupeesToPaise(rupees) {
  const value = Number(rupees);
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.round(value * 100);
}

export function formatInrFromPaise(paise, { maximumFractionDigits = 0 } = {}) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits,
  }).format(paiseToRupees(paise));
}
