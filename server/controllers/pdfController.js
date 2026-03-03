import pool from '../config/db.js';
import { generateItineraryPDF, generateInvoicePDF, generateQuotationPDF } from '../services/pdfService.js';

export const itinerary = async (req, res) => {
  try {
    const { id } = req.params;
    const pkg = await pool.query('SELECT * FROM packages WHERE id = $1', [id]);
    if (pkg.rows.length === 0) return res.status(404).json({ message: 'Package not found.' });
    const days = await pool.query('SELECT * FROM package_days WHERE package_id = $1 ORDER BY day_number', [id]);
    const buf = await generateItineraryPDF(pkg.rows[0], days.rows);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=itinerary-${id}.pdf`);
    res.send(buf);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
};

export const invoice = async (req, res) => {
  try {
    const { id } = req.params;
    const booking = await pool.query('SELECT * FROM bookings WHERE id = $1', [id]);
    if (booking.rows.length === 0) return res.status(404).json({ message: 'Booking not found.' });
    const customer = await pool.query('SELECT * FROM customers WHERE id = $1', [booking.rows[0].customer_id]);
    const payments = await pool.query('SELECT * FROM payments WHERE booking_id = $1', [id]);
    const total = Number(booking.rows[0].total_amount || 0);
    const buf = await generateInvoicePDF(booking.rows[0], customer.rows[0], payments.rows, total);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=invoice-${id}.pdf`);
    res.send(buf);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
};

export const quotationPdf = async (req, res) => {
  try {
    const { id } = req.params;
    const q = await pool.query('SELECT * FROM quotations WHERE id = $1', [id]);
    if (q.rows.length === 0) return res.status(404).json({ message: 'Quotation not found.' });
    const customer = await pool.query('SELECT * FROM customers WHERE id = $1', [q.rows[0].customer_id]);
    const items = await pool.query('SELECT * FROM quotation_items WHERE quotation_id = $1', [id]);
    const pkg = q.rows[0].package_id ? await pool.query('SELECT name FROM packages WHERE id = $1', [q.rows[0].package_id]) : { rows: [] };
    const customerRow = customer.rows[0] || {};
    const buf = await generateQuotationPDF(q.rows[0], customerRow, items.rows, pkg.rows[0]?.name);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=quotation-${id}.pdf`);
    res.send(buf);
  } catch (err) {
    console.error('Quotation PDF error:', err?.message || err);
    if (err?.stack) console.error(err.stack);
    res.status(500).json({ message: 'Server error.', error: process.env.NODE_ENV !== 'production' ? (err?.message || String(err)) : undefined });
  }
};
