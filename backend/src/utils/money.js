export function netRevenuePaise({ capturedPaymentPaise = 0, succeededRefundPaise = 0 } = {}) {
  return Number(capturedPaymentPaise) - Number(succeededRefundPaise);
}

export function lineTotalPaise(quantity, unitPricePaise) {
  return Number(quantity) * Number(unitPricePaise);
}

export function orderTotalPaise({
  subtotalPaise,
  shippingPaise = 0,
  taxPaise = 0,
  discountPaise = 0,
}) {
  return Number(subtotalPaise) + Number(shippingPaise) + Number(taxPaise) - Number(discountPaise);
}

export default {
  netRevenuePaise,
  lineTotalPaise,
  orderTotalPaise,
};
