import pool from '../config/db.js';

export const dashboard = async (req, res) => {
  try {
    const [customers, revenue, collected, invoiceStats, quotationStats, paymentModes, monthlySales, invoiceStatusBreakdown] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM customers').then((r) => parseInt(r.rows[0].count, 10)),
      pool.query(`SELECT COALESCE(SUM(total),0) FROM invoices WHERE status NOT IN ('cancelled','draft')`).then((r) => Number(r.rows[0].coalesce)),
      pool.query('SELECT COALESCE(SUM(amount),0) FROM invoice_payments').then((r) => Number(r.rows[0].coalesce)),
      pool.query(`SELECT
        COUNT(*) FILTER (WHERE status='draft') as draft,
        COUNT(*) FILTER (WHERE status='issued') as issued,
        COUNT(*) FILTER (WHERE status='paid') as paid,
        COUNT(*) FILTER (WHERE status='overdue') as overdue,
        COUNT(*) FILTER (WHERE status='cancelled') as cancelled,
        COUNT(*) as total
       FROM invoices`).then((r) => r.rows[0]),
      pool.query(`SELECT
        COUNT(*) FILTER (WHERE status='draft') as draft,
        COUNT(*) FILTER (WHERE status='sent') as sent,
        COUNT(*) FILTER (WHERE status='approved') as approved,
        COUNT(*) as total
       FROM quotations`).then((r) => r.rows[0]),
      pool.query(`SELECT mode, COUNT(*) as count, COALESCE(SUM(amount),0) as total
       FROM invoice_payments GROUP BY mode ORDER BY total DESC`).then((r) => r.rows),
      pool.query(`SELECT
        TO_CHAR(DATE_TRUNC('month', invoice_date), 'Mon YYYY') as month,
        DATE_TRUNC('month', invoice_date) as month_date,
        COALESCE(SUM(total),0) as revenue,
        COUNT(*) as count
       FROM invoices WHERE status NOT IN ('cancelled','draft') AND invoice_date >= NOW() - INTERVAL '6 months'
       GROUP BY DATE_TRUNC('month', invoice_date)
       ORDER BY month_date ASC`).then((r) => r.rows),
      pool.query(`SELECT status, COUNT(*) as count, COALESCE(SUM(total),0) as total
       FROM invoices GROUP BY status ORDER BY total DESC`).then((r) => r.rows),
    ]);

    const due = revenue - collected;

    res.json({
      totalCustomers: customers,
      monthlyRevenue: revenue,
      totalCollected: collected,
      pendingPayments: Math.max(0, due),
      invoiceStats,
      quotationStats,
      paymentModes,
      monthlySales,
      invoiceStatusBreakdown,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
};

export const revenueReport = async (req, res) => {
  try {
    const { start, end } = req.query;
    let where = "WHERE status NOT IN ('cancelled','draft')";
    const params = [];
    if (start) { params.push(start); where += ` AND invoice_date >= $${params.length}`; }
    if (end) { params.push(end); where += ` AND invoice_date <= $${params.length}`; }
    const result = await pool.query(
      `SELECT i.invoice_number, i.invoice_date, i.total, i.status,
              c.name as customer_name
       FROM invoices i LEFT JOIN customers c ON i.customer_id = c.id
       ${where} ORDER BY i.invoice_date DESC`,
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
      `SELECT i.id, i.invoice_number, i.total, i.due_date, i.status,
              c.name as customer_name, c.mobile,
              COALESCE((SELECT SUM(amount) FROM invoice_payments WHERE invoice_id = i.id),0) as paid
       FROM invoices i LEFT JOIN customers c ON i.customer_id = c.id
       WHERE i.status NOT IN ('paid','cancelled')`
    );
    const withDue = result.rows
      .map((r) => ({ ...r, due: Number(r.total || 0) - Number(r.paid || 0) }))
      .filter((r) => r.due > 0)
      .sort((a, b) => b.due - a.due);
    res.json(withDue);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
};

export const staffPerformance = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.name, u.email, u.branch,
              COUNT(b.id) FILTER (WHERE b.status IN ('confirmed','ongoing','completed')) as completed_count,
              COUNT(b.id) FILTER (WHERE b.status = 'cancelled') as cancelled_count
       FROM users u
       LEFT JOIN bookings b ON b.assigned_staff_id = u.id
       WHERE u.role IN ('manager','staff')
       GROUP BY u.id ORDER BY completed_count DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
};
