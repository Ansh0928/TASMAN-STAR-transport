# 🚛 TASMAN-STAR-transport — Freight & Transport Booking Platform

> **Live (Admin Dashboard):** [https://tasman-transport-admin.vercel.app](https://tasman-transport-admin.vercel.app)
>
> A full-stack freight/goods transport booking application for the **Gold Coast ↔ Sydney** corridor. Features three user roles — **Customer**, **Driver**, and **Admin** — with a React Native mobile app (Expo) for customers and drivers, and a Next.js admin web dashboard.
>
> ---
>
> ## ✨ What It Does
>
> - **Customer Booking** — Book freight transport between Gold Coast and Sydney with pickup/dropoff scheduling
> - - **Driver Management** — Drivers accept deliveries, capture photo proof, and collect digital signatures
>   - - **Admin Dashboard** — Web-based admin panel to manage all bookings, drivers, pricing, and rate sheets
>     - - **Live Tracking** — Google Maps integration for route planning, geocoding, and real-time delivery tracking
>       - - **Rate Sheet Booking** — Pre-configured rate sheets for quick booking
>         - - **Digital Signatures** — Drivers capture proof-of-delivery signatures on mobile
>           - - **Email Notifications** — Transactional emails via Resend (through Supabase Edge Functions)
>             - - **Role-Based Auth** — Separate sign-in flows for customers, drivers, and admins via Supabase Auth
>               - - **Real-time Updates** — Supabase Realtime for live booking status changes
>                
>                 - ---
>
> ## 🛠️ Tech Stack
>
> | Category | Technology |
> |----------|-----------|
> | Mobile App | Expo (React Native) with expo-router — iOS + Android |
> | Admin Web | Next.js 14 (App Router) with shadcn/ui |
> | Backend | Supabase (Auth, PostgreSQL, Storage, Realtime, Edge Functions) |
> | Email | Resend (via Supabase Edge Functions) |
> | Maps | Google Maps Platform (routing, geocoding, live tracking) |
> | Monorepo | npm workspaces + Turborepo |
> | Mobile Styling | NativeWind (Tailwind for React Native) |
> | Web Styling | Tailwind CSS + shadcn/ui |
> | Validation | Zod (shared schemas between mobile and web) |
>
> ---
>
> ## 📁 Monorepo Structure
>
> ```
> ├── apps/
> │   ├── mobile/                 # Expo React Native app (all 3 roles)
> │   └── web/                    # Next.js admin dashboard
> ├── packages/
> │   └── shared/                 # Shared types, utils, Supabase client, Zod schemas
> ├── supabase/
> │   ├── migrations/             # Database migrations
> │   ├── functions/              # Edge Functions (email, etc.)
> │   └── seed.sql                # Seed data
> ├── .planning/phases/full-uat/  # UAT planning docs
> ├── turbo.json                  # Turborepo config
> ├── vercel.json                 # Vercel deployment config
> └── package.json                # Workspace root
> ```
>
> ---
>
> ## 👤 User Roles
>
> | Role | Platform | Access |
> |------|----------|--------|
> | `customer` | Mobile | Book transport, track deliveries |
> | `driver` | Mobile | Execute deliveries, photo proof, digital signatures |
> | `admin` | Web | Manage bookings, drivers, pricing, rate sheets |
>
> ---
>
> ## 📏 Booking Rules
>
> - Pickup datetime must be before dropoff datetime
> - - One quantity type per booking
>   - - Cutoff for edits/cancellations: before **5pm AEST** the day prior to pickup
>     - - Booking number format: `TT-YYYYMMDD-NNNN` (auto-generated)
>       - - All datetimes use **Australia/Brisbane timezone** (AEST, UTC+10, no DST)
>        
>         - ---
>
> ## 🚀 Getting Started
>
> ### Prerequisites
> - Node.js 18+
> - - Supabase project (or local Supabase via CLI)
>   - - Google Maps API key
>     - - Expo CLI (for mobile development)
>      
>       - ### Installation
>      
>       - ```bash
>         # Clone the repo
>         git clone https://github.com/Ansh0928/TASMAN-STAR-transport.git
>         cd TASMAN-STAR-transport
>
>         # Install all dependencies (workspaces)
>         npm install
>
>         # Start local Supabase (optional)
>         npx supabase start
>
>         # Reset database with migrations
>         npx supabase db reset
>         ```
>
> ### Development
>
> ```bash
> # Run all apps simultaneously
> npm run dev
>
> # Run mobile app only
> npm run dev:mobile
>
> # Run web admin dashboard only
> npm run dev:web
> ```
>
> ### Build & Type Check
>
> ```bash
> npm run build        # Build all
> npm run typecheck    # TypeScript check all packages
> ```
>
> ---
>
> ## 🔒 Security
>
> - Row Level Security (RLS) on ALL Supabase tables
> - - Auto-generated `updated_at` triggers
>   - - Profile auto-creation on `auth.users` insert
>     - - TypeScript strict mode everywhere — no `any` types
>      
>       - ---
>
> ## 🚢 Deployment
>
> - **Admin Web Dashboard** deployed on **Vercel** with auto-deploys from `master`
> - - **Mobile App** built with Expo Application Services (EAS)
>  
>   - **Live URL:** [https://tasman-transport-admin.vercel.app](https://tasman-transport-admin.vercel.app)
>  
>   - ---
>
> ## 🔗 Related Tasman Projects
>
> | Project | Description | Link |
> |---------|------------|------|
> | [TASMAN-STAR](https://github.com/Ansh0928/TASMAN-STAR) | Customer-facing storefront (Shopify Storefront API) | [tasman-star.vercel.app](https://tasman-star.vercel.app) |
> | [TASMAN-ADMIN](https://github.com/Ansh0928/TASMAN-ADMIN) | Full admin panel + e-commerce backend | [tasman-admin.vercel.app](https://tasman-admin.vercel.app) |
> | [Tasman-Sales-Rep](https://github.com/Ansh0928/Tasman-Sales-Rep) | iOS sales rep visit tracker + admin dashboard | [tasman-sales-rep.vercel.app](https://tasman-sales-rep.vercel.app) |
> | [tasmanstarseafoodmarket](https://github.com/Ansh0928/tasmanstarseafoodmarket) | Marketing website (React + Vite) with product showcase | — |
>
> ---
>
> ## 📄 License
>
> MIT
