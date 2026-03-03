import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Generate itinerary PDF for a package
 */
export async function generateItineraryPDF(packageData, days) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  let y = 750;
  const lineHeight = 18;
  const margin = 50;

  const drawText = (text, size = 12, bold = false) => {
    const f = bold ? fontBold : font;
    doc.getPages()[0].drawText(text, { x: margin, y, size, font: f, color: rgb(0, 0, 0) });
    y -= lineHeight;
  };

  doc.getPages()[0].drawText('Travel Itinerary', { x: margin, y, size: 22, font: fontBold, color: rgb(0.1, 0.2, 0.5) });
  y -= 28;
  drawText(`Package: ${packageData.name || packageData.title}`, 14, true);
  drawText(`Duration: ${packageData.duration_days || packageData.days || 0} days`);
  drawText(`Price: ₹${Number(packageData.price || 0).toLocaleString()}`);
  y -= 10;

  if (days && days.length) {
    drawText('Day-wise Itinerary', 14, true);
    y -= 8;
    for (const d of days.sort((a, b) => a.day_number - b.day_number)) {
      drawText(`Day ${d.day_number}`, 12, true);
      if (d.activities) drawText(`  Activities: ${d.activities}`);
      if (d.hotel_id) drawText(`  Hotel: ${d.hotel_id}`);
      if (d.meals) drawText(`  Meals: ${d.meals}`);
      if (d.transport) drawText(`  Transport: ${d.transport}`);
      if (d.notes) drawText(`  Notes: ${d.notes}`);
      y -= 4;
    }
  }

  const pdfBytes = await doc.save();
  return Buffer.from(pdfBytes);
}

/**
 * Generate invoice PDF for a booking
 */
export async function generateInvoicePDF(booking, customer, payments = [], totalAmount = 0) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  let y = 750;
  const lineHeight = 18;
  const margin = 50;

  const drawText = (text, size = 12, bold = false) => {
    const f = bold ? fontBold : font;
    doc.getPages()[0].drawText(text, { x: margin, y, size, font: f, color: rgb(0, 0, 0) });
    y -= lineHeight;
  };

  doc.getPages()[0].drawText('INVOICE', { x: margin, y, size: 22, font: fontBold, color: rgb(0.1, 0.2, 0.5) });
  y -= 28;
  drawText(`Booking #${booking.id}`, 14, true);
  drawText(`Customer: ${customer?.name || 'N/A'} | ${customer?.email || ''} | ${customer?.mobile || ''}`);
  drawText(`Travel: ${booking.travel_start_date || 'TBD'} to ${booking.travel_end_date || 'TBD'}`);
  drawText(`Status: ${booking.status}`);
  y -= 10;
  drawText(`Total Amount: ₹${Number(totalAmount || booking.total_amount || 0).toLocaleString()}`, 14, true);
  drawText('Payments:', 12, true);
  const paid = payments.reduce((s, p) => s + Number(p.amount || 0), 0);
  payments.forEach((p) => drawText(`  ${p.mode}: ₹${Number(p.amount).toLocaleString()} (${p.paid_at ? new Date(p.paid_at).toLocaleDateString() : '-'})`));
  drawText(`Paid: ₹${paid.toLocaleString()} | Due: ₹${(Number(totalAmount || 0) - paid).toLocaleString()}`);

  const pdfBytes = await doc.save();
  return Buffer.from(pdfBytes);
}

const COMPANY_PDF = {
  name: 'Vision Travel Hub',
  address: '1234 Street, City, State, Zip Code',
  phone: '123-123-1234',
  email: 'yourcompany@email.com',
  gst: 'GST Number',
};
const TERMS_PDF = 'Terms and Conditions: By accepting this quotation, you agree to the following terms: Payment is due upon receipt unless otherwise stated. Prices are valid for the validity period stated. Any changes to the scope of work may affect the quoted price and timeline. Our liability is limited to the total amount paid.';

// Use ASCII "Rs." in PDF (StandardFonts do not support Unicode rupee symbol). Avoid locale to prevent 500 in some envs.
function pdfAmount(n) {
  const num = Number(n);
  if (Number.isNaN(num)) return 'Rs.0';
  const fixed = num.toFixed(2);
  const [intPart, decPart] = fixed.split('.');
  const withCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `Rs.${withCommas}${decPart ? '.' + decPart : ''}`;
}

// Strip to ASCII so pdf-lib StandardFonts don't throw (WinAnsi encoding only)
function asciiOnly(s) {
  if (s == null || typeof s !== 'string') return '-';
  return s.replace(/[^\x20-\x7E]/g, ' ').trim().substring(0, 80) || '-';
}

// pdf-lib drawText requires string only (no Date/number). Coerce anything to string.
function toPdfText(v) {
  if (v == null || v === '') return '-';
  if (typeof v === 'string') return v;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v);
}

/**
 * Generate quotation PDF – same structure as View Quotation (header, quote meta, customer, table, terms + summary, acceptance)
 */
