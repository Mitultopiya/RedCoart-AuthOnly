import pool from '../config/db.js';

/** Upload UPI QR image; saves to uploads/payment/. If branch_id in body, update branch_settings else company_settings. */
export const uploadQr = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded.' });
    const pathValue = `/uploads/payment/${req.file.filename}`;
    const branchId = req.body?.branch_id != null ? parseInt(req.body.branch_id, 10) : null;
    if (branchId) {
      await pool.query(
        `INSERT INTO branch_settings (branch_id, key, value, updated_at) VALUES ($1, 'upi_qr_path', $2, NOW())
         ON CONFLICT (branch_id, key) DO UPDATE SET value = $2, updated_at = NOW()`,
        [branchId, pathValue]
      );
    } else {
      await pool.query(
        `INSERT INTO company_settings (key, value, updated_at) VALUES ('upi_qr_path', $1, NOW())
         ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`,
        [pathValue]
      );
    }
    const result = await pool.query('SELECT key, value FROM company_settings ORDER BY key');
    const obj = {};
    result.rows.forEach((r) => { obj[r.key] = r.value || ''; });
    if (branchId) {
      const branch = await pool.query('SELECT key, value FROM branch_settings WHERE branch_id = $1 ORDER BY key', [branchId]);
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
    const global = await pool.query('SELECT key, value FROM company_settings ORDER BY key');
    const obj = {};
    global.rows.forEach((r) => { obj[r.key] = r.value || ''; });
    if (branchId) {
      const branch = await pool.query('SELECT key, value FROM branch_settings WHERE branch_id = $1 ORDER BY key', [branchId]);
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
          `INSERT INTO branch_settings (branch_id, key, value, updated_at)
           VALUES ($1, $2, $3, NOW())
           ON CONFLICT (branch_id, key) DO UPDATE SET value = $3, updated_at = NOW()`,
          [id, key, value ?? '']
        );
      }
    } else {
      for (const [key, value] of entries) {
        await pool.query(
          `INSERT INTO company_settings (key, value, updated_at)
           VALUES ($1, $2, NOW())
           ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
          [key, value ?? '']
        );
      }
    }
    const result = await pool.query('SELECT key, value FROM company_settings ORDER BY key');
    const obj = {};
    result.rows.forEach((r) => { obj[r.key] = r.value || ''; });
    if (id) {
      const branch = await pool.query('SELECT key, value FROM branch_settings WHERE branch_id = $1 ORDER BY key', [id]);
      branch.rows.forEach((r) => { obj[r.key] = r.value || ''; });
    }
    res.json(obj);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
};
