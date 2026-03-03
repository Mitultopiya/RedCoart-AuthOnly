import bcrypt from 'bcryptjs';
import pool from '../config/db.js';

/**
 * GET /api/users - List all users (admin only; managers see staff list via /staff)
 */
export const getUsers = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, email, role, is_blocked, created_at FROM users ORDER BY created_at DESC'
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get users error:', err);
    res.status(500).json({ message: 'Server error.' });
  }
};

/**
 * POST /api/users - Create user (admin only)
 */
export const createUser = async (req, res) => {
  try {
    const { name, email, password, role = 'staff' } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email and password are required.' });
    }

    if (!['admin', 'manager', 'staff'].includes(role)) {
      return res.status(400).json({ message: 'Role must be admin, manager or staff.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await pool.query(
      'INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4) RETURNING id, name, email, role, is_blocked, created_at',
      [name, email, hashedPassword, role]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ message: 'Email already exists.' });
    }
    console.error('Create user error:', err);
    res.status(500).json({ message: 'Server error.' });
  }
};

/**
 * DELETE /api/users/:id - Delete user (admin only)
 */
export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query('DELETE FROM users WHERE id = $1 RETURNING id', [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }

    res.json({ message: 'User deleted successfully.' });
  } catch (err) {
    console.error('Delete user error:', err);
    res.status(500).json({ message: 'Server error.' });
  }
};

/**
 * PATCH /api/users/:id/block - Block/unblock user (admin only)
 */
export const toggleBlock = async (req, res) => {
  try {
    const { id } = req.params;
    const { is_blocked } = req.body;
    const result = await pool.query(
      'UPDATE users SET is_blocked = $1, updated_at = NOW() WHERE id = $2 RETURNING id, name, email, role, is_blocked',
      [!!is_blocked, id]
    );
    if (result.rowCount === 0) return res.status(404).json({ message: 'User not found.' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Toggle block error:', err);
    res.status(500).json({ message: 'Server error.' });
  }
};
