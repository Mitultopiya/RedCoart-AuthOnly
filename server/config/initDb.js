import pool from './db.js';

/** MySQL 5.7 / older 8.0 do not support ADD COLUMN IF NOT EXISTS; silent .catch left columns missing. */
async function ensureColumn(client, table, column, definition) {
  try {
    await client.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
  } catch (e) {
    if (e.errno === 1060 || e.code === 'ER_DUP_FIELDNAME') return;
    if (String(e.message || '').includes('Duplicate column name')) return;
    throw e;
  }
}

const createStatements = [
  `CREATE TABLE IF NOT EXISTS branches (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) NOT NULL UNIQUE,
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    phone VARCHAR(50),
    email VARCHAR(255),
    manager_name VARCHAR(255),
    gst_number VARCHAR(50),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB`,
  `CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'staff',
    is_blocked TINYINT(1) NOT NULL DEFAULT 0,
    branch VARCHAR(100),
    branch_id INT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_users_branch FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE SET NULL
  ) ENGINE=InnoDB`,
  `CREATE TABLE IF NOT EXISTS customers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    mobile VARCHAR(50),
    email VARCHAR(255),
    address TEXT,
    passport VARCHAR(100),
    family_count INT DEFAULT 0,
    notes TEXT,
    branch_id INT NULL,
    created_by INT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_customers_branch FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE SET NULL,
    CONSTRAINT fk_customers_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
  ) ENGINE=InnoDB`,
  `CREATE TABLE IF NOT EXISTS customer_family (
    id INT AUTO_INCREMENT PRIMARY KEY,
    customer_id INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    relation VARCHAR(100),
    age INT,
    mobile VARCHAR(50),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_customer_family_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
  ) ENGINE=InnoDB`,
  `CREATE TABLE IF NOT EXISTS cities (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    country VARCHAR(255) DEFAULT 'India',
    branch_id INT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_cities_branch FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE SET NULL
  ) ENGINE=InnoDB`,
  `CREATE TABLE IF NOT EXISTS hotels (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    city_id INT NULL,
    branch_id INT NULL,
    address TEXT,
    contact VARCHAR(100),
    room_type VARCHAR(100),
    base_price DECIMAL(12,2),
    markup_price DECIMAL(12,2),
    extra_adult_price DECIMAL(12,2),
    price DECIMAL(12,2),
    month_prices JSON,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_hotels_city FOREIGN KEY (city_id) REFERENCES cities(id) ON DELETE SET NULL,
    CONSTRAINT fk_hotels_branch FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE SET NULL
  ) ENGINE=InnoDB`,
  `CREATE TABLE IF NOT EXISTS vehicles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(100),
    capacity INT,
    city_id INT NULL,
    branch_id INT NULL,
    contact VARCHAR(100),
    base_price DECIMAL(12,2),
    markup_price DECIMAL(12,2),
    price DECIMAL(12,2),
    month_prices JSON,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_vehicles_city FOREIGN KEY (city_id) REFERENCES cities(id) ON DELETE SET NULL,
    CONSTRAINT fk_vehicles_branch FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE SET NULL
  ) ENGINE=InnoDB`,
  `CREATE TABLE IF NOT EXISTS transports (
    id INT AUTO_INCREMENT PRIMARY KEY,
    transport_type VARCHAR(20) NOT NULL,
    from_location VARCHAR(255) NOT NULL,
    to_location VARCHAR(255) NOT NULL,
    branch_id INT NULL,
    base_price DECIMAL(12,2),
    markup_price DECIMAL(12,2),
    price DECIMAL(12,2),
    month_prices JSON,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_transports_branch FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE SET NULL
  ) ENGINE=InnoDB`,
  `CREATE TABLE IF NOT EXISTS activities (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    city_id INT NULL,
    branch_id INT NULL,
    image_url VARCHAR(500),
    contact VARCHAR(100),
    base_price DECIMAL(12,2),
    markup_price DECIMAL(12,2),
    price DECIMAL(12,2),
    month_prices JSON,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_activities_city FOREIGN KEY (city_id) REFERENCES cities(id) ON DELETE SET NULL,
    CONSTRAINT fk_activities_branch FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE SET NULL
  ) ENGINE=InnoDB`,
  `CREATE TABLE IF NOT EXISTS guides (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    mobile VARCHAR(50),
    city_id INT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_guides_city FOREIGN KEY (city_id) REFERENCES cities(id) ON DELETE SET NULL
  ) ENGINE=InnoDB`,
  `CREATE TABLE IF NOT EXISTS packages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255),
    title VARCHAR(255),
    description TEXT,
    duration_days INT,
    days INT,
    price DECIMAL(12,2) DEFAULT 0,
    city_ids JSON,
    image_urls JSON,
    itinerary_pdf_url TEXT,
    default_hotel_id INT NULL,
    default_vehicle_id INT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_packages_hotel FOREIGN KEY (default_hotel_id) REFERENCES hotels(id) ON DELETE SET NULL,
    CONSTRAINT fk_packages_vehicle FOREIGN KEY (default_vehicle_id) REFERENCES vehicles(id) ON DELETE SET NULL
  ) ENGINE=InnoDB`,
  `CREATE TABLE IF NOT EXISTS package_days (
    id INT AUTO_INCREMENT PRIMARY KEY,
    package_id INT NOT NULL,
    day_number INT NOT NULL,
    activities TEXT,
    hotel_id INT NULL,
    meals TEXT,
    transport TEXT,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_package_days_package FOREIGN KEY (package_id) REFERENCES packages(id) ON DELETE CASCADE,
    CONSTRAINT fk_package_days_hotel FOREIGN KEY (hotel_id) REFERENCES hotels(id) ON DELETE SET NULL
  ) ENGINE=InnoDB`,
  `CREATE TABLE IF NOT EXISTS bookings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    customer_id INT NULL,
    package_id INT NULL,
    status VARCHAR(50) DEFAULT 'inquiry',
    total_amount DECIMAL(12,2) DEFAULT 0,
    travel_start_date DATE,
    travel_end_date DATE,
    assigned_hotel_id INT NULL,
    assigned_vehicle_id INT NULL,
    assigned_transport_id INT NULL,
    assigned_staff_id INT NULL,
    assigned_guide_id INT NULL,
    internal_notes TEXT,
    branch_id INT NULL,
    created_by INT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_bookings_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
    CONSTRAINT fk_bookings_package FOREIGN KEY (package_id) REFERENCES packages(id) ON DELETE SET NULL,
    CONSTRAINT fk_bookings_hotel FOREIGN KEY (assigned_hotel_id) REFERENCES hotels(id) ON DELETE SET NULL,
    CONSTRAINT fk_bookings_vehicle FOREIGN KEY (assigned_vehicle_id) REFERENCES vehicles(id) ON DELETE SET NULL,
    CONSTRAINT fk_bookings_transport FOREIGN KEY (assigned_transport_id) REFERENCES transports(id) ON DELETE SET NULL,
    CONSTRAINT fk_bookings_staff FOREIGN KEY (assigned_staff_id) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_bookings_guide FOREIGN KEY (assigned_guide_id) REFERENCES guides(id) ON DELETE SET NULL,
    CONSTRAINT fk_bookings_branch FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE SET NULL,
    CONSTRAINT fk_bookings_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
  ) ENGINE=InnoDB`,
  `CREATE TABLE IF NOT EXISTS booking_notes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    booking_id INT NOT NULL,
    user_id INT NULL,
    note TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_booking_notes_booking FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
    CONSTRAINT fk_booking_notes_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
  ) ENGINE=InnoDB`,
  `CREATE TABLE IF NOT EXISTS quotations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    customer_id INT NULL,
    package_id INT NULL,
    valid_until DATE,
    discount DECIMAL(12,2) DEFAULT 0,
    tax_percent DECIMAL(5,2) DEFAULT 0,
    terms_text TEXT,
    prepared_by VARCHAR(255),
    family_count INT DEFAULT 1,
    status VARCHAR(50) DEFAULT 'draft',
    total DECIMAL(12,2) DEFAULT 0,
    branch_id INT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_quotations_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
    CONSTRAINT fk_quotations_package FOREIGN KEY (package_id) REFERENCES packages(id) ON DELETE SET NULL,
    CONSTRAINT fk_quotations_branch FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE SET NULL
  ) ENGINE=InnoDB`,
  `CREATE TABLE IF NOT EXISTS quotation_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    quotation_id INT NOT NULL,
    description VARCHAR(500) NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_quotation_items_quotation FOREIGN KEY (quotation_id) REFERENCES quotations(id) ON DELETE CASCADE
  ) ENGINE=InnoDB`,
  `CREATE TABLE IF NOT EXISTS invoices (
    id INT AUTO_INCREMENT PRIMARY KEY,
    invoice_number VARCHAR(50) NOT NULL UNIQUE,
    booking_id INT NULL,
    customer_id INT NULL,
    invoice_date DATE NOT NULL,
    due_date DATE NOT NULL,
    subtotal DECIMAL(12,2) DEFAULT 0,
    discount DECIMAL(12,2) DEFAULT 0,
    discount_type VARCHAR(20) DEFAULT 'flat',
    tax_percent DECIMAL(5,2) DEFAULT 0,
    tax_amount DECIMAL(12,2) DEFAULT 0,
    service_charges DECIMAL(12,2) DEFAULT 0,
    round_off DECIMAL(12,2) DEFAULT 0,
    total DECIMAL(12,2) NOT NULL,
    status VARCHAR(30) DEFAULT 'draft',
    created_by INT NULL,
    branch_id INT NULL,
    place_of_supply VARCHAR(100),
    billing_address TEXT,
    customer_gst VARCHAR(50),
    travel_destination VARCHAR(255),
    travel_start_date DATE,
    travel_end_date DATE,
    adults INT DEFAULT 0,
    children INT DEFAULT 0,
    package_name VARCHAR(255),
    hotel_category VARCHAR(100),
    vehicle_type VARCHAR(100),
    terms_text TEXT,
    company_gst VARCHAR(50),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_invoices_booking FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE SET NULL,
    CONSTRAINT fk_invoices_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
    CONSTRAINT fk_invoices_user FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_invoices_branch FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE SET NULL
  ) ENGINE=InnoDB`,
  `CREATE TABLE IF NOT EXISTS invoice_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    invoice_id INT NOT NULL,
    description VARCHAR(500),
    quantity DECIMAL(10,2) DEFAULT 1,
    rate DECIMAL(12,2) DEFAULT 0,
    amount DECIMAL(12,2) DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_invoice_items_invoice FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
  ) ENGINE=InnoDB`,
  `CREATE TABLE IF NOT EXISTS payments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    booking_id INT NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    mode VARCHAR(50) NOT NULL,
    reference VARCHAR(255),
    paid_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_by INT NULL,
    CONSTRAINT fk_payments_booking FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
    CONSTRAINT fk_payments_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
  ) ENGINE=InnoDB`,
  `CREATE TABLE IF NOT EXISTS invoice_payments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    invoice_id INT NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    mode VARCHAR(50) NOT NULL,
    reference VARCHAR(255),
    paid_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_invoice_payments_invoice FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
  ) ENGINE=InnoDB`,
  `CREATE TABLE IF NOT EXISTS documents (
    id INT AUTO_INCREMENT PRIMARY KEY,
    entity_type VARCHAR(50) NOT NULL,
    entity_id INT NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_url VARCHAR(500) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB`,
  `CREATE TABLE IF NOT EXISTS staff_performance (
    id INT AUTO_INCREMENT PRIMARY KEY,
    staff_id INT NOT NULL,
    booking_id INT NULL,
    notes TEXT,
    rating INT,
    period_start DATE,
    period_end DATE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_staff_performance_staff FOREIGN KEY (staff_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_staff_performance_booking FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE SET NULL
  ) ENGINE=InnoDB`,
  `CREATE TABLE IF NOT EXISTS company_settings (
    \`key\` VARCHAR(100) PRIMARY KEY,
    value TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB`,
  `CREATE TABLE IF NOT EXISTS branch_settings (
    branch_id INT NOT NULL,
    \`key\` VARCHAR(100) NOT NULL,
    value TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (branch_id, \`key\`),
    CONSTRAINT fk_branch_settings_branch FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE
  ) ENGINE=InnoDB`,
  `CREATE TABLE IF NOT EXISTS activity_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50),
    entity_id INT,
    details JSON,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_activity_logs_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
  ) ENGINE=InnoDB`,
  `CREATE TABLE IF NOT EXISTS itinerary_templates (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    state_id INT NULL,
    state_name VARCHAR(255),
    branch_id INT NULL,
    total_nights INT NOT NULL DEFAULT 0,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_itinerary_templates_city FOREIGN KEY (state_id) REFERENCES cities(id) ON DELETE SET NULL,
    CONSTRAINT fk_itinerary_templates_branch FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE SET NULL
  ) ENGINE=InnoDB`,
  `CREATE TABLE IF NOT EXISTS itinerary_template_days (
    id INT AUTO_INCREMENT PRIMARY KEY,
    itinerary_id INT NOT NULL,
    day_number INT NOT NULL,
    city_id INT NULL,
    city_name VARCHAR(255) NOT NULL,
    night_count INT NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_itinerary_days_itinerary FOREIGN KEY (itinerary_id) REFERENCES itinerary_templates(id) ON DELETE CASCADE,
    CONSTRAINT fk_itinerary_days_city FOREIGN KEY (city_id) REFERENCES cities(id) ON DELETE SET NULL
  ) ENGINE=InnoDB`,
];

