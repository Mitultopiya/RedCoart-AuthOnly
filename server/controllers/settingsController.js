import pool from '../config/db.js';
import crypto from 'crypto';

const SMTP_KEYS = ['smtp_host', 'smtp_port', 'smtp_username', 'smtp_password', 'smtp_encryption', 'smtp_from_name', 'smtp_from_email'];

function getCipherKey() {
  const base = String(process.env.SMTP_SECRET || process.env.JWT_SECRET || 'vth-smtp-secret').trim();
  return crypto.createHash('sha256').update(base).digest();
}

function encryptValue(plainText) {
  const text = String(plainText ?? '');
  if (!text) return '';
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getCipherKey(), iv);
  const enc = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `enc:v1:${iv.toString('base64')}:${tag.toString('base64')}:${enc.toString('base64')}`;
}

function decryptValue(value) {
  const text = String(value || '');
  if (!text) return '';
  if (!text.startsWith('enc:v1:')) return text;
  const parts = text.split(':');
  if (parts.length !== 5) return '';
  const iv = Buffer.from(parts[2], 'base64');
  const tag = Buffer.from(parts[3], 'base64');
  const payload = Buffer.from(parts[4], 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', getCipherKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(payload), decipher.final()]).toString('utf8');
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
}

function normalizeEncryption(value) {
  const text = String(value || '').trim().toUpperCase();
  return text === 'SSL' ? 'SSL' : 'TLS';
}

async function readSmtpMap() {
  const result = await pool.query(
    `SELECT \`key\`, value FROM company_settings WHERE \`key\` IN ('smtp_host', 'smtp_port', 'smtp_username', 'smtp_password', 'smtp_encryption', 'smtp_from_name', 'smtp_from_email')`
  );
  const map = {};
  for (const row of result.rows || []) map[row.key] = row.value || '';
  return map;
}

function buildSmtpResponse(map) {
  return {
    smtp_host: String(map.smtp_host || ''),
    smtp_port: String(map.smtp_port || '587'),
    smtp_username: String(map.smtp_username || ''),
    smtp_password: '',
    smtp_password_masked: decryptValue(map.smtp_password) ? '********' : '',
    smtp_encryption: normalizeEncryption(map.smtp_encryption || 'TLS'),
    smtp_from_name: String(map.smtp_from_name || ''),
    smtp_from_email: String(map.smtp_from_email || ''),
  };
}

/** Upload UPI QR image; saves to uploads/payment/. If branch_id in body, update branch_settings else company_settings. */
export const uploadQr = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded.' });
    const pathValue = `/uploads/payment/${req.file.filename}`;
    const branchId = req.body?.branch_id != null ? parseInt(req.body.branch_id, 10) : null;
    if (branchId) {
      await pool.query(
        `INSERT INTO branch_settings (branch_id, \`key\`, value, updated_at) VALUES ($1, 'upi_qr_path', $2, NOW())
         ON DUPLICATE KEY UPDATE value = VALUES(value), updated_at = NOW()`,
        [branchId, pathValue]
      );
    } else {
      await pool.query(
        `INSERT INTO company_settings (\`key\`, value, updated_at) VALUES ('upi_qr_path', $1, NOW())
         ON DUPLICATE KEY UPDATE value = VALUES(value), updated_at = NOW()`,
        [pathValue]
      );
    }
    const result = await pool.query('SELECT `key`, value FROM company_settings ORDER BY `key`');
    const obj = {};
    result.rows.forEach((r) => { obj[r.key] = r.value || ''; });
    if (branchId) {
      const branch = await pool.query('SELECT `key`, value FROM branch_settings WHERE branch_id = $1 ORDER BY `key`', [branchId]);
      branch.rows.forEach((r) => { obj[r.key] = r.value || ''; });
    }
    res.json({ path: pathValue, settings: obj });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
};

