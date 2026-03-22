# Travel Agency Management System (Enterprise)

Full-stack ERP-style travel agency application with CRM, itinerary templates, quotations, invoices, payment slips, company settings, staff management, and reports with charts.

---

## Tech Stack

- **Frontend:** React, Vite, Tailwind CSS, React Router, Axios, React Icons, Recharts
- **Backend:** Node.js, Express.js, **MySQL** (mysql2), JWT, bcrypt, Multer, pdf-lib
- **Roles:** Super Admin, Admin, Branch Admin, Manager, Staff (login only; no signup; admin creates users)

---

## Default Admin

- **Email:** admin@travel.com  
- **Password:** admin123  
- Created automatically on first API start if the `users` table is empty (`server/server.js`).

---

## Prerequisites

- Node.js 18+
- **MySQL** 5.7+ or 8.x (local or remote)

---

## Database Setup

**Option A — Recommended (empty database)**  
Create an empty database (e.g. `travel_hub`), configure `server/.env` (see below), then start the server. **`server/config/initDb.js`** creates all tables, runs column migrations (`ensureColumn` for `created_by`, etc.), seeds a default **Ahmedabad** branch when none exist, seeds **company_settings**, and fixes orphan FKs.

```bash
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS travel_hub CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
```

**Option B — MySQL Workbench / CLI import**  
Import the full schema (aligned with `initDb.js`):

```bash
mysql -u root -p < database/mysql_workbench_import.sql
```

Still run the API once afterward so `initDb()` can apply any newer migrations and seed branch/settings if needed.

**Legacy:** `database/schema.sql` targets PostgreSQL-style DDL; the running app uses **MySQL** as above.

---

## Environment (Backend)

Copy `server/.env.example` to `server/.env` and set:

| Variable | Purpose |
|----------|---------|
| `PORT` | API port (e.g. `5000` or `5002`) |
| `JWT_SECRET` | Strong secret for JWT signing |
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | MySQL connection |

There is **no** `DATABASE_URL` for Postgres in this project.

---

## Backend Setup

```bash
cd server
npm install
cp .env.example .env
# Edit .env: PORT, JWT_SECRET, DB_*
npm start
```

The API listens on `http://localhost:<PORT>` (check `.env`). Tables are created/updated on startup; default admin is seeded if no users exist.

---

## Frontend Setup

```bash
cd client
npm install
# Optional: client/.env — VITE_API_URL (default http://localhost:5000/api; match your server PORT)
npm run dev
```

Open the URL Vite prints (often `http://localhost:5173`).

---

## Core Modules & Features

### 1. Dashboard
- Branch selector (Ahmedabad, Baroda, Junagadh, Rajkot, etc.). Selection is stored and applied across Dashboard, Settings, Customers, Invoices, Payment Slips, masters, Staff, and Reports (admins/managers; staff stay scoped to their branch token).
- Summary cards: **Total Customers**, **Total Revenue**, **Pending Payments**, **Completed Payments** (branch-aware where applicable)
- Charts: payments overview, monthly revenue (layout varies by role)

### 2. Customer CRM
- Add / Edit / View customers (name, mobile, email, address, passport, family count, notes); **`created_by`** for staff scoping
- Family members, search & filters
- Under **Customers:** Invoice, Payment Slip (sidebar); quotations may be available depending on build/routing

### 3. Package Builder (when enabled in navigation)
- Packages with cities, default hotel/vehicle, package days, images
- Package deletion: dependent bookings/quotations may null `package_id` first

### 4. Master Data (Preferred Items)
- **Cities**, **Hotels**, **Vehicles**, **Activities** — branch-scoped where applicable

### 5. Booking Management
- Customer, package, dates; hotel, vehicle, staff assignment; status workflow (inquiry → … → completed / cancelled)
- **`created_by`** on bookings for ownership; staff visibility rules apply

### 6. Quotations
- Customer, package, valid until, terms, line items, PDF

### 7. Invoices
- Full invoice fields (GST, travel meta, line items), payments, PDF

