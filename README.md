# SubsPro — Subscription Management System

A full-stack subscription management platform built for **Lumen Quest 2.0**. Customers can browse plans, subscribe, pause, cancel and download invoices. Admins get a live analytics dashboard plus tools to manage customers, payments and plans.

**Live demo:** https://dewangshree.github.io/Lumen_Quest/  
**API:** https://lumen-quest-api.vercel.app · **API docs (Swagger):** https://lumen-quest-api.vercel.app/api/docs

![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3-06B6D4?logo=tailwindcss&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-Express_5-339933?logo=node.js&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Neon-4169E1?logo=postgresql&logoColor=white)

---

## Demo accounts

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@lumen.com` | `admin123` |
| Customer | `aman@example.com` | `password123` |
| Dataset customers | `user1@example.com` … `user100@example.com` | `password123` |

---

## Features

### Customer portal
- **Overview:** current plan, days remaining, total spent, and payment count
- **Smart suggestions:** cheaper long-term plans, more sessions per rupee, renewal reminders, and alerts for unpaid bills, all computed from the customer's own data
- **Subscription control:** subscribe, switch plan, pause (remaining days are kept), resume, cancel
- **Billing:** full payment history with status and date-range filters, "Pay now" for pending or failed bills, and PDF invoice download
- **Profile:** edit name and phone; change password (current password required)

### Admin console
- **Analytics dashboard:** revenue, customers, active subscriptions, churn rate, ARPU and failed payments, plus charts for revenue by month, new vs churned subscriptions and plan distribution, top customers, recent billing activity, and CSV export
- **Customers:** search, status and date-range filters, pagination, CSV export, and add customer (generates a temporary password)
- **Customer detail:** subscription and bill history; pause, resume or cancel; change plan; mark bills paid; mark the customer active or inactive
- **Payments:** every bill across customers, filter by paid, pending or failed and by date range (presets or custom), mark as paid, CSV export
- **Plan management:** create, edit, activate or deactivate, and delete plans (plans with subscription history are protected)

### Platform
- JWT authentication with refresh tokens and role-based access (`user` / `admin`) on both the API and the UI
- Separate customer and admin sign-in screens; signing in with the other role's account is rejected
- Security hardening: Helmet headers, CORS limited to the frontend, rate limiting (5 failed sign-ins per email per 15 min, 10 sign-ups per IP per hour, 600 requests per IP per 15 min), 100 kB body limit, input validation
- Interactive API docs (OpenAPI 3 / Swagger UI) at `/api/docs`
- Welcome email on signup and an account email with a temporary password for admin-created customers (SMTP; skipped if not configured)
- Data persisted in PostgreSQL (Neon), seeded from the Lumen Quest dataset (`SubscriptionUseCase_Dataset.xlsx`)
- Responsive layout, from a collapsible sidebar on desktop to an overlay menu on mobile
- Auto-deploys on every push to `main`

---

## Tech stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 15 (App Router, static export), React 18, TypeScript, Tailwind CSS, Zustand, React Hook Form, Recharts, jsPDF, Lucide icons |
| Backend | Node.js, Express 5, `pg`, bcryptjs, jsonwebtoken |
| Database | PostgreSQL on Neon (provisioned through Vercel) |
| Hosting | GitHub Pages (frontend), Vercel serverless (backend) |
| CI/CD | GitHub Actions (frontend), Vercel Git integration (backend) |

---

## Project structure

```
Lumen_Quest/
├── frontend/                     # Next.js app
│   └── src/
│       ├── app/                  # Pages (one folder per route)
│       │   ├── account/          #   customer overview
│       │   ├── billing/          #   customer billing & invoices
│       │   ├── profile/          #   profile & password
│       │   ├── subscribe/        #   plan catalogue & checkout
│       │   ├── dashboard/        #   admin analytics
│       │   ├── customers/        #   admin customer list
│       │   ├── customer/         #   admin customer detail (?id=)
│       │   ├── payments/         #   admin payments
│       │   ├── plans/            #   admin plan management
│       │   └── login, signup, forgot-password, …
│       ├── components/           # UI kit, layout (sidebar/header), auth guard
│       ├── lib/                  # API client, invoice PDF, utils
│       └── store/                # Zustand stores (auth, UI)
├── backend/                      # Express API
│   ├── api/index.js              # Vercel serverless entry
│   ├── app.js                    # Express app (routes, CORS, health)
│   ├── server.js                 # Local dev server
│   ├── scripts/seed.js           # Create schema + load sample data
│   └── src/
│       ├── controllers/          # Route handlers
│       ├── routes/               # auth, users, plans, subscriptions, admin, recommendations
│       ├── middleware/auth.js    # JWT + role checks
│       ├── database/             # schema.sql, pool, data-access layer (repo.js)
│       ├── services/             # Recommendation engine (dataset based)
│       └── data/dataset.json     # Exported from the Excel dataset
├── .github/workflows/            # GitHub Pages deploy
└── SubscriptionUseCase_Dataset.xlsx
```

---

## Getting started (local)

**Prerequisites:** Node.js 18+ and a PostgreSQL database (the project uses Neon).

### 1. Backend

```bash
cd backend
npm install
```

Create `backend/.env.local`. For the existing Vercel project, `npx vercel env pull .env.local` fills it in.

```env
DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require
JWT_SECRET=any-long-random-string
JWT_REFRESH_SECRET=another-long-random-string

