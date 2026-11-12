import { eq } from 'drizzle-orm';
import { db } from '../config/database.js';
import { APP_SETTING_WHATSAPP_ENQUIRY, appSettings } from '../db/schema/app-settings.schema.js';
import {
  maskWhatsappE164,
  normalizeWhatsappButtonLabel,
  normalizeWhatsappE164,
  resolveWhatsappButtonLabel,
  toPublicWhatsappSnapshot,
} from '../lib/whatsapp-enquiry.js';
import { ApiError } from '../utils/ApiError.js';
import { writeAuditLog } from './audit.service.js';

function emptyAdminWhatsappSettings() {
  return {
    enabled: false,
    e164: '',
    buttonLabel: '',
    updatedAt: null,
  };
}

function toAdminWhatsappSettings(row) {
  if (!row) {
    return emptyAdminWhatsappSettings();
  }

  const value = row.value && typeof row.value === 'object' ? row.value : {};
  return {
    enabled: Boolean(value.enabled),
    e164: typeof value.e164 === 'string' ? value.e164 : '',
    buttonLabel: typeof value.buttonLabel === 'string' ? value.buttonLabel : '',
    updatedAt: row.updatedAt || null,
  };
}

async function getWhatsappSettingsRow() {
  const [row] = await db
    .select()
    .from(appSettings)
    .where(eq(appSettings.key, APP_SETTING_WHATSAPP_ENQUIRY))
    .limit(1);
  return row || null;
}

export async function getPublicWhatsappEnquiry() {
  const row = await getWhatsappSettingsRow();
  return toPublicWhatsappSnapshot(row?.value);
}

export async function getAdminWhatsappSettings() {
  const row = await getWhatsappSettingsRow();
  return toAdminWhatsappSettings(row);
}

export async function updateAdminWhatsappSettings(payload, actorUserId, { ipAddress } = {}) {
  const enabled = Boolean(payload.enabled);
  const rawNumber = payload.e164 == null ? '' : String(payload.e164);
  const e164 = rawNumber.trim() ? normalizeWhatsappE164(rawNumber) : null;

  if (rawNumber.trim() && !e164) {
    throw new ApiError(400, 'Enter a valid WhatsApp number in E.164 format, for example +9198XXXXXXXX.');
  }

  if (enabled && !e164) {
    throw new ApiError(400, 'A valid WhatsApp number in E.164 format is required when enquiries are enabled.');
  }

  const rawLabel = payload.buttonLabel == null ? '' : String(payload.buttonLabel);
  if (rawLabel.trim() && /[<>]/.test(rawLabel)) {
    throw new ApiError(400, 'The button label cannot contain HTML.');
  }

  const buttonLabel = rawLabel.trim() ? normalizeWhatsappButtonLabel(rawLabel) : null;
  if (rawLabel.trim() && !buttonLabel) {
    throw new ApiError(400, 'The button label must be at most 40 characters.');
  }

  const value = {
    enabled,
    e164: enabled ? e164 : (e164 || null),
    buttonLabel,
  };

  const [row] = await db
    .insert(appSettings)
    .values({
      key: APP_SETTING_WHATSAPP_ENQUIRY,
      value,
      updatedBy: actorUserId || null,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: {
        value,
        updatedBy: actorUserId || null,
        updatedAt: new Date(),
      },
    })
    .returning();

  await writeAuditLog({
    actorUserId,
    action: 'settings.whatsapp.update',
    entityType: 'app_settings',
    entityId: null,
    ipAddress: ipAddress || null,
    metadata: {
      key: APP_SETTING_WHATSAPP_ENQUIRY,
      enabled,
      e164: maskWhatsappE164(e164),
      buttonLabel: resolveWhatsappButtonLabel(buttonLabel),
    },
  });

  return toAdminWhatsappSettings(row);
}

export default {
  getPublicWhatsappEnquiry,
  getAdminWhatsappSettings,
  updateAdminWhatsappSettings,
};