/** Return all settings as a flat key→value object. If branch_id query param, merge branch_settings over company_settings. */
export const getSettings = async (req, res) => {
  try {
    const branchId = req.query.branch_id ? parseInt(req.query.branch_id, 10) : null;
    const global = await pool.query('SELECT `key`, value FROM company_settings ORDER BY `key`');
    const obj = {};
    global.rows.forEach((r) => { obj[r.key] = r.value || ''; });
    if (branchId) {
      const branch = await pool.query('SELECT `key`, value FROM branch_settings WHERE branch_id = $1 ORDER BY `key`', [branchId]);
      branch.rows.forEach((r) => { obj[r.key] = r.value || ''; });
    }
    res.json(obj);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
};

/** Upsert multiple settings. If body.branch_id set, write to branch_settings; else company_settings. */
export const updateSettings = async (req, res) => {
  try {
    const { branch_id: branchId, ...rest } = req.body || {};
    const entries = Object.entries(rest);
    if (!entries.length) return res.status(400).json({ message: 'No settings provided.' });
    const id = branchId != null ? parseInt(branchId, 10) : null;
    if (id) {
      for (const [key, value] of entries) {
        await pool.query(
          `INSERT INTO branch_settings (branch_id, \`key\`, value, updated_at)
           VALUES ($1, $2, $3, NOW())
           ON DUPLICATE KEY UPDATE value = VALUES(value), updated_at = NOW()`,
          [id, key, value ?? '']
        );
      }
    } else {
      for (const [key, value] of entries) {
        await pool.query(
          `INSERT INTO company_settings (\`key\`, value, updated_at)
           VALUES ($1, $2, NOW())
           ON DUPLICATE KEY UPDATE value = VALUES(value), updated_at = NOW()`,
          [key, value ?? '']
        );
      }
    }
    const result = await pool.query('SELECT `key`, value FROM company_settings ORDER BY `key`');
    const obj = {};
    result.rows.forEach((r) => { obj[r.key] = r.value || ''; });
    if (id) {
      const branch = await pool.query('SELECT `key`, value FROM branch_settings WHERE branch_id = $1 ORDER BY `key`', [id]);
      branch.rows.forEach((r) => { obj[r.key] = r.value || ''; });
    }
    res.json(obj);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
};

/** Get SMTP settings (password masked). */
export const getSmtpSettings = async (_req, res) => {
  try {
    const map = await readSmtpMap();
    res.json(buildSmtpResponse(map));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
};

/** Save/update SMTP settings with validation and encrypted password storage. */
export const upsertSmtpSettings = async (req, res) => {
  try {
    const current = await readSmtpMap();
    const body = req.body || {};
    const host = String(body.smtp_host ?? current.smtp_host ?? '').trim();
    const port = Number(body.smtp_port ?? current.smtp_port ?? 587);
    const username = String(body.smtp_username ?? current.smtp_username ?? '').trim();
    const fromName = String(body.smtp_from_name ?? current.smtp_from_name ?? '').trim();
    const fromEmail = String(body.smtp_from_email ?? current.smtp_from_email ?? '').trim();
    const encryption = normalizeEncryption(body.smtp_encryption ?? current.smtp_encryption ?? 'TLS');
    const passwordIncoming = String(body.smtp_password ?? '').trim();
    const existingPassword = decryptValue(current.smtp_password || '');
    const finalPassword = passwordIncoming || existingPassword;

    if (!host) return res.status(400).json({ message: 'SMTP Host is required.' });
    if (!Number.isFinite(port) || port < 1 || port > 65535) {
      return res.status(400).json({ message: 'SMTP Port must be between 1 and 65535.' });
    }
    if (!username || !isValidEmail(username)) {
      return res.status(400).json({ message: 'SMTP Email (User) must be a valid email.' });
    }
    if (!finalPassword) return res.status(400).json({ message: 'SMTP Password is required.' });
    if (!fromEmail || !isValidEmail(fromEmail)) {
      return res.status(400).json({ message: 'From Email must be a valid email.' });
    }
    if (!fromName) return res.status(400).json({ message: 'From Name is required.' });

    const data = {
      smtp_host: host,
      smtp_port: String(port),
      smtp_username: username,
      smtp_password: encryptValue(finalPassword),
      smtp_encryption: encryption,
      smtp_from_name: fromName,
      smtp_from_email: fromEmail,
    };

    for (const key of SMTP_KEYS) {
      await pool.query(
        `INSERT INTO company_settings (\`key\`, value, updated_at)
         VALUES ($1, $2, NOW())
         ON DUPLICATE KEY UPDATE value = VALUES(value), updated_at = NOW()`,
        [key, data[key] ?? '']
      );
    }

    const latest = await readSmtpMap();
    res.json(buildSmtpResponse(latest));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
};
