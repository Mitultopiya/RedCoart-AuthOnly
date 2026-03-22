import pool from '../config/db.js';
import { assertStaffOwnsRecord, isFullDataAccess, staffCanAccessCustomer, staffRequiresCreatorScope } from '../utils/dataScope.js';

let invoiceColumnsCache = null;
async function getInvoiceColumns() {
  if (invoiceColumnsCache) return invoiceColumnsCache;
  const result = await pool.query(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'invoices'`
  );
  invoiceColumnsCache = new Set((result.rows || []).map((r) => String(r.COLUMN_NAME || r.column_name || '').toLowerCase()));
  return invoiceColumnsCache;
}

function resolveBranchId(req) {
  if (req.query.branch_id != null && String(req.query.branch_id) === 'all') return null;
  if (req.query.branch_id != null && String(req.query.branch_id) !== '') {
    const parsed = parseInt(req.query.branch_id, 10);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return req.branchId ?? null;
}

function getNextInvoiceNumber() {
  const year = new Date().getFullYear();
  const prefix = `INV-${year}-`;
  return pool
    .query(
      `SELECT invoice_number FROM invoices WHERE invoice_number LIKE $1 ORDER BY id DESC LIMIT 1`,
      [prefix + '%']
    )
    .then((r) => {
      const last = r.rows[0]?.invoice_number || '';
      const num = last ? parseInt(last.replace(prefix, ''), 10) + 1 : 1;
      return `${prefix}${String(num).padStart(4, '0')}`;
    });
}

export const list = async (req, res) => {
  try {
    const branchId = resolveBranchId(req);
    const parts = [];
    const params = [];
    if (branchId && Number.isFinite(branchId)) {
      params.push(branchId);
      parts.push(`i.branch_id = $${params.length}`);
    }
    if (staffRequiresCreatorScope(req)) {
      params.push(req.user.id);
      parts.push(`i.created_by = $${params.length}`);
    }
    const where = parts.length ? ` WHERE ${parts.join(' AND ')}` : '';
    const result = await pool.query(
      `SELECT i.*, c.name as customer_name, c.email as customer_email, c.mobile,
        COALESCE(b.name, cb.name) as branch_name,
        (SELECT COALESCE(SUM(ip.amount), 0) FROM invoice_payments ip WHERE ip.invoice_id = i.id) as paid_amount
       FROM invoices i
       LEFT JOIN customers c ON i.customer_id = c.id
       LEFT JOIN branches b ON i.branch_id = b.id
       LEFT JOIN branches cb ON c.branch_id = cb.id${where}
       ORDER BY i.created_at DESC`,
      params
    );
    const rows = result.rows.map((r) => {
      const total = Number(r.total || 0);
      const paid = Number(r.paid_amount || 0);
      let status = r.status;
      if (status === 'issued' && new Date(r.due_date) < new Date() && paid < total) status = 'overdue';
      if (status !== 'cancelled' && status !== 'paid' && paid >= total && total > 0) status = 'paid';
      return { ...r, paid_amount: paid, status };
    });
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
};

export const getOne = async (req, res) => {
  try {
    const { id } = req.params;
    const inv = await pool.query(
      `SELECT i.*, c.name as customer_name, c.email as customer_email, c.mobile, c.address as customer_address
       FROM invoices i LEFT JOIN customers c ON i.customer_id = c.id WHERE i.id = $1`,
      [id]
    );
    if (inv.rows.length === 0) return res.status(404).json({ message: 'Invoice not found.' });
    if (!assertStaffOwnsRecord(req, inv.rows[0].created_by)) {
      return res.status(404).json({ message: 'Invoice not found.' });
    }
    const items = await pool.query('SELECT * FROM invoice_items WHERE invoice_id = $1 ORDER BY id', [id]);
    const payments = await pool.query('SELECT * FROM invoice_payments WHERE invoice_id = $1 ORDER BY paid_at', [id]);
    const paid = payments.rows.reduce((s, p) => s + Number(p.amount || 0), 0);
    const total = Number(inv.rows[0].total || 0);
    let status = inv.rows[0].status;
    if (status !== 'cancelled' && status !== 'paid' && paid >= total && total > 0) status = 'paid';
    else if (status === 'issued' && new Date(inv.rows[0].due_date) < new Date() && paid < total) status = 'overdue';
    res.json({
      ...inv.rows[0],
      items: items.rows,
      payments: payments.rows,
      paid_amount: paid,
      due_amount: Math.max(0, total - paid),
      status,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
};

export const nextNumber = async (req, res) => {
  try {
    const num = await getNextInvoiceNumber();
    res.json({ invoice_number: num });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
};

export const create = async (req, res) => {
  try {
    const {
      invoice_number,
      booking_id,
      customer_id,
      invoice_date,
      due_date,
      subtotal,
      discount,
      discount_type,
      tax_percent,
      tax_amount,
      service_charges,
      round_off,
      total,
      status,
      place_of_supply,
      billing_address,
      customer_gst,
      travel_destination,
      travel_start_date,
      travel_end_date,
      adults,
      children,
      package_name,
      hotel_category,
      vehicle_type,
      terms_text,
      company_gst,
      items,
      created_by,
      branch_id,
    } = req.body;
    if (!customer_id || !invoice_date || !due_date) {
      return res.status(400).json({ message: 'customer_id, invoice_date, due_date required.' });
    }
    const num = invoice_number || (await getNextInvoiceNumber());
    const isElevated = ['admin', 'super_admin'].includes(req.user?.role);
    let bid = isElevated ? (branch_id ?? req.branchId ?? null) : (req.branchId ?? null);
    if (staffRequiresCreatorScope(req)) {
      if (!(await staffCanAccessCustomer(pool, req, customer_id))) {
        return res.status(403).json({ message: 'Access denied.' });
      }
    }
    if (bid == null && customer_id) {
      const customerBranch = await pool.query('SELECT branch_id FROM customers WHERE id = $1 LIMIT 1', [customer_id]);
      bid = customerBranch.rows[0]?.branch_id ?? null;
    }
    const columns = await getInvoiceColumns();
    const payload = {
      invoice_number: num,
      booking_id: booking_id || null,
      customer_id,
      invoice_date,
      due_date,
      subtotal: Number(subtotal) || 0,
      discount: Number(discount) || 0,
      discount_type: discount_type || 'flat',
      tax_percent: Number(tax_percent) || 0,
      tax_amount: Number(tax_amount) || 0,
      service_charges: Number(service_charges) || 0,
      round_off: Number(round_off) || 0,
      total: Number(total) || 0,
      status: status || 'draft',
      created_by: isFullDataAccess(req)
        ? (created_by != null && created_by !== '' ? Number(created_by) : (req.user?.id != null ? Number(req.user.id) : null))
        : (req.user?.id != null ? Number(req.user.id) : null),
      place_of_supply: place_of_supply || null,
      billing_address: billing_address || null,
      customer_gst: customer_gst || null,
      travel_destination: travel_destination || null,
      travel_start_date: travel_start_date || null,
      travel_end_date: travel_end_date || null,
      adults: Number(adults) || 0,
      children: Number(children) || 0,
      package_name: package_name || null,
      hotel_category: hotel_category || null,
      vehicle_type: vehicle_type || null,
      terms_text: terms_text || null,
      company_gst: company_gst || null,
      branch_id: bid,
    };
    const insertCols = Object.keys(payload).filter((k) => columns.has(k));
    const insertVals = insertCols.map((k) => payload[k]);
    const placeholders = insertCols.map((_, i) => `$${i + 1}`).join(',');
    const result = await pool.query(
      `INSERT INTO invoices (${insertCols.join(',')}) VALUES (${placeholders}) RETURNING *`,
      insertVals
    );
    const invoice = result.rows[0];
    if (items && items.length) {
      for (const it of items) {
        await pool.query(
          'INSERT INTO invoice_items (invoice_id, description, quantity, rate, amount) VALUES ($1,$2,$3,$4,$5)',
          [invoice.id, it.description || '', Number(it.quantity) || 0, Number(it.rate) || 0, Number(it.amount) || 0]
        );
      }
    }
    const full = await pool.query('SELECT * FROM invoices WHERE id = $1', [invoice.id]);
    const itemRows = await pool.query('SELECT * FROM invoice_items WHERE invoice_id = $1', [invoice.id]);
    res.status(201).json({ ...full.rows[0], items: itemRows.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
};

export const update = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await pool.query('SELECT * FROM invoices WHERE id = $1', [id]);
    if (existing.rows.length === 0) return res.status(404).json({ message: 'Invoice not found.' });
    if (!assertStaffOwnsRecord(req, existing.rows[0].created_by)) {
      return res.status(404).json({ message: 'Invoice not found.' });
    }
    const {
      invoice_date,
      due_date,
      subtotal,
      discount,
      discount_type,
      tax_percent,
      tax_amount,
      service_charges,
      round_off,
      total,
      status,
      place_of_supply,
      billing_address,
      customer_gst,
      travel_destination,
      travel_start_date,
      travel_end_date,
      adults,
      children,
      package_name,
      hotel_category,
      vehicle_type,
      terms_text,
      company_gst,
      items,
      branch_id,
    } = req.body;
    const isElevated = ['admin', 'super_admin'].includes(req.user?.role);
    const incomingBranchId = isElevated ? (branch_id ?? null) : null;
    const columns = await getInvoiceColumns();
    const updateMap = {
      invoice_date,
      due_date,
      subtotal,
      discount,
      discount_type,
      tax_percent,
      tax_amount,
      service_charges,
      round_off,
      total,
      status,
      place_of_supply: place_of_supply || null,
      billing_address: billing_address || null,
      customer_gst: customer_gst || null,
      travel_destination: travel_destination || null,
      travel_start_date: travel_start_date || null,
      travel_end_date: travel_end_date || null,
      adults,
      children,
      package_name: package_name || null,
      hotel_category: hotel_category || null,
      vehicle_type: vehicle_type || null,
      terms_text: terms_text || null,
      company_gst: company_gst || null,
      branch_id: incomingBranchId,
    };
    const setParts = [];
    const values = [];
    for (const [key, val] of Object.entries(updateMap)) {
      if (!columns.has(key)) continue;
      values.push(val);
      if (key === 'branch_id') setParts.push(`${key}=COALESCE($${values.length}, ${key})`);
      else if (['invoice_date', 'due_date', 'subtotal', 'discount', 'discount_type', 'tax_percent', 'tax_amount', 'service_charges', 'round_off', 'total', 'status', 'adults', 'children'].includes(key)) {
        setParts.push(`${key}=COALESCE($${values.length},${key})`);
      } else {
        setParts.push(`${key}=$${values.length}`);
      }
    }
    values.push(id);
    await pool.query(
      `UPDATE invoices SET ${setParts.join(', ')}, updated_at=NOW() WHERE id=$${values.length}`,
      values
    );
    if (items) {
      await pool.query('DELETE FROM invoice_items WHERE invoice_id = $1', [id]);
      for (const it of items) {
        await pool.query(
          'INSERT INTO invoice_items (invoice_id, description, quantity, rate, amount) VALUES ($1,$2,$3,$4,$5)',
          [id, it.description || '', Number(it.quantity) || 0, Number(it.rate) || 0, Number(it.amount) || 0]
        );
      }
    }
    const inv = await pool.query('SELECT * FROM invoices WHERE id = $1', [id]);
    const itemRows = await pool.query('SELECT * FROM invoice_items WHERE invoice_id = $1', [id]);
    res.json({ ...inv.rows[0], items: itemRows.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
};

export const remove = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await pool.query('SELECT id, created_by FROM invoices WHERE id = $1', [id]);
    if (existing.rows.length === 0) return res.status(404).json({ message: 'Invoice not found.' });
    if (!assertStaffOwnsRecord(req, existing.rows[0].created_by)) {
      return res.status(404).json({ message: 'Invoice not found.' });
    }
    const result = await pool.query('DELETE FROM invoices WHERE id = $1 RETURNING id', [id]);
    if (result.rowCount === 0) return res.status(404).json({ message: 'Invoice not found.' });
    res.json({ message: 'Deleted.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
};

export const listAllPayments = async (req, res) => {
  try {
    const branchId =
      req.query.branch_id && String(req.query.branch_id) !== 'all'
        ? parseInt(req.query.branch_id, 10)
        : (req.branchId ?? null);
    const parts = [];
    const params = [];
    if (branchId && Number.isFinite(branchId)) {
      params.push(branchId);
      parts.push(`i.branch_id = $${params.length}`);
    }
    if (staffRequiresCreatorScope(req)) {
      params.push(req.user.id);
      parts.push(`i.created_by = $${params.length}`);
    }
    const where = parts.length ? ` WHERE ${parts.join(' AND ')}` : '';
    const columns = await getInvoiceColumns();
    const placeOfSupplyExpr = columns.has('place_of_supply') ? 'i.place_of_supply' : "NULL as place_of_supply";
    const customerGstExpr = columns.has('customer_gst') ? 'i.customer_gst' : "NULL as customer_gst";
    const companyGstExpr = columns.has('company_gst') ? 'i.company_gst' : "NULL as company_gst";
    const result = await pool.query(
      `SELECT ip.*, i.invoice_number, i.total as invoice_total,
              ${companyGstExpr}, ${customerGstExpr}, ${placeOfSupplyExpr},
              c.name as customer_name, c.mobile as customer_mobile
       FROM invoice_payments ip
       JOIN invoices i ON ip.invoice_id = i.id
       LEFT JOIN customers c ON i.customer_id = c.id${where}
       ORDER BY ip.paid_at DESC`,
      params
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
};

export const removePayment = async (req, res) => {
  try {
    const { id, pid } = req.params;
    const inv = await pool.query('SELECT created_by FROM invoices WHERE id = $1', [id]);
    if (inv.rows.length === 0) return res.status(404).json({ message: 'Invoice not found.' });
    if (!assertStaffOwnsRecord(req, inv.rows[0].created_by)) {
      return res.status(404).json({ message: 'Invoice not found.' });
    }
    const result = await pool.query(
      'DELETE FROM invoice_payments WHERE id = $1 AND invoice_id = $2 RETURNING id',
      [pid, id]
    );
    if (result.rowCount === 0) return res.status(404).json({ message: 'Payment not found.' });
    res.json({ message: 'Payment deleted.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
};

export const addPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, mode, reference } = req.body;
    const inv = await pool.query('SELECT * FROM invoices WHERE id = $1', [id]);
    if (inv.rows.length === 0) return res.status(404).json({ message: 'Invoice not found.' });
    if (!assertStaffOwnsRecord(req, inv.rows[0].created_by)) {
      return res.status(404).json({ message: 'Invoice not found.' });
    }
    if (!amount || !mode) return res.status(400).json({ message: 'amount and mode required.' });
    await pool.query(
      'INSERT INTO invoice_payments (invoice_id, amount, mode, reference) VALUES ($1,$2,$3,$4)',
      [id, Number(amount), mode, reference || null]
    );
    const payments = await pool.query('SELECT * FROM invoice_payments WHERE invoice_id = $1', [id]);
    const paid = payments.rows.reduce((s, p) => s + Number(p.amount || 0), 0);
    const total = Number(inv.rows[0].total || 0);
    let status = inv.rows[0].status;
    if (paid >= total && total > 0) status = 'paid';
    else if (paid > 0) status = 'partially_paid';
    await pool.query('UPDATE invoices SET status = $1, updated_at = NOW() WHERE id = $2', [status, id]);
    const updated = await pool.query('SELECT * FROM invoices WHERE id = $1', [id]);
    res.status(201).json(updated.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
};