### 8. Payment Slips
- Customer-wise payment list, receipt, PDF; **`created_by`** on payments where used

### 9. Company & Branch Settings
- Company info, bank, UPI/QR, per-branch overrides via **branch_settings**

### 10. Staff Management
- Staff users with branch assignment; reset password, block, delete (UI may hide delete for some roles)

### 11. Reports & Analytics
- Branch-aware data where the API supports it
- **Overview:** KPIs, charts (invoice status, collections, etc.)
- **Revenue / Pending Payments:** tables and charts
- **Staff:** booking-related performance (bookings attributed by assignee, creator, or invoice linkage)
- **Branches:** branch summaries where implemented

### 12. Itinerary Templates
- Template library with day rows (states/cities/nights)

### 13. PDFs
- Quotation, invoice, payment slip, itinerary — driven by `server/services/pdfService.js` and company/branch settings

---

## Role Permissions (summary)

- **Super Admin / Admin:** Broad access; settings and user management
- **Branch Admin:** Scoped to their branch
- **Manager:** Operational modules + reports (per middleware)
- **Staff:** Scoped data (`created_by` / branch); restricted actions (e.g. no delete on some entities in UI)

JWT **roles are matched case-insensitively** in middleware.

---

## API Overview

| Area | Endpoints |
|------|-----------|
| Auth | `POST /api/auth/login` |
| Users | `GET/POST/DELETE /api/users`, `PATCH /api/users/:id/block` |
| Customers | `GET/POST/PUT/DELETE /api/customers`, family sub-routes |
| Masters | `GET/POST/PUT/DELETE /api/masters/cities|hotels|vehicles|activities` |
| Packages | `GET/POST/PUT/DELETE /api/packages`, uploads, package days |
| Bookings | `GET/POST/PUT /api/bookings`, `POST /api/bookings/:id/notes` |
| Quotations | `GET/POST/PUT/DELETE /api/quotations`, convert, etc. |
| Invoices | `GET/POST/PUT/DELETE /api/invoices`, payments, next number |
| Payments | Booking/invoice payment routes as implemented |
| Staff | `GET/POST/PUT/DELETE /api/staff`, block, reset-password, performance |
| Reports | `GET /api/reports/dashboard`, `revenue`, `pending-payments`, `staff-performance` |
| Settings | `GET/PUT /api/settings`, branch settings |
| PDF | `GET /api/pdf/...` (itinerary, invoice, quotation, payment-slip, etc.) |

Use header: `Authorization: Bearer <token>`. Base URL: `http://localhost:<PORT>/api`.

---

## Project Structure

```
Travel-Agency/
├── client/src/
│   ├── components/       # Sidebar, Header, Modal, Loading, …
│   ├── context/          # ToastContext
│   ├── pages/
│   │   ├── Login.jsx
│   │   ├── Admin/        # Dashboard, Customers, Invoices, PaymentSlips, …
│   │   └── Staff/        # Staff dashboard, bookings
│   ├── services/api.js
│   └── utils/            # auth, branch, …
├── server/
│   ├── config/           # db.js (MySQL pool), initDb.js
│   ├── controllers/
│   ├── middleware/       # auth.js (JWT, roles: adminOnly, reportsReader, …)
│   ├── routes/
│   ├── services/         # pdfService.js
│   ├── uploads/
│   └── server.js
├── database/
│   ├── mysql_workbench_import.sql   # Full MySQL schema (sync with initDb.js)
│   └── schema.sql                   # Legacy Postgres-oriented reference
└── README.md
```

---

## Security

- Passwords hashed with bcrypt
- JWT authentication; role-based middleware (`adminOnly`, `adminOrManager`, `reportsReader`, `anyAuth`, …)
- Store secrets in `server/.env`; do not commit `.env`

---

## UI Notes

- White theme with teal/cyan accents
- Sidebar items may be toggled in `client/src/components/AdminLayout.jsx` (some entries commented out in the default build)
- Tables: teal gradient headers, responsive layout