export async function initDb() {
  const client = await pool.connect();
  try {
    for (const sql of createStatements) await client.query(sql);

    // Heal older MySQL schemas created from early migration files.
    await client.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS place_of_supply VARCHAR(100)`).catch(() => {});
    await client.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS billing_address TEXT`).catch(() => {});
    await client.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS customer_gst VARCHAR(50)`).catch(() => {});
    await client.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS travel_destination VARCHAR(255)`).catch(() => {});
    await client.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS travel_start_date DATE`).catch(() => {});
    await client.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS travel_end_date DATE`).catch(() => {});
    await client.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS adults INT DEFAULT 0`).catch(() => {});
    await client.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS children INT DEFAULT 0`).catch(() => {});
    await client.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS package_name VARCHAR(255)`).catch(() => {});
    await client.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS hotel_category VARCHAR(100)`).catch(() => {});
    await client.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS vehicle_type VARCHAR(100)`).catch(() => {});
    await ensureColumn(client, 'customers', 'created_by', 'INT NULL');
    await ensureColumn(client, 'bookings', 'created_by', 'INT NULL');
    await ensureColumn(client, 'bookings', 'assigned_transport_id', 'INT NULL');
    await ensureColumn(client, 'payments', 'created_by', 'INT NULL');

    await client.query(
      `INSERT INTO branches (name, code, address, city, state, phone, email, manager_name, gst_number)
       SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?
       FROM DUAL
       WHERE NOT EXISTS (SELECT 1 FROM branches LIMIT 1)`,
      ['Ahmedabad Branch', 'AHM', 'Ahmedabad Branch Address', 'Ahmedabad', 'Gujarat', '', '', '', '']
    );

    // Clear orphan branch references to prevent FK failures on CRUD.
    await client.query(`
      UPDATE users u LEFT JOIN branches b ON u.branch_id = b.id
      SET u.branch_id = NULL
      WHERE u.branch_id IS NOT NULL AND b.id IS NULL
    `).catch(() => {});
    await client.query(`
      UPDATE customers c LEFT JOIN branches b ON c.branch_id = b.id
      SET c.branch_id = NULL
      WHERE c.branch_id IS NOT NULL AND b.id IS NULL
    `).catch(() => {});
    await client.query(`
      UPDATE bookings bk LEFT JOIN branches b ON bk.branch_id = b.id
      SET bk.branch_id = NULL
      WHERE bk.branch_id IS NOT NULL AND b.id IS NULL
    `).catch(() => {});
    await client.query(`
      UPDATE transports t LEFT JOIN branches b ON t.branch_id = b.id
      SET t.branch_id = NULL
      WHERE t.branch_id IS NOT NULL AND b.id IS NULL
    `).catch(() => {});
    await client.query(`
      UPDATE quotations q LEFT JOIN branches b ON q.branch_id = b.id
      SET q.branch_id = NULL
      WHERE q.branch_id IS NOT NULL AND b.id IS NULL
    `).catch(() => {});
    await client.query(`
      UPDATE invoices i LEFT JOIN branches b ON i.branch_id = b.id
      SET i.branch_id = NULL
      WHERE i.branch_id IS NOT NULL AND b.id IS NULL
    `).catch(() => {});

    const settingsSeed = [
      ['company_name', 'Vision Travel Hub'],
      ['company_address', '1234 Street, City, State, Zip Code'],
      ['company_phone', '123-123-1234'],
      ['company_email', 'yourcompany@email.com'],
      ['company_gst', 'GST Number'],
      ['company_website', ''],
      ['bank_name', 'Your Bank Name'],
      ['bank_account', '000000000000'],
      ['bank_ifsc', 'BANK0000000'],
      ['bank_upi', 'yourcompany@upi'],
      ['bank_branch', 'Main Branch'],
      ['upi_name', ''],
      ['upi_qr_path', ''],
    ];
    for (const [k, v] of settingsSeed) {
      await client.query(
        'INSERT INTO company_settings (`key`, value) VALUES ($1, $2) ON DUPLICATE KEY UPDATE value = value',
        [k, v]
      );
    }
  } finally {
    client.release();
  }
}
