@'
# Maison d'Art

Premium curated handmade art gallery and marketplace.

## Technology Stack
- Frontend: Next.js (JavaScript)
- Backend: Node.js + Express.js
- Database: Supabase PostgreSQL
- ORM: Drizzle ORM
- Authentication: Supabase Auth
- Storage: Supabase Storage
- Payments: Razorpay

## Project Structure
- frontend/ - Customer-facing application
- backend/ - REST API and business logic
- designs/ - Approved Stitch designs
- docs/ - Technical architecture documentation

## MVP Scope
- Artwork discovery and purchasing
- Mobile AR artwork visualization
- Artwork certificates and media
- Admin dashboard and customer management
- Orders, shipping and fulfilment
- Revenue and order analytics
- Transactional email notifications

## Development Rules
- JavaScript only; no TypeScript.
- Modular monolith backend.
- REST API under /api/v1.
- Never commit environment secrets.

## Out of Scope
- Multi-vendor marketplace
- Seller onboarding
- Live auctions and bidding
'@ | Set-Content README.md