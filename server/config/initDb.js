import pool from './db.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Create all tables and run migrations for enterprise schema
 */
export async function initDb() {
  const client = await pool.connect();
  try {
    // Migrate users: add is_blocked, branch, allow admin|manager|staff
    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN DEFAULT FALSE;
    `).catch(() => {});
    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS branch VARCHAR(100);
    `).catch(() => {});
    await client.query(`UPDATE users SET role = 'staff' WHERE role = 'user';`).catch(() => {});
    await client.query(`ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;`).catch(() => {});
    await client.query(`
      ALTER TABLE users ADD CONSTRAINT users_role_check 
      CHECK (role IN ('admin', 'manager', 'staff'));
    `).catch(() => {});

    // New tables in dependency order
    const tables = [
      `CREATE TABLE IF NOT EXISTS customers (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        mobile VARCHAR(50),
        email VARCHAR(255),
        address TEXT,
        passport VARCHAR(100),
        family_count INTEGER DEFAULT 0,
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS customer_family (
        id SERIAL PRIMARY KEY,
        customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        relation VARCHAR(100),
        age INTEGER,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS cities (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        country VARCHAR(255) DEFAULT 'India',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS hotels (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        city_id INTEGER REFERENCES cities(id) ON DELETE SET NULL,
        address TEXT,
        contact VARCHAR(100),
        room_type VARCHAR(100),
        price DECIMAL(12,2),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS vehicles (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        type VARCHAR(100),
        capacity INTEGER,
        city_id INTEGER REFERENCES cities(id) ON DELETE SET NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS activities (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        city_id INTEGER REFERENCES cities(id) ON DELETE SET NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS guides (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        mobile VARCHAR(50),
        city_id INTEGER REFERENCES cities(id) ON DELETE SET NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )`,
    ];

    for (const sql of tables) {
      await client.query(sql);
    }

    // Hotels: ensure new columns exist on older databases
    await client.query(`
      ALTER TABLE hotels ADD COLUMN IF NOT EXISTS room_type VARCHAR(100);
    `).catch(() => {});
    await client.query(`
      ALTER TABLE hotels ADD COLUMN IF NOT EXISTS price DECIMAL(12,2);
    `).catch(() => {});

    // Vehicles: ensure city_id exists on older databases
    await client.query(`
      ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS city_id INTEGER REFERENCES cities(id);
    `).catch(() => {});

    // Packages: add new columns if table exists (old structure)
    await client.query(`
      ALTER TABLE packages ADD COLUMN IF NOT EXISTS name VARCHAR(255);
    `).catch(() => {});
    await client.query(`
      UPDATE packages SET name = title WHERE name IS NULL AND title IS NOT NULL;
    `).catch(() => {});
    await client.query(`
      ALTER TABLE packages ADD COLUMN IF NOT EXISTS duration_days INTEGER;
    `).catch(() => {});
    await client.query(`
      UPDATE packages SET duration_days = days WHERE duration_days IS NULL AND days IS NOT NULL;
    `).catch(() => {});
    await client.query(`
      ALTER TABLE packages ADD COLUMN IF NOT EXISTS city_ids INTEGER[] DEFAULT '{}';
    `).catch(() => {});
    await client.query(`
      ALTER TABLE packages ADD COLUMN IF NOT EXISTS image_urls TEXT[] DEFAULT '{}';
    `).catch(() => {});
    await client.query(`
      ALTER TABLE packages ADD COLUMN IF NOT EXISTS itinerary_pdf_url TEXT;
    `).catch(() => {});

    await client.query(`
      CREATE TABLE IF NOT EXISTS package_days (
        id SERIAL PRIMARY KEY,
        package_id INTEGER NOT NULL REFERENCES packages(id) ON DELETE CASCADE,
        day_number INTEGER NOT NULL,
        activities TEXT,
        hotel_id INTEGER REFERENCES hotels(id) ON DELETE SET NULL,
        meals TEXT,
        transport TEXT,
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Bookings: ensure we have customers first, then alter or create bookings
    await client.query(`
      ALTER TABLE bookings ADD COLUMN IF NOT EXISTS customer_id INTEGER REFERENCES customers(id);
    `).catch(() => {});
    await client.query(`
      ALTER TABLE bookings ADD COLUMN IF NOT EXISTS travel_start_date DATE;
    `).catch(() => {});
    await client.query(`
      ALTER TABLE bookings ADD COLUMN IF NOT EXISTS travel_end_date DATE;
    `).catch(() => {});
    await client.query(`
      ALTER TABLE bookings ADD COLUMN IF NOT EXISTS assigned_hotel_id INTEGER REFERENCES hotels(id);
    `).catch(() => {});
    await client.query(`
      ALTER TABLE bookings ADD COLUMN IF NOT EXISTS assigned_vehicle_id INTEGER REFERENCES vehicles(id);
    `).catch(() => {});
    await client.query(`
      ALTER TABLE bookings ADD COLUMN IF NOT EXISTS assigned_staff_id INTEGER REFERENCES users(id);
    `).catch(() => {});
    await client.query(`
      ALTER TABLE bookings ADD COLUMN IF NOT EXISTS assigned_guide_id INTEGER REFERENCES guides(id);
    `).catch(() => {});
    await client.query(`
      ALTER TABLE bookings ADD COLUMN IF NOT EXISTS total_amount DECIMAL(12,2) DEFAULT 0;
    `).catch(() => {});
    await client.query(`
      ALTER TABLE bookings ADD COLUMN IF NOT EXISTS internal_notes TEXT;
    `).catch(() => {});
    await client.query(`UPDATE bookings SET status = 'inquiry' WHERE status = 'pending';`).catch(() => {});
    await client.query(`
      ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_status_check;
    `).catch(() => {});
    await client.query(`
      ALTER TABLE bookings ADD CONSTRAINT bookings_status_check
      CHECK (status IN ('inquiry','quotation_sent','confirmed','ongoing','completed','cancelled'));
    `).catch(() => {});

    await client.query(`
      CREATE TABLE IF NOT EXISTS booking_notes (
        id SERIAL PRIMARY KEY,
        booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        note TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS quotations (
        id SERIAL PRIMARY KEY,
        customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
        package_id INTEGER REFERENCES packages(id) ON DELETE SET NULL,
        valid_until DATE,
        discount DECIMAL(12,2) DEFAULT 0,
        tax_percent DECIMAL(5,2) DEFAULT 0,
        status VARCHAR(50) DEFAULT 'draft',
        total DECIMAL(12,2) DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS quotation_items (
        id SERIAL PRIMARY KEY,
        quotation_id INTEGER NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
        description VARCHAR(500) NOT NULL,
        amount DECIMAL(12,2) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS payments (
        id SERIAL PRIMARY KEY,
        booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
        amount DECIMAL(12,2) NOT NULL,
        mode VARCHAR(50) NOT NULL CHECK (mode IN ('cash','upi','bank','card')),
        reference VARCHAR(255),
        paid_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS documents (
        id SERIAL PRIMARY KEY,
        entity_type VARCHAR(50) NOT NULL,
        entity_id INTEGER NOT NULL,
        file_name VARCHAR(255) NOT NULL,
        file_url VARCHAR(500) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS staff_performance (
        id SERIAL PRIMARY KEY,
        staff_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        booking_id INTEGER REFERENCES bookings(id) ON DELETE SET NULL,
        notes TEXT,
        rating INTEGER CHECK (rating >= 1 AND rating <= 5),
        period_start DATE,
        period_end DATE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS activity_logs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        action VARCHAR(100) NOT NULL,
        entity_type VARCHAR(50),
        entity_id INTEGER,
        details JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Indexes
    await client.query('CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);').catch(() => {});
    await client.query('CREATE INDEX IF NOT EXISTS idx_customers_mobile ON customers(mobile);').catch(() => {});
    await client.query('CREATE INDEX IF NOT EXISTS idx_bookings_customer ON bookings(customer_id);').catch(() => {});
    await client.query('CREATE INDEX IF NOT EXISTS idx_bookings_staff ON bookings(assigned_staff_id);').catch(() => {});
    await client.query('CREATE INDEX IF NOT EXISTS idx_payments_booking ON payments(booking_id);').catch(() => {});
  } finally {
    client.release();
  }
}
