import { desc, eq, ilike, or, sql } from 'drizzle-orm';
import { db } from '../config/database.js';
import { orders, profiles, userRoles } from '../db/schema/index.js';
import { ApiError } from '../utils/ApiError.js';
import { paginationQuery } from '../validators/common.js';

export async function listCustomers(query = {}) {
  const parsed = paginationQuery.parse(query);
  const filters = [];
  if (query.q) {
    const pattern = `%${query.q}%`;
    filters.push(or(ilike(profiles.fullName, pattern), ilike(profiles.phone, pattern)));
  }

  const whereClause = filters.length > 0 ? filters[0] : undefined;
  const offset = (parsed.page - 1) * parsed.limit;

  const [countRow] = await db
    .select({ count: sql`count(*)::int`.as('count') })
    .from(profiles)
    .where(whereClause);

  const items = await db
    .select()
    .from(profiles)
    .where(whereClause)
    .orderBy(desc(profiles.createdAt))
    .limit(parsed.limit)
    .offset(offset);

  return {
    items,
    page: parsed.page,
    limit: parsed.limit,
    total: Number(countRow?.count || 0),
  };
}

export async function getCustomer(userId) {
  const [profile] = await db.select().from(profiles).where(eq(profiles.id, userId)).limit(1);
  if (!profile) {
    throw new ApiError(404, 'Customer not found');
  }

  const roles = await db.select({ role: userRoles.role }).from(userRoles).where(eq(userRoles.userId, userId));
  const customerOrders = await db.select().from(orders).where(eq(orders.userId, userId)).orderBy(desc(orders.placedAt));

  return {
    profile,
    roles: roles.map((row) => row.role),
    orders: customerOrders,
  };
}

export default {
  listCustomers,
  getCustomer,
};
