import { and, desc, eq } from 'drizzle-orm';
import { db } from '../config/database.js';
import { addresses } from '../db/schema/index.js';
import { ApiError } from '../utils/ApiError.js';
import { selectDefaultAfterDelete } from '../utils/address-defaults.js';

export async function listAddresses(userId) {
  return db.select().from(addresses).where(eq(addresses.userId, userId)).orderBy(desc(addresses.isDefault), desc(addresses.updatedAt));
}

export async function getAddressForUser(addressId, userId) {
  const [row] = await db.select().from(addresses).where(and(
    eq(addresses.id, addressId),
    eq(addresses.userId, userId),
  )).limit(1);

  if (!row) {
    throw new ApiError(404, 'Address not found');
  }

  return row;
}

async function clearDefault(tx, userId) {
  await tx.update(addresses).set({ isDefault: false }).where(eq(addresses.userId, userId));
}

export async function createAddress(userId, payload) {
  return db.transaction(async (tx) => {
    if (payload.isDefault) {
      await clearDefault(tx, userId);
    }

    const [created] = await tx.insert(addresses).values({
      userId,
      recipientName: payload.recipientName,
      phone: payload.phone,
      addressLine1: payload.addressLine1,
      addressLine2: payload.addressLine2 ?? null,
      city: payload.city,
      state: payload.state,
      postalCode: payload.postalCode,
      country: payload.country || 'IN',
      isDefault: payload.isDefault ?? false,
    }).returning();

    return created;
  });
}

export async function updateAddress(userId, addressId, payload) {
  return db.transaction(async (tx) => {
    const [existing] = await tx.select().from(addresses).where(and(
      eq(addresses.id, addressId),
      eq(addresses.userId, userId),
    )).limit(1);

    if (!existing) {
      throw new ApiError(404, 'Address not found');
    }

    if (payload.isDefault === true) {
      await clearDefault(tx, userId);
    }

    const [updated] = await tx.update(addresses).set({
      recipientName: payload.recipientName ?? existing.recipientName,
      phone: payload.phone ?? existing.phone,
      addressLine1: payload.addressLine1 ?? existing.addressLine1,
      addressLine2: Object.hasOwn(payload, 'addressLine2') ? (payload.addressLine2 ?? null) : existing.addressLine2,
      city: payload.city ?? existing.city,
      state: payload.state ?? existing.state,
      postalCode: payload.postalCode ?? existing.postalCode,
      country: payload.country ?? existing.country,
      isDefault: Object.hasOwn(payload, 'isDefault') ? payload.isDefault : existing.isDefault,
    }).where(and(
      eq(addresses.id, addressId),
      eq(addresses.userId, userId),
    )).returning();

    return updated;
  });
}

export async function deleteAddress(userId, addressId) {
  return db.transaction(async (tx) => {
    const [existing] = await tx.select().from(addresses).where(and(
      eq(addresses.id, addressId),
      eq(addresses.userId, userId),
    )).limit(1);

    if (!existing) {
      throw new ApiError(404, 'Address not found');
    }

    await tx.delete(addresses).where(and(
      eq(addresses.id, addressId),
      eq(addresses.userId, userId),
    ));

    if (existing.isDefault) {
      const remaining = await tx.select().from(addresses).where(eq(addresses.userId, userId));
      const nextDefault = selectDefaultAfterDelete(remaining, addressId);
      if (nextDefault) {
        await tx.update(addresses).set({ isDefault: true }).where(and(
          eq(addresses.id, nextDefault.id),
          eq(addresses.userId, userId),
        ));
      }
    }

    return existing;
  });
}

export function toShippingSnapshot(address) {
  return {
    recipientName: address.recipientName,
    phone: address.phone,
    addressLine1: address.addressLine1,
    addressLine2: address.addressLine2,
    city: address.city,
    state: address.state,
    postalCode: address.postalCode,
    country: address.country,
  };
}

export default {
  listAddresses,
  getAddressForUser,
  createAddress,
  updateAddress,
  deleteAddress,
  toShippingSnapshot,
};
