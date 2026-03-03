import pool from '../config/db.js';
import bcrypt from 'bcryptjs';

/** List staff (manager + staff); admin can see all users via /users */
export const list = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, email, role, is_blocked, branch, created_at FROM users WHERE role IN ('manager', 'staff') ORDER BY name`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
};

export const create = async (req, res) => {
  try {
    const { name, email, password, role = 'staff', branch = null } = req.body;
    if (!name || !email || !password) return res.status(400).json({ message: 'Name, email, password required.' });
    if (!['manager', 'staff'].includes(role)) return res.status(400).json({ message: 'Role must be manager or staff.' });
    const hashed = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (name, email, password, role, branch) VALUES ($1, $2, $3, $4, $5) RETURNING id, name, email, role, is_blocked, branch, created_at',
      [name, email, hashed, role, branch]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ message: 'Email already exists.' });
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
};

export const update = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, role, branch } = req.body;
    const result = await pool.query(
      `UPDATE users SET name = COALESCE($1, name), email = COALESCE($2, email), role = COALESCE($3, role), branch = COALESCE($4, branch), updated_at = NOW()
       WHERE id = $5 AND role IN ('manager', 'staff') RETURNING id, name, email, role, is_blocked, branch`,
      [name, email, role, branch, id]
    );
    if (result.rowCount === 0) return res.status(404).json({ message: 'Not found.' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
};

export const toggleBlock = async (req, res) => {
  try {
    const { id } = req.params;
    const { is_blocked } = req.body;
    const result = await pool.query(
      "UPDATE users SET is_blocked = $1, updated_at = NOW() WHERE id = $2 AND role IN ('manager', 'staff') RETURNING id, is_blocked",
      [!!is_blocked, id]
    );
    if (result.rowCount === 0) return res.status(404).json({ message: 'Not found.' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
};

export const remove = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      "DELETE FROM users WHERE id = $1 AND role IN ('manager', 'staff') RETURNING id",
      [id]
    );
    if (result.rowCount === 0) return res.status(404).json({ message: 'Not found.' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
};

export const performance = async (req, res) => {
  try {
    const { id } = req.params;
    const bookings = await pool.query(
      `SELECT b.id, b.status, b.travel_start_date, b.created_at, c.name as customer_name
       FROM bookings b LEFT JOIN customers c ON b.customer_id = c.id WHERE b.assigned_staff_id = $1 ORDER BY b.created_at DESC`,
      [id]
    );
    const perfs = await pool.query('SELECT * FROM staff_performance WHERE staff_id = $1 ORDER BY created_at DESC', [id]);
    res.json({ bookings: bookings.rows, performance: perfs.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
};
