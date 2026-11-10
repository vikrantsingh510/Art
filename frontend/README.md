# Maison d'Art frontend

Next.js App Router (JavaScript) storefront for the existing Express API at `/api/v1`.

## Run locally

Copy `.env.example` to `.env.local` and set:

- `NEXT_PUBLIC_API_BASE_URL` (example `http://localhost:5000`)
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (`sb_publishable_…` only)

Enable Google OAuth in Supabase with redirect `http://localhost:3000/auth/callback`. Start the Express API on port 5000, then:

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

```bash
npm test
npm run lint
npm run build
```

Do not put service-role keys, database URLs, or Razorpay secrets in this app.
