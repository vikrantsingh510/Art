import { z } from 'zod';

export const cartItemBody = z.object({
  artworkId: z.string().uuid(),
}).strict();

export const checkoutBody = z.object({
  addressId: z.string().uuid().optional(),
  shippingAddress: z.object({
    recipientName: z.string().trim().min(1).max(150),
    phone: z.string().trim().min(5).max(20),
    addressLine1: z.string().trim().min(1).max(500),
    addressLine2: z.string().trim().max(500).optional().nullable(),
    city: z.string().trim().min(1).max(100),
    state: z.string().trim().min(1).max(100),
    postalCode: z.string().trim().min(1).max(15),
    country: z.string().trim().min(2).max(100).default('IN'),
  }).optional(),
  notes: z.string().trim().max(2000).optional().nullable(),
}).superRefine((value, ctx) => {
  if (!value.addressId && !value.shippingAddress) {
    ctx.addIssue({
      code: 'custom',
      message: 'Provide addressId or shippingAddress',
      path: ['addressId'],
    });
  }
});

const addressFields = {
  recipientName: z.string().trim().min(1).max(150),
  phone: z.string().trim().min(5).max(20),
  addressLine1: z.string().trim().min(1).max(500),
  addressLine2: z.string().trim().max(500).optional().nullable(),
  city: z.string().trim().min(1).max(100),
  state: z.string().trim().min(1).max(100),
  postalCode: z.string().trim().min(1).max(15),
  country: z.string().trim().min(2).max(100),
  isDefault: z.boolean(),
};

export const addressBody = z.object({
  ...addressFields,
  country: addressFields.country.default('IN'),
  isDefault: addressFields.isDefault.default(false),
}).strict();

export const addressPatchBody = z.object(addressFields).partial().strict().superRefine((value, ctx) => {
  if (Object.keys(value).length === 0) {
    ctx.addIssue({
      code: 'custom',
      message: 'Provide at least one address field',
      path: ['recipientName'],
    });
  }
});

export const wishlistItemBody = z.object({
  artworkId: z.string().uuid(),
}).strict();

export default {
  cartItemBody,
  checkoutBody,
  addressBody,
  addressPatchBody,
  wishlistItemBody,
};
