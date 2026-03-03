import pool from '../config/db.js';

export const list = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT q.*, c.name as customer_name, c.email as customer_email, p.name as package_name
       FROM quotations q
       LEFT JOIN customers c ON q.customer_id = c.id
       LEFT JOIN packages p ON q.package_id = p.id
       ORDER BY q.created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
};

export const getOne = async (req, res) => {
  try {
    const { id } = req.params;
    const q = await pool.query(
      `SELECT q.*, c.name as customer_name, c.email as customer_email, c.mobile, p.name as package_name, p.price as package_price
       FROM quotations q LEFT JOIN customers c ON q.customer_id = c.id LEFT JOIN packages p ON q.package_id = p.id WHERE q.id = $1`,
      [id]
    );
    if (q.rows.length === 0) return res.status(404).json({ message: 'Quotation not found.' });
    const items = await pool.query('SELECT * FROM quotation_items WHERE quotation_id = $1 ORDER BY id', [id]);
    res.json({ ...q.rows[0], items: items.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
};

export const create = async (req, res) => {
  try {
    const { customer_id, package_id, valid_until, discount, tax_percent, items } = req.body;
    if (!customer_id) return res.status(400).json({ message: 'customer_id required.' });
    const sub = (items || []).reduce((s, i) => s + Number(i.amount || 0), 0);
    const total = sub - Number(discount || 0);
    const result = await pool.query(
      `INSERT INTO quotations (customer_id, package_id, valid_until, discount, tax_percent, total) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [customer_id, package_id || null, valid_until || null, discount || 0, tax_percent || 0, total]
    );
    const q = result.rows[0];
    if (items && items.length) {
      for (const it of items) {
        await pool.query('INSERT INTO quotation_items (quotation_id, description, amount) VALUES ($1, $2, $3)', [q.id, it.description || '', it.amount || 0]);
      }
    }
    const full = await pool.query(
      `SELECT q.*, c.name as customer_name FROM quotations q LEFT JOIN customers c ON q.customer_id = c.id WHERE q.id = $1`,
      [q.id]
    );
    const itemRows = await pool.query('SELECT * FROM quotation_items WHERE quotation_id = $1', [q.id]);
    res.status(201).json({ ...full.rows[0], items: itemRows.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
};

export const update = async (req, res) => {
  try {
    const { id } = req.params;
    const { valid_until, discount, tax_percent, items } = req.body;
    const existing = await pool.query('SELECT * FROM quotations WHERE id = $1', [id]);
    if (existing.rows.length === 0) return res.status(404).json({ message: 'Not found.' });
    const sub = (items || []).reduce((s, i) => s + Number(i.amount || 0), 0);
    const discountVal = discount != null ? discount : (existing.rows[0].discount || 0);
    const total = sub - Number(discountVal);
    await pool.query(
      'UPDATE quotations SET valid_until = COALESCE($1, valid_until), discount = COALESCE($2, discount), tax_percent = COALESCE($3, tax_percent), total = $4, updated_at = NOW() WHERE id = $5',
      [valid_until, discount, tax_percent, total, id]
    );
    if (items) {
      await pool.query('DELETE FROM quotation_items WHERE quotation_id = $1', [id]);
      for (const it of items) {
        await pool.query('INSERT INTO quotation_items (quotation_id, description, amount) VALUES ($1, $2, $3)', [id, it.description || '', it.amount || 0]);
      }
    }
    const q = await pool.query('SELECT * FROM quotations WHERE id = $1', [id]);
    const itemRows = await pool.query('SELECT * FROM quotation_items WHERE quotation_id = $1', [id]);
    res.json({ ...q.rows[0], items: itemRows.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
};

export const remove = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM quotations WHERE id = $1 RETURNING id', [id]);
    if (result.rowCount === 0) return res.status(404).json({ message: 'Quotation not found.' });
    res.json({ message: 'Deleted.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
};

export const convertToBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const q = await pool.query('SELECT * FROM quotations WHERE id = $1', [id]);
    if (q.rows.length === 0) return res.status(404).json({ message: 'Quotation not found.' });
    const row = q.rows[0];
    const result = await pool.query(
      `INSERT INTO bookings (customer_id, package_id, total_amount, status) VALUES ($1, $2, $3, 'confirmed') RETURNING *`,
      [row.customer_id, row.package_id, row.total]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
};
