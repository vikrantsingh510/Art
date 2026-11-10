import { and, desc, eq, gte, ilike, lte, or, sql } from 'drizzle-orm';
import { db } from '../config/database.js';
import {
  inventoryReservations,
  orderItems,
  orders,
  payments,
  profiles,
} from '../db/schema/index.js';
import { compactAdminOrderRow, exactOrderUuid, searchTerm } from '../utils/admin-orders-query.js';
import { adminOrdersQuery } from '../validators/admin.validators.js';

export async function listAdminOrders(query = {}) {
  const parsed = adminOrdersQuery.parse(query);
  const filters = [];
  const uuid = exactOrderUuid(parsed);
  const q = searchTerm(parsed);

  if (uuid) {
    filters.push(eq(orders.id, uuid));
  }
  if (parsed.status) {
    filters.push(eq(orders.status, parsed.status));
  }
  if (parsed.from) {
    filters.push(gte(orders.placedAt, new Date(parsed.from)));
  }
  if (parsed.to) {
    filters.push(lte(orders.placedAt, new Date(parsed.to)));
  }
  if (q) {
    const pattern = `%${q}%`;
    filters.push(or(
      ilike(orders.orderNumber, pattern),
      ilike(profiles.fullName, pattern),
      ilike(profiles.phone, pattern),
    ));
  }

  const itemCount = sql`(
    select count(*)::int from ${orderItems} where ${orderItems.orderId} = ${orders.id}
  )`.as('itemCount');
  const paymentStatus = sql`(
    select ${payments.status} from ${payments}
    where ${payments.orderId} = ${orders.id}
    order by ${payments.createdAt} desc
    limit 1
  )`.as('paymentStatus');
  const reservationExpiresAt = sql`(
    select min(${inventoryReservations.expiresAt}) from ${inventoryReservations}
    where ${inventoryReservations.orderId} = ${orders.id}
      and ${inventoryReservations.status} = 'active'
  )`.as('reservationExpiresAt');

  if (parsed.paymentStatus) {
    filters.push(sql`(
      select ${payments.status} from ${payments}
      where ${payments.orderId} = ${orders.id}
      order by ${payments.createdAt} desc
      limit 1
    ) = ${parsed.paymentStatus}`);
  }

  const whereClause = filters.length > 0 ? and(...filters) : undefined;
  const offset = (parsed.page - 1) * parsed.limit;

  const [countRow] = await db
    .select({ count: sql`count(*)::int`.as('count') })
    .from(orders)
    .innerJoin(profiles, eq(profiles.id, orders.userId))
    .where(whereClause);

  const rows = await db
    .select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      placedAt: orders.placedAt,
      status: orders.status,
      totalPaise: orders.totalPaise,
      currency: orders.currency,
      customerId: orders.userId,
      customerFullName: profiles.fullName,
      customerPhone: profiles.phone,
      itemCount,
      paymentStatus,
      reservationExpiresAt,
    })
    .from(orders)
    .innerJoin(profiles, eq(profiles.id, orders.userId))
    .where(whereClause)
    .orderBy(desc(orders.placedAt), desc(orders.id))
    .limit(parsed.limit)
    .offset(offset);

  return {
    items: rows.map(compactAdminOrderRow),
    page: parsed.page,
    limit: parsed.limit,
    total: Number(countRow?.count || 0),
  };
}

export default {
  listAdminOrders,
};
