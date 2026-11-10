import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { artworkStatusEnum } from './enums.js';

/**
 * Catalogue row. `status` is publication/lifecycle only — not the stock lock.
 * Later phases compute:
 *   available_quantity = inventory_quantity - SUM(active reservation quantities)
 *   is_purchasable = catalog-visible AND available_quantity >= requested_quantity
 * Artist attribution stays on this table as `artist_name`. No artists table.
 */
export const artworks = pgTable(
  'artworks',
  {
    id: uuid('id').defaultRandom().primaryKey().notNull(),
    title: varchar('title', { length: 255 }).notNull(),
    slug: varchar('slug', { length: 255 }).notNull().unique(),
    description: text('description'),
    story: text('story'),
    technique: varchar('technique', { length: 150 }),
    medium: varchar('medium', { length: 150 }),
    material: varchar('material', { length: 150 }),
    artistName: varchar('artist_name', { length: 150 }).notNull(),
    yearCreated: integer('year_created'),
    width: numeric('width', { precision: 10, scale: 2 }),
    height: numeric('height', { precision: 10, scale: 2 }),
    depth: numeric('depth', { precision: 10, scale: 2 }),
    dimensionUnit: varchar('dimension_unit', { length: 10 }),
    pricePaise: bigint('price_paise', { mode: 'number' }).notNull(),
    currency: varchar('currency', { length: 3 }).notNull().default('INR'),
    inventoryQuantity: integer('inventory_quantity').notNull().default(1),
    status: artworkStatusEnum('status').notNull().default('draft'),
    isFeatured: boolean('is_featured').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index('artworks_status_idx').on(table.status),
    check('artworks_price_paise_non_negative', sql`${table.pricePaise} >= 0`),
    check('artworks_inventory_quantity_non_negative', sql`${table.inventoryQuantity} >= 0`),
    check(
      'artworks_dimension_unit_allowed',
      sql`${table.dimensionUnit} IS NULL OR ${table.dimensionUnit} IN ('cm', 'in', 'mm')`,
    ),
    check('artworks_width_positive', sql`${table.width} IS NULL OR ${table.width} > 0`),
    check('artworks_height_positive', sql`${table.height} IS NULL OR ${table.height} > 0`),
    check('artworks_depth_positive', sql`${table.depth} IS NULL OR ${table.depth} > 0`),
  ],
);
