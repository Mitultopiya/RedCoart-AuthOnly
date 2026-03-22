import pool from '../config/db.js';
import { assertStaffOwnsRecord } from '../utils/dataScope.js';

export const listByBooking = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const bk = await pool.query('SELECT id, created_by FROM bookings WHERE id = $1', [bookingId]);
    if (bk.rows.length === 0) return res.status(404).json({ message: 'Booking not found.' });
    if (!assertStaffOwnsRecord(req, bk.rows[0].created_by)) {
      return res.status(404).json({ message: 'Booking not found.' });
    }
    const result = await pool.query('SELECT * FROM payments WHERE booking_id = $1 ORDER BY paid_at', [bookingId]);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
};

export const add = async (req, res) => {
  try {
    const { booking_id, amount, mode, reference } = req.body;
    if (!booking_id || amount == null) return res.status(400).json({ message: 'booking_id and amount required.' });
    const bk = await pool.query('SELECT id, created_by FROM bookings WHERE id = $1', [booking_id]);
    if (bk.rows.length === 0) return res.status(404).json({ message: 'Booking not found.' });
    if (!assertStaffOwnsRecord(req, bk.rows[0].created_by)) {
      return res.status(403).json({ message: 'Access denied.' });
    }
    const creatorId = req.user?.id != null ? Number(req.user.id) : null;
    const result = await pool.query(
      'INSERT INTO payments (booking_id, amount, mode, reference, created_by) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [booking_id, Number(amount), mode || 'cash', reference || null, creatorId]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
};

export const remove = async (req, res) => {
  try {
    const { id } = req.params;
    const row = await pool.query(
      `SELECT p.id, p.booking_id, b.created_by AS booking_created_by
       FROM payments p JOIN bookings b ON b.id = p.booking_id WHERE p.id = $1`,
      [id]
    );
    if (row.rows.length === 0) return res.status(404).json({ message: 'Not found.' });
    if (!assertStaffOwnsRecord(req, row.rows[0].booking_created_by)) {
      return res.status(404).json({ message: 'Not found.' });
    }
    const result = await pool.query('DELETE FROM payments WHERE id = $1 RETURNING id', [id]);
    if (result.rowCount === 0) return res.status(404).json({ message: 'Not found.' });
    res.json({ message: 'Deleted.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
};
