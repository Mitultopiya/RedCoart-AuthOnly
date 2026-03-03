import pool from '../config/db.js';

export const listByBooking = async (req, res) => {
  try {
    const { bookingId } = req.params;
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
    const result = await pool.query(
      'INSERT INTO payments (booking_id, amount, mode, reference) VALUES ($1, $2, $3, $4) RETURNING *',
      [booking_id, Number(amount), mode || 'cash', reference || null]
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
    const result = await pool.query('DELETE FROM payments WHERE id = $1 RETURNING id', [id]);
    if (result.rowCount === 0) return res.status(404).json({ message: 'Not found.' });
    res.json({ message: 'Deleted.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
};
