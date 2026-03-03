# Travel Agency Management System (Enterprise)

Full-stack ERP-style travel agency application with CRM, package builder, bookings, quotations, payments, staff management, and reports.

## Tech Stack

- **Frontend:** React, Vite, Tailwind CSS, React Router, Axios
- **Backend:** Node.js, Express.js, PostgreSQL, JWT, bcrypt, Multer, pdf-lib
- **Roles:** Admin, Manager, Staff (login only, no signup)

## Default Admin

- **Email:** admin@travel.com  
- **Password:** admin123  
- Created automatically on first server start.

## Prerequisites

- Node.js 18+
- PostgreSQL

## Database Setup

1. Create database:
   ```bash
   createdb travel_agency
   ```

2. (Optional) Run schema manually:
   ```bash
   psql -d travel_agency -f database/schema.sql
   ```
   Or let the server create/alter tables on startup via `initDb`.

## Backend Setup

```bash
cd server
npm install
cp .env.example .env
# Edit .env: PORT, JWT_SECRET, DATABASE_URL or DB_* vars
npm start
```

Server runs at http://localhost:5000. Tables are created/updated automatically; default admin is seeded if missing.

## Frontend Setup

```bash
cd client
npm install
# Optional: set VITE_API_URL in .env (default http://localhost:5000/api)
npm run dev
```

Open http://localhost:5173.

## Core Modules

1. **Dashboard** – Total customers, active bookings, revenue, pending payments, recent activities
2. **Customer CRM** – Add/edit/view customers, family members, notes, search/filters
3. **Package Builder** – Create packages, day-wise itinerary, hotels/meals/transport, optional PDF itinerary
4. **Master Data** – Cities, Hotels, Vehicles, Activities, Guides (full CRUD)
5. **Booking Management** – Select customer & package, travel dates, assign hotel/vehicle/staff/guide, status workflow (inquiry → quotation_sent → confirmed → ongoing → completed/cancelled), notes
6. **Quotations** – Create quotation, items, discount, tax, PDF, convert to booking
7. **Payments** – Record payments (cash/UPI/bank/card), track paid/due, invoice PDF
8. **Staff Management** – Add staff (manager/staff), assign to bookings, block/unblock, performance
9. **Documents** – Upload and link files to customers/bookings
10. **Reports** – Dashboard stats, revenue, pending payments, staff performance

## Role Permissions

- **Admin:** Full access; user management (create/delete/block).
- **Manager:** Customers, packages, bookings, quotations, payments, reports, staff (no delete staff).
- **Staff:** View assigned bookings only, update status, add notes.

## API Overview

- `POST /api/auth/login` – Login (email, password)
- `GET/POST/DELETE /api/users` – Users (admin)
- `GET/POST/PUT/DELETE /api/customers` – Customers (+ family)
- `GET/POST/PUT/DELETE /api/masters/cities|hotels|vehicles|activities|guides` – Masters
- `GET/POST/PUT/DELETE /api/packages` – Packages; `POST /api/packages/:id/days` – itinerary days
- `GET/POST/PUT /api/bookings` – Bookings; `POST /api/bookings/:id/notes` – notes
- `GET/POST/PUT /api/quotations` – Quotations; `POST /api/quotations/:id/convert-booking`
- `GET /api/payments/booking/:id` – Payments by booking; `POST/DELETE /api/payments`
- `GET/POST/DELETE /api/documents` – Documents (query: entity_type, entity_id)
- `GET/POST/PUT/PATCH /api/staff` – Staff; `GET /api/staff/:id/performance`
- `GET /api/reports/dashboard|revenue|pending-payments|staff-performance`
- `GET /api/pdf/itinerary/:id|invoice/:id|quotation/:id` – PDF download

JWT in `Authorization: Bearer <token>`. Base URL: `http://localhost:5000/api`.

## Project Structure

```
Travel-Agency/
├── client/src/
│   ├── components/     # Sidebar, Header, DataTable, FormModal, FileUpload, StatusBadge, ChartCard
│   ├── pages/
│   │   ├── Auth/Login.jsx
│   │   ├── Admin/      # Dashboard, Customers, Packages, PackageBuilder, Bookings, Quotations, Payments, Reports, Staff
│   │   │   └── Masters/ # Cities, Hotels, Vehicles, Activities, Guides
│   │   └── Staff/      # Dashboard, MyBookings, BookingDetails
│   ├── services/api.js
│   └── utils/auth.js
├── server/
│   ├── config/         # db.js, initDb.js
│   ├── controllers/    # auth, users, customers, masters, packages, bookings, quotations, payments, documents, staff, reports, pdf
│   ├── middleware/     # auth.js (JWT, roles), upload.js (Multer)
│   ├── routes/
│   ├── services/       # pdfService.js
│   ├── uploads/
│   └── server.js
├── database/
│   └── schema.sql
└── README.md
```

## Security

- Passwords hashed with bcrypt
- JWT authentication; role-based middleware (admin, adminOrManager, anyAuth)
- Store secrets in `.env`; do not commit `.env`
