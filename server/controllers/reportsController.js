import pool from '../config/db.js';

export const dashboard = async (req, res) => {
  try {
    const [customers, bookings, revenue, payments] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM customers').then((r) => parseInt(r.rows[0].count, 10)),
      pool.query("SELECT COUNT(*) FROM bookings WHERE status NOT IN ('cancelled')").then((r) => parseInt(r.rows[0].count, 10)),
      pool.query('SELECT COALESCE(SUM(total_amount), 0) FROM bookings WHERE status IN (\'confirmed\', \'ongoing\', \'completed\')').then((r) => Number(r.rows[0].coalesce)),
      pool.query('SELECT COALESCE(SUM(amount), 0) FROM payments').then((r) => Number(r.rows[0].coalesce)),
    ]);
    const due = revenue - payments;
    const recent = await pool.query(
      `SELECT b.id, b.status, b.created_at, c.name as customer_name FROM bookings b
       LEFT JOIN customers c ON b.customer_id = c.id ORDER BY b.created_at DESC LIMIT 10`
    );
    res.json({
      totalCustomers: customers,
      activeBookings: bookings,
      monthlyRevenue: revenue,
      pendingPayments: due,
      totalCollected: payments,
      recentActivities: recent.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
};

export const revenueReport = async (req, res) => {
  try {
    const { start, end } = req.query;
    let where = "WHERE status IN ('confirmed', 'ongoing', 'completed')";
    const params = [];
    if (start) { params.push(start); where += ` AND travel_start_date >= $${params.length}`; }
    if (end) { params.push(end); where += ` AND travel_end_date <= $${params.length}`; }
    const result = await pool.query(
      `SELECT travel_start_date, COUNT(*) as count, SUM(total_amount) as total FROM bookings ${where} GROUP BY travel_start_date ORDER BY travel_start_date`,
      params
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
};

export const pendingPayments = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT b.id, b.total_amount, c.name as customer_name, c.email,
              (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE booking_id = b.id) as paid
       FROM bookings b LEFT JOIN customers c ON b.customer_id = c.id
       WHERE b.status IN ('confirmed', 'ongoing', 'completed')`
    );
    const withDue = result.rows.map((r) => ({ ...r, due: Number(r.total_amount || 0) - Number(r.paid || 0) })).filter((r) => r.due > 0);
    res.json(withDue);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
};

export const staffPerformance = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.name, u.email,
              (SELECT COUNT(*) FROM bookings WHERE assigned_staff_id = u.id AND status IN ('confirmed', 'ongoing', 'completed')) as completed_count
       FROM users u WHERE u.role IN ('manager', 'staff') ORDER BY completed_count DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
};
