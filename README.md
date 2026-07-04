# Finance OS

Personal Financial Operating System — a mobile-first PWA for Indian salaried professionals (Bangalore lifestyle).

## Features

- **Dashboard** — Balance, income, expenses, loans, savings, budget health
- **Loan Manager** — EMI tracking, prepayment planner, interest savings
- **Expense Tracker** — Quick add (<5 sec), NEED/WANT/LUXURY/SAVINGS classification
- **Monthly Budget** — Salary cycle (7th–6th), fixed expenses, subscriptions
- **Cash Box** — Wallet, home, office, emergency cash
- **Credit Cards** — Limits, usage, due dates
- **Goals** — Progress tracking with visual bars
- **Excel Import** — Upload your finance spreadsheet (.xlsx/.csv)
- **5-digit PIN auth** — Hashed PIN + JWT session
- **PWA** — Installable on Android, offline support
- **Dark/Light mode**

## Tech Stack

- Next.js 15+ (App Router), React 19, TypeScript
- TailwindCSS, shadcn/ui-style components
- Prisma ORM + PostgreSQL (Neon)
- Recharts, Framer Motion, Lucide icons
- Deploy on Vercel

## Quick Start

```bash
cd finance-os
npm install
cp .env.example .env
# Add your DATABASE_URL and JWT_SECRET to .env
npx prisma db push
npm run db:seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

**Default PIN after seed:** `12345`

## Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Neon PostgreSQL connection string (pooler) |
| `DIRECT_URL` | Direct Neon connection (migrations) |
| `JWT_SECRET` | Secret for JWT sessions (min 32 chars) |
| `NEXT_PUBLIC_APP_NAME` | App display name |
| `NEXT_PUBLIC_APP_URL` | Production URL |

## Deploy to Vercel

1. Push to GitHub
2. Import project in Vercel
3. Add environment variables from `.env.example`
4. Deploy — `prisma db push` runs on build

## Excel Import

Upload your **My 2026 Finance Management** spreadsheet from Profile → Import Excel.

Auto-imports:
- Loans & EMI schedule
- Income sources
- Fixed expenses
- Subscriptions
- Savings targets
- Monthly budget

## Salary Cycle

Configured for **7th of every month** salary credit (July 7 → August 7 cycle).

## Project Structure

```
src/
  app/           # Pages & API routes
  components/    # UI components
  lib/           # Auth, DB, utils, import
  generated/     # Prisma client
prisma/
  schema.prisma  # Database models
  seed.ts        # Sample data from your Excel
```

## Security

- PIN stored as bcrypt hash (never plain text)
- JWT in httpOnly cookie
- HTTPS on production (Vercel)
- `.env` excluded from git

## License

Private — Personal use