export async function generateQuotationPDF(quotation, customer, items = [], packageName = '') {
  quotation = quotation || {};
  customer = customer || {};
  items = Array.isArray(items) ? items : [];

  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const margin = 50;
  const pageWidth = 595;
  const pageHeight = 842;
  const contentWidth = pageWidth - 2 * margin;
  const summaryWidth = 200;
  const summaryX = pageWidth - margin - summaryWidth;
  let y = pageHeight - margin;

  const greyBg = rgb(0.96, 0.96, 0.97);
  const greyBorder = rgb(0.9, 0.9, 0.92);
  const textDark = rgb(0.2, 0.2, 0.25);
  const textMuted = rgb(0.45, 0.45, 0.5);

  // Logo (top-right, same as View) – try PNG then JPG; skip if either fails
  const logoSize = 56;
  let logoImage;
  try {
    const baseDir = path.join(__dirname, '..', '..');
    const pngPath = path.join(baseDir, 'client', 'public', 'Vision_JPG_Logo.png');
    const jpgPath = path.join(baseDir, 'client', 'public', 'Vision JPG Logo.JPG');
    if (fs.existsSync(pngPath)) {
      const buf = fs.readFileSync(pngPath);
      try { logoImage = await doc.embedPng(buf); } catch (_) { logoImage = await doc.embedJpg(buf); }
    } else if (fs.existsSync(jpgPath)) {
      logoImage = await doc.embedJpg(fs.readFileSync(jpgPath));
    }
  } catch (e) {
    logoImage = null;
  }

  // ----- 1. Header (same as View: left = QUOTATION + company, right = logo) -----
  page.drawText('QUOTATION', { x: margin, y, size: 20, font: fontBold, color: textDark });
  y -= 14;
  page.drawText(COMPANY_PDF.name, { x: margin, y, size: 11, font: fontBold, color: textDark });
  y -= 11;
  page.drawText(COMPANY_PDF.address, { x: margin, y, size: 9, font: font, color: textMuted });
  y -= 10;
  page.drawText(COMPANY_PDF.phone, { x: margin, y, size: 9, font: font, color: textMuted });
  y -= 10;
  page.drawText(COMPANY_PDF.email, { x: margin, y, size: 9, font: font, color: textMuted });

  if (logoImage) {
    page.drawImage(logoImage, {
      x: pageWidth - margin - logoSize,
      y: pageHeight - margin - logoSize,
      width: logoSize,
      height: logoSize,
    });
  }

  y -= 16;
  page.drawLine({ start: { x: margin, y }, end: { x: pageWidth - margin, y }, thickness: 0.5, color: greyBorder });
  y -= 18;

  // ----- 2. Quote No. / Prepared by / Quote Date / Due Date (same 2x2 grid as View) -----
  const quoteNo = `QTN-${new Date().getFullYear()}-${String(quotation.id).padStart(4, '0')}`;
  const quoteDateStr = toPdfText(quotation.created_at);
  const dueDateStr = quotation.valid_until != null
    ? (quotation.valid_until instanceof Date
        ? quotation.valid_until.toISOString().slice(0, 10)
        : String(quotation.valid_until).slice(0, 10))
    : '-';
  const metaY = y;
  page.drawText('Quote No.', { x: margin, y: metaY, size: 9, font: font, color: textMuted });
  page.drawText(quoteNo, { x: margin + 72, y: metaY, size: 9, font: fontBold, color: textDark });
  page.drawText('Prepared by:', { x: margin + 220, y: metaY, size: 9, font: font, color: textMuted });
  page.drawText('-', { x: margin + 295, y: metaY, size: 9, font: font, color: textDark });
  y -= 14;
  page.drawText('Quote Date:', { x: margin, y, size: 9, font: font, color: textMuted });
  page.drawText(quoteDateStr, { x: margin + 72, y, size: 9, font: font, color: textDark });
  page.drawText('Due Date:', { x: margin + 220, y, size: 9, font: font, color: textMuted });
  page.drawText(dueDateStr, { x: margin + 295, y, size: 9, font: font, color: textDark });
  y -= 22;

  // ----- 3. Customer Details (same grey box + heading as View) -----
  const custBoxH = 48;
  page.drawRectangle({ x: margin, y: y - custBoxH, width: contentWidth, height: custBoxH, color: greyBg });
  page.drawText('CUSTOMER DETAILS', { x: margin + 6, y: y - 14, size: 8, font: fontBold, color: textMuted });
  page.drawText(`Name: ${asciiOnly(customer.name)}`, { x: margin + 6, y: y - 26, size: 9, font: font, color: textDark });
  page.drawText(`Email: ${asciiOnly(customer.email)}`, { x: margin + 6, y: y - 38, size: 9, font: font, color: textDark });
  page.drawText('Address: -', { x: margin + 260, y: y - 26, size: 9, font: font, color: textDark });
  page.drawText(`Phone: ${asciiOnly(customer.mobile)}`, { x: margin + 260, y: y - 38, size: 9, font: font, color: textDark });
  y -= custBoxH + 14;

  // ----- 4. Cost breakdown table (same columns as View: Item Description, Unit Price, Qty, Total) -----
  const tableWidth = contentWidth;
  const colDesc = margin + 4;
  const colPrice = margin + 300;
  const colQty = margin + 380;
  const colTotal = margin + 430;
  const rowH = 18;
  const headerH = 20;

  page.drawRectangle({ x: margin, y: y - headerH, width: tableWidth, height: headerH, color: greyBg });
  page.drawText('Item Description', { x: colDesc, y: y - 14, size: 9, font: fontBold, color: textDark });
  page.drawText('Unit Price', { x: colPrice, y: y - 14, size: 9, font: fontBold, color: textDark });
  page.drawText('Qty', { x: colQty, y: y - 14, size: 9, font: fontBold, color: textDark });
  page.drawText('Total', { x: colTotal, y: y - 14, size: 9, font: fontBold, color: textDark });
  y -= headerH;

  const subtotalItems = items.reduce((s, i) => s + Number(i.amount || 0), 0);
  items.forEach((i) => {
    const amt = Number(i.amount || 0);
    page.drawLine({ start: { x: margin, y }, end: { x: margin + tableWidth, y }, thickness: 0.25, color: greyBorder });
    page.drawText(asciiOnly(i.description).substring(0, 50), { x: colDesc, y: y - 12, size: 9, font: font, color: textDark });
    page.drawText(pdfAmount(amt), { x: colPrice, y: y - 12, size: 9, font: font, color: textDark });
    page.drawText('1', { x: colQty + 20, y: y - 12, size: 9, font: font, color: textDark });
    page.drawText(pdfAmount(amt), { x: colTotal, y: y - 12, size: 9, font: fontBold, color: textDark });
    y -= rowH;
  });
  page.drawLine({ start: { x: margin, y }, end: { x: margin + tableWidth, y }, thickness: 0.5, color: greyBorder });
  y -= 18;

  // ----- 5. Terms (left) + Price summary (right), same as View -----
  const blockStart = y;
  page.drawText('Terms and Conditions', { x: margin, y, size: 10, font: fontBold, color: textDark });
  y -= 12;
  const termsLines = TERMS_PDF.match(/.{1,62}(\s|$)/g) || [TERMS_PDF];
  termsLines.slice(0, 7).forEach((line) => {
    page.drawText(asciiOnly(line).substring(0, 62), { x: margin, y, size: 8, font: font, color: textMuted });
    y -= 10;
  });

  const summaryH = 88;
  page.drawRectangle({ x: summaryX, y: blockStart - summaryH, width: summaryWidth, height: summaryH, color: greyBg });
  let sy = blockStart - 8;
  page.drawText('Subtotal', { x: summaryX + 8, y: sy, size: 10, font: font, color: textDark });
  page.drawText(pdfAmount(subtotalItems), { x: summaryX + summaryWidth - 70, y: sy, size: 10, font: font, color: textDark });
  sy -= 16;
  page.drawText('Discount', { x: summaryX + 8, y: sy, size: 10, font: font, color: textDark });
  page.drawText(pdfAmount(quotation.discount || 0), { x: summaryX + summaryWidth - 70, y: sy, size: 10, font: font, color: textDark });
  sy -= 16;
  page.drawText(`Tax (${toPdfText(quotation.tax_percent ?? 0)}%)`, { x: summaryX + 8, y: sy, size: 10, font: font, color: textDark });
  page.drawText('-', { x: summaryX + summaryWidth - 70, y: sy, size: 10, font: font, color: textDark });
  sy -= 20;
  page.drawLine({ start: { x: summaryX + 8, y: sy + 4 }, end: { x: summaryX + summaryWidth - 8, y: sy + 4 }, thickness: 0.5, color: greyBorder });
  sy -= 12;
  page.drawText('Grand Total', { x: summaryX + 8, y: sy, size: 12, font: fontBold, color: textDark });
  page.drawText(pdfAmount(quotation.total || 0), { x: summaryX + summaryWidth - 85, y: sy, size: 12, font: fontBold, color: rgb(0.1, 0.45, 0.55) });

  // ----- 6. Customer Acceptance (same grey box as View) -----
  y -= 28;
  const acceptH = 46;
  page.drawRectangle({ x: margin, y: y - acceptH, width: contentWidth, height: acceptH, color: greyBg });
  page.drawText('CUSTOMER ACCEPTANCE', { x: margin + 6, y: y - 14, size: 8, font: fontBold, color: textMuted });
  page.drawText('Signature: _________________    Name: _________________    Date: _________________', { x: margin + 6, y: y - 34, size: 9, font: font, color: textMuted });

  const pdfBytes = await doc.save();
  return Buffer.from(pdfBytes);
}
