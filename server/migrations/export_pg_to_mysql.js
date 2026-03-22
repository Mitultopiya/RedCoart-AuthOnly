import pg from 'pg';
import fs from 'fs/promises';

const pgPool = new pg.Pool({
  host: process.env.PG_HOST || 'localhost',
  port: Number(process.env.PG_PORT || 5432),
  user: process.env.PG_USER || 'postgres',
  password: String(process.env.PG_PASSWORD || ''),
  database: process.env.PG_DB || 'Travel-Agency',
});

const TABLES = [
  'branches', 'users', 'customers', 'customer_family', 'cities', 'hotels', 'vehicles', 'activities',
  'guides', 'packages', 'package_days', 'bookings', 'booking_notes', 'quotations', 'quotation_items',
  'invoices', 'invoice_items', 'payments', 'invoice_payments', 'documents', 'staff_performance',
  'company_settings', 'branch_settings', 'activity_logs', 'itinerary_templates', 'itinerary_template_days',
];

function esc(v) {
  if (v == null) return 'NULL';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'boolean') return v ? '1' : '0';
  if (v instanceof Date) return `'${v.toISOString().slice(0, 19).replace('T', ' ')}'`;
  return `'${String(v).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

async function run() {
  const lines = ['SET FOREIGN_KEY_CHECKS=0;'];
  for (const table of TABLES) {
    const rs = await pgPool.query(`SELECT * FROM ${table}`);
    if (!rs.rows.length) continue;
    const cols = Object.keys(rs.rows[0]).map((c) => `\`${c}\``).join(', ');
    for (const row of rs.rows) {
      const vals = Object.values(row).map((v) => {
        if (Array.isArray(v)) return esc(JSON.stringify(v));
        if (v && typeof v === 'object' && !(v instanceof Date)) return esc(JSON.stringify(v));
        return esc(v);
      }).join(', ');
      lines.push(`INSERT INTO \`${table}\` (${cols}) VALUES (${vals});`);
    }
  }
  lines.push('SET FOREIGN_KEY_CHECKS=1;');
  await fs.writeFile(new URL('./mysql_data_dump.sql', import.meta.url), `${lines.join('\n')}\n`, 'utf8');
  await pgPool.end();
  console.log('Wrote server/migrations/mysql_data_dump.sql');
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
