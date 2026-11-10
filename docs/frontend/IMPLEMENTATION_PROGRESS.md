# Frontend implementation progress

F0 was already complete and was not rerun.

## Milestone 1 — Scaffold and foundation

Completed. Next.js App Router (JavaScript) in `frontend/`. Tailwind v4 tokens from Curatorial Editorial. API client in `lib/api-client.js`. Supabase SSR session. Public and admin shells.

## Milestone 2 — Public discovery

Completed. Home, explore (supported filters only), artwork detail (UUID), collections, about, contact, privacy, terms.

## Milestone 3 — Authentication and account

Completed. Google OAuth, `/auth/callback`, protected account, read-only profile, address create, wishlist/cart representation, customer orders.

## Milestone 4 — Cart and checkout

Completed. Bag uses `/cart`. Checkout posts a reservation and never claims payment.

## Milestone 5 — Admin

Completed. Dashboard metrics, artwork list/create/edit/archive, image path registration, customers, honest orders-list unavailable state, order detail by UUID.

## Milestone 6 — Quality

Completed. Loading/empty/error states, metadata, node:test (7), lint, production build. Browser QA on desktop for Home, Explore, login, and admin auth redirect. Home hero/header matches the Stitch salon treatment. Catalogue empty states are honest because no published artworks are in the database. Admin Stitch screens are implemented as live consoles, with the orders list showing the documented API gap.

Visual QA viewports: desktop ~1280px in the Cursor browser. Mobile uses the same tokens, 1.5rem margins, and a hamburger under `xl`. Compare remaining admin tables against Stitch `screen.png` after an admin session is configured.

## Full-stack feature expansion (9 November 2026)

Profile edit, address edit/delete, admin orders register, separate wishlist/cart, and View-in-your-space AR shipped. See `docs/full-stack/FEATURE_EXPANSION_PROGRESS.md`.
