import { eq } from 'drizzle-orm';
import { db } from '../config/database.js';
import { carts, profiles, userRoles, wishlists } from '../db/schema/index.js';
import { enqueueNotification } from './notification.service.js';

export async function provisionCustomerIdentity({ userId, fullName, email }) {
  await db.transaction(async (tx) => {
    const inserted = await tx.insert(profiles).values({
      id: userId,
      fullName: fullName || null,
    }).onConflictDoNothing().returning({ id: profiles.id });

    await tx.insert(userRoles).values({
      userId,
      role: 'customer',
    }).onConflictDoNothing();

    await tx.insert(wishlists).values({
      userId,
    }).onConflictDoNothing();

    await tx.insert(carts).values({
      userId,
    }).onConflictDoNothing();

    if (inserted.length > 0) {
      await enqueueNotification({
        userId,
        eventType: 'customer.welcome',
        recipientEmail: email,
        payload: {
          fullName: fullName || null,
          email,
        },
        executor: tx,
      });
    }
  });
}

export async function getProfileWithRoles(userId) {
  const [profile] = await db.select().from(profiles).where(eq(profiles.id, userId)).limit(1);
  const roleRows = await db.select({
    role: userRoles.role,
  }).from(userRoles).where(eq(userRoles.userId, userId));

  return {
    profile: profile || null,
    roles: roleRows.map((row) => row.role),
  };
}

export default {
  provisionCustomerIdentity,
  getProfileWithRoles,
};
