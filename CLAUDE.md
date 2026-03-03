# Tasman Transport App

## Project Overview
Freight/goods transport booking app for Gold Coast ↔ Sydney. Three user roles: Customer, Driver, Admin.

## Tech Stack
- **Mobile App**: Expo (React Native) with expo-router — all 3 roles — iOS + Android
- **Admin Web Dashboard**: Next.js 14 (App Router) with shadcn/ui
- **Backend**: Supabase (Auth, PostgreSQL, Storage, Realtime, Edge Functions)
- **Email**: Resend (via Supabase Edge Functions)
- **Maps**: Google Maps Platform (routing, geocoding, live tracking)
- **Monorepo**: npm workspaces with Turborepo

## Monorepo Structure
```
apps/mobile/       — Expo React Native app (all roles)
apps/web/          — Next.js admin dashboard
packages/shared/   — Shared types, utils, Supabase client, Zod schemas
supabase/          — Migrations, Edge Functions, seed data
```

## Conventions

### TypeScript
- Strict mode everywhere (`"strict": true`)
- No `any` types — use `unknown` and narrow
- Prefer `interface` for object shapes, `type` for unions/intersections

### Date/Time
- All datetimes use `Australia/Brisbane` timezone (AEST, UTC+10, no DST)
- Use `date-fns` + `date-fns-tz` for all date handling
- Store as UTC in database, display as AEST in UI
- Import timezone constant from `@tasman-transport/shared`

### Validation
- Zod for all validation (shared between mobile and web)
- Schemas defined in `packages/shared/src/schemas/`
- Derive TypeScript types from Zod schemas where possible

### Booking Rules
- Pickup datetime must be before dropoff datetime
- One quantity type per booking
- Cutoff for edits/cancellations: before 5pm AEST the day prior to pickup
- Booking number format: `TT-YYYYMMDD-NNNN` (auto-generated)

### Roles
- `customer` — books transport, tracks deliveries
- `driver` — executes deliveries with photo proof and signatures
- `admin` — manages everything (bookings, drivers, pricing)

### Database
- RLS (Row Level Security) on ALL Supabase tables
- Auto-generated `updated_at` triggers
- Profile auto-creation on auth.users insert

### Styling
- Mobile: NativeWind (Tailwind for React Native)
- Web: Tailwind CSS + shadcn/ui components

### Commands
```bash
# Development
npm run dev          # Run all apps
npm run dev:mobile   # Run mobile app only
npm run dev:web      # Run web app only

# Build
npm run build        # Build all
npm run typecheck    # TypeScript check all packages

# Supabase
npx supabase start   # Start local Supabase
npx supabase db reset # Reset database with migrations
```
