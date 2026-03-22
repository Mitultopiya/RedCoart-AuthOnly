import pool from '../config/db.js';
import { isFullDataAccess, staffRequiresCreatorScope } from '../utils/dataScope.js';

let reportInvoiceColumnsCache = null;
async function getReportInvoiceColumns() {
  if (reportInvoiceColumnsCache) return reportInvoiceColumnsCache;
  const result = await pool.query(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'invoices'`
  );
  reportInvoiceColumnsCache = new Set((result.rows || []).map((r) => String(r.COLUMN_NAME || r.column_name || '').toLowerCase()));
  return reportInvoiceColumnsCache;
}

let reportBookingsColumnsCache = null;
async function getReportBookingsColumns() {
  if (reportBookingsColumnsCache) return reportBookingsColumnsCache;
  const result = await pool.query(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bookings'`
  );
  reportBookingsColumnsCache = new Set((result.rows || []).map((r) => String(r.COLUMN_NAME || r.column_name || '').toLowerCase()));
  return reportBookingsColumnsCache;
}

function resolveBranchId(req) {
  // If UI explicitly requests all branches, DO NOT apply token branch scope.
  if (req.query.branch_id != null && String(req.query.branch_id) === 'all') return null;
  if (req.query.branch_id != null && String(req.query.branch_id) !== '') {
    const parsed = parseInt(req.query.branch_id, 10);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return req.branchId ?? null;
}

export const dashboard = async (req, res) => {
  try {
    const invoiceColumns = await getReportInvoiceColumns();
    const itineraryFromHotelsExpr = `(SELECT GROUP_CONCAT(
      DISTINCT TRIM(SUBSTRING_INDEX(SUBSTRING_INDEX(ii.description, ' -', 1), 'Hotel: ', -1))
      ORDER BY ii.id SEPARATOR ' / '
    )
    FROM invoice_items ii
    WHERE ii.invoice_id = i.id AND ii.description LIKE 'Hotel:%')`;
    const packageCandidates = [];
    if (invoiceColumns.has('package_name')) packageCandidates.push("NULLIF(i.package_name, '')");
    if (invoiceColumns.has('travel_destination')) packageCandidates.push("NULLIF(i.travel_destination, '')");
    packageCandidates.push('p.name', 'p.title', itineraryFromHotelsExpr, "(SELECT ii.description FROM invoice_items ii WHERE ii.invoice_id = i.id ORDER BY ii.id LIMIT 1)", "'Custom Invoice'");
    const packageExpr = `COALESCE(${packageCandidates.join(', ')})`;
    const branchId = resolveBranchId(req);
    const staffUid = !isFullDataAccess(req) && staffRequiresCreatorScope(req) ? Number(req.user.id) : null;

    let customerCountSql;
    let customerCountParams;
    if (staffUid != null) {
      customerCountParams = [staffUid, branchId ?? null];
      customerCountSql = `SELECT COUNT(DISTINCT id) AS count FROM (
      SELECT i.customer_id AS id FROM invoices i
      WHERE i.created_by = $1 AND i.customer_id IS NOT NULL
        AND ($2 IS NULL OR i.branch_id = $2)
      UNION
      SELECT c.id FROM customers c
      WHERE c.created_by = $1 AND ($2 IS NULL OR c.branch_id = $2)
    ) t`;
    } else {
      const pCust = [];
      let wCust = '';
      if (branchId && Number.isFinite(branchId)) {
        pCust.push(branchId);
        wCust = 'WHERE branch_id = $1';
      }
      customerCountSql = `SELECT COUNT(*) AS count FROM customers ${wCust ? wCust : ''}`;
      customerCountParams = pCust;
    }

    const pInvBase = [];
    let invWhereNoAlias = '';
    if (branchId && Number.isFinite(branchId)) {
      pInvBase.push(branchId);
      invWhereNoAlias = 'WHERE branch_id = $1';
    }
    if (staffUid != null) {
      pInvBase.push(staffUid);
      invWhereNoAlias += invWhereNoAlias ? ` AND created_by = $${pInvBase.length}` : `WHERE created_by = $1`;
    }

    const pInvAlias = [];
    let invAliasAnd = '';
    if (branchId && Number.isFinite(branchId)) {
      pInvAlias.push(branchId);
      invAliasAnd = ' AND i.branch_id = $1';
    }
    if (staffUid != null) {
      pInvAlias.push(staffUid);
      invAliasAnd += ` AND i.created_by = $${pInvAlias.length}`;
    }

    const pBook = [];
    let wBook = '';
    if (branchId && Number.isFinite(branchId)) {
      pBook.push(branchId);
      wBook = 'WHERE branch_id = $1';
    }
    if (staffUid != null) {
      pBook.push(staffUid);
      wBook += wBook ? ` AND created_by = $${pBook.length}` : `WHERE created_by = $1`;
    }

    const pUp = [];
    let wUp = ` WHERE status NOT IN ('cancelled') AND (travel_start_date IS NULL OR travel_start_date >= CURRENT_DATE)`;
    if (branchId && Number.isFinite(branchId)) {
      pUp.push(branchId);
      wUp += ` AND branch_id = $${pUp.length}`;
    }
    if (staffUid != null) {
      pUp.push(staffUid);
      wUp += ` AND created_by = $${pUp.length}`;
    }

    const pRev = [];
    let wRev = ` WHERE status NOT IN ('cancelled','draft')`;
    if (branchId && Number.isFinite(branchId)) {
      pRev.push(branchId);
      wRev += ` AND branch_id = $${pRev.length}`;
    }
    if (staffUid != null) {
      pRev.push(staffUid);
      wRev += ` AND created_by = $${pRev.length}`;
    }

    const pColl = [];
    let wColl = '';
    if (branchId && Number.isFinite(branchId)) {
      pColl.push(branchId);
      wColl = ' WHERE i.branch_id = $1';
    }
    if (staffUid != null) {
      pColl.push(staffUid);
      wColl += wColl ? ` AND i.created_by = $${pColl.length}` : ` WHERE i.created_by = $1`;
    }

    const pQuot = [];
    let qWhere = '';
    if (branchId && Number.isFinite(branchId)) {
      pQuot.push(branchId);
      qWhere = 'WHERE branch_id = $1';
    }

    const [
      totalBranches,
      customers,
      revenue,
      collected,
      totalBookings,
      upcomingTrips,
      invoiceStats,
      quotationStats,
      paymentModes,
      monthlySales,
      invoiceStatusBreakdown,
      paymentReminders,
      recentPaymentActivity,
      branchRevenue,
      branchMetrics,
    ] = await Promise.all([
      pool.query('SELECT COUNT(*) AS count FROM branches').then((r) => parseInt(r.rows[0].count, 10)),
      pool.query(customerCountSql, customerCountParams).then((r) => parseInt(r.rows[0].count, 10)),
      pool.query(`SELECT COALESCE(SUM(total),0) AS total FROM invoices${wRev}`, pRev).then((r) => Number(r.rows[0].total)),
      pool.query(
        `SELECT COALESCE(SUM(ip.amount),0) AS total FROM invoice_payments ip JOIN invoices i ON ip.invoice_id = i.id${wColl || ''}`,
        pColl
      ).then((r) => Number(r.rows[0].total)),
      pool.query(`SELECT COUNT(*) AS count FROM bookings ${wBook ? wBook : ''}`, pBook).then((r) => parseInt(r.rows[0].count, 10)),
      pool.query(`SELECT COUNT(*) AS count FROM bookings${wUp}`, pUp).then((r) => parseInt(r.rows[0].count, 10)),
      pool.query(
        `SELECT
        SUM(CASE WHEN status='draft' THEN 1 ELSE 0 END) as draft,
        SUM(CASE WHEN status='issued' THEN 1 ELSE 0 END) as issued,
        SUM(CASE WHEN status='paid' THEN 1 ELSE 0 END) as paid,
        SUM(CASE WHEN status='overdue' THEN 1 ELSE 0 END) as overdue,
        SUM(CASE WHEN status='cancelled' THEN 1 ELSE 0 END) as cancelled,
        COUNT(*) as total
       FROM invoices ${invWhereNoAlias ? invWhereNoAlias : ''}`,
        pInvBase
      ).then((r) => r.rows[0]),
      staffUid != null
        ? Promise.resolve({ draft: 0, sent: 0, approved: 0, total: 0 })
        : pool
            .query(
              `SELECT
        SUM(CASE WHEN status='draft' THEN 1 ELSE 0 END) as draft,
        SUM(CASE WHEN status='sent' THEN 1 ELSE 0 END) as sent,
        SUM(CASE WHEN status='approved' THEN 1 ELSE 0 END) as approved,
        COUNT(*) as total
       FROM quotations ${qWhere}`,
              pQuot
            )
            .then((r) => r.rows[0]),
      pool
        .query(
          `SELECT ip.mode, COUNT(*) as count, COALESCE(SUM(ip.amount),0) as total
       FROM invoice_payments ip JOIN invoices i ON ip.invoice_id = i.id${wColl ? wColl : ''} GROUP BY ip.mode ORDER BY total DESC`,
          pColl
        )
        .then((r) => r.rows),
      pool
        .query(
          `SELECT
        DATE_FORMAT(x.month_date, '%b %Y') AS month,
        x.month_date,
        x.revenue,
        x.count
       FROM (
         SELECT
           STR_TO_DATE(DATE_FORMAT(i.invoice_date, '%Y-%m-01'), '%Y-%m-%d') AS month_date,
           COALESCE(SUM(i.total),0) AS revenue,
           COUNT(*) AS count
         FROM invoices i
         WHERE i.status NOT IN ('cancelled','draft')
           AND i.invoice_date >= DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 12 MONTH)${invAliasAnd}
         GROUP BY STR_TO_DATE(DATE_FORMAT(i.invoice_date, '%Y-%m-01'), '%Y-%m-%d')
       ) x
       ORDER BY x.month_date ASC`,
          pInvAlias
        )
        .then((r) => r.rows),
      pool
        .query(
          `SELECT status, COUNT(*) as count, COALESCE(SUM(total),0) as total
       FROM invoices ${invWhereNoAlias ? invWhereNoAlias : ''} GROUP BY status ORDER BY total DESC`,
          pInvBase
        )
        .then((r) => r.rows),
      pool
        .query(
          `SELECT i.id, i.invoice_number, i.total, i.due_date, i.status,
                c.name as customer_name, c.mobile as customer_mobile,
                ${packageExpr} as package_name,
                COALESCE((SELECT SUM(amount) FROM invoice_payments WHERE invoice_id = i.id),0) as paid
         FROM invoices i
         LEFT JOIN customers c ON i.customer_id = c.id
         LEFT JOIN bookings bk ON i.booking_id = bk.id
         LEFT JOIN packages p ON bk.package_id = p.id
         WHERE i.status NOT IN ('paid','cancelled')${invAliasAnd}`,
          pInvAlias
        )
        .then((r) => {
        return r.rows
          .map((row) => ({
            ...row,
            remaining: Math.max(0, Number(row.total || 0) - Number(row.paid || 0)),
          }))
          .filter((row) => row.remaining > 0)
          .map((row) => {
            const due = new Date(row.due_date);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            due.setHours(0, 0, 0, 0);
            const diffDays = Math.ceil((due - today) / (1000 * 60 * 60 * 24));
            let status = 'Due Soon';
            if (row.status === 'overdue' || diffDays < 0) status = 'Overdue';
            else if (Number(row.paid || 0) >= Number(row.total || 0)) status = 'Paid';
            return { ...row, status };
          })
          .sort((a, b) => new Date(a.due_date) - new Date(b.due_date));
      }),
      pool
        .query(
          `SELECT ip.id, ip.invoice_id, ip.amount as paid_amount, ip.paid_at,
                i.total as invoice_total,
                ${packageExpr} as package_name,
                c.name as customer_name
         FROM invoice_payments ip
         JOIN invoices i ON ip.invoice_id = i.id
         LEFT JOIN bookings bk ON i.booking_id = bk.id
         LEFT JOIN packages p ON bk.package_id = p.id
         LEFT JOIN customers c ON i.customer_id = c.id${wColl || ''}
         ORDER BY ip.paid_at DESC LIMIT 15`,
          pColl
        )
        .then((r) => {
        const byInvoice = {};
        r.rows.forEach((row) => {
          if (!byInvoice[row.invoice_id]) byInvoice[row.invoice_id] = { paidSum: 0, rows: [] };
          byInvoice[row.invoice_id].paidSum += Number(row.paid_amount || 0);
          byInvoice[row.invoice_id].rows.push(row);
        });
        return r.rows.map((row) => {
          const inv = byInvoice[row.invoice_id];
          const totalPaid = inv.paidSum;
          const remaining = Math.max(0, Number(row.invoice_total || 0) - totalPaid);
          return {
            customer_name: row.customer_name,
            package_name: row.package_name,
            paid_amount: Number(row.paid_amount),
            remaining,
            paid_at: row.paid_at,
          };
        });
      }),
      staffUid != null
        ? Promise.resolve([])
        : pool
            .query(
              `SELECT
           b.id AS branch_id,
           b.name AS branch_name,
           COALESCE((
             SELECT SUM(i2.total)
             FROM invoices i2
             LEFT JOIN bookings bk2 ON bk2.id = i2.booking_id
             LEFT JOIN customers c2 ON c2.id = i2.customer_id
             WHERE i2.status NOT IN ('cancelled','draft')
               AND COALESCE(i2.branch_id, bk2.branch_id, c2.branch_id) = b.id
           ), 0) AS revenue
         FROM branches b
         ORDER BY revenue DESC`
            )
            .then((r) => r.rows.map((row) => ({ branch_id: row.branch_id, branch_name: row.branch_name, revenue: Number(row.revenue) }))),
      staffUid != null
        ? Promise.resolve([])
        : pool
            .query(
              `SELECT
           b.id   AS branch_id,
           b.name AS branch_name,
           (SELECT COUNT(*) FROM customers c WHERE c.branch_id = b.id) AS customers,
           (SELECT COUNT(*) FROM bookings bk WHERE bk.branch_id = b.id) AS bookings,
           (SELECT COUNT(*)
              FROM invoices i
              LEFT JOIN bookings bk ON bk.id = i.booking_id
              LEFT JOIN customers c ON c.id = i.customer_id
             WHERE i.status NOT IN ('cancelled','draft')
               AND COALESCE(i.branch_id, bk.branch_id, c.branch_id) = b.id) AS invoices,
           COALESCE((
             SELECT SUM(i.total)
             FROM invoices i
             LEFT JOIN bookings bk ON bk.id = i.booking_id
             LEFT JOIN customers c ON c.id = i.customer_id
             WHERE i.status NOT IN ('cancelled','draft')
               AND COALESCE(i.branch_id, bk.branch_id, c.branch_id) = b.id
           ), 0) AS revenue,
           COALESCE((
             SELECT SUM(ip.amount)
             FROM invoice_payments ip
             JOIN invoices i ON i.id = ip.invoice_id
             LEFT JOIN bookings bk ON bk.id = i.booking_id
             LEFT JOIN customers c ON c.id = i.customer_id
             WHERE COALESCE(i.branch_id, bk.branch_id, c.branch_id) = b.id
           ), 0) AS collected,
           COALESCE((
             SELECT SUM(i.total)
             FROM invoices i
             LEFT JOIN bookings bk ON bk.id = i.booking_id
             LEFT JOIN customers c ON c.id = i.customer_id
             WHERE i.status NOT IN ('cancelled','draft')
               AND COALESCE(i.branch_id, bk.branch_id, c.branch_id) = b.id
           ), 0) - COALESCE((
             SELECT SUM(ip.amount)
             FROM invoice_payments ip
             JOIN invoices i ON i.id = ip.invoice_id
             LEFT JOIN bookings bk ON bk.id = i.booking_id
             LEFT JOIN customers c ON c.id = i.customer_id
             WHERE COALESCE(i.branch_id, bk.branch_id, c.branch_id) = b.id
           ), 0) AS pending
         FROM branches b
         ORDER BY revenue DESC`
            )
            .then((r) =>
              r.rows.map((row) => ({
                branch_id: row.branch_id,
                branch_name: row.branch_name,
                customers: Number(row.customers || 0),
                bookings: Number(row.bookings || 0),
                invoices: Number(row.invoices || 0),
                revenue: Number(row.revenue || 0),
                collected: Number(row.collected || 0),
                pending: Number(row.pending || 0),
              }))
            ),
    ]);

    const due = revenue - collected;
    const pendingCount = paymentReminders.length;

    const paidInvoicesCount = Number(invoiceStats?.paid ?? 0) || 0;

    res.json({
      totalBranches,
      totalCustomers: customers,
      totalBookings,
      upcomingTrips,
      monthlyRevenue: revenue,
      totalCollected: collected,
      completedPayments: collected,
      pendingPayments: Math.max(0, due),
      pendingPaymentsCount: pendingCount,
      paidInvoicesCount,
      invoiceStats,
      quotationStats,
      paymentModes,
      monthlySales,
      invoiceStatusBreakdown,
      paymentReminders,
      recentPaymentActivity,
      branchRevenue,
      branchMetrics,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
};

export const revenueReport = async (req, res) => {
  try {
    const { start, end, branch_id } = req.query;

    // Normalize branch
    let branchId = null;
    if (branch_id && String(branch_id) !== 'all') {
      const parsed = parseInt(branch_id, 10);
      if (Number.isFinite(parsed) && parsed > 0) branchId = parsed;
    } else if (req.branchId && Number.isFinite(req.branchId)) {
      branchId = req.branchId;
    }

    // Only accept ISO date (YYYY-MM-DD); ignore anything else
    const isValidDateStr = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
    const startDate = isValidDateStr(start) ? start : null;
    const endDate = isValidDateStr(end) ? end : null;

    let where = "WHERE i.status NOT IN ('cancelled','draft')";
    const params = [];

    if (branchId) {
      params.push(branchId);
      where += ` AND i.branch_id = $${params.length}`;
    }
    if (startDate) {
      params.push(startDate);
      where += ` AND i.invoice_date >= $${params.length}`;
    }
    if (endDate) {
      params.push(endDate);
      where += ` AND i.invoice_date <= $${params.length}`;
    }

    const result = await pool.query(
      `SELECT i.invoice_number,
              i.invoice_date,
              i.total,
              i.status,
              c.name as customer_name
       FROM invoices i
       LEFT JOIN customers c ON i.customer_id = c.id
       ${where}
       ORDER BY i.invoice_date DESC`,
      params
    );

    res.json(result.rows || []);
  } catch (err) {
    console.error('Error in revenueReport:', err);
    res.status(500).json({ message: 'Failed to load revenue report.' });
  }
};

export const pendingPayments = async (req, res) => {
  try {
    const branchId = resolveBranchId(req);
    const params = [];
    const branchAnd = branchId && Number.isFinite(branchId) ? ` AND i.branch_id = $1` : '';
    if (branchAnd) params.push(branchId);
    const result = await pool.query(
      `SELECT i.id, i.invoice_number, i.total, i.due_date, i.status,
              c.name as customer_name, c.mobile,
              COALESCE((SELECT SUM(amount) FROM invoice_payments WHERE invoice_id = i.id),0) as paid
       FROM invoices i LEFT JOIN customers c ON i.customer_id = c.id
       WHERE i.status NOT IN ('paid','cancelled')${branchAnd}`,
      params
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
    const branchId = resolveBranchId(req);
    const params = [];
    const bookingCols = await getReportBookingsColumns();
    const invCols = await getReportInvoiceColumns();
    const hasBkCreatedBy = bookingCols.has('created_by');
    const invLinksBooking = invCols.has('booking_id') && invCols.has('created_by');

    let where = `WHERE LOWER(u.role) IN ('manager', 'staff')`;
    if (branchId && Number.isFinite(branchId)) {
      params.push(branchId);
      where += ` AND u.branch_id = $${params.length}`;
    }

    // Attribute a booking to staff if: assigned, or creator (when column exists), or they issued an invoice for that booking.
    const parts = ['bk.assigned_staff_id = u.id'];
    if (hasBkCreatedBy) parts.push('bk.created_by = u.id');
    if (invLinksBooking) {
      parts.push(
        'EXISTS (SELECT 1 FROM invoices inv WHERE inv.booking_id = bk.id AND inv.created_by = u.id)'
      );
    }
    const staffMatchesBooking = `(${parts.join(' OR ')})`;

    const phNc = params.length + 1;
    const phCx = params.length + 2;
    params.push('cancelled', 'cancelled');
    const nonCancelled = `(bk.status IS NULL OR bk.status <> $${phNc})`;
    const cancelled = `bk.status = $${phCx}`;

    const sql = `SELECT u.id, u.name, u.email, u.branch_id,
        COALESCE(br.name, NULLIF(u.branch, ''), '-') AS branch_name,
        (SELECT COUNT(*) FROM bookings bk WHERE ${staffMatchesBooking} AND ${nonCancelled}) AS completed_count,
        (SELECT COUNT(*) FROM bookings bk WHERE ${staffMatchesBooking} AND ${cancelled}) AS cancelled_count
      FROM users u
      LEFT JOIN branches br ON u.branch_id = br.id
      ${where}
      ORDER BY completed_count DESC, u.name ASC`;

    const result = await pool.query(sql, params);
    const rows = (result.rows || []).map((row) => ({
      ...row,
      completed_count: Number(row.completed_count ?? 0),
      cancelled_count: Number(row.cancelled_count ?? 0),
    }));
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
};
