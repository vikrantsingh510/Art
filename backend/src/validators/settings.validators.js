import { z } from 'zod';

export const whatsappSettingsBody = z.object({
  enabled: z.boolean(),
  e164: z.string().trim().max(20).nullable().optional(),
  buttonLabel: z.string().trim().max(40).nullable().optional(),
});

export default {
  whatsappSettingsBody,
};