# Optional: transactional email (e.g. Gmail with an App Password)
SMTP_USER=you@gmail.com
SMTP_PASS=your-16-char-app-password
# SMTP_HOST=smtp.gmail.com  SMTP_PORT=465  MAIL_FROM="SubsPro <you@gmail.com>"
# CORS_ORIGINS=https://your-frontend.example,http://localhost:3000
```

```bash
npm run db:seed     # create tables + sample data (skips if data exists)
npm run db:reset    # drop everything and reseed
npm run dev         # http://localhost:5000
```

### 2. Frontend

```bash
cd frontend
npm install
NEXT_PUBLIC_API_URL=http://localhost:5000 npm run dev   # http://localhost:3000
```

Without `NEXT_PUBLIC_API_URL` the frontend talks to the live API.

---

## API reference

Base URL: `https://lumen-quest-api.vercel.app`. Authenticated routes need `Authorization: Bearer <accessToken>`.

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | `/api/auth/register` | Public | Create a customer account |
| POST | `/api/auth/login` | Public | Returns access + refresh tokens |
| POST | `/api/auth/refresh` | Public | New access token from refresh token |
| GET | `/api/plans` · `/api/plans/:id` | Public | List / get plans |
| POST · PUT · DELETE | `/api/plans` · `/api/plans/:id` | Admin | Manage plans |
| GET · PUT · DELETE | `/api/users/me` | Signed in | Profile, update (password needs `current_password`), delete |
| GET | `/api/subscriptions/me` | Signed in | My subscriptions |
| GET | `/api/subscriptions/me/summary` | Signed in | Overview + suggestions |
| GET | `/api/subscriptions/me/billing` | Signed in | My bills |
| POST | `/api/subscriptions/me/billing/:id/pay` | Signed in | Pay a pending/failed bill |
| POST | `/api/subscriptions` | Signed in | Subscribe / switch plan (`plan_id`) |
| POST | `/api/subscriptions/:id/pause` · `resume` · `cancel` | Signed in | Manage my subscription |
| GET | `/api/admin/stats` | Admin | Dashboard metrics |
| GET · POST | `/api/admin/customers` | Admin | List / create customers |
| GET · PATCH | `/api/admin/customers/:id` | Admin | Customer detail / set status |
| POST | `/api/admin/customers/:id/subscription` | Admin | Assign or change plan |
| POST | `/api/admin/subscriptions/:id/:action` | Admin | `pause` / `resume` / `cancel` |
| GET | `/api/admin/billing?status=` | Admin | All bills |
| POST | `/api/admin/billing/:id/mark-paid` | Admin | Mark bill paid |
| GET | `/api/admin/plans` | Admin | Plans with subscriber counts |
| GET | `/api/recommendations` · `/:id` | Public | Dataset-based recommendations |
| GET | `/api/health` | Public | API + database health |

---

## Deployment

| Part | Where | How |
|------|-------|-----|
| Frontend | GitHub Pages | Push to `main` → `.github/workflows/deploy-frontend.yml` builds a static export and publishes it |
| Backend | Vercel (`lumen-quest-api`) | Push to `main` → Vercel builds the `backend/` folder (project root directory = `backend`) |
| Database | Neon Postgres | Connected to the Vercel project; `DATABASE_URL` is injected automatically |

Secrets (`JWT_SECRET`, `JWT_REFRESH_SECRET`, `DATABASE_URL`, and `SMTP_USER`/`SMTP_PASS` for email) live in the Vercel project's environment variables and are never committed.

---

## Sample data

`npm run db:reset` loads:
- 5 plans (Monthly, Quarterly, Yearly, Postpaid, Top-up)
- the demo admin and 4 demo customers
- 100 users, 100 subscriptions and 100 bills from `SubscriptionUseCase_Dataset.xlsx`

Dataset dates are shifted so the latest record falls on today. The dataset's 100 product IDs are mapped onto the 5 plans, and active subscriptions whose end date has passed are marked expired.

---

## Known limitations

- **Payments are simulated.** Checkout records a payment but no money is charged. A real gateway such as Razorpay or Stripe would be the next step.
- **Emails need SMTP credentials.** Until `SMTP_USER`/`SMTP_PASS` are set on Vercel, welcome emails are skipped.
- **No password-reset emails yet.** Admins issue new temporary passwords instead.
- **Rate limits are per server instance.** Counters live in memory, so on serverless they reset on cold starts. Use a shared store such as Redis for strict limits.
