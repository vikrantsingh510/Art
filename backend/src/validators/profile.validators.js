import { z } from 'zod';

export const profilePatchBody = z.object({
  fullName: z.string().trim().max(150).nullable().optional(),
  phone: z.string().trim().max(20).nullable().optional(),
}).strict().superRefine((value, ctx) => {
  if (!Object.hasOwn(value, 'fullName') && !Object.hasOwn(value, 'phone')) {
    ctx.addIssue({
      code: 'custom',
      message: 'Provide fullName and/or phone',
      path: ['fullName'],
    });
  }
  if (typeof value.phone === 'string' && value.phone.length > 0 && value.phone.length < 5) {
    ctx.addIssue({
      code: 'custom',
      message: 'Phone must be between 5 and 20 characters',
      path: ['phone'],
    });
  }
});

export default {
  profilePatchBody,
};
