/**
 * Revenue calculation rules (Phase 7):
 * - Gross captured revenue = SUM(payments.amount_paise) WHERE status = 'captured'
 *   and captured_at is within the optional [from, to] window.
 * - Succeeded refunds = SUM(refunds.amount_paise) WHERE status = 'succeeded'
 *   and refunded_at is within the same window.
 * - Net revenue = gross captured revenue - succeeded refunds.
 * - Refunds do not restock inventory and do not reverse order counts.
 * - Order counts use orders.placed_at in the window, excluding no statuses
 *   except when explicitly filtering. Cancelled orders are counted separately.
 * - Pending or failed payments are excluded from revenue.
 */
import { and, eq, gte, lte, sql } from 'drizzle-orm';
import { db } from '../config/database.js';
import { orders, payments, refunds } from '../db/schema/index.js';
import { netRevenuePaise } from '../utils/money.js';

function dateRangeFilters(column, { from, to } = {}) {
  const filters = [];
  if (from) {
    filters.push(gte(column, new Date(from)));
  }
  if (to) {
    filters.push(lte(column, new Date(to)));
  }
  return filters;
}

export async function getDashboardMetrics(query = {}) {
  const paymentFilters = [eq(payments.status, 'captured'), ...dateRangeFilters(payments.capturedAt, query)];
  const refundFilters = [eq(refunds.status, 'succeeded'), ...dateRangeFilters(refunds.refundedAt, query)];
  const orderFilters = dateRangeFilters(orders.placedAt, query);

  const [paymentRow] = await db
    .select({
      capturedPaise: sql`coalesce(sum(${payments.amountPaise}), 0)::bigint`.as('capturedPaise'),
      capturedCount: sql`count(*)::int`.as('capturedCount'),
    })
    .from(payments)
    .where(and(...paymentFilters));

  const [refundRow] = await db
    .select({
      refundedPaise: sql`coalesce(sum(${refunds.amountPaise}), 0)::bigint`.as('refundedPaise'),
      refundCount: sql`count(*)::int`.as('refundCount'),
    })
    .from(refunds)
    .where(and(...refundFilters));

  const [orderRow] = await db
    .select({
      orderCount: sql`count(*)::int`.as('orderCount'),
      cancelledCount: sql`count(*) filter (where ${orders.status} = 'cancelled')::int`.as('cancelledCount'),
      confirmedCount: sql`count(*) filter (where ${orders.status} in ('confirmed', 'processing', 'shipped', 'delivered'))::int`.as('confirmedCount'),
    })
    .from(orders)
    .where(orderFilters.length > 0 ? and(...orderFilters) : undefined);

  const capturedPaymentPaise = Number(paymentRow?.capturedPaise || 0);
  const succeededRefundPaise = Number(refundRow?.refundedPaise || 0);

  return {
    from: query.from || null,
    to: query.to || null,
    currency: 'INR',
    rules: {
      grossRevenue: 'sum of captured payments in window',
      succeededRefunds: 'sum of succeeded refunds in window',
      netRevenue: 'gross captured payments minus succeeded refunds',
      restock: 'succeeded refunds do not restock inventory',
    },
    capturedPaymentPaise,
    succeededRefundPaise,
    netRevenuePaise: netRevenuePaise({ capturedPaymentPaise, succeededRefundPaise }),
    capturedPaymentCount: Number(paymentRow?.capturedCount || 0),
    refundCount: Number(refundRow?.refundCount || 0),
    orderCount: Number(orderRow?.orderCount || 0),
    confirmedOrderCount: Number(orderRow?.confirmedCount || 0),
    cancelledOrderCount: Number(orderRow?.cancelledCount || 0),
  };
}

export default {
  getDashboardMetrics,
};
