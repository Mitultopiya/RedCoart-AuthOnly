import pool from '../config/db.js';

export const list = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM branches ORDER BY name ASC'
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
    const result = await pool.query('SELECT * FROM branches WHERE id = $1', [id]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'Branch not found.' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
};

export const create = async (req, res) => {
  try {
    const { name, code, address, city, state, phone, email, manager_name, gst_number } = req.body;
    if (!name || !code) return res.status(400).json({ message: 'Branch name and code are required.' });
    const result = await pool.query(
      `INSERT INTO branches (name, code, address, city, state, phone, email, manager_name, gst_number)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [name, code || null, address || null, city || null, state || null, phone || null, email || null, manager_name || null, gst_number || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ message: 'Branch code already exists.' });
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
};

export const update = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, code, address, city, state, phone, email, manager_name, gst_number } = req.body;
    const result = await pool.query(
      `UPDATE branches SET
        name = COALESCE($1, name),
        code = COALESCE($2, code),
        address = COALESCE($3, address),
        city = COALESCE($4, city),
        state = COALESCE($5, state),
        phone = COALESCE($6, phone),
        email = COALESCE($7, email),
        manager_name = COALESCE($8, manager_name),
        gst_number = COALESCE($9, gst_number),
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $10 RETURNING *`,
      [name, code, address, city, state, phone, email, manager_name, gst_number, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'Branch not found.' });
    res.json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ message: 'Branch code already exists.' });
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
};

export const remove = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM branches WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'Branch not found.' });
    res.json({ message: 'Branch deleted.' });
  } catch (err) {
    if (err.code === '23503') return res.status(400).json({ message: 'Cannot delete branch: it is in use.' });
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
};
