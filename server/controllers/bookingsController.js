import pool from '../config/db.js';
import { assertStaffOwnsRecord, staffCanAccessCustomer, staffRequiresCreatorScope } from '../utils/dataScope.js';

export const list = async (req, res) => {
  try {
    const { status, staff_id, page = 1, limit = 20 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    const conditions = [];
    const params = [];
    let idx = 1;
    if (status) { params.push(status); conditions.push(`b.status = $${idx++}`); }
    if (staff_id) { params.push(staff_id); conditions.push(`b.assigned_staff_id = $${idx++}`); }
    if (staffRequiresCreatorScope(req)) { params.push(req.user.id); conditions.push(`b.created_by = $${idx++}`); }
    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    params.push(Number(limit), offset);
    const result = await pool.query(
      `SELECT b.*, c.name as customer_name, c.email as customer_email, c.mobile as customer_mobile,
              p.name as package_name, p.price as package_price, t.transport_type, t.from_location, t.to_location,
              t.price as transport_price
       FROM bookings b
       LEFT JOIN customers c ON b.customer_id = c.id
       LEFT JOIN packages p ON b.package_id = p.id
       LEFT JOIN transports t ON b.assigned_transport_id = t.id
       ${where}
       ORDER BY b.created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`,
      params
    );
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM bookings b ${where}`,
      params.slice(0, -2)
    );
    res.json({ data: result.rows, total: parseInt(countResult.rows[0]?.count || 0, 10) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
};

export const getOne = async (req, res) => {
  try {
    const { id } = req.params;
    const booking = await pool.query(
      `SELECT b.*, c.name as customer_name, c.email as customer_email, c.mobile as customer_mobile, c.address as customer_address,
              p.name as package_name, p.description as package_description, p.price as package_price, p.duration_days,
              t.transport_type, t.from_location, t.to_location, t.price as transport_price
       FROM bookings b
       LEFT JOIN customers c ON b.customer_id = c.id
       LEFT JOIN packages p ON b.package_id = p.id
       LEFT JOIN transports t ON b.assigned_transport_id = t.id
       WHERE b.id = $1`,
      [id]
    );
    if (booking.rows.length === 0) return res.status(404).json({ message: 'Booking not found.' });
    if (!assertStaffOwnsRecord(req, booking.rows[0].created_by)) {
      return res.status(404).json({ message: 'Booking not found.' });
    }
    const notes = await pool.query('SELECT bn.*, u.name as user_name FROM booking_notes bn LEFT JOIN users u ON bn.user_id = u.id WHERE bn.booking_id = $1 ORDER BY bn.created_at', [id]);
    const payments = await pool.query('SELECT * FROM payments WHERE booking_id = $1 ORDER BY paid_at', [id]);
    res.json({ ...booking.rows[0], notes: notes.rows, payments: payments.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
};

export const create = async (req, res) => {
  try {
    const {
      customer_id,
      package_id,
      travel_start_date,
      travel_end_date,
      total_amount,
      status,
      assigned_hotel_id,
      assigned_vehicle_id,
      assigned_transport_id,
      assigned_staff_id,
      assigned_guide_id,
      internal_notes,
    } = req.body;
    if (!customer_id || !package_id) return res.status(400).json({ message: 'customer_id and package_id required.' });
    if (staffRequiresCreatorScope(req)) {
      if (!(await staffCanAccessCustomer(pool, req, customer_id))) {
        return res.status(403).json({ message: 'Access denied.' });
      }
    }
    const creatorId = req.user?.id != null ? Number(req.user.id) : null;
    const result = await pool.query(
      `INSERT INTO bookings (customer_id, package_id, travel_start_date, travel_end_date, total_amount, status,
        assigned_hotel_id, assigned_vehicle_id, assigned_transport_id, assigned_staff_id, assigned_guide_id, internal_notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
      [
        customer_id,
        package_id,
        travel_start_date || null,
        travel_end_date || null,
        total_amount ?? 0,
        status || 'inquiry',
        assigned_hotel_id ?? null,
        assigned_vehicle_id ?? null,
        assigned_transport_id ?? null,
        assigned_staff_id ?? null,
        assigned_guide_id ?? null,
        internal_notes ?? null,
        creatorId,
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
};

export const update = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await pool.query('SELECT id, created_by FROM bookings WHERE id = $1', [id]);
    if (existing.rows.length === 0) return res.status(404).json({ message: 'Booking not found.' });
    if (!assertStaffOwnsRecord(req, existing.rows[0].created_by)) {
      return res.status(404).json({ message: 'Booking not found.' });
    }
    const { travel_start_date, travel_end_date, assigned_hotel_id, assigned_vehicle_id, assigned_transport_id, assigned_staff_id, assigned_guide_id, status, total_amount, internal_notes } = req.body;
    const result = await pool.query(
      `UPDATE bookings SET
        travel_start_date = COALESCE($1, travel_start_date), travel_end_date = COALESCE($2, travel_end_date),
        assigned_hotel_id = $3, assigned_vehicle_id = $4, assigned_transport_id = $5, assigned_staff_id = $6, assigned_guide_id = $7,
        status = COALESCE($8, status), total_amount = COALESCE($9, total_amount), internal_notes = $10, updated_at = NOW()
       WHERE id = $11 RETURNING *`,
      [travel_start_date, travel_end_date, assigned_hotel_id ?? null, assigned_vehicle_id ?? null, assigned_transport_id ?? null, assigned_staff_id ?? null, assigned_guide_id ?? null, status, total_amount != null ? Number(total_amount) : null, internal_notes ?? null, id]
    );
    if (result.rowCount === 0) return res.status(404).json({ message: 'Booking not found.' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
};

export const addNote = async (req, res) => {
  try {
    const { id } = req.params;
    const bk = await pool.query('SELECT created_by FROM bookings WHERE id = $1', [id]);
    if (bk.rows.length === 0) return res.status(404).json({ message: 'Booking not found.' });
    if (!assertStaffOwnsRecord(req, bk.rows[0].created_by)) {
      return res.status(404).json({ message: 'Booking not found.' });
    }
    const { note } = req.body;
    if (!note) return res.status(400).json({ message: 'Note text required.' });
    const result = await pool.query(
      'INSERT INTO booking_notes (booking_id, user_id, note) VALUES ($1, $2, $3) RETURNING *',
      [id, req.user.id, note]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
};
