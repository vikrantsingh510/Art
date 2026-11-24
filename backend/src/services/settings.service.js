import { eq } from 'drizzle-orm';
import { db } from '../config/database.js';
import {
  APP_SETTING_HOMEPAGE_FEATURED_ARTIST,
  APP_SETTING_HOMEPAGE_HERO,
  APP_SETTING_WHATSAPP_ENQUIRY,
  appSettings,
  artists,
} from '../db/schema/index.js';
import {
  readHomepageFeaturedArtistId,
  toHomepageFeaturedArtistSnapshot,
  toPublicHomepageFeaturedArtist,
} from '../lib/homepage-featured-artist.js';
import {
  normalizeHomepageHeroAltText,
  normalizeHomepageHeroStoragePath,
  toHomepageHeroSnapshot,
} from '../lib/homepage-hero.js';
import {
  maskWhatsappE164,
  normalizeWhatsappButtonLabel,
  normalizeWhatsappE164,
  resolveWhatsappButtonLabel,
  toPublicWhatsappSnapshot,
} from '../lib/whatsapp-enquiry.js';
import { ApiError } from '../utils/ApiError.js';
import { toPublicArtistProfile } from './artist.service.js';
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

async function getHomepageHeroSettingsRow() {
  const [row] = await db
    .select()
    .from(appSettings)
    .where(eq(appSettings.key, APP_SETTING_HOMEPAGE_HERO))
    .limit(1);
  return row || null;
}

export async function getPublicHomepageHero() {
  const row = await getHomepageHeroSettingsRow();
  return toHomepageHeroSnapshot(row);
}

export async function getAdminHomepageHeroSettings() {
  const row = await getHomepageHeroSettingsRow();
  return toHomepageHeroSnapshot(row);
}

export async function updateAdminHomepageHeroSettings(payload, actorUserId, { ipAddress } = {}) {
  const storagePath = normalizeHomepageHeroStoragePath(payload.storagePath);
  const altText = normalizeHomepageHeroAltText(payload.altText);

  const value = {
    storagePath,
    altText,
  };

  const [row] = await db
    .insert(appSettings)
    .values({
      key: APP_SETTING_HOMEPAGE_HERO,
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
    action: 'settings.homepage_hero.update',
    entityType: 'app_settings',
    entityId: null,
    ipAddress: ipAddress || null,
    metadata: {
      key: APP_SETTING_HOMEPAGE_HERO,
      storagePath,
      altTextLength: altText ? altText.length : 0,
    },
  });

  return toHomepageHeroSnapshot(row);
}

async function getHomepageFeaturedArtistSettingsRow() {
  const [row] = await db
    .select()
    .from(appSettings)
    .where(eq(appSettings.key, APP_SETTING_HOMEPAGE_FEATURED_ARTIST))
    .limit(1);
  return row || null;
}

async function findPublishedFeaturedArtist(artistId) {
  const id = readHomepageFeaturedArtistId({ artistId });
  if (!id) {
    return null;
  }

  const [row] = await db
    .select()
    .from(artists)
    .where(eq(artists.id, id))
    .limit(1);

  if (!row || row.status !== 'published') {
    return null;
  }

  return row;
}

async function assertPublishedFeaturedArtist(artistId) {
  const id = readHomepageFeaturedArtistId({ artistId });
  const [row] = await db
    .select({ id: artists.id, status: artists.status })
    .from(artists)
    .where(eq(artists.id, id))
    .limit(1);

  if (!row) {
    throw new ApiError(404, 'Artist not found.');
  }

  if (row.status !== 'published') {
    throw new ApiError(400, 'Only a published artist can be featured on the homepage.');
  }

  return row.id;
}

export async function getPublicHomepageFeaturedArtist() {
  const row = await getHomepageFeaturedArtistSettingsRow();
  const storedId = readHomepageFeaturedArtistId(row?.value);
  const artist = await findPublishedFeaturedArtist(storedId);
  return toPublicHomepageFeaturedArtist(toPublicArtistProfile(artist));
}

export async function getAdminHomepageFeaturedArtistSettings() {
  const row = await getHomepageFeaturedArtistSettingsRow();
  return toHomepageFeaturedArtistSnapshot(row);
}

export async function updateAdminHomepageFeaturedArtistSettings(payload, actorUserId, { ipAddress } = {}) {
  const requestedId = payload.artistId == null || payload.artistId === ''
    ? null
    : String(payload.artistId).trim();
  const artistId = requestedId ? await assertPublishedFeaturedArtist(requestedId) : null;
  const value = { artistId };

  const [row] = await db
    .insert(appSettings)
    .values({
      key: APP_SETTING_HOMEPAGE_FEATURED_ARTIST,
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
    action: 'settings.homepage_featured_artist.update',
    entityType: 'app_settings',
    entityId: artistId,
    ipAddress: ipAddress || null,
    metadata: {
      key: APP_SETTING_HOMEPAGE_FEATURED_ARTIST,
      artistId,
    },
  });

  return toHomepageFeaturedArtistSnapshot(row);
}

export default {
  getPublicWhatsappEnquiry,
  getAdminWhatsappSettings,
  updateAdminWhatsappSettings,
  getPublicHomepageHero,
  getAdminHomepageHeroSettings,
  updateAdminHomepageHeroSettings,
  getPublicHomepageFeaturedArtist,
  getAdminHomepageFeaturedArtistSettings,
  updateAdminHomepageFeaturedArtistSettings,
};
